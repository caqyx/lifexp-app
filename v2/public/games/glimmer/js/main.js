// @ts-check
// Świetlik (Glimmer), LifeXP's own game (docs/v2/PLAN.md 9.1, gl-1): the page. It wires the
// pure game (js/sim.js) to input, a fixed-step loop, the drawing (js/render.js), the menu,
// pause and game-over panels, the best run and the "fewer effects" setting.
//
// It runs in GameHost's frame on LifeXP's origin, with a CSP that allows only this origin:
// no requests, no inline scripts. It touches only its own localStorage keys (js/records.js).
// Query: ?lang=pl|en (from GameHost); ?test=1 with seed=, hp=, start=, speed= for the
// browser tests (js/i18n.js testParams), which also puts the run's state on the stage.

import { ARENA_SHORT, DT, MAX_STEPS_PER_FRAME } from './config.js';
import { clockText, pickLang, testParams, translator } from './i18n.js';
import { readBest, readSettings, saveBest, saveSettings } from './records.js';
import { consumeEvents, createRenderer, renderFrame, resetRenderer, resizeRenderer } from './render.js';
import { createGame, createInput, updateGame } from './sim.js';

const MAX_PIXEL_RATIO = 3;
/** After the last heart: the burst plays this long before the result card. */
const OVER_DELAY = 0.9;

// ── Setup ────────────────────────────────────────────────────────────────────

/** @param {string} id @returns {HTMLElement} */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

/** localStorage, or null when the browser blocks it. */
function deviceStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function randomSeed() {
  return ((crypto.getRandomValues(new Uint32Array(1))[0] ?? 1) % 999999) + 1;
}

const search = location.search;
const lang = pickLang(search);
const t = translator(lang);
const test = testParams(search);
const storage = deviceStorage();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const dom = {
  app: byId('app'),
  stage: byId('stage'),
  board: /** @type {HTMLCanvasElement} */ (byId('board')),
  play: byId('play-button'),
  best: byId('menu-best'),
  pause: byId('pause'),
  focus: byId('focus'),
  resume: byId('resume'),
  restart: byId('restart'),
  toMenu: byId('to-menu'),
  again: byId('again'),
  overMenu: byId('over-menu'),
  overScore: byId('over-score'),
  overDetail: byId('over-detail'),
  overBest: byId('over-best'),
  newBest: byId('new-best'),
  live: byId('live'),
};

const renderer = createRenderer(dom.board);
const best = readBest(storage);
const settings = readSettings(storage);
const input = createInput();
const keys = new Set();
const state = {
  game: createGame({ width: ARENA_SHORT, height: ARENA_SHORT * 2, seed: 1 }),
  /** 'menu' | 'play' | 'over' (the panels follow it). */
  screen: 'menu',
  paused: false,
  touchFocus: false,
  /** When the last heart went (clock seconds), until the card shows. */
  overAt: /** @type {number | null} */ (null),
  /** The arena on screen: art size and device pixels per art pixel. */
  art: { width: ARENA_SHORT, height: ARENA_SHORT * 2, k: 1 },
  lastHp: 0,
};
const clock = { last: /** @type {number | null} */ (null), time: 0, accumulator: 0, frame: 0 };
/** The finger moving the wisp (relative drag): its id and last position in CSS pixels. */
const drag = { id: /** @type {number | null} */ (null), x: 0, y: 0 };

function applyTexts() {
  document.documentElement.lang = lang;
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-t]')) {
    el.textContent = t(/** @type {import('./i18n.js').TextKey} */ (el.getAttribute('data-t')));
  }
  dom.board.setAttribute('aria-label', t('canvas'));
}

// ── Layout ───────────────────────────────────────────────────────────────────

/**
 * The arena is the whole frame: k whole device pixels per art pixel (the short side about
 * ARENA_SHORT art pixels), and enough art pixels to cover the frame — rounded up, so the
 * canvas is at most one art pixel larger than the frame and, centred, crops less than that
 * on each side: no empty band on any screen. A new shape mid-run resizes the arena too (the
 * wisp stays inside; shots that end up outside fly off as usual).
 */
