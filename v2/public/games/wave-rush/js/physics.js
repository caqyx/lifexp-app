// @ts-check
// The vehicle's motion (docs/v2/PLAN.md 9.1, stages w-1 and w-2). The wave has no
// horizontal state: the level scrolls at the piece's speed, and the wave only ever goes
// up or down at its slope — up while held, down while released (the other way round
// upside down). The ship (the finale) has a vertical speed instead: holding thrusts it
// up, letting go lets gravity pull it down, smoothly and capped.
import { INPUT_BUFFER_MS, MAX_FRAME, SHIP, STEP, WAVE } from './config.js';

/**
 * @typedef {{ x: number, y: number, dir: number, gravity: 1 | -1, mini: boolean, ship: boolean, vy: number }} Wave
 *   dir: +1 moving down, −1 moving up (screen y grows downwards); ship: flying the ship,
 *   with vertical speed vy (cells/s; the wave keeps 0 and never uses it).
 */

/** @param {number} x @param {number} y @returns {Wave} */
export function createWave(x, y) {
  return { x, y, dir: 1, gravity: 1, mini: false, ship: false, vy: 0 };
}

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

/**
 * Fixed timestep: adds a frame's time to the accumulator and says how many steps to
 * run. A 60, 120 or 144 Hz screen runs the same number of steps per second.
 * @param {number} accumulator @param {number} frameSeconds
 */
export function advanceClock(accumulator, frameSeconds) {
  let acc = accumulator + Math.min(Math.max(frameSeconds, 0), MAX_FRAME);
  let steps = 0;
  while (acc >= STEP - 1e-12) {
    acc -= STEP;
    steps += 1;
  }
  acc = Math.max(0, acc);
  return { steps, accumulator: acc, alpha: acc / STEP };
}

/**
 * Is a tap made at `pressedAt` still waiting to be used at `now`? (milliseconds)
 * @param {number | null} pressedAt @param {number} now
 */
export function isBuffered(pressedAt, now) {
  return pressedAt !== null && now - pressedAt >= 0 && now - pressedAt <= INPUT_BUFFER_MS;
}
