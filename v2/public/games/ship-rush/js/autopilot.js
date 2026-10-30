// @ts-check
// Test-only pilot (loaded by the page only with ?seed=&autopilot=<k>): the validator's
// plan from where the ship really is, applied as the input on every physics step, so the
// browser test can fly through sections. Replans when the plan runs out or the ship
// drifts from it (docs/v2/PLAN.md 9.1, stage s-1).
import { solveBeam } from '../../_engine/beam.js';
import { STEP, tierOf } from './config.js';
import { roomy, stepShip } from './physics.js';
import { SHIP_GRAINS } from './prove.js';
import { pieceAt, sectorAt, speedAt } from './run.js';
import { runWorld } from './solids.js';

/**
 * @typedef {import('./run.js').Run} Run
 * @typedef {import('./physics.js').Ship} Ship
 * @typedef {{ x0: number, x1: number, speed: number, holds: Int8Array, ys: Float64Array }} Flight
 *   The hold for every physics step, and where the ship should be after it.
 */

const DRIFT = 0.06;
/** A plan is renewed this many cells before it ends, so what lies beyond is seen in time. */
const LOOKAHEAD = 8;

/**
 * The span to plan over: past the section a little way ahead, but never past a change
 * of speed, a portal or the sector's end.
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
 * A plan from the ship's state (only flown, not checked against the human limits).
 * @param {Run} run @param {Ship} ship
 * @returns {Flight | null}
 */
function planFlight(run, ship) {
  const piece = pieceAt(run, ship.x);
  const x1 = horizon(run, ship.x);
  if (x1 - ship.x < 0.5) return null;
  const world = runWorld(run);
  const speed = piece.speed;
  /** @type {import('../../_engine/beam.js').BeamSpec} */
  const spec = {
    x0: ship.x,
    x1,
    speed,
    limits: { ...tierOf(piece.tier), minInterval: 0.05 },
    start: ship,
    step(v, holding, dt) {
      const next = stepShip(v, holding, speed, dt, world);
      return next.crashed ? null : next.vehicle;
    },
    safe: (v, band) => roomy(world, v, band),
  };
  for (const grain of SHIP_GRAINS) {
    const { holds } = solveBeam(spec, { verify: false, grain, bands: [[0.35, 'min'], [0.2, 'min'], [0.05, 'min']] });
    if (!holds) continue;
    const ys = new Float64Array(holds.length);
    /** @type {Ship} */
    let s = ship;
    holds.forEach((h, i) => {
      s = stepShip(s, h > 0, speed, STEP, world).vehicle;
      ys[i] = s.y;
    });
    return { x0: ship.x, x1, speed, holds, ys };
  }
  return null;
}

/** @returns {{ advise: (run: Run, ship: Ship) => boolean }} */
export function createAutopilot() {
  /** @type {Flight | null} */
  let flight = null;
  /** @type {Run | null} */
  let forRun = null;
  return {
    advise(run, ship) {
      const at = (/** @type {Flight} */ f) => Math.round((ship.x - f.x0) / (f.speed * STEP));
      const i = flight ? at(flight) : -1;
      const expected = flight && i > 0 ? (flight.ys[i - 1] ?? ship.y) : ship.y;
      const ending = flight !== null && ship.x > flight.x1 - LOOKAHEAD && horizon(run, ship.x) > flight.x1 + 0.5;
      if (!flight || forRun !== run || i < 0 || i >= flight.holds.length - 1 || ending || Math.abs(expected - ship.y) > DRIFT) {
        flight = planFlight(run, ship);
        forRun = run;
      }
      if (!flight) return false;
      return /** @type {number} */ (flight.holds[Math.min(Math.max(0, at(flight)), flight.holds.length - 1)]) > 0;
    },
  };
}
