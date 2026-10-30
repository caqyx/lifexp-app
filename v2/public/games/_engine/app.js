// @ts-check
// The page of a Rush game (docs/v2/PLAN.md 9.1, stages w-1 and s-1): wires a game's pure
// parts (its game rules, levels, records, skins and look) to the page — screens, input,
// the fixed-step loop, drawing, the HUD and pausing while hidden. Wave Rush and Ship Rush
// each call `runApp` from their main.js with what makes them themselves.
//
// It runs in GameHost's frame on LifeXP's origin, with a CSP that allows only this
// origin: no requests, no inline scripts, no audio. It touches only the game's own
// localStorage keys (its records). Query: ?lang=pl|en (from GameHost); ?seed=<n> (tests
// only) makes runs repeatable and exposes the state as data-debug-*; only with a seed,
// ?sector=<n>&section=<m> starts there and ?autopilot=<k> lets the solver fly the first k
// sections of the first attempt (then the vehicle is the player's again).
import { MAX_FRAME, STEP } from './world.js';
import { advanceClock, isBuffered } from './clock.js';
import { createParticles, flashAlpha, ringProgress, shakeOffset, spawnBurst, updateParticles } from './effects.js';
import { createGame, keepsRecords, resultOf, stepGame } from './game.js';
import { pieceAt, progressAt } from './level.js';
import { beatPulse } from './render/backdrop.js';
import { portalColor } from './render/sprites.js';
import { easeAngle, targetAngle } from './render/turn.js';
import { computeView } from './render/view.js';
import { createRng, parseSwitches } from './rng.js';
import { isUnlocked, resolveSkin } from './skins.js';

/**
 * @typedef {import('./game.js').Game} Game
 * @typedef {import('./game.js').GameEvent} GameEvent
 * @typedef {import('./level.js').Run} Run
 * @typedef {import('./game.js').Vehicle} Vehicle
 * @typedef {{ id: string, name: { pl: string, en: string }, body: string, accent: string, trail: string, unlock?: 'demon' }} AppSkin
 * @typedef {(key: string, values?: Record<string, string | number>) => string} Translate
 * @typedef {{
 *   lang: 'pl' | 'en', t: Translate,
 *   sectors: import('./sectors.js').SectorDef[],
 *   rules: import('./game.js').GameRules,
 *   records: import('./records.js').Records,
 *   skins: readonly AppSkin[],
 *   createRenderer: () => import('./render/frame.js').Renderer,
 *   renderFrame: (ctx: CanvasRenderingContext2D, r: import('./render/frame.js').Renderer, s: import('./render/frame.js').Scene) => void,
 *   paintSkin: (ctx: CanvasRenderingContext2D, skin: any) => void,
 *   slopeOf: (vehicle: Vehicle) => number,
 *   loadAutopilot: () => Promise<{ advise: (run: Run, vehicle: Vehicle) => boolean }>,
 *   demon: boolean, finale: boolean, holdTaps?: boolean,
 * }} AppDef
 *   t: the game's translator (every key of APP_TEXT_KEYS, plus sector1..n and the Demon
 *   bands' keys); paintSkin: a skin's preview in a 96 × 64 box (CSS px); slopeOf: the
 *   wave's |dy/dx| now (the icon turns toward it); demon: the run ends with the Demon
 *   sector (finishing it is the achievement that unlocks the last skin and the finale);
 *   finale: the game has its finale level (its box on the menu); holdTaps: a short tap is
 *   held down until the ball or the spider has acted on it (or INPUT_BUFFER_MS passes).
 */

/** The texts the page itself uses (each game's i18n has them all; its tests check). */
export const APP_TEXT_KEYS = [
  'canvas', 'bestValue', 'bestNone', 'finaleLocked', 'finaleBest', 'finaleReady', 'sectorLabel', 'sectionLabel',
  'attempt', 'result', 'tapRespawn', 'tapRestart', 'finaleResult', 'finaleDoneTitle', 'finishedTitle', 'finaleDoneBody',
  'finishedBody', 'achFinale', 'achDemon', 'achFinaleBody', 'achDemonBody', 'unlockSkin', 'unlockFinale', 'gravityFlip',
  'gravityBack', 'shipOn', 'waveOn', 'finaleName', 'selected', 'locked',
];

