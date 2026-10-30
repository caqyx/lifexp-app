// @ts-check
// The ship's flight (docs/v2/PLAN.md 9.1, stages s-1 and f-0). Hold: thrust up; release:
// gravity pulls down (the other way round upside down); the vertical speed changes
// smoothly and is capped — braking is stronger than speeding up, and the climb is faster
// than the fall (config.js SHIP); the level scrolls at the piece's speed. The mini ship is
// smaller and lighter: it answers the input faster.
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
import { roomyAt, settle as settleBody } from '../../_engine/solids.js';
import { PLAY_H, SNAP, shipKind } from './config.js';

export { advanceClock, isBuffered } from '../../_engine/clock.js';

/**
 * @typedef {import('../../_engine/game.js').Vehicle} Ship
 * @typedef {import('../../_engine/solids.js').World} World
 */

/** A ship at (x, y), flying level. @param {number} x @param {number} y @returns {Ship} */
export function createShip(x, y) {
  return { ...createVehicle(x, y), ship: true };
}

/**
 * Where the ship's body ends up after moving (the engine's rule, with the ship's snap).
 * @param {World} world @param {number} prevY @param {number} x @param {number} y @param {number} half
 */
export function settle(world, prevY, x, y, half) {
  return settleBody(world, prevY, x, y, half, SNAP);
}

/**
 * One fixed step of the ship in a world.
 * @param {Ship} ship @param {boolean} holding @param {number} speed cells/s @param {number} dt @param {World} world
 * @returns {{ vehicle: Ship, crashed: boolean }}
 */
export function stepShip(ship, holding, speed, dt, world) {
  const kind = shipKind(ship.mini);
  // In gravity's frame: positive is falling.
  const fall = ship.vy * ship.gravity;
  const rising = fall <= 0;
  const accel = holding ? -(rising ? kind.upRise : kind.upFall) : rising ? kind.downRise : kind.downFall;
  let vy = Math.min(kind.capDown, Math.max(-kind.capUp, fall + accel * dt)) * ship.gravity;
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
 * The search's "room to spare" (prove.js): the engine's rule for the ship's body.
 * @param {World} world @param {Ship} ship @param {number} band
 */
export function roomy(world, ship, band) {
  const kind = shipKind(ship.mini);
  return roomyAt(world, ship.x, ship.y, kind.half, kind.radius, band);
}
