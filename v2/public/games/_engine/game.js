// @ts-check
// A Rush game's states (docs/v2/PLAN.md 9.1, stages w-1, w-2 and s-1): ready → playing →
// dead or finished, in two modes, on two levels (the run of sectors 1–6, or the finale).
// Normal: a crash starts a new run (sector 1, section 1, a new shuffle); its result is how
// far it got. Praktyka: a crash restarts at the last checkpoint (the start of the sector,
// or of the section) of the same run; no records. No DOM and no clock: the page feeds the
// input and the fixed steps. Each game brings its levels and its vehicle's flight
// (`GameRules`); everything else here is shared by Wave Rush and Ship Rush.
import { JOINT, RESTART_LOCK } from './world.js';
import { checkpointX, jumpX, locate, pieceAt, progressAt, respawnX, speedAt, stateAt } from './level.js';

/**
 * @typedef {'ready' | 'playing' | 'dead' | 'finished'} Phase
 * @typedef {'normal' | 'practice'} Mode
 * @typedef {'start' | 'sector' | 'tier' | 'section' | 'portal' | 'death' | 'finish' | 'restart'} GameEvent
 *   tier: a new Demon tier began (inside the same sector).
 * @typedef {{ sector: number, section: number, percent: number }} Result
 * @typedef {{ x: number, y: number }} Point
 * @typedef {import('./level.js').Run} Run
 * @typedef {{ x: number, y: number, dir: number, gravity: 1 | -1, mini: boolean, ship: boolean, vy: number,
 *   mode?: import('./geometry.js').VehicleMode, held?: boolean, queued?: boolean, grounded?: boolean, streak?: number, streakFrom?: number, sinceAct?: number,
 *   spentRing?: string, spentPad?: string, burst?: number, burstAt?: { x: number, y: number, type: 'ring' | 'pad', kind: string } }} Vehicle
 *   dir: +1 moving down, −1 moving up (screen y grows downwards); ship: flying the ship,
 *   with vertical speed vy (cells/s; the wave keeps 0 and never uses it); mode: which
 *   vehicle (Flip Rush has more than two); held / queued / grounded: a tapping vehicle's
 *   input and contact (Flip Rush), sinceAct: seconds since its last press acted; streak /
 *   streakFrom: the spider's snap, for drawing; spentRing / spentPad: the last orb and pad
 *   used (each fires once per pass); burst / burstAt: an orb's or pad's flash, for drawing.
 * @typedef {{
 *   mode: Mode, level: 'run' | 'finale', checkpointBy: 'sector' | 'section', rng: () => number,
 *   run: Run, jumped: boolean, rules: GameRules,
 *   phase: Phase, phaseTime: number, time: number,
 *   wave: Vehicle, previous: { x: number, y: number },
 *   trail: Point[], attempt: number, checkpoint: number,
 *   where: { sector: number, section: number }, band: number, result: Result | null, lastPortal: import('./level.js').Portal | null,
 * }} Game
 * @typedef {{ holding: boolean, tap: boolean }} Input
 * @typedef {{
 *   buildRun: (rng: () => number) => Run, buildFinale: () => Run,
 *   step: (vehicle: Vehicle, holding: boolean, speed: number, dt: number, run: Run) => { vehicle: Vehicle, crashed: boolean },
 *   crashed: (run: Run, vehicle: Vehicle) => boolean,
 * }} GameRules
 *   step: one fixed step of flight (crashed: it hit something on the way, e.g. a block's
 *   side); crashed: does the vehicle touch anything where it is now (after portals).
 */

/** @param {number} x @param {number} y @returns {Vehicle} */
export function createVehicle(x, y) {
  return { x, y, dir: 1, gravity: 1, mini: false, ship: false, vy: 0 };
}

/** Where a wave starts its run (the joint corridor's middle). */
export const START_Y = (JOINT.ceil + JOINT.floor) / 2;
/** Trail points further behind the wave than this are dropped. */
const TRAIL_KEEP = 48;

/**
 * Puts the wave at x with the state the run has there.
 * @param {Game} game @param {number} x
 */
function placeWave(game, x) {
  const state = stateAt(game.run, x);
  game.wave = { ...createVehicle(x, START_Y), gravity: state.gravity, mini: state.mini, ship: state.ship, mode: state.mode };
  game.previous = { x, y: START_Y };
  game.trail = [{ x, y: START_Y }];
  game.where = locate(game.run, x);
  game.band = pieceAt(game.run, x).band;
  game.lastPortal = null;
}

/**
 * A new game on its ready screen.
 * @param {GameRules} rules
 * @param {{ rng: () => number, mode: Mode, level?: 'run' | 'finale', checkpointBy?: 'sector' | 'section', jump?: { sector: number, section: number } | null }} options
 *   The finale's practice always uses section checkpoints.
 * @returns {Game}
 */
export function createGame(rules, options) {
  const level = options.level ?? 'run';
  const run = level === 'finale' ? rules.buildFinale() : rules.buildRun(options.rng);
  const target = options.jump ? jumpX(run, options.jump.sector, options.jump.section) : null;
  const start = target === null ? run.startX : respawnX(run, target);
  /** @type {Game} */
  const game = {
    mode: options.mode,
    level,
    checkpointBy: level === 'finale' ? 'section' : (options.checkpointBy ?? 'sector'),
    rng: options.rng,
    run,
    jumped: target !== null,
    rules,
    phase: 'ready',
    phaseTime: 0,
    time: 0,
    wave: createVehicle(start, START_Y),
    previous: { x: start, y: START_Y },
    trail: [],
    attempt: 1,
    checkpoint: target === null ? run.startX : checkpointX(run, target, level === 'finale' ? 'section' : (options.checkpointBy ?? 'sector')),
    where: { sector: 1, section: 1 },
    band: -1,
    result: null,
    lastPortal: null,
  };
  placeWave(game, start);
  return game;
}

