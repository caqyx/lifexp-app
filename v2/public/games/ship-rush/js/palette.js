// @ts-check
// What Ship Rush's level editor offers (docs/v2/PLAN.md 9.1, stage r-3): its tiers, its
// vehicles (the finale's wave stretches too) and every item its sections may hold.
import { TIERS } from './config.js';

/** @type {import('../../_engine/editor/format.js').Palette} */
export const PALETTE = {
  id: 'ship-rush',
  tiers: Object.keys(TIERS),
  modes: ['ship', 'wave'],
  moving: true,
  items: ['spike', 'halfSpike', 'block', 'pillar', 'saw', 'mine', 'orb', 'speed', 'portal', 'dark', 'invert'],
};

/** The editor's item tools, in the order shown. */
export const TOOLS = ['spike', 'block', 'pillar', 'saw', 'mine', 'orb', 'speed', 'flip', 'mini', 'big', 'dark', 'invert'];
