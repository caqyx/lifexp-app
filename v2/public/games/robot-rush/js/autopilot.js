// @ts-check
// Test-only pilot (loaded by the page only with ?seed=&autopilot=<k>; docs/v2/PLAN.md 9.1,
// stage rr-b, as Flip Rush's): the validator's plan from where the robot really is, applied
// as the input on every physics step, so the tests can run through sections and whole runs.
// Replans when the plan nears its end or the robot drifts from it.
import { solveBeam } from '../../_engine/beam.js';
import { runWorld } from '../../_engine/solids.js';
import { STEP, tierOf } from './config.js';
import { stepRobot } from './physics.js';
import { ROBOT_GRAINS, beamSpec } from './prove.js';
import { pieceAt, sectorAt, speedAt } from './run.js';

/**
 * @typedef {import('./run.js').Run} Run
 * @typedef {import('./physics.js').Robot} Body
 * @typedef {{ x0: number, x1: number, speed: number, holds: Int8Array, ys: Float64Array, xs: Float64Array, mode: string | undefined }} Flight
 *   xs: where each step starts (the speed may change along the way).
 */

const DRIFT = 0.06;
/** A plan is renewed this many cells before it ends. */
const LOOKAHEAD = 8;

/**
 * The span to plan over: past the section a little way ahead, but never past a change of
 * speed or vehicle or the sector's end.
 * @param {Run} run @param {number} x
 */
function horizon(run, x) {
  let end = Math.min(pieceAt(run, x + LOOKAHEAD + 2).x1 + 2, sectorAt(run, x).x1 + 0.5);
  const speed = speedAt(run, x);
  for (const p of run.pieces) if (p.x0 > x && p.x0 < end && p.speed !== speed) end = Math.min(end, p.x0 + 0.5);
  // A section's own gravity flips and speed portals are played through (the plan applies
  // them, so it gets ready for what they do); every other portal ends the plan.
  for (const p of run.portals) if (p.kind !== 'flip' && p.kind !== 'speed' && p.x > x + 1e-6 && p.x < end) end = p.x - 0.01;
  return end;
}

/**
 * The body after the gravity and size portals between `from` and its x (as the game applies them).
 * @param {Run} run @param {number} from @param {Body} body
 * @returns {Body}
 */
function throughPortals(run, from, body) {
  let out = body;
  for (const p of run.portals) {
    if (p.x <= from || p.x > body.x) continue;
    if (p.kind === 'gravity') out = { ...out, gravity: p.on ? -1 : 1 };
    else if (p.kind === 'flip') out = { ...out, gravity: /** @type {1 | -1} */ (-out.gravity) };
    else if (p.kind === 'mini') out = { ...out, mini: p.on };
  }
  return out;
}

/**
 * A plan from the body's state (only flown, not checked against the human limits).
 * @param {Run} run @param {Body} body
 * @returns {Flight | null}
 */
function planFlight(run, body) {
  const piece = pieceAt(run, body.x);
  const x1 = horizon(run, body.x);
  if (x1 - body.x < 0.5) return null;
  const world = runWorld(run);
  // The pilot's presses land exactly when planned: it plans with the real orbs' reach.
  const speed = speedAt(run, body.x);
  const base = beamSpec(world, body.x, x1, speed, { ...tierOf(piece.tier), minInterval: 0.05 }, body);
  /** @type {import('../../_engine/beam.js').BeamSpec} */
  const spec = {
    ...base,
    search: undefined,
    // Speed portals: the plan runs at the speed of each place (stage r-2).
    speedAt: (x) => speedAt(run, x),
    step: (v, holding, dt) => {
      const next = stepRobot(v, holding, speedAt(run, v.x), dt, world);
      return next.crashed ? null : throughPortals(run, v.x, next.vehicle);
    },
  };
  spec.released = !body.held;
  for (const grain of ROBOT_GRAINS) {
    const { holds } = solveBeam(spec, { verify: false, grain, bands: [[0.5, 'min'], [0.25, 'min'], [0.05, 'min'], [0, 'min']] });
    if (!holds) continue;
    const ys = new Float64Array(holds.length);
    const xs = new Float64Array(holds.length);
    /** @type {Body} */
    let s = body;
    holds.forEach((h, i) => {
      xs[i] = s.x;
      s = throughPortals(run, s.x, stepRobot(s, h > 0, speedAt(run, s.x), STEP, world).vehicle);
      ys[i] = s.y;
    });
    return { x0: body.x, x1, speed, holds, ys, xs, mode: body.mode };
  }
  return null;
}

/**
 * The step of a flight the body is at: the last one starting at or before x.
 * @param {{ xs: Float64Array }} f @param {number} x
 */
function stepIndex(f, x) {
  let lo = 0;
  let hi = f.xs.length - 1;
  if (hi < 0 || x < /** @type {number} */ (f.xs[0]) - 1e-6) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (/** @type {number} */ (f.xs[mid]) <= x + 1e-6) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** @returns {{ advise: (run: Run, body: Body) => boolean }} */
export function createAutopilot() {
  /** @type {Flight | null} */
  let flight = null;
  /** @type {Run | null} */
  let forRun = null;
  return {
    advise(run, body) {
      const at = (/** @type {Flight} */ f) => stepIndex(f, body.x);
      const i = flight ? at(flight) : -1;
      const expected = flight && i > 0 ? (flight.ys[i - 1] ?? body.y) : body.y;
      const ending = flight !== null && body.x > flight.x1 - LOOKAHEAD && horizon(run, body.x) > flight.x1 + 0.5;
      if (!flight || forRun !== run || flight.mode !== body.mode || i < 0 || i >= flight.holds.length - 1 || ending || Math.abs(expected - body.y) > DRIFT) {
        flight = planFlight(run, body);
        forRun = run;
      }
      if (!flight) return false;
      return /** @type {number} */ (flight.holds[Math.min(Math.max(0, at(flight)), flight.holds.length - 1)]) > 0;
    },
  };
}