/** Does this game keep records? Normal runs from the start only (not practice, not a test jump). @param {Game} game */
export const keepsRecords = (game) => game.mode === 'normal' && !game.jumped;

/** How far the wave is: sector, section and % of the whole run. @param {Game} game @returns {Result} */
export function resultOf(game) {
  const where = locate(game.run, game.wave.x);
  return { sector: where.sector, section: where.section, percent: Math.floor(progressAt(game.run, game.wave.x)) };
}

/**
 * Passing portals between two x: gravity or size changes.
 * @param {Game} game @param {number} from @param {number} to @param {GameEvent[]} events
 */
function passPortals(game, from, to, events) {
  for (const p of game.run.portals) {
    if (p.x <= from || p.x > to) continue;
    if (p.kind === 'gravity') game.wave = { ...game.wave, gravity: p.on ? -1 : 1 };
    else if (p.kind === 'mini') game.wave = { ...game.wave, mini: p.on };
    else game.wave = { ...game.wave, ship: p.on, vy: 0, mode: p.mode ?? (p.on ? 'ship' : 'wave') };
    game.lastPortal = p;
    events.push('portal');
  }
}

/**
 * Sector and section changes: a new sector starts upright and full size; a practice
 * checkpoint moves along.
 * @param {Game} game @param {GameEvent[]} events
 */
function trackPlace(game, events) {
  const where = locate(game.run, game.wave.x);
  if (where.sector !== game.where.sector) {
    game.wave = { ...game.wave, gravity: 1, mini: false };
    events.push('sector');
  }
  const piece = pieceAt(game.run, game.wave.x);
  if (piece.kind === 'section' && piece.band !== game.band) {
    if (where.sector === game.where.sector && piece.band >= 0) events.push('tier');
    game.band = piece.band;
  }
  if (where.sector !== game.where.sector || where.section !== game.where.section) {
    if (piece.kind === 'section') events.push('section');
    game.checkpoint = Math.max(game.checkpoint, checkpointX(game.run, game.wave.x, game.checkpointBy));
  }
  game.where = where;
}

/**
 * Keeps the trail: a point at every change of direction, nothing far behind.
 * @param {Game} game @param {number} previousDir
 */
function trackTrail(game, previousDir) {
  const last = game.trail[game.trail.length - 1];
  if (game.wave.ship) {
    // The ship flies curves: a point every few tenths of a cell.
    if (!last || game.wave.x - last.x > 0.25) game.trail.push({ x: game.wave.x, y: game.wave.y });
  } else if (game.wave.dir !== previousDir) game.trail.push({ x: game.previous.x, y: game.previous.y });
  const behind = game.wave.x - TRAIL_KEEP;
  let drop = 0;
  while (drop < game.trail.length - 2 && /** @type {Point} */ (game.trail[drop + 1]).x < behind) drop += 1;
  if (drop) game.trail.splice(0, drop);
}

/**
 * One fixed step of flight.
 * @param {Game} game @param {boolean} holding @param {number} dt @param {GameEvent[]} events
 */
function fly(game, holding, dt, events) {
  const before = game.wave;
  game.previous = { x: before.x, y: before.y };
  const flown = game.rules.step(before, holding, speedAt(game.run, before.x), dt, game.run);
  game.wave = flown.vehicle;
  passPortals(game, before.x, game.wave.x, events);
  trackPlace(game, events);
  trackTrail(game, before.dir);
  if (flown.crashed || game.rules.crashed(game.run, game.wave)) {
    game.phase = 'dead';
    game.phaseTime = 0;
    game.result = resultOf(game);
    events.push('death');
    return;
  }
  if (game.wave.x >= game.run.finishX) {
    game.phase = 'finished';
    game.phaseTime = 0;
    const last = /** @type {import('./level.js').PlacedSector} */ (game.run.sectors[game.run.sectors.length - 1]);
    game.result = { sector: game.run.sectors.length, section: last.count, percent: 100 };
    events.push('finish');
  }
}

/**
 * After a crash: normal mode builds a new run from the start, practice goes back to the
 * checkpoint of the same run.
 * @param {Game} game
 */
function restart(game) {
  if (game.mode === 'normal') {
    game.run = game.level === 'finale' ? game.rules.buildFinale() : game.rules.buildRun(game.rng);
    game.jumped = false;
    game.checkpoint = game.run.startX;
    placeWave(game, game.run.startX);
  } else {
    placeWave(game, respawnX(game.run, game.checkpoint));
  }
  game.attempt += 1;
  game.result = null;
  game.phase = 'playing';
  game.phaseTime = 0;
}

/**
 * One fixed step of the whole game.
 * @param {Game} game (changed in place) @param {Input} input @param {number} dt
 * @returns {GameEvent[]}
 */
export function stepGame(game, input, dt) {
  /** @type {GameEvent[]} */
  const events = [];
  game.time += dt;
  game.phaseTime += dt;
  if (game.phase === 'ready') {
    if (!input.tap) return events;
    game.phase = 'playing';
    game.phaseTime = 0;
    events.push('start');
  } else if (game.phase === 'dead' || game.phase === 'finished') {
    if (!input.tap || game.phaseTime < RESTART_LOCK) return events;
    restart(game);
    events.push('restart');
  }
  fly(game, input.holding, dt, events);
  return events;
}

/** Is a tap now too early to restart? @param {Game} game */
export function restartLocked(game) {
  return (game.phase === 'dead' || game.phase === 'finished') && game.phaseTime < RESTART_LOCK;
}
