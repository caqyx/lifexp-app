// @ts-check
// Test-only pilot (loaded by the page only with ?seed=&autopilot=<k>; docs/v2/PLAN.md 9.1,
// stage f-1): the validator's plan from where the ball or the spider really is, applied
// as the input on every physics step, so the browser test can fly through sections.
// Replans when the plan nears its end, the vehicle drifts from it or the vehicle changes.
import { solveBeam } from '../../_engine/beam.js';
import { runWorld } from '../../_engine/solids.js';
import { STEP, tierOf } from './config.js';
import { stepBody } from './physics.js';
import { FLIP_GRAINS, beamSpec } from './prove.js';
import { pieceAt, sectorAt, speedAt } from './run.js';

/**
 * @typedef {import('./run.js').Run} Run
 * @typedef {import('./physics.js').Body} Body
 * @typedef {{ x0: number, x1: number, speed: number, holds: Int8Array, ys: Float64Array, mode: string | undefined }} Flight
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
  for (const p of run.portals) if (p.x > x + 0.05 && p.x < end) end = p.x - 0.01;
  return end;
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
  const spec = beamSpec(world, body.x, x1, piece.speed, { ...tierOf(piece.tier), minInterval: 0.05 }, body);
  spec.released = !body.held;
  for (const grain of FLIP_GRAINS) {
    const { holds } = solveBeam(spec, { verify: false, grain, bands: [[0.5, 'min'], [0.25, 'min'], [0.05, 'min']] });
    if (!holds) continue;
    const ys = new Float64Array(holds.length);
    /** @type {Body} */
    let s = body;
    holds.forEach((h, i) => {
      s = stepBody(s, h > 0, piece.speed, STEP, world).vehicle;
      ys[i] = s.y;
    });
    return { x0: body.x, x1, speed: piece.speed, holds, ys, mode: body.mode };
  }
  return null;
}

/** @returns {{ advise: (run: Run, body: Body) => boolean }} */
export function createAutopilot() {
  /** @type {Flight | null} */
  let flight = null;
  /** @type {Run | null} */
  let forRun = null;
  return {
    advise(run, body) {
      const at = (/** @type {Flight} */ f) => Math.round((body.x - f.x0) / (f.speed * STEP));
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
