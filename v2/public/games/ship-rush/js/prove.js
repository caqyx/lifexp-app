// @ts-check
// The validator's entry point (docs/v2/PLAN.md 9.1, stage s-1): is an authored Ship Rush
// section fair for a human at its sector's settings? The search and the replays are the
// Rush engine's beam validator (../../_engine/beam.js), flying this game's own physics
// (physics.js) through the section's solids and hazards (solids.js). Used by
// v2/tests/ship-rush.test.ts on every section, in every state the run can fly it in.
import { solveBeam } from '../../_engine/beam.js';
import { capsuleHits, checkSection, widestGapAt } from '../../_engine/geometry.js';
import { entryHeights, proveFrom, toleranceBand } from '../../_engine/solver.js';
import { WAVE } from '../../_engine/wave.js';
import { changesOf } from '../../_engine/limits.js';
import { JOINT, sectionStyle, shipKind, tierOf, tierSpeed } from './config.js';
import { geometryOf } from './run.js';
import { createShip, roomy, stepShip } from './physics.js';
import { sectionWorld } from './solids.js';

/**
 * @typedef {import('./config.js').SectorDef} SectorDef
 * @typedef {import('../../_engine/geometry.js').SectionData} SectionData
 * @typedef {{ gravity: 1 | -1, mini: boolean }} State
 * @typedef {{ y: number, vy: number }} Entry
 * @typedef {{ entry: Entry, problem: string | null, changes: number, holds: Int8Array | null }} EntryResult
 */

/**
 * The states a section of this sector can be flown in: both gravities when the sector
 * has gravity portals; mini only for a section marked `mini` (its portals surround it).
 * @param {SectorDef} sector @param {SectionData} [data]
 * @returns {State[]}
 */
export function statesOf(sector, data) {
  const gravities = sector.portals.some((p) => p.kind === 'gravity') ? [1, -1] : [1];
  const mini = data?.mini === true;
  return gravities.map((gravity) => ({ gravity: /** @type {1 | -1} */ (gravity), mini }));
}

/**
 * The tier a section flies at: its own (a finale's), its Demon band's, or its sector's.
 * @param {SectionData} data @param {SectorDef} sector @param {number} number
 */
export function tierKeyOf(data, sector, number) {
  return data.tier ?? sectionStyle(sector, number).tier;
}

/**
 * The corridor a tier needs everywhere, in cells (clearance × the body's height; the
 * mini ship's body is smaller, so a mini section may be tighter).
 * @param {string} tier @param {boolean} [mini]
 */
export function minGapOf(tier, mini = false) {
  return tierOf(tier).clearance * 2 * shipKind(mini).half;
}

/**
 * Where a section is proven from: anywhere a ship can leave the section before — resting
 * on the joint's floor, under its ceiling (held there), or in the air across the joint,
 * climbing, level or falling.
 * @param {boolean} mini @returns {Entry[]}
 */
export function entriesOf(mini) {
  const half = shipKind(mini).half;
  /** @type {Entry[]} */
  const out = [{ y: JOINT.floor - half, vy: 0 }, { y: JOINT.ceil + half, vy: 0 }];
  for (const y of [3.5, 5, 6.5, 8]) for (const vy of [-4, 0, 4]) out.push({ y, vy });
  return out;
}

/**
 * The narrowest opening of a section: sampled finely, and exactly at every step of the
 * floor and the ceiling and every edge of a hazard (where a step up and a step down at
 * one x leave only their overlap to fly through).
 * @param {SectionData} data
 */
export function narrowestGap(data) {
  const g = geometryOf(data);
  const xs = [...g.ceil.map((p) => p[0]), ...g.floor.map((p) => p[0]), ...g.hazards.flatMap((h) => [/** @type {number} */ (h.bbox[0]), /** @type {number} */ (h.bbox[2])])];
  for (let x = 0; x <= g.length; x += 0.05) xs.push(x);
  let least = Infinity;
  for (const x of xs) if (x >= 0 && x <= g.length) least = Math.min(least, widestGapAt(g, x));
  return least;
}

/**
 * Problems with a section's data for the ship (empty when it is well formed): the
 * engine's checks (joints, spikes on level ground, nothing near the ends, the corridor's
 * height), no slope anywhere, and the opening checked at every step as well.
 * @param {SectionData} data @param {number} minGap
 */
export function checkShipSection(data, minGap) {
  const problems = checkSection(data, minGap);
  if (problems.length) return problems;
  const g = geometryOf(data);
  for (const seg of [...g.ceilSegs, ...g.floorSegs]) {
    if (seg.slope !== null && seg.slope !== 0) problems.push(`${data.id}: a slope at x=${seg.x0} (ship terrain is level runs and steps)`);
  }
  const gap = narrowestGap(data);
  if (gap < minGap - 1e-9) problems.push(`${data.id}: an opening ${gap.toFixed(2)} high (< ${minGap.toFixed(2)})`);
  return problems;
}