function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const box = dom.stage.getBoundingClientRect();
  const cssW = box.width || innerWidth;
  const cssH = box.height || innerHeight;
  const devW = Math.max(1, Math.ceil(cssW * dpr - 0.01));
  const devH = Math.max(1, Math.ceil(cssH * dpr - 0.01));
  const k = Math.max(1, Math.floor(Math.min(devW, devH) / ARENA_SHORT));
  const width = Math.max(120, Math.ceil(devW / k));
  const height = Math.max(120, Math.ceil(devH / k));
  if (width !== state.art.width || height !== state.art.height || renderer.canvas.width !== width) resizeRenderer(renderer, width, height);
  state.art = { width, height, k };
  const g = state.game;
  if (g.width !== width || g.height !== height) {
    if (state.screen === 'play') {
      g.width = width;
      g.height = height;
      g.player.x = Math.min(width - 4, Math.max(4, g.player.x));
      g.player.y = Math.min(height - 4, Math.max(4, g.player.y));
    } else {
      state.game = createGame({ width, height, seed: 1 });
      resetRenderer(renderer, state.game);
    }
  }
  // Centred on whole device pixels (crisp), the overflow cropped by the stage.
  const left = Math.floor((devW - width * k) / 2) / dpr;
  const top = Math.floor((devH - height * k) / 2) / dpr;
  dom.stage.style.setProperty('--board-w', `${(width * k) / dpr}px`);
  dom.stage.style.setProperty('--board-h', `${(height * k) / dpr}px`);
  dom.stage.style.setProperty('--board-x', `${left}px`);
  dom.stage.style.setProperty('--board-y', `${top}px`);
  // One art pixel in CSS pixels: the panels' borders are whole art pixels.
  dom.stage.style.setProperty('--px', `${Math.max(1, Math.round(k / dpr))}px`);
}

// ── Screens ──────────────────────────────────────────────────────────────────

function bestText() {
  return best.score > 0 ? t('best', { score: best.score, time: clockText(best.time) }) : t('noBest');
}

function showEffects() {
  for (const el of document.querySelectorAll('[data-fx]')) {
    el.setAttribute('aria-pressed', String((el.getAttribute('data-fx') === 'calm') === settings.calm));
  }
}

/** @param {'menu' | 'play' | 'over'} screen */
function showScreen(screen) {
  state.screen = screen;
  dom.app.dataset.screen = screen;
  dom.best.textContent = bestText();
  if (screen !== 'play') setPaused(false);
}

/** @param {boolean} paused */
function setPaused(paused) {
  if (paused && state.screen !== 'play') return;
  state.paused = paused;
  dom.app.dataset.paused = String(paused);
  dom.pause.setAttribute('aria-pressed', String(paused));
  keys.clear();
  drag.id = null;
  clock.last = null;
  if (paused) dom.resume.focus({ preventScroll: true });
}

function startRun() {
  state.screen = 'play';
  layout();
  const seed = test.seed ?? randomSeed();
  state.game = createGame({ width: state.art.width, height: state.art.height, seed, hp: test.hp ?? undefined, start: test.start ?? 0, pattern: test.pattern ?? undefined });
  resetRenderer(renderer, state.game);
  Object.assign(input, createInput());
  keys.clear();
  drag.id = null;
  state.touchFocus = false;
  dom.focus.setAttribute('aria-pressed', 'false');
  state.overAt = null;
  state.lastHp = state.game.player.hp;
  clock.accumulator = 0;
  clock.last = null;
  showScreen('play');
  dom.live.textContent = `${t('lives')}: ${state.lastHp}`;
  dom.stage.focus({ preventScroll: true });
}

function finishRun() {
  const g = state.game;
  const seconds = g.time - g.startTime;
  const isBest = saveBest(storage, best, g.score, seconds);
  dom.overScore.textContent = t('overScore', { score: g.score });
  dom.overDetail.textContent = t('overDetail', { time: clockText(seconds), grazes: g.grazes });
  dom.overBest.textContent = bestText();
  dom.newBest.hidden = !isBest;
  showScreen('over');
  dom.live.textContent = `${t('over')} ${t('overScore', { score: g.score })}`;
  dom.again.focus({ preventScroll: true });
}

// ── Input ────────────────────────────────────────────────────────────────────

const MOVE_KEYS = /** @type {Record<string, [number, number]>} */ ({
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
});

function readKeys() {
  let mx = 0;
  let my = 0;
  for (const code of keys) {
    const d = MOVE_KEYS[code];
    if (!d) continue;
    mx += d[0];
    my += d[1];
  }
  input.mx = Math.sign(mx);
  input.my = Math.sign(my);
  input.focus = state.touchFocus || keys.has('ShiftLeft') || keys.has('ShiftRight');
}

/** @param {KeyboardEvent} event */
function handleKeyDown(event) {
  const code = event.code;
  if (state.screen === 'play' && (code === 'Space' || code === 'KeyP' || code === 'Escape')) {
    event.preventDefault();
    if (!event.repeat) setPaused(!state.paused);
    return;
  }
  if (state.screen !== 'play' || state.paused) return;
  if (MOVE_KEYS[code] || code === 'ShiftLeft' || code === 'ShiftRight') {
    event.preventDefault();
    keys.add(code);
  }
}

/** @param {KeyboardEvent} event */
function handleKeyUp(event) {
  keys.delete(event.code);
}

/** @param {PointerEvent} event */
function handlePointerDown(event) {
  if (state.screen !== 'play' || state.paused) return;
  if (event.target instanceof HTMLButtonElement) return;
  if (drag.id !== null) return;
  event.preventDefault();
  drag.id = event.pointerId;
  drag.x = event.clientX;
  drag.y = event.clientY;
  try {
    dom.stage.setPointerCapture(event.pointerId);
  } catch {
    // A synthetic pointer (tests): moves still reach the stage.
  }
}

