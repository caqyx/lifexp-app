// @ts-check
// Test-only pilot (loaded by main.js only with ?seed=&autopilot=<k>): the solver's plan
// from where the wave really is, applied as the input on every physics step, so the
// browser test can fly through sections. Replans when the plan ends or the wave drifts.
import { STEP, sectorTier } from './config.js';
import { holdFor, waveSlope } from './physics.js';
import { pieceAt, runHits, sectorAt } from './run.js';
import { buildTable, readPlan, rowOf } from './solver.js';

/**
 * @typedef {{ x0: number, x1: number, y0: number, dx: number, dy: number, slope: number, dirs: Int8Array }} Course
 */

const DRIFT = 0.08;

/**
 * The span to plan over: to just past the section ahead, never past the sector's end.
 * @param {import('./run.js').Run} run @param {number} x
 */
function horizon(run, x) {
  const ahead = pieceAt(run, x + 4);
  return Math.min(ahead.x1 + 2, sectorAt(run, x).x1 + 0.5);
}

/**
 * A plan from the wave's state, with a looser band if the full one finds nothing.
 * @param {import('./run.js').Run} run @param {import('./physics.js').Wave} wave
 * @returns {Course | null}
 */
function planCourse(run, wave) {
  const sector = sectorAt(run, wave.x);
  const x1 = horizon(run, wave.x);
  const x0 = wave.x;
  const y0 = wave.y;
  if (x1 - x0 < 0.5) return null;
  for (const band of [1, 0.6, 0.3, 0]) {
    const spec = {
      hits: /** @type {import('./solver.js').HitTest} */ ((x, ya, yb, r, dir, slope) => runHits(run, x, ya, yb, r, dir, slope)),
      x0,
      x1,
      speed: sector.speed,
      mini: wave.mini,
      limits: { ...sectorTier(sector.def), minInterval: 0.08 },
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
function expected(c, x) {
  const i = Math.min(c.dirs.length - 1, Math.max(0, Math.floor((x - c.x0) / c.dx)));
  let y = c.y0;
  for (let k = 0; k < i; k++) y += /** @type {number} */ (c.dirs[k]) * c.dy;
  const dir = /** @type {number} */ (c.dirs[i]);
  return { y: y + dir * (x - (c.x0 + i * c.dx)) * c.slope, dir };
}

/** @returns {{ advise: (run: import('./run.js').Run, wave: import('./physics.js').Wave) => boolean }} */
export function createAutopilot() {
  /** @type {Course | null} */
  let course = null;
  /** @type {import('./run.js').Run | null} */
  let forRun = null;
  return {
    advise(run, wave) {
      const stale =
        !course ||
        forRun !== run ||
        wave.x < course.x0 ||
        wave.x > course.x1 - 1 ||
        wave.mini !== (course.slope !== 1) ||
        Math.abs(expected(course, wave.x).y - wave.y) > DRIFT;
      if (stale) {
        course = planCourse(run, wave);
        forRun = run;
      }
      if (!course) return false;
      // The direction for the step about to be taken.
      const next = Math.min(course.x1 - 0.01, wave.x + sectorAt(run, wave.x).speed * STEP * 0.5);
      return holdFor(expected(course, next).dir, wave.gravity);
    },
  };
}