/**
 * The search's tries, roomiest first: the room to spare around the ship (cells) and the
 * spacing of its taps (the tier's minimum, or wide enough that the rate cap holds).
 * A ship with momentum strays further on a mistimed tap than the wave, so the search
 * looks for central paths first.
 * @type {[number, 'min' | 'rateSafe'][]}
 */
const TRIES = [[0.7, 'min'], [0.55, 'min'], [0.55, 'rateSafe'], [0.45, 'min'], [0.35, 'min'], [0.25, 'min'], [0.15, 'min'], [0.08, 'min']];
/**
 * How finely the beam keeps states, tried in turn: the coarse one first (quick), then
 * finer ones that keep more alternatives (a path that survives every mistimed tap is
 * there, the coarse beam merged it away).
 * @type {import('../../_engine/beam.js').Grain[]}
 */
export const SHIP_GRAINS = [
  { bucket: 0.25, per: 3, spread: 0.8 },
  { bucket: 0.1, per: 6, spread: 0.3 },
  { bucket: 0.15, per: 4, spread: 0.5 },
];

/**
 * Proves a section from one entry, in one state.
 * @param {SectionData} data @param {string} tier @param {State} state @param {Entry} entry
 * @param {{ verify?: boolean }} [options]
 * @returns {EntryResult}
 */
export function proveEntry(data, tier, state, entry, options = {}) {
  const g = geometryOf(data);
  const world = sectionWorld(g);
  const speed = tierSpeed(tier);
  /** @type {import('../../_engine/beam.js').BeamSpec} */
  const spec = {
    x0: 0,
    x1: g.length,
    speed,
    limits: tierOf(tier),
    start: { ...createShip(0, entry.y), vy: entry.vy, gravity: state.gravity, mini: state.mini },
    step(v, holding, dt) {
      const next = stepShip(v, holding, speed, dt, world);
      return next.crashed ? null : next.vehicle;
    },
    safe: (v, band) => roomy(world, v, band),
  };
  let result = { holds: /** @type {Int8Array | null} */ (null), problem: /** @type {string | null} */ ('no path') };
  for (const grain of SHIP_GRAINS) {
    result = solveBeam(spec, { bands: TRIES, grain, ...options });
    if (result.holds) break;
  }
  return { entry, problem: result.problem, changes: result.holds ? changesOf(result.holds).length : -1, holds: result.holds };
}

/**
 * Everything wrong with a section (empty = fair): its data, then its proof from every
 * entry in every state.
 * @param {SectionData} data @param {SectorDef} sector @param {number} number its number in the sector (1-based)
 */
export function sectionProblems(data, sector, number) {
  const tier = tierKeyOf(data, sector, number);
  if (data.mode === 'wave') return waveProblems(data, tier);
  const problems = checkShipSection(data, minGapOf(tier, data.mini === true));
  if (problems.length) return problems;
  for (const state of statesOf(sector, data)) {
    for (const entry of entriesOf(state.mini)) {
      const result = proveEntry(data, tier, state, entry);
      if (result.problem) problems.push(`${data.id} (gravity ${state.gravity}${state.mini ? ', mini' : ''}) from y=${entry.y.toFixed(2)} vy=${entry.vy}: ${result.problem}`);
    }
  }
  return problems;
}

/**
 * A finale wave stretch: Wave Rush's rules (45° slopes, its corridor checks) and its wave
 * solver (../../_engine/solver.js), from every entry height across the joint.
 * @param {SectionData} data @param {string} tier
 */
export function waveProblems(data, tier) {
  const limits = tierOf(tier);
  const problems = checkSection(data, limits.clearance * 2 * WAVE.radius);
  if (problems.length) return problems;
  const g = geometryOf(data);
  const spec = {
    hits: /** @type {import('../../_engine/solver.js').HitTest} */ ((x, ya, yb, r, dir, slope) => capsuleHits(g, x, ya, yb, r, dir, slope)),
    x0: 0,
    x1: g.length,
    speed: tierSpeed(tier),
    mini: false,
    limits,
    yAnchor: JOINT.ceil,
  };
  const tables = new Map();
  for (const y of entryHeights(false, toleranceBand(spec.speed, false, limits.tolerance))) {
    const result = proveFrom(spec, y, 1, tables);
    if (result.problem) problems.push(`${data.id} (wave) from y=${y.toFixed(2)}: ${result.problem}`);
  }
  return problems;
}

