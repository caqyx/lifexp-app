// @ts-check
// The finale "Ostatnia Fala" (docs/v2/PLAN.md 9.1, stage w-2): built in the next step.
import { FINALE_ID } from '../config.js';

/** @type {import('../config.js').SectorDef} */
export const FINALE = { id: FINALE_ID, key: 'finale', tier: 'finale', theme: 'eclipse', groups: [[]], portals: [], fixed: true };

/** @type {import('../geometry.js').SectionData[]} */
export const FINALE_SECTIONS = [];
