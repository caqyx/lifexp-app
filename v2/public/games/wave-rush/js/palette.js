// @ts-check
// What Wave Rush's level editor offers (docs/v2/PLAN.md 9.1, stages r-3 and r-5): its
// tiers, every vehicle and the items its sections are made of — every portal too (speed,
// gravity, size, vehicle): the editor's levels are verified by their maker, not by the
// wave's validator. Hazards stay still (the wave's physics has no moving ones in its
// proofs, and none were asked for here); a dark stretch is only drawing.
import { TIERS } from './config.js';

/** @type {import('../../_engine/editor/format.js').Palette} */
export const PALETTE = {
  id: 'wave-rush',
  tiers: Object.keys(TIERS),
  // Every vehicle (stage r-5): the game's own first (`native`); the others fly by their own
  // game's physics (_engine/editor/vehicles.js).
  modes: ['wave', 'ship', 'ball', 'spider', 'robot'],
  native: ['wave', 'ship'],
  items: ['spike', 'halfSpike', 'block', 'pillar', 'saw', 'mine', 'orb', 'speed', 'portal', 'dark'],
};

/** The editor's item tools, in the order shown. */
export const TOOLS = ['spike', 'block', 'pillar', 'saw', 'mine', 'orb', 'speed', 'flip', 'mini', 'big', 'vehicle', 'dark'];
