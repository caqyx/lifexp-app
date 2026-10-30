// @ts-check
// The vehicle's motion (docs/v2/PLAN.md 9.1, stages w-1 and w-2). The wave has no
// horizontal state: the level scrolls at the piece's speed, and the wave only ever goes
// up or down at its slope — up while held, down while released (the other way round
// upside down). The ship (the finale) has a vertical speed instead: holding thrusts it
// up, letting go lets gravity pull it down, smoothly and capped.
import { createVehicle } from '../../_engine/game.js';
import { SHIP, WAVE } from './config.js';

export { advanceClock, isBuffered } from '../../_engine/clock.js';

/** @typedef {import('../../_engine/game.js').Vehicle} Wave */

export const createWave = createVehicle;

/** The hit radius of whatever is flying. @param {Wave} w */
export const hitRadius = (w) => (w.ship ? SHIP.radius : waveRadius(w.mini));

/** @param {boolean} mini */
export const waveRadius = (mini) => (mini ? WAVE.miniRadius : WAVE.radius);
/** @param {boolean} mini */
export const waveSlope = (mini) => (mini ? WAVE.miniSlope : WAVE.slope);

/**
 * Which way the wave goes for this input: holding climbs, unless gravity is flipped.
 * @param {boolean} holding @param {1 | -1} gravity
 */
export function directionFor(holding, gravity) {
  return holding ? -gravity : gravity;
}

/**
 * The input that makes the wave go `dir` (the solver plans in directions).
 * @param {number} dir @param {1 | -1} gravity
 */
export function holdFor(dir, gravity) {
  return dir === -gravity;
}

/**
 * One fixed step: forward at `speed` cells/s, up or down at the slope. No clamping:
 * leaving the playfield is a crash, found by the collision check.
 * @param {Wave} wave @param {boolean} holding @param {number} speed @param {number} dt
 * @returns {Wave}
 */
export function stepWave(wave, holding, speed, dt) {
  if (wave.ship) return stepShip(wave, holding, speed, dt);
  const dir = directionFor(holding, wave.gravity);
  const dx = speed * dt;
  return { ...wave, dir, x: wave.x + dx, y: wave.y + dir * waveSlope(wave.mini) * dx };
}

/**
 * One fixed step of the ship: thrust up while held, gravity down while not (flipped
 * upside down), the vertical speed capped; forward at `speed` as ever.
 * @param {Wave} ship @param {boolean} holding @param {number} speed @param {number} dt
 * @returns {Wave}
 */
export function stepShip(ship, holding, speed, dt) {
  const accel = (holding ? -SHIP.up : SHIP.down) * ship.gravity;
  const vy = Math.min(SHIP.maxV, Math.max(-SHIP.maxV, ship.vy + accel * dt));
  return { ...ship, vy, dir: vy < 0 ? -1 : 1, x: ship.x + speed * dt, y: ship.y + vy * dt };
}
