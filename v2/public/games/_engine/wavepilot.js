// @ts-check
// The test-only pilot's wave half (docs/v2/PLAN.md 9.1, stages w-1 and s-2), shared by Wave
// Rush and Ship Rush's finale: the wave solver's plan from where the wave really is, read
// as the direction to fly at each x. Each game's autopilot decides when to plan and how
// far ahead.
import { runHits } from './level.js';
import { buildTable, readPlan, rowOf } from './solver.js';
import { holdFor, waveSlope } from './wave.js';
import { STEP } from './world.js';

/**
 * @typedef {{ x0: number, x1: number, y0: number, dx: number, dy: number, slope: number, dirs: Int8Array }} Course
 * @typedef {import('./level.js').Run} Run
 * @typedef {import('./game.js').Vehicle} Vehicle
 */

/**
 * A plan from the wave's state up to x1, with a looser band if the full one finds nothing.
 * @param {Run} run @param {Vehicle} wave @param {number} x1 @param {number} speed
 * @param {{ minInterval: number, tolerance: number, maxRate: number }} limits
 * @returns {Course | null}
 */
export function planCourse(run, wave, x1, speed, limits) {
  const x0 = wave.x;
  const y0 = wave.y;
  if (x1 - x0 < 0.5) return null;
  for (const band of [1, 0.6, 0.3, 0]) {
    const spec = {
      hits: /** @type {import('./solver.js').HitTest} */ ((x, ya, yb, r, dir, slope) => runHits(run, x, ya, yb, r, dir, slope)),
      x0,
      x1,
      speed,
      mini: wave.mini,
      limits: { ...limits, minInterval: 0.08 },
      yAnchor: y0,
      band,
    };
    const table = buildTable(spec);
    const plan = readPlan(table, rowOf(table, y0));
    if (plan) return { x0, x1, y0, dx: table.dx, dy: table.dy, slope: waveSlope(wave.mini), dirs: plan.dirs };
  }
  return null;
}

/**
 * Where the plan expects the wave at x, and the direction it wants there.
 * @param {Course} c @param {number} x
 */
export function expected(c, x) {
  const i = Math.min(c.dirs.length - 1, Math.max(0, Math.floor((x - c.x0) / c.dx)));
  let y = c.y0;
  for (let k = 0; k < i; k++) y += /** @type {number} */ (c.dirs[k]) * c.dy;
  const dir = /** @type {number} */ (c.dirs[i]);
  return { y: y + dir * (x - (c.x0 + i * c.dx)) * c.slope, dir };
}

/**
 * The input for the step about to be taken.
 * @param {Course} c @param {Vehicle} wave @param {number} speed
 */
export function courseHold(c, wave, speed) {
  const next = Math.min(c.x1 - 0.01, wave.x + speed * STEP * 0.5);
  return holdFor(expected(c, next).dir, wave.gravity);
}
