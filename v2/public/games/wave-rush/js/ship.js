// @ts-check
// The validator for the ship (docs/v2/PLAN.md 9.1, stage w-2): the finale's ship
// stretches must be flyable by a human, under the same rules as the wave's sections.
// The search and the replays are the shared beam validator (../../_engine/beam.js); here
// is the finale ship's flight: physics.js, and any touch of the hit circle is a crash
// (the touch test of the search sweeps it over a small vertical band for room to spare).
import { replayBeam, solveBeam, verifyBeam } from '../../_engine/beam.js';
import { SHIP } from './config.js';
import { createWave, stepShip } from './physics.js';

/**
 * @typedef {import('./solver.js').HitTest} HitTest
 * @typedef {import('./solver.js').Limits} Limits
 * @typedef {{ hits: HitTest, x0: number, x1: number, speed: number, limits: Limits, gravity: 1 | -1, y: number, vy: number, band?: number }} ShipSpec
 */

/**
 * The finale ship as the beam validator sees it.
 * @param {ShipSpec} spec @returns {import('../../_engine/beam.js').BeamSpec}
 */
function beamSpec(spec) {
  return {
    x0: spec.x0,
    x1: spec.x1,
    speed: spec.speed,
    limits: spec.limits,
    band: spec.band,
    start: { ...createWave(spec.x0, spec.y), ship: true, vy: spec.vy, gravity: spec.gravity },
    step(v, holding, dt) {
      const next = stepShip(v, holding, spec.speed, dt);
      return spec.hits(next.x, next.y, next.y, SHIP.radius, 0, 0) ? null : next;
    },
    safe: (v, band) => !spec.hits(v.x, v.y - band, v.y + band, SHIP.radius, 0, 0),
  };
}

/** Flies holds through the game's ship physics; true when it survives. @param {ShipSpec} spec @param {Int8Array} holds */
export function replayShip(spec, holds) {
  return replayBeam(beamSpec(spec), holds);
}

/**
 * Checks holds against all the human limits by replaying them.
 * @param {ShipSpec} spec @param {Int8Array} holds
 * @returns {string | null} what failed, or null
 */
export function verifyShip(spec, holds) {
  return verifyBeam(beamSpec(spec), holds);
}

/**
 * Searches a path that keeps every limit.
 * @param {ShipSpec} spec @param {{ verify?: boolean, tries?: number }} [options] verify: false for the pilot
 * @returns {{ holds: Int8Array | null, problem: string | null }}
 */
export function solveShip(spec, options = {}) {
  return solveBeam(beamSpec(spec), options);
}
