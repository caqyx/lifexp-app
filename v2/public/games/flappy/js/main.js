// @ts-check
// Flappy Bird, LifeXP's own game (docs/v2/PLAN.md 9.1, stage g-3). This module wires
// the pure parts (logic.js, game.js, effects.js) to the page: input, the fixed-step
// loop, drawing, the HUD, the best score and pausing while hidden.
//
// It runs in GameHost's frame on LifeXP's origin, with a CSP that allows only this
// origin: no requests, no inline scripts. It touches one localStorage key of its own.
// Query: ?lang=pl|en (from GameHost); ?seed=<n> makes the pipes repeatable and puts the
// bird's and the next gap's positions on the stage (data-debug-*), for the browser test.
import { createParticles, flashAlpha, shakeOffset, spawnBurst, updateParticles } from './effects.js';
import { createGame, handlePress, stepGame } from './game.js';
import { translator, pickLang } from './i18n.js';
import {
  BIRD,
  PIPE,
  RESTART_LOCK,
  STEP,
  WORLD_HEIGHT,
  advanceClock,
  createRng,
  fitWorld,
  isBuffered,
  lerp,
  parseSeed,
} from './logic.js';
import { renderFrame } from './render.js';

const BEST_KEY = 'lifexp-flappy-best';
const MAX_PIXEL_RATIO = 3;

// ── Setup ────────────────────────────────────────────────────────────────────

/** @param {string} id @returns {HTMLElement} */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

function findElements() {
  const board = /** @type {HTMLCanvasElement} */ (byId('board'));
  const ctx = board.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('no 2D canvas');
  return {
    stage: byId('stage'),
    board,
    ctx,
    score: byId('score'),
    readyBest: byId('ready-best'),
    overScore: byId('over-score'),
    overBest: byId('over-best'),
    again: byId('again'),
  };
}

/** @param {(key: import('./i18n.js').TextKey) => string} t @param {'pl' | 'en'} lang */
function applyTexts(t, lang) {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) {
    el.textContent = t(/** @type {import('./i18n.js').TextKey} */ (el.getAttribute('data-t')));
  }
  byId('board').setAttribute('aria-label', t('canvas'));
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

function loadBest() {
  try {
    const value = Number.parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** @param {number} best */
function saveBest(best) {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Storage blocked: the record lasts for this visit only.
  }
}

const search = location.search;
const lang = pickLang(search);
const t = translator(lang);
const seed = parseSeed(search);
const debug = seed !== null;
const gameRng = createRng(seed ?? randomSeed());
const effectRng = createRng(randomSeed());
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const dom = findElements();

let game = createGame(fitWorld(innerWidth, innerHeight).width, gameRng, loadBest());
let pressedAt = /** @type {number | null} */ (null);
let previousBirdY = game.bird.y;
const particles = createParticles();
const fx = { flapAt: -10, deathAt: -10 };
const clock = { accumulator: 0, last: /** @type {number | null} */ (null), time: 0, frame: 0, paused: false, running: false };
const view = { scale: 1, pixelScale: 1 };

// ── Layout ───────────────────────────────────────────────────────────────────

/**
 * Sizes the stage to the world (letterboxed when the frame is wider) and the canvas to
 * the device's pixels. A new shape changes the world's width only on the ready screen,
 * never under a game in progress.
 */
function layoutStage() {
  const fit = fitWorld(innerWidth, innerHeight);
  if (game.state === 'ready' && fit.width !== game.width) {
    game = createGame(fit.width, gameRng, game.best);
    previousBirdY = game.bird.y;
  }
  const scale = Math.min(innerWidth / game.width, innerHeight / WORLD_HEIGHT);
  const cssWidth = game.width * scale;
  const cssHeight = WORLD_HEIGHT * scale;
  const ratio = Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO);
  dom.board.width = Math.round(cssWidth * ratio);
  dom.board.height = Math.round(cssHeight * ratio);
  view.scale = scale;
  view.pixelScale = dom.board.width / game.width;
  dom.stage.style.setProperty('--stage-w', `${cssWidth}px`);
  dom.stage.style.setProperty('--stage-h', `${cssHeight}px`);
  dom.stage.style.setProperty('--s', scale.toFixed(4));
  dom.stage.style.setProperty('--t', Math.max(scale, 0.85).toFixed(4));
  dom.stage.classList.toggle('is-boxed', innerWidth - cssWidth > 24 || innerHeight - cssHeight > 24);
}

// ── Input ────────────────────────────────────────────────────────────────────

/** A press is kept with its time and used on the next step (or within the buffer). */
function handlePressInput() {
  if (clock.paused) {
    resumeFromPause();
    return;
  }
  pressedAt = performance.now();
}

/** @param {PointerEvent} event */
function handlePointerDown(event) {
  if (event.button !== 0) return;
  if (event.target instanceof HTMLButtonElement) return;
  event.preventDefault();
  handlePressInput();
}

