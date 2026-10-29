// @ts-check
// All authored sections by sector id (docs/v2/PLAN.md 9.1, stage w-1). A section's
// number is its position in its sector's list (1-based): the sector's groups refer to it.
import { SECTOR1 } from './sector1.js';
import { SECTOR2 } from './sector2.js';
import { SECTOR3 } from './sector3.js';

/** @type {Record<number, import('../geometry.js').SectionData[]>} */
export const SECTION_LIBRARY = { 1: SECTOR1, 2: SECTOR2, 3: SECTOR3 };
