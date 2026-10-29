// @ts-check
// Test-only pilot (loaded by main.js only with ?seed=&autopilot=<k>): the solver's plan
// from where the wave really is, applied as the input on every physics step, so the
// browser test can fly through sections. Replans when the plan ends or the wave drifts.
import { STEP, tierOf } from './config.js';
import { holdFor, stepShip, waveSlope } from './physics.js';
import { solveShip } from './ship.js';
import { pieceAt, runHits, sectorAt, speedAt } from './run.js';
import { buildTable, readPlan, rowOf } from './solver.js';

/**
 * @typedef {{ x0: number, x1: number, y0: number, dx: number, dy: number, slope: number, dirs: Int8Array }} Course
 */

const DRIFT = 0.08;

/**
 * The span to plan over: to just past the section ahead, but never past a change of
 * speed (sector or Demon tier), a size portal or the sector's end.
 * @param {import('./run.js').Run} run @param {number} x
 */
function horizon(run, x) {
  let end = Math.min(pieceAt(run, x + 4).x1 + 2, sectorAt(run, x).x1 + 0.5);
  const speed = speedAt(run, x);
  for (const p of run.pieces) if (p.x0 > x && p.x0 < end && p.speed !== speed) end = Math.min(end, p.x0 + 0.5);
  for (const p of run.portals) if (p.kind !== 'gravity' && p.x > x + 0.05 && p.x < end) end = p.x - 0.01;
  return end;
}

/**
 * A plan from the wave's state, with a looser band if the full one finds nothing.
 * @param {import('./run.js').Run} run @param {import('./physics.js').Wave} wave
 * @returns {Course | null}
 */
function planCourse(run, wave) {
  const piece = pieceAt(run, wave.x);
  const x1 = horizon(run, wave.x);
  const x0 = wave.x;
  const y0 = wave.y;
  if (x1 - x0 < 0.5) return null;
  for (const band of [1, 0.6, 0.3, 0]) {
    const spec = {
      hits: /** @type {import('./solver.js').HitTest} */ ((x, ya, yb, r, dir, slope) => runHits(run, x, ya, yb, r, dir, slope)),
      x0,
      x1,
      speed: piece.speed,
      mini: wave.mini,
      limits: { ...tierOf(piece.tier), minInterval: 0.08 },
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

/**
 * @typedef {{ x0: number, x1: number, speed: number, holds: Int8Array, ys: Float64Array }} Flight
 *   A ship plan: the hold for every physics step, and where the ship should be after it.
 */

/**
 * A ship plan from the ship's state (not checked against the human limits: the pilot
 * only has to fly it, exactly).
 * @param {import('./run.js').Run} run @param {import('./physics.js').Wave} ship
 * @returns {Flight | null}
 */
function planFlight(run, ship) {
  const piece = pieceAt(run, ship.x);
  const x1 = horizon(run, ship.x);
  if (x1 - ship.x < 0.5) return null;
  const spec = {
    hits: /** @type {import('./solver.js').HitTest} */ ((x, ya, yb, r, dir, slope) => runHits(run, x, ya, yb, r, dir, slope)),
    x0: ship.x,
    x1,
    speed: piece.speed,
    limits: { ...tierOf(piece.tier), minInterval: 0.05 },
    gravity: ship.gravity,
    y: ship.y,
    vy: ship.vy,
    band: 0.2,
  };
  const { holds } = solveShip(spec, { verify: false });
  if (!holds) return null;
  const ys = new Float64Array(holds.length);
  let s = { ...ship };
  holds.forEach((h, i) => {
    s = stepShip(s, h > 0, piece.speed, STEP);
    ys[i] = s.y;
  });
  return { x0: ship.x, x1, speed: piece.speed, holds, ys };
}

/** @returns {{ advise: (run: import('./run.js').Run, wave: import('./physics.js').Wave) => boolean }} */
export function createAutopilot() {
  /** @type {Course | null} */
  let course = null;
  /** @type {Flight | null} */
  let flight = null;
  /** @type {import('./run.js').Run | null} */
  let forRun = null;
  /**
   * @param {import('./run.js').Run} run @param {import('./physics.js').Wave} ship
   */
  const adviseShip = (run, ship) => {
    const index = flight ? Math.round((ship.x - flight.x0) / (flight.speed * STEP)) : -1;
    const stale = !flight || forRun !== run || index < 0 || index >= flight.holds.length - 1 || Math.abs((index > 0 ? flight.ys[index - 1] ?? ship.y : flight.ys[0] ?? ship.y) - ship.y) > DRIFT;
    if (stale) {
      flight = planFlight(run, ship);
      forRun = run;
      course = null;
    }
    if (!flight) return false;
    const i = Math.max(0, Math.round((ship.x - flight.x0) / (flight.speed * STEP)));
    return /** @type {number} */ (flight.holds[Math.min(i, flight.holds.length - 1)]) > 0;
  };
  return {
    advise(run, wave) {
      if (wave.ship) return adviseShip(run, wave);
      flight = null;
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
      const next = Math.min(course.x1 - 0.01, wave.x + speedAt(run, wave.x) * STEP * 0.5);
      return holdFor(expected(course, next).dir, wave.gravity);
    },
  };
}
