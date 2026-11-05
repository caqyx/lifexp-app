// @ts-check
// What Robot Rush's level editor offers (docs/v2/PLAN.md 9.1, stage rr-b): its tiers, every
// vehicle (the robot first) and every item its sections may hold (orbs and pads included;
// inverted controls mean nothing to a jump, so not here).
import { TIERS } from './config.js';

/** @type {import('../../_engine/editor/format.js').Palette} */
export const PALETTE = {
  id: 'robot-rush',
  tiers: Object.keys(TIERS),
  // Every vehicle: the game's own first (`native`); the others fly by their own game's
  // physics (_engine/editor/vehicles.js).
  modes: ['robot', 'wave', 'ship', 'ball', 'spider'],
  native: ['robot'],
  moving: true,
  items: ['spike', 'block', 'pillar', 'saw', 'mine', 'ring', 'pad', 'speed', 'portal', 'dark'],
};

/** The editor's item tools, in the order shown. */
export const TOOLS = ['spike', 'block', 'pillar', 'saw', 'mine', 'ring', 'pad', 'speed', 'flip', 'mini', 'big', 'vehicle', 'dark'];
