// @ts-check
// The validator's entry point: is an authored section fair at its sector's settings?
// (docs/v2/PLAN.md 9.1, stage w-1). Used by v2/tests/wave-rush.test.ts on every section.
import { JOINT, WAVE, sectionStyle, tierOf, tierSpeed } from './config.js';
import { buildGeometry, capsuleHits, checkSection } from '../../_engine/geometry.js';
import { PORTAL_OFFSET } from './run.js';
import { solveShip } from './ship.js';
import { changesOf, entryHeights, proveFrom, toleranceBand } from './solver.js';

/**
 * @typedef {import('./config.js').SectorDef} SectorDef
 * @typedef {import('../../_engine/geometry.js').SectionData} SectionData
 * @typedef {{ y: number, problem: string | null, changes: number }} EntryResult
 */

/**
 * The states a section of this sector can be flown in: both gravities when the sector
 * has gravity portals; mini only for a section marked `mini` (its portals surround it).
 * @param {SectorDef} sector @param {SectionData} [data]
 */
export function statesOf(sector, data) {
  const gravities = sector.portals.some((p) => p.kind === 'gravity') ? [1, -1] : [1];
  const mini = data?.mini === true;
  return gravities.map((gravity) => ({ gravity: /** @type {1 | -1} */ (gravity), mini }));
}

/**
 * The tier a section flies at: its own (the finale), its Demon band's, or its sector's.
 * @param {SectionData} data @param {SectorDef} sector @param {number} number
 */
export function tierKeyOf(data, sector, number) {
  return data.tier ?? sectionStyle(sector, number).tier;
}

/** The corridor a tier needs everywhere, in cells. @param {string} tier */
export function minGapOf(tier) {
  return tierOf(tier).clearance * 2 * WAVE.radius;
}

/**
 * Proves a section from every entry height across the joint, in one state.
 * @param {SectionData} data @param {string} tier @param {{ gravity: 1 | -1, mini: boolean }} state
 * @param {number} [spacing] between entry heights
 * @returns {EntryResult[]}
 */
export function proveSection(data, tier, state, spacing = 0.5) {
  const g = buildGeometry(data);
  const spec = {
    hits: /** @type {import('./solver.js').HitTest} */ ((x, ya, yb, r, dir, slope) => capsuleHits(g, x, ya, yb, r, dir, slope)),
    x0: 0,
    x1: g.length,
    speed: tierSpeed(tier),
    mini: state.mini,
    limits: tierOf(tier),
    yAnchor: JOINT.ceil,
  };
  const tables = new Map();
  return entryHeights(state.mini, toleranceBand(spec.speed, state.mini, spec.limits.tolerance), spacing).map((y) => {
    const result = proveFrom(spec, y, state.gravity, tables);
    return { y, problem: result.problem, changes: result.plan ? result.plan.changes : -1 };
  });
}

/** Where a ship stretch is proven from: across the joint, flying level (a portal stops it). */
export const SHIP_ENTRIES = [3.6, 4.8, 6, 7.2, 8.4];

/**
 * Proves a ship section from every entry height, from its ship portal on.
 * @param {SectionData} data @param {string} tier
 * @returns {EntryResult[]}
 */
export function proveShipSection(data, tier) {
  const g = buildGeometry(data);
  return SHIP_ENTRIES.map((y) => {
    const result = solveShip({
      hits: (x, ya, yb, r, dir, slope) => capsuleHits(g, x, ya, yb, r, dir, slope),
      x0: PORTAL_OFFSET.ship,
      x1: g.length,
      speed: tierSpeed(tier),
      limits: tierOf(tier),
      gravity: 1,
      y,
      vy: 0,
    });
    return { y, problem: result.problem, changes: result.holds ? changesOf(result.holds).length : -1 };
  });
}

/**
 * Everything wrong with a section (empty = fair): its data, then its proof in every state.
 * @param {SectionData} data @param {SectorDef} sector @param {number} number its number in the sector (1-based)
 */
export function sectionProblems(data, sector, number) {
  const tier = tierKeyOf(data, sector, number);
  const problems = checkSection(data, minGapOf(tier));
  if (problems.length) return problems;
  if (data.mode === 'ship') {
    for (const entry of proveShipSection(data, tier)) if (entry.problem) problems.push(`${data.id} (ship) from y=${entry.y.toFixed(2)}: ${entry.problem}`);
    return problems;
  }
  for (const state of statesOf(sector, data)) {
    for (const entry of proveSection(data, tier, state)) {
      if (entry.problem) problems.push(`${data.id} (gravity ${state.gravity}${state.mini ? ', mini' : ''}) from y=${entry.y.toFixed(2)}: ${entry.problem}`);
    }
  }
  return problems;
}