/** @param {PointerEvent} event */
function handlePointerMove(event) {
  if (event.pointerId !== drag.id) return;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  // CSS pixels → art pixels: the wisp follows the finger's movement, wherever the finger is.
  const perArt = state.art.k / dpr;
  input.dragX += (event.clientX - drag.x) / perArt;
  input.dragY += (event.clientY - drag.y) / perArt;
  drag.x = event.clientX;
  drag.y = event.clientY;
}

/** @param {PointerEvent} event */
function handlePointerUp(event) {
  if (event.pointerId === drag.id) drag.id = null;
}

function toggleTouchFocus() {
  state.touchFocus = !state.touchFocus;
  dom.focus.setAttribute('aria-pressed', String(state.touchFocus));
}

function bindInput() {
  addEventListener('keydown', handleKeyDown);
  addEventListener('keyup', handleKeyUp);
  addEventListener('blur', () => keys.clear());
  dom.stage.addEventListener('pointerdown', handlePointerDown);
  dom.stage.addEventListener('pointermove', handlePointerMove);
  dom.stage.addEventListener('pointerup', handlePointerUp);
  dom.stage.addEventListener('pointercancel', handlePointerUp);
  addEventListener('contextmenu', (event) => event.preventDefault());
  dom.play.addEventListener('click', startRun);
  dom.again.addEventListener('click', startRun);
  dom.restart.addEventListener('click', startRun);
  dom.toMenu.addEventListener('click', () => showScreen('menu'));
  dom.overMenu.addEventListener('click', () => showScreen('menu'));
  dom.pause.addEventListener('click', () => setPaused(!state.paused));
  dom.resume.addEventListener('click', () => setPaused(false));
  dom.focus.addEventListener('click', toggleTouchFocus);
  for (const el of document.querySelectorAll('[data-fx]')) {
    el.addEventListener('click', () => {
      settings.calm = el.getAttribute('data-fx') === 'calm';
      saveSettings(storage, settings);
      showEffects();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state.screen === 'play') setPaused(true);
  });
  addEventListener('resize', layout);
  new ResizeObserver(layout).observe(dom.stage);
}

// ── Loop ─────────────────────────────────────────────────────────────────────

/** The run's state on the stage, for the browser tests only (?test=1). */
function writeTestData() {
  const g = state.game;
  const d = dom.stage.dataset;
  d.phase = g.phase;
  d.hp = String(g.player.hp);
  d.score = String(g.score);
  d.time = (g.time - g.startTime).toFixed(2);
  d.shots = String(g.shotCount);
  d.x = g.player.x.toFixed(1);
  d.y = g.player.y.toFixed(1);
  d.grazes = String(g.grazes);
  d.patterns = String(g.patternsStarted);
  d.last = g.lastPattern;
  d.zones = String(g.zones.filter((z) => z.alive).length);
  d.focus = String(g.player.focus);
}

/** @param {number} now */
function frame(now) {
  requestAnimationFrame(frame);
  const seconds = now / 1000;
  const elapsed = clock.last === null ? 0 : Math.min(0.25, seconds - clock.last);
  clock.last = seconds;
  clock.time += elapsed;
  const g = state.game;
  const calm = settings.calm || reducedMotion.matches;
  if (state.screen === 'play' && !state.paused && g.phase === 'play') {
    const speed = test.speed ?? 1;
    clock.accumulator += elapsed * speed;
    let steps = 0;
    while (clock.accumulator >= DT && steps < MAX_STEPS_PER_FRAME * speed) {
      readKeys();
      updateGame(g, input, DT);
      clock.accumulator -= DT;
      steps += 1;
      if (g.phase !== 'play') break;
    }
    if (steps >= MAX_STEPS_PER_FRAME * speed) clock.accumulator = 0;
    consumeEvents(renderer, g, calm);
    if (g.player.hp !== state.lastHp) {
      state.lastHp = g.player.hp;
      dom.live.textContent = `${t('lives')}: ${g.player.hp}`;
    }
    if (g.phase === 'over') state.overAt = clock.time;
  }
  if (state.screen === 'play' && state.overAt !== null && clock.time - state.overAt >= OVER_DELAY / (test.speed ?? 1)) {
    state.overAt = null;
    finishRun();
  }
  renderFrame(renderer, g, { clock: clock.time, calm, playing: state.screen === 'play' });
  clock.frame += 1;
  if (test.on && clock.frame % 4 === 0) writeTestData();
}

// ── Start ────────────────────────────────────────────────────────────────────

applyTexts();
showEffects();
showScreen('menu');
layout();
bindInput();
if (test.on) dom.stage.dataset.test = '1';
requestAnimationFrame(frame);
