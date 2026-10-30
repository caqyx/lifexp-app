// @ts-check
// Flip Rush's levels (docs/v2/PLAN.md 9.1, stage f-1): the run of sectors, built by the
// Rush engine (../../_engine/level.js) from this game's sectors, sections and tiers. Each
// section says its vehicle (`ball` or `spider`); a vehicle portal stands in the joint
// wherever the next section is the other one.
import { buildLevel } from '../../_engine/level.js';
import { FINALE, FINALE_ID, SECTORS, tierSpeed } from './config.js';
import { SECTION_LIBRARY } from './sections/index.js';

export {
  END_PAD,
  PORTAL_OFFSET,
  checkpointX,
  geometryOf,
  jumpX,
  locate,
  orderSections,
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
 * @typedef {import('./config.js').SectorDef} SectorDef
 * @typedef {import('../../_engine/geometry.js').SectionData} SectionData
 */

/** @type {import('../../_engine/level.js').LevelRules} */
const RULES = { tierSpeed, baseMode: 'ball' };

/**
 * The run: the sectors in order (or the given ones).
 * @param {() => number} rng
 * @param {{ sectors?: SectorDef[], library?: Record<number, SectionData[]> }} [options]
 * @returns {Run}
 */
export function buildRun(rng, options = {}) {
  return buildLevel('run', options.sectors ?? SECTORS, options.library ?? SECTION_LIBRARY, rng, RULES);
}

/** The finale: one fixed sequence of ball and spider stretches. @returns {Run} */
export function buildFinale() {
  return buildLevel('finale', [FINALE], { [FINALE_ID]: SECTION_LIBRARY[FINALE_ID] ?? [] }, () => 0, RULES);
}
