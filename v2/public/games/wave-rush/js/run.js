// @ts-check
// Wave Rush's levels (docs/v2/PLAN.md 9.1, stages w-1 and w-2): the run of sectors 1–6
// and the finale, built by the shared engine (../../_engine/level.js) from this game's
// sectors, sections and tiers. Every section is flown as the wave unless it says `ship`.
import { buildLevel } from '../../_engine/level.js';
import { FINALE_ID, SECTORS, tierSpeed } from './config.js';
import { FINALE, SECTION_LIBRARY } from './sections/index.js';

export {
  END_PAD,
  PORTAL_OFFSET,
  checkpointX,
  geometryOf,
  jumpX,
  locate,
  orderSections,
  padGeometry,
  pieceAt,
  pieceIndexAt,
  placePortals,
  progressAt,
  respawnX,
  runHits,
  sectorAt,
  speedAt,
  stateAt,
} from '../../_engine/level.js';

/**
 * @typedef {import('../../_engine/level.js').Run} Run
 * @typedef {import('../../_engine/level.js').Piece} Piece
 * @typedef {import('../../_engine/level.js').Portal} Portal
 * @typedef {import('../../_engine/level.js').PortalSlot} PortalSlot
 * @typedef {import('../../_engine/level.js').PlacedSector} PlacedSector
 * @typedef {import('./config.js').SectorDef} SectorDef
 * @typedef {import('../../_engine/geometry.js').SectionData} SectionData
 */

/** @type {import('../../_engine/level.js').LevelRules} */
const RULES = { tierSpeed, baseMode: 'wave' };

/**
 * The run: sectors 1–6 (or the given ones).
 * @param {() => number} rng
 * @param {{ sectors?: SectorDef[], library?: Record<number, SectionData[]> }} [options]
 * @returns {Run}
 */
export function buildRun(rng, options = {}) {
  return buildLevel('run', options.sectors ?? SECTORS, options.library ?? SECTION_LIBRARY, rng, RULES);
}

/** The finale: one fixed sequence of ship and wave stretches. @returns {Run} */
export function buildFinale() {
  return buildLevel('finale', [FINALE], { [FINALE_ID]: SECTION_LIBRARY[FINALE_ID] ?? [] }, () => 0, RULES);
}
