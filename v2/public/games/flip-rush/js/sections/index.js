// @ts-check
// All authored Flip Rush sections by sector id (docs/v2/PLAN.md 9.1, stages f-1 and f-2). A
// section's number is its position in its sector's list (1-based).
import { SECTOR1 } from './sector1.js';
import { SECTOR2 } from './sector2.js';
import { SECTOR3 } from './sector3.js';
import { SECTOR4 } from './sector4.js';
import { SECTOR5 } from './sector5.js';
import { SECTOR6 } from './sector6.js';
import { FINALE_SECTIONS } from './finale.js';
import { FINALE_ID } from '../config.js';

/** @type {Record<number, import('../../../_engine/geometry.js').SectionData[]>} */
export const SECTION_LIBRARY = { 1: SECTOR1, 2: SECTOR2, 3: SECTOR3, 4: SECTOR4, 5: SECTOR5, 6: SECTOR6, [FINALE_ID]: FINALE_SECTIONS };
