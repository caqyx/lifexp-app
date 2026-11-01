// @ts-check
// What Wave Rush's level editor offers (docs/v2/PLAN.md 9.1, stage r-3): its tiers, its
// vehicles (the finale's ship stretches too) and the items its sections are made of. The
// wave's validator (solver.js) proves still hazards, so no speed portals, flips or moving
// hazards here; a dark stretch is only drawing.
import { TIERS } from './config.js';

/** @type {import('../../_engine/editor/format.js').Palette} */
export const PALETTE = {
  id: 'wave-rush',
  tiers: Object.keys(TIERS),
  modes: ['wave', 'ship'],
  items: ['spike', 'halfSpike', 'block', 'pillar', 'saw', 'mine', 'orb', 'dark'],
};

/** The editor's item tools, in the order shown. */
export const TOOLS = ['spike', 'block', 'pillar', 'saw', 'mine', 'orb', 'dark'];
