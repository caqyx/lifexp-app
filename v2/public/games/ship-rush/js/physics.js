// @ts-check
// The ship's flight (docs/v2/PLAN.md 9.1, stage s-1). Hold: thrust up; release: gravity
// pulls down (the other way round upside down); the vertical speed changes smoothly and is
// capped; the level scrolls at the piece's speed. The mini ship is smaller and lighter: it
// answers the input faster.
//
// The collision rule (owner, stage s-1: "as in the genre"), checked once per fixed step:
// 1. The ship's body is a square (half side `half`). It moves, then every solid box it now
//    overlaps is judged by where the body was the step before:
//    - it was above the box's top (at most SNAP below it): it lands — put back on the top,
//      its downward speed stopped. Resting there and sliding along is free;
//    - it was below the box's underside (at most SNAP above it): it bumps — put back under
//      it, its upward speed stopped. Riding along the ceiling while held is free;
//    - otherwise it came in from the side: a vertical side (a block's, a pillar's, a step
//      of the floor or the ceiling) is a crash.
//    Squeezed between a top and an underside, or still overlapping after being put back:
//    a crash. Leaving the playfield is a crash.
// 2. Hazards (spikes, half-spikes, saws, orbs, mines): a circle inside the body touching
//    any of them is a crash, wherever it comes from.
// There are no slopes in ship terrain (solids.js), so no surface is "almost level".
import { createVehicle } from '../../_engine/game.js';
import { PLAY_H, SNAP, shipKind } from './config.js';

export { advanceClock, isBuffered } from '../../_engine/clock.js';

/**
 * @typedef {import('../../_engine/game.js').Vehicle} Ship
 * @typedef {import('./solids.js').World} World
 * @typedef {import('./solids.js').Solid} Solid
 */

const EPS = 1e-9;

/** A ship at (x, y), flying level. @param {number} x @param {number} y @returns {Ship} */
export function createShip(x, y) {
  return { ...createVehicle(x, y), ship: true };
}

/**
 * Does a body at (x, y) overlap the box (touching does not count)?
 * @param {Solid} s @param {number} x @param {number} y @param {number} half
 */
function overlaps(s, x, y, half) {
  return x + half > s.x0 + EPS && x - half < s.x1 - EPS && y + half > s.y0 + EPS && y - half < s.y1 - EPS;
}

/**
 * Where the body ends up after moving to (x, y) from height `prevY`: put back on the tops
 * it landed on and under the undersides it bumped, or a crash.
 * @param {World} world @param {number} prevY @param {number} x @param {number} y @param {number} half
 * @returns {{ y: number, crash: boolean, landed: boolean, bumped: boolean }}
 */
export function settle(world, prevY, x, y, half) {
  const list = world.solids.get(Math.floor(x)) ?? [];
  let top = Infinity;
  let under = -Infinity;
  for (const s of list) {
    if (!overlaps(s, x, y, half)) continue;
    if (prevY + half <= s.y0 + SNAP) top = Math.min(top, s.y0 - half);
    else if (prevY - half >= s.y1 - SNAP) under = Math.max(under, s.y1 + half);
    else return { y, crash: true, landed: false, bumped: false };
  }
  if (top < under - EPS) return { y, crash: true, landed: true, bumped: true };
  const settled = Math.max(under, Math.min(y, top));
  for (const s of list) if (overlaps(s, x, settled, half)) return { y: settled, crash: true, landed: false, bumped: false };
  return { y: settled, crash: false, landed: settled < y - EPS, bumped: settled > y + EPS };
}

/**
 * One fixed step of the ship in a world.
 * @param {Ship} ship @param {boolean} holding @param {number} speed cells/s @param {number} dt @param {World} world
 * @returns {{ vehicle: Ship, crashed: boolean }}
 */
export function stepShip(ship, holding, speed, dt, world) {
  const kind = shipKind(ship.mini);
  const accel = (holding ? -kind.up : kind.down) * ship.gravity;
  let vy = Math.min(kind.maxV, Math.max(-kind.maxV, ship.vy + accel * dt));
  const x = ship.x + speed * dt;
  const moved = settle(world, ship.y, x, ship.y + vy * dt, kind.half);
  if (moved.landed && vy > 0) vy = 0;
  if (moved.bumped && vy < 0) vy = 0;
  const y = moved.y;
  const vehicle = { ...ship, x, y, vy, dir: vy < 0 ? -1 : 1 };
  const outside = y - kind.half < 0 || y + kind.half > PLAY_H;
  return { vehicle, crashed: moved.crash || outside || world.hazard(x, y, y, kind.radius) };
}

/**
 * The search's "room to spare" (prove.js): no hazard within `band` above or below, and
 * no box's left side (a wall ahead) within the body's width and `band` of its height.
 * Resting on a box whose left side is behind is no danger.
 * @param {World} world @param {Ship} ship @param {number} band
 */
export function roomy(world, ship, band) {
  const kind = shipKind(ship.mini);
  if (world.hazard(ship.x, ship.y - band, ship.y + band, kind.radius)) return false;
  if (band <= 0) return true;
  const list = world.solids.get(Math.floor(ship.x)) ?? [];
  const h = kind.half;
  for (const s of list) {
    if (s.x0 <= ship.x - h + EPS || s.x0 >= ship.x + h - EPS) continue;
    if (ship.y + h + band > s.y0 + EPS && ship.y - h - band < s.y1 - EPS) return false;
  }
  return true;
}
