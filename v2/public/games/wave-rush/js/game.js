// @ts-check
// Wave Rush's states (docs/v2/PLAN.md 9.1, stage w-1): ready → playing → dead or
// finished, in two modes. Normal: a crash starts a new run (sector 1, section 1, a new
// shuffle); its result is how far it got. Praktyka: a crash restarts at the last
// checkpoint (the start of the sector, or of the section) of the same run; no records.
// No DOM and no clock: main.js feeds the input and the fixed steps.
import { JOINT, RESTART_LOCK } from './config.js';
import { createWave, stepWave, waveRadius, waveSlope } from './physics.js';
import {
  buildRun,
  checkpointX,
  jumpX,
  locate,
  pieceAt,
  progressAt,
  respawnX,
  runHits,
  sectorAt,
  stateAt,
} from './run.js';

/**
 * @typedef {'ready' | 'playing' | 'dead' | 'finished'} Phase
 * @typedef {'normal' | 'practice'} Mode
 * @typedef {'start' | 'sector' | 'section' | 'portal' | 'death' | 'finish' | 'restart'} GameEvent
 * @typedef {{ sector: number, section: number, percent: number }} Result
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{
 *   mode: Mode, checkpointBy: 'sector' | 'section', rng: () => number,
 *   run: import('./run.js').Run, jumped: boolean,
 *   phase: Phase, phaseTime: number, time: number,
 *   wave: import('./physics.js').Wave, previous: { x: number, y: number },
 *   trail: Point[], attempt: number, checkpoint: number,
 *   where: { sector: number, section: number }, result: Result | null, lastPortal: import('./run.js').Portal | null,
 * }} Game
 * @typedef {{ holding: boolean, tap: boolean }} Input
 */

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
  game.wave = { ...createWave(x, START_Y), gravity: state.gravity, mini: state.mini };
  game.previous = { x, y: START_Y };
  game.trail = [{ x, y: START_Y }];
  game.where = locate(game.run, x);
  game.lastPortal = null;
}

/**
 * A new game on its ready screen.
 * @param {{ rng: () => number, mode: Mode, checkpointBy?: 'sector' | 'section', jump?: { sector: number, section: number } | null }} options
 * @returns {Game}
 */
export function createGame(options) {
  const run = buildRun(options.rng);
  const target = options.jump ? jumpX(run, options.jump.sector, options.jump.section) : null;
  const start = target === null ? run.startX : respawnX(run, target);
  /** @type {Game} */
  const game = {
    mode: options.mode,
    checkpointBy: options.checkpointBy ?? 'sector',
    rng: options.rng,
    run,
    jumped: target !== null,
    phase: 'ready',
    phaseTime: 0,
    time: 0,
    wave: createWave(start, START_Y),
    previous: { x: start, y: START_Y },
    trail: [],
    attempt: 1,
    checkpoint: target === null ? run.startX : checkpointX(run, target, options.checkpointBy ?? 'sector'),
    where: { sector: 1, section: 1 },
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
    else game.wave = { ...game.wave, mini: p.on };
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
  if (where.sector !== game.where.sector || where.section !== game.where.section) {
    if (pieceAt(game.run, game.wave.x).kind === 'section') events.push('section');
    game.checkpoint = Math.max(game.checkpoint, checkpointX(game.run, game.wave.x, game.checkpointBy));
  }
  game.where = where;
}

/**
 * Keeps the trail: a point at every change of direction, nothing far behind.
 * @param {Game} game @param {number} previousDir
 */
function trackTrail(game, previousDir) {
  if (game.wave.dir !== previousDir) game.trail.push({ x: game.previous.x, y: game.previous.y });
  const behind = game.wave.x - TRAIL_KEEP;
  let drop = 0;
  while (drop < game.trail.length - 2 && /** @type {Point} */ (game.trail[drop + 1]).x < behind) drop += 1;
  if (drop) game.trail.splice(0, drop);
}

/** @param {Game} game */
function crashed(game) {
  const w = game.wave;
  return runHits(game.run, w.x, w.y, w.y, waveRadius(w.mini), w.dir, waveSlope(w.mini));
}

/**
 * One fixed step of flight.
 * @param {Game} game @param {boolean} holding @param {number} dt @param {GameEvent[]} events
 */
function fly(game, holding, dt, events) {
  const before = game.wave;
  game.previous = { x: before.x, y: before.y };
  game.wave = stepWave(before, holding, sectorAt(game.run, before.x).speed, dt);
  passPortals(game, before.x, game.wave.x, events);
  trackPlace(game, events);
  trackTrail(game, before.dir);
  if (crashed(game)) {
    game.phase = 'dead';
    game.phaseTime = 0;
    game.result = resultOf(game);
    events.push('death');
    return;
  }
  if (game.wave.x >= game.run.finishX) {
    game.phase = 'finished';
    game.phaseTime = 0;
    const last = /** @type {import('./run.js').PlacedSector} */ (game.run.sectors[game.run.sectors.length - 1]);
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
    game.run = buildRun(game.rng);
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
