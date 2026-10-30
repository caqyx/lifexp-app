// @ts-check
// The vehicle's motion (docs/v2/PLAN.md 9.1, stages w-1 and w-2). The wave has no
// horizontal state: the level scrolls at the piece's speed, and the wave only ever goes
// up or down at its slope — up while held, down while released (the other way round
// upside down). The ship (the finale) has a vertical speed instead: holding thrusts it
// up, letting go lets gravity pull it down, smoothly and capped.
import { createVehicle } from '../../_engine/game.js';
import { stepWaveOnly, waveRadius } from '../../_engine/wave.js';
import { SHIP } from './config.js';

export { directionFor, holdFor, waveRadius, waveSlope } from '../../_engine/wave.js';

export { advanceClock, isBuffered } from '../../_engine/clock.js';

/** @typedef {import('../../_engine/game.js').Vehicle} Wave */

export const createWave = createVehicle;

/** The hit radius of whatever is flying. @param {Wave} w */
export const hitRadius = (w) => (w.ship ? SHIP.radius : waveRadius(w.mini));

/**
 * One fixed step: forward at `speed` cells/s, up or down at the slope. No clamping:
 * leaving the playfield is a crash, found by the collision check.
 * @param {Wave} wave @param {boolean} holding @param {number} speed @param {number} dt
 * @returns {Wave}
 */
export function stepWave(wave, holding, speed, dt) {
  if (wave.ship) return stepShip(wave, holding, speed, dt);
  return stepWaveOnly(wave, holding, speed, dt);
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