/**
 * Starts the page.
 * @param {AppDef} def
 */
export function runApp(def) {
  const { lang, t } = def;
  const MAX_PIXEL_RATIO = 2;
  const TOAST_TIME = 1600;

  // ── Setup ────────────────────────────────────────────────────────────────────

  /** @param {string} id @returns {HTMLElement} */
  function byId(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`#${id} missing`);
    return el;
  }

  /** @param {string} id */
  const buttonById = (id) => /** @type {HTMLButtonElement} */ (byId(id));

  function findElements() {
    const board = /** @type {HTMLCanvasElement} */ (byId('board'));
    const ctx = board.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('no 2D canvas');
    return {
      stage: byId('stage'),
      board,
      ctx,
      progress: byId('progress-fill'),
      progressText: byId('progress-text'),
      hudSector: byId('hud-sector'),
      hudAttempt: byId('hud-attempt'),
      toast: byId('toast'),
      menuBest: byId('menu-best'),
      menuAttempts: byId('menu-attempts'),
      play: buttonById('play'),
      practice: buttonById('practice'),
      skinsOpen: buttonById('skins-open'),
      cpSector: buttonById('cp-sector'),
      cpSection: buttonById('cp-section'),
      skinList: byId('skin-list'),
      skinsDone: buttonById('skins-done'),
      deadResult: byId('dead-result'),
      deadHint: byId('dead-hint'),
      deadMenu: buttonById('dead-menu'),
      finishedResult: byId('finished-result'),
      finishedAgain: buttonById('finished-again'),
      finishedMenu: buttonById('finished-menu'),
      achievementNext: buttonById('achievement-next'),
      achievementTitle: byId('achievement-title'),
      achievementBody: byId('achievement-body'),
      achievementUnlocks: byId('achievement-unlocks'),
      finishedTitle: byId('finished-title'),
      finishedBody: byId('finished-body'),
      finaleBox: byId('finale-box'),
      finalePlay: buttonById('finale-play'),
      finalePractice: buttonById('finale-practice'),
      finaleNote: byId('finale-note'),
    };
  }

  function applyTexts() {
    document.documentElement.lang = lang;
    for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.getAttribute('data-t') ?? '');
    byId('board').setAttribute('aria-label', t('canvas'));
  }

  function randomSeed() {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  }

  /** localStorage, or null when the browser blocks it. */
  function deviceStorage() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  const search = location.search;
  const switches = parseSwitches(search);
  const debug = switches.seed !== null;
  const gameRng = createRng(switches.seed ?? randomSeed());
  const effectRng = createRng(randomSeed());
  const storage = deviceStorage();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const dom = findElements();
  const renderer = def.createRenderer();
  const { records } = def;
  /** @type {{ advise: (run: Run, wave: Vehicle) => boolean } | null} */
  let autopilot = null;
  /** The test pilot (?autopilot=k) flies the first k sections of the first attempt, up to this x. */
  const pilot = { sections: switches.autopilot ?? 0, untilX: -Infinity };

  /** @typedef {'menu' | 'skins' | 'ready' | 'playing' | 'dead' | 'finished' | 'achievement' | 'paused'} Screen */

  const state = {
    /** @type {Screen} */
    screen: 'menu',
    game: createGame(def.rules, { rng: gameRng, mode: 'normal', jump: switches.jump }),
    skin: resolveSkin(def.skins, records.readSkin(storage), records.readProgress(storage)),
    checkpointBy: records.readCheckpointBy(storage),
    newBest: false,
  };
  const input = { down: false, pressedAt: /** @type {number | null} */ (null) };
  const particles = createParticles();
  const fx = { deathAt: -10, ring: /** @type {{ x: number, color: string, at: number } | null} */ (null) };
  const clock = { accumulator: 0, last: /** @type {number | null} */ (null), time: 0, frame: 0, running: false, alpha: 1 };
  let view = computeView(innerWidth, innerHeight, Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO));
  let toastTimer = 0;
  /** The icon's drawn angle (render only; null = snap to the flight's angle). */
  const visual = { angle: /** @type {number | null} */ (null) };

  // ── Layout ───────────────────────────────────────────────────────────────────

  function layoutStage() {
    view = computeView(innerWidth, innerHeight, Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO));
    dom.board.width = view.width;
    dom.board.height = view.height;
    dom.stage.classList.toggle('is-portrait', innerHeight > innerWidth);
    // The band's position, for the HUD (CSS pixels).
    dom.stage.style.setProperty('--band-top', `${view.top / view.ratio}px`);
    dom.stage.style.setProperty('--band-h', `${(view.height - view.top * 2) / view.ratio}px`);
  }

  // ── Screens ──────────────────────────────────────────────────────────────────

  /** @param {Screen} screen */
  function show(screen) {
    state.screen = screen;
    dom.stage.dataset.state = screen;
    const focus = { menu: dom.play, skins: dom.skinsDone, finished: dom.finishedAgain, achievement: dom.achievementNext }[/** @type {string} */ (screen)];
    if (focus) focus.focus({ preventScroll: true });
  }

  function sectorName(/** @type {number} */ n) {
    return t(`sector${n}`);
  }

  function updateMenu() {
    const best = records.readBest(storage);
    dom.menuBest.textContent = best ? t('bestValue', best) : t('bestNone');
    dom.finaleBox.hidden = !def.finale;
    const unlocked = def.finale && records.readProgress(storage).demonComplete;
    dom.finalePlay.disabled = !unlocked;
    dom.finalePractice.disabled = !unlocked;
    dom.finaleBox.classList.toggle('is-locked', !unlocked);
    const finaleBest = records.readBest(storage, records.KEYS.finaleBest);
    dom.finaleNote.textContent = !unlocked ? t('finaleLocked') : finaleBest ? `${t('finaleBest')}: ${finaleBest.percent}%` : t('finaleReady');
    dom.menuAttempts.textContent = String(records.readAttempts(storage));
    dom.cpSector.setAttribute('aria-pressed', String(state.checkpointBy === 'sector'));
    dom.cpSection.setAttribute('aria-pressed', String(state.checkpointBy === 'section'));
  }

  /** @param {'normal' | 'practice'} mode @param {'run' | 'finale'} [level] */
  function startGame(mode, level = 'run') {
    if (level === 'finale' && !(def.finale && records.readProgress(storage).demonComplete)) return;
    const jump = level === 'finale' ? (switches.finale ? { sector: 1, section: switches.finale } : null) : switches.jump;
    state.game = createGame(def.rules, { rng: gameRng, mode, level, checkpointBy: state.checkpointBy, jump });
    state.newBest = false;
    dom.stage.classList.toggle('is-practice', mode === 'practice');
    input.pressedAt = null;
    updateHud();
    show('ready');
  }

  function backToMenu() {
    updateMenu();
    show('menu');
  }

  /** @param {string} text */
  function showToast(text) {
    dom.toast.textContent = text;
    dom.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-on'), TOAST_TIME);
  }

  // ── Skins ────────────────────────────────────────────────────────────────────

  /**
   * Draws a skin's preview (the game's look paints it in a 96 × 64 box).
   * @param {HTMLCanvasElement} canvas @param {AppSkin} skin
   */
  function paintSkinPreview(canvas, skin) {
    const ratio = Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO);
    canvas.width = 96 * ratio;
    canvas.height = 64 * ratio;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.scale(ratio, ratio);
    def.paintSkin(ctx, skin);
  }

  function buildSkinList() {
    const progress = records.readProgress(storage);
    dom.skinList.replaceChildren();
    for (const skin of def.skins) {
      const unlocked = isUnlocked(skin, progress);
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'skin';
      button.dataset.skin = skin.id;
      button.disabled = !unlocked;
      button.setAttribute('aria-pressed', String(skin.id === state.skin.id));
      const preview = document.createElement('canvas');
      preview.className = 'skin__preview';
      preview.setAttribute('aria-hidden', 'true');
      paintSkinPreview(preview, skin);
      const name = document.createElement('span');
      name.className = 'skin__name';
      name.textContent = skin.name[lang];
      const note = document.createElement('span');
      note.className = 'skin__note';
      note.textContent = unlocked ? (skin.id === state.skin.id ? t('selected') : '') : t('locked');
      button.append(preview, name, note);
      button.addEventListener('click', () => pickSkin(skin.id));
      item.append(button);
      dom.skinList.append(item);
    }
  }

  /** @param {string} id */
  function pickSkin(id) {
    const skin = def.skins.find((s) => s.id === id);
    if (!skin || !isUnlocked(skin, records.readProgress(storage))) return;
    state.skin = skin;
    records.saveSkin(storage, id);
    buildSkinList();
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  const playing = () => ['ready', 'playing', 'dead', 'finished'].includes(state.screen);

  function pressDown() {
    if (state.screen === 'paused') {
      resumeFromPause();
      return;
    }
    if (!playing()) return;
    input.down = true;
    input.pressedAt = performance.now();
  }

  function pressUp() {
    input.down = false;
  }

  /** @param {PointerEvent} event */
  function handlePointerDown(event) {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button')) return;
    if (!playing() && state.screen !== 'paused') return;
    event.preventDefault();
    pressDown();
  }

  /** @param {KeyboardEvent} event */
  function handleKeyDown(event) {
    if (!['Space', 'ArrowUp', 'KeyW'].includes(event.code)) return;
    if (!playing() && state.screen !== 'paused') return;
    event.preventDefault();
    if (event.repeat) return;
    pressDown();
  }

  /** @param {KeyboardEvent} event */
  function handleKeyUp(event) {
    if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) pressUp();
  }

  function bindInput() {
    dom.stage.addEventListener('pointerdown', handlePointerDown);
    addEventListener('pointerup', pressUp);
    addEventListener('pointercancel', pressUp);
    addEventListener('blur', pressUp);
    addEventListener('keydown', handleKeyDown);
    addEventListener('keyup', handleKeyUp);
    addEventListener('contextmenu', (event) => event.preventDefault());
    dom.play.addEventListener('click', () => startGame('normal'));
    dom.practice.addEventListener('click', () => startGame('practice'));
    dom.skinsOpen.addEventListener('click', () => {
      buildSkinList();
      show('skins');
    });
    dom.skinsDone.addEventListener('click', backToMenu);
    dom.deadMenu.addEventListener('click', backToMenu);
    dom.finishedMenu.addEventListener('click', backToMenu);
    dom.achievementNext.addEventListener('click', () => show('finished'));
    dom.finishedAgain.addEventListener('click', () => startGame(state.game.mode, state.game.level));
    dom.finalePlay.addEventListener('click', () => startGame('normal', 'finale'));
    dom.finalePractice.addEventListener('click', () => startGame('practice', 'finale'));
    for (const [button, by] of /** @type {const} */ ([[dom.cpSector, 'sector'], [dom.cpSection, 'section']])) {
      button.addEventListener('click', () => {
        state.checkpointBy = by;
        records.saveCheckpointBy(storage, by);
        updateMenu();
      });
    }
  }

  // ── Feedback and HUD ─────────────────────────────────────────────────────────

  const reduced = () => reducedMotion.matches;

  /** @param {GameEvent[]} events */
  function reactToEvents(events) {
    const game = state.game;
    for (const event of events) {
      if (event === 'start' || event === 'restart') {
        visual.angle = null;
        records.countAttempt(storage);
        state.newBest = false;
        show('playing');
      }
      if (event === 'start' && pilot.sections > 0) pilot.untilX = pilotEnd(game.run, game.wave.x, pilot.sections);
      if (event === 'death') pilot.sections = 0;
      if (event === 'sector') showToast(t('sectorLabel', { n: game.where.sector, name: sectorName(game.where.sector) }));
      if (event === 'tier') showToast(bandName(game) ?? '');
      if (event === 'portal' && game.lastPortal) {
        const p = game.lastPortal;
        fx.ring = { x: p.x, color: portalColor(p), at: clock.time };
        if (p.kind === 'gravity') showToast(t(p.on ? 'gravityFlip' : 'gravityBack'));
        if (p.kind === 'ship') showToast(t(p.mode ? `${p.mode}On` : p.on ? 'shipOn' : 'waveOn'));
      }
      if (event === 'death') handleDeath();
      if (event === 'finish') handleFinish();
    }
    if (events.length) updateHud();
  }

  function handleDeath() {
    const game = state.game;
    fx.deathAt = clock.time;
    if (!reduced()) spawnBurst(particles, game.wave.x, game.wave.y, [state.skin.body, state.skin.accent, state.skin.trail], effectRng);
    const result = game.result ?? resultOf(game);
    if (keepsRecords(game)) state.newBest = records.saveBest(storage, result).isNew;
    dom.deadResult.textContent = t('result', result);
    dom.deadHint.textContent = t(game.mode === 'practice' ? 'tapRespawn' : 'tapRestart');
    dom.stage.classList.toggle('is-new-best', state.newBest);
    show('dead');
  }

  function handleFinish() {
    const game = state.game;
    const finale = game.level === 'finale';
    const result = game.result ?? resultOf(game);
    if (keepsRecords(game)) state.newBest = records.saveBest(storage, result, finale ? records.KEYS.finaleBest : records.KEYS.best).isNew;
    dom.finishedResult.textContent = finale ? t('finaleResult') : t('result', result);
    dom.finishedTitle.textContent = t(finale ? 'finaleDoneTitle' : 'finishedTitle');
    dom.finishedBody.textContent = t(finale ? 'finaleDoneBody' : 'finishedBody');
    dom.stage.classList.toggle('is-new-best', state.newBest);
    // The whole run (Demon included) and the finale each give an achievement. A level
    // jumped into with the test switches counts only in a test (?seed=); practice never.
    const earned = game.mode === 'normal' && (keepsRecords(game) || debug) && (finale || def.demon);
    if (earned && records.unlock(storage, finale ? 'finaleComplete' : 'demonComplete')) {
      showAchievement(finale);
      return;
    }
    show('finished');
  }

  /**
   * The celebratory screen: the achievement, and what it unlocked.
   * @param {boolean} finale
   */
  function showAchievement(finale) {
    dom.achievementTitle.textContent = t(finale ? 'achFinale' : 'achDemon');
    dom.achievementBody.textContent = t(finale ? 'achFinaleBody' : 'achDemonBody');
    dom.achievementUnlocks.replaceChildren(
      ...(finale ? [] : def.finale ? ['unlockSkin', 'unlockFinale'] : ['unlockSkin']).map((key) => {
        const item = document.createElement('li');
        item.className = 'unlocks__item';
        item.textContent = t(key);
        return item;
      }),
    );
    celebrate();
    show('achievement');
  }

  /** Shards in every skin colour across the screen (not with reduced motion). */
  function celebrate() {
    if (reduced()) return;
    const w = state.game.wave;
    const colors = def.skins.map((s) => s.trail);
    for (let i = 0; i < 3; i++) spawnBurst(particles, w.x - 4 + i * 4, 6, colors, effectRng);
  }

  /**
   * The name of the Demon tier the vehicle is in, or null.
   * @param {Game} game
   */
  function bandName(game) {
    if (game.level === 'finale') return t('finaleName');
    const piece = pieceAt(game.run, game.wave.x);
    const sector = game.run.sectors[piece.sector];
    const band = piece.band >= 0 ? sector?.def.bands?.[piece.band] : null;
    return band ? t(band.key) : null;
  }

  function updateHud() {
    const game = state.game;
    const where = game.where;
    const sector = game.run.sectors[where.sector - 1];
    const band = bandName(game);
    const label = game.level === 'finale' ? t('finaleName') : t('sectorLabel', { n: where.sector, name: band ?? sectorName(where.sector) });
    dom.hudSector.textContent = `${label} · ${t('sectionLabel', { section: where.section, count: sector ? sector.count : 0 })}`;
    dom.hudAttempt.textContent = t('attempt', { n: game.attempt });
  }

  let shownPercent = -1;

  function updateProgress() {
    const percent = Math.floor(progressAt(state.game.run, state.game.wave.x));
    dom.progress.style.setProperty('--progress', String(percent / 100));
    if (percent !== shownPercent) {
      shownPercent = percent;
      dom.progressText.textContent = `${percent}%`;
    }
  }

  /** The state for the browser test only (?seed=). */
  function writeDebug() {
    const game = state.game;
    const w = game.wave;
    const d = dom.stage.dataset;
    d.debugX = w.x.toFixed(2);
    d.debugY = w.y.toFixed(3);
    d.debugDir = String(w.dir);
    d.debugGravity = String(w.gravity);
    d.debugSector = String(game.where.sector);
    d.debugSection = String(game.where.section);
    d.debugAttempt = String(game.attempt);
    d.debugCheckpoint = game.checkpoint.toFixed(2);
    d.debugOrder = game.run.sectors.map((s) => s.order.join('.')).join('|');
    d.debugPortals = game.run.portals.map((p) => `${p.kind}:${p.x.toFixed(1)}:${p.on ? 'on' : 'off'}`).join(',');
    d.debugTier = pieceAt(game.run, w.x).tier;
    d.debugMini = w.mini ? '1' : '0';
    d.debugShip = w.ship ? '1' : '0';
    d.debugMode = w.mode ?? '';
    d.debugPieceMode = pieceAt(game.run, w.x).mode;
    d.debugRing = w.spentRing ?? '';
    d.debugPad = w.spentPad ?? '';
    d.debugLevel = game.level;
    d.debugPilot = piloting() ? '1' : '0';
  }

  // ── Loop ─────────────────────────────────────────────────────────────────────

  /**
   * Where the test pilot lets go: the start of the section k after the first one ahead.
   * @param {Run} run @param {number} x @param {number} k
   */
  function pilotEnd(run, x, k) {
    const first = run.pieces.findIndex((p) => p.kind === 'section' && p.x0 >= x - 0.01);
    return run.pieces[first + k]?.x0 ?? Infinity;
  }

  /** Is the test pilot flying now? */
  function piloting() {
    const game = state.game;
    return autopilot !== null && pilot.sections > 0 && game.phase === 'playing' && game.wave.x < pilot.untilX;
  }

  /** One fixed step: the input, the game, the shards. */
  function runStep() {
    const now = performance.now();
    const tap = isBuffered(input.pressedAt, now);
    const holding = piloting() && autopilot ? autopilot.advise(state.game.run, state.game.wave) : input.down || tap;
    const events = stepGame(state.game, { holding, tap }, STEP);
    if (tap && (events.includes('start') || events.includes('restart'))) input.pressedAt = null;
    if (input.pressedAt !== null && !isBuffered(input.pressedAt, now)) input.pressedAt = null;
    // A press shorter than a step still counts once. For tap vehicles (Flip Rush's ball and
    // spider, which act only on the ground) a short tap is kept until it has acted or the
    // buffer runs out, so a tap just before landing counts.
    const w = state.game.wave;
    const waits = def.holdTaps === true && (w.mode === 'ball' || w.mode === 'spider') && w.sinceAct !== 0;
    if (!input.down && tap && state.game.phase === 'playing' && !waits) input.pressedAt = null;
    clock.time += STEP;
    reactToEvents(events);
    updateParticles(particles, STEP);
  }

  /**
   * The icon's drawn angle: it turns toward the flight's angle by real frame time (the
   * flight itself changes direction instantly). Snaps on a new attempt. Kept with reduced
   * motion: it is a quick, subtle turn, not decoration.
   * @param {number} dt seconds since the last frame
   */
  function turnIcon(dt) {
    const w = state.game.wave;
    const target = targetAngle(w, pieceAt(state.game.run, w.x).speed, def.slopeOf(w));
    visual.angle = visual.angle === null ? target : easeAngle(visual.angle, target, dt);
    return visual.angle;
  }

  /**
   * @param {number} alpha how far between the last two steps this frame is
   * @param {number} dt seconds since the last frame
   */
  function drawFrame(alpha, dt) {
    const game = state.game;
    const angle = turnIcon(dt);
    const calm = reduced();
    const w = game.wave;
    const since = clock.time - fx.deathAt;
    const moving = game.phase === 'playing';
    const ring = fx.ring && !calm ? ringProgress(clock.time - fx.ring.at) : null;
    def.renderFrame(dom.ctx, renderer, {
      view,
      run: game.run,
      wave: {
        x: moving ? game.previous.x + (w.x - game.previous.x) * alpha : w.x,
        y: moving ? game.previous.y + (w.y - game.previous.y) * alpha : w.y,
        dir: w.dir,
        mini: w.mini,
        alive: game.phase !== 'dead',
        flipped: w.gravity === -1,
        ship: w.ship,
        angle,
        thrust: input.down && game.phase === 'playing',
        mode: w.mode,
        grounded: w.grounded,
        streak: w.streak,
        streakFrom: w.streakFrom,
        spentRing: w.spentRing,
        spentPad: w.spentPad,
        burst: w.burst,
        burstAt: w.burstAt,
      },
      trail: game.trail,
      skin: state.skin,
      time: clock.time,
      reduced: calm,
      pulse: beatPulse(clock.time),
      particles,
      shake: calm || game.phase !== 'dead' ? { x: 0, y: 0 } : shakeOffset(since, effectRng),
      flash: calm || game.phase !== 'dead' ? 0 : flashAlpha(since),
      ring: ring !== null && fx.ring ? { x: fx.ring.x, color: fx.ring.color, progress: ring } : null,
    });
  }

  /** @param {number} now */
  function frame(now) {
    clock.frame = requestAnimationFrame(frame);
    const seconds = clock.last === null ? 0 : (now - clock.last) / 1000;
    clock.last = now;
    if (state.screen !== 'paused' && playing()) {
      const tick = advanceClock(clock.accumulator, Math.min(seconds, MAX_FRAME));
      clock.accumulator = tick.accumulator;
      for (let i = 0; i < tick.steps; i++) runStep();
      clock.alpha = tick.alpha;
      updateProgress();
    } else {
      clock.time += Math.min(seconds, MAX_FRAME);
    }
    drawFrame(clock.alpha, Math.min(seconds, MAX_FRAME));
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

  /** Hidden tab or frame: the loop stops, and a run in flight waits for a tap. */
  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      stopLoop();
      if (state.screen === 'playing') show('paused');
      input.down = false;
      input.pressedAt = null;
    } else {
      startLoop();
    }
  }

  function resumeFromPause() {
    clock.accumulator = 0;
    input.pressedAt = null;
    show('playing');
  }

  // ── Start ────────────────────────────────────────────────────────────────────

  /** Fails loudly if a sector has no name in the texts. */
  function checkSectorNames() {
    for (const s of def.sectors) sectorName(s.id);
  }

  applyTexts();
  checkSectorNames();
  layoutStage();
  bindInput();
  addEventListener('resize', layoutStage);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  updateMenu();
  updateHud();
  show('menu');
  startLoop();
  if (debug && pilot.sections > 0) {
    def.loadAutopilot().then((pilotModule) => {
      autopilot = pilotModule;
    });
  }
}