/** @param {KeyboardEvent} event */
function handleKeyDown(event) {
  if (!['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(event.code)) return;
  event.preventDefault();
  if (event.repeat) return;
  handlePressInput();
}

function handleAgainClick() {
  handlePressInput();
}

function bindInput() {
  dom.stage.addEventListener('pointerdown', handlePointerDown);
  dom.again.addEventListener('click', handleAgainClick);
  addEventListener('keydown', handleKeyDown);
  addEventListener('contextmenu', (event) => event.preventDefault());
}

// ── Feedback and HUD ─────────────────────────────────────────────────────────

const reduced = () => reducedMotion.matches;

function popScore() {
  if (reduced()) return;
  dom.score.animate(
    [{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }],
    { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  );
}

/** @param {import('./game.js').GameEvent[]} events */
function reactToEvents(events) {
  for (const event of events) {
    if (event === 'flap') fx.flapAt = clock.time;
    if (event === 'score') {
      popScore();
      if (!reduced()) spawnBurst(particles, game.bird.x + 4, game.bird.y, effectRng);
    }
    if (event === 'hit') {
      fx.deathAt = clock.time;
      if (game.newBest) saveBest(game.best);
    }
    if (event === 'restart') {
      fx.deathAt = -10;
      previousBirdY = game.bird.y;
    }
  }
  if (events.length) updateHud();
}

function updateHud() {
  const state = clock.paused ? 'paused' : game.state;
  if (dom.stage.dataset.state !== state) dom.stage.dataset.state = state;
  dom.score.textContent = String(game.score);
  dom.readyBest.textContent = String(game.best);
  dom.overScore.textContent = String(game.score);
  dom.overBest.textContent = String(game.best);
  dom.stage.classList.toggle('is-new-best', game.newBest);
}

/** The bird and the gap ahead, for the browser test only (?seed=). */
function writeDebug() {
  const ahead = game.pipes.find((p) => p.x + PIPE.width > game.bird.x - BIRD.radius);
  dom.stage.dataset.debugBirdY = game.bird.y.toFixed(1);
  dom.stage.dataset.debugVy = game.bird.vy.toFixed(1);
  dom.stage.dataset.debugGapY = ahead ? String(ahead.gapY) : '';
}

// ── Loop ─────────────────────────────────────────────────────────────────────

/** The ready screen's bobbing offset: the bird floats around its start. */
function readyBob() {
  return reduced() ? 0 : Math.sin(clock.time * 3.2) * 6;
}

/**
 * The first flap starts from where the bobbing bird is drawn, so it does not jump.
 * @param {import('./game.js').Game} next
 */
function liftOffFromBob(next) {
  return { ...next, bird: { ...next.bird, y: next.bird.y + readyBob() } };
}

/** One fixed step: a buffered press first, then the game, then the sparks. */
function runStep() {
  const now = performance.now();
  if (isBuffered(pressedAt, now)) {
    const wasReady = game.state === 'ready';
    const press = handlePress(game);
    if (press.consumed) {
      pressedAt = null;
      game = wasReady ? liftOffFromBob(press.game) : press.game;
      reactToEvents(press.events);
    }
  } else {
    pressedAt = null;
  }
  previousBirdY = game.bird.y;
  const step = stepGame(game, STEP);
  game = step.game;
  clock.time += STEP;
  reactToEvents(step.events);
  updateParticles(particles, STEP);
  updateAgainButton();
}

/** "Jeszcze raz" waits out the same short lock as a tap, so a frantic tap does not skip the result. */
function updateAgainButton() {
  const locked = game.state !== 'over' || game.stateTime < RESTART_LOCK;
  const button = /** @type {HTMLButtonElement} */ (dom.again);
  if (button.disabled !== locked) button.disabled = locked;
}

/** @param {number} alpha how far between the last two steps this frame is */
function drawFrame(alpha) {
  const lag = game.lastDx * (1 - alpha);
  const since = clock.time - fx.deathAt;
  const calm = reduced();
  const bob = game.state === 'ready' ? readyBob() : 0;
  renderFrame(dom.ctx, view.pixelScale, {
    width: game.width,
    distance: game.distance - lag,
    time: clock.time,
    pipes: game.pipes,
    pipeLag: lag,
    bird: {
      x: game.bird.x,
      y: lerp(previousBirdY, game.bird.y, alpha) + bob,
      vy: game.bird.vy,
      flapSince: clock.time - fx.flapAt,
      time: clock.time,
      alive: game.state === 'ready' || game.state === 'playing',
      tiltOverride: game.state === 'ready' ? 0 : game.state === 'over' ? 1.45 : null,
    },
    particles,
    shake: calm ? { x: 0, y: 0 } : shakeOffset(since, effectRng),
    flash: calm ? 0 : flashAlpha(since),
    reduced: calm,
  });
}

/** @param {number} now */
function frame(now) {
  clock.frame = requestAnimationFrame(frame);
  const seconds = clock.last === null ? 0 : (now - clock.last) / 1000;
  clock.last = now;
  if (clock.paused) {
    drawFrame(1);
    return;
  }
  const tick = advanceClock(clock.accumulator, seconds);
  clock.accumulator = tick.accumulator;
  for (let i = 0; i < tick.steps; i++) runStep();
  drawFrame(tick.alpha);
  if (debug) writeDebug();
}

function startLoop() {
  if (clock.running) return;
  clock.running = true;
  clock.last = null;
  clock.frame = requestAnimationFrame(frame);
}

function stopLoop() {
  if (!clock.running) return;
  clock.running = false;
  cancelAnimationFrame(clock.frame);
}

// ── Pause ────────────────────────────────────────────────────────────────────

/** Hidden tab or frame: the loop stops, and a game in progress waits for a tap. */
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    stopLoop();
    if (game.state === 'playing') clock.paused = true;
    pressedAt = null;
    updateHud();
  } else {
    startLoop();
  }
}

function resumeFromPause() {
  clock.paused = false;
  clock.accumulator = 0;
  pressedAt = null;
  updateHud();
}

// ── Start ────────────────────────────────────────────────────────────────────

applyTexts(t, lang);
layoutStage();
bindInput();
addEventListener('resize', layoutStage);
document.addEventListener('visibilitychange', handleVisibilityChange);
updateHud();
startLoop();
