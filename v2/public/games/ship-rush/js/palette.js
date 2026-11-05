// @ts-check
// What Ship Rush's level editor offers (docs/v2/PLAN.md 9.1, stage r-3): its tiers, its
// vehicles (the finale's wave stretches too) and every item its sections may hold.
import { TIERS } from './config.js';

/** @type {import('../../_engine/editor/format.js').Palette} */
export const PALETTE = {
  id: 'ship-rush',
  tiers: Object.keys(TIERS),
  // Every vehicle (stage r-5): the game's own first (`native`); the others fly by their own
  // game's physics (_engine/editor/vehicles.js).
  modes: ['ship', 'wave', 'ball', 'spider', 'robot'],
  native: ['ship', 'wave'],
  moving: true,
  items: ['spike', 'halfSpike', 'block', 'pillar', 'saw', 'mine', 'orb', 'speed', 'portal', 'dark', 'invert'],
};

/** The editor's item tools, in the order shown. */
export const TOOLS = ['spike', 'block', 'pillar', 'saw', 'mine', 'orb', 'speed', 'flip', 'mini', 'big', 'vehicle', 'dark', 'invert'];
