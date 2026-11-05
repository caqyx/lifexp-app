// @ts-check
// What Flip Rush's level editor offers (docs/v2/PLAN.md 9.1, stage r-3): its tiers, the
// ball and the spider, and every item its sections may hold (orbs and pads included;
// inverted controls mean nothing to a tap, so not here).
import { TIERS } from './config.js';

/** @type {import('../../_engine/editor/format.js').Palette} */
export const PALETTE = {
  id: 'flip-rush',
  tiers: Object.keys(TIERS),
  // Every vehicle (stage r-5): the game's own first (`native`); the others fly by their own
  // game's physics (_engine/editor/vehicles.js).
  modes: ['ball', 'spider', 'wave', 'ship', 'robot'],
  native: ['ball', 'spider'],
  moving: true,
  items: ['spike', 'block', 'pillar', 'saw', 'mine', 'ring', 'pad', 'speed', 'portal', 'dark'],
};

/** The editor's item tools, in the order shown. */
export const TOOLS = ['spike', 'block', 'pillar', 'saw', 'mine', 'ring', 'pad', 'speed', 'flip', 'mini', 'big', 'vehicle', 'dark'];
