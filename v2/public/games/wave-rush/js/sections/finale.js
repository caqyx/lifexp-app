// @ts-check
// The finale "Ostatnia Fala" (docs/v2/PLAN.md 9.1, stage w-2): an original level,
// unlocked by finishing the Demon, the hardest content in the game. A fixed sequence
// (never shuffled) that alternates wave and ship stretches, with a portal at every
// change of vehicle. Wave stretches fly at the Extreme Demon tier and its limits; ship
// stretches at the "finale" tier, proven by the ship validator (ship.js).
import { FINALE_ID } from '../config.js';
import { join, open, room, tunnel } from './kit.js';

/** @type {import('../config.js').SectorDef} */
export const FINALE = { id: FINALE_ID, key: 'finale', tier: 'finale', theme: 'eclipse', groups: [[1, 2, 3, 4, 5, 6, 7, 8, 9]], portals: [], fixed: true };

const W = 'extremeDemon';
const S = 'finale';

const w3 = join(tunnel({ gap: 3, legs: [3, -4, 4, -3], tail: 2 }), room({ lead: 2, top: 1, bottom: 11, inner: 12 }), tunnel({ lead: 2, gap: 3, legs: [-3, 3, -4, 4] }));
const w9 = join(tunnel({ gap: 3, legs: [4, -4, 3, -3, 4, -4], tail: 2 }), open(3), tunnel({ lead: 2, gap: 3, legs: [-4, 4, -3, 3, -4, 4, -3, 3] }));

/** @type {import('../geometry.js').SectionData[]} */
export const FINALE_SECTIONS = [
  { id: 'f1', tier: W, ...tunnel({ gap: 3, legs: [3, -3, 4, -4, 3, -3, 4, -4] }), hazards: [] },
  {
    id: 'f2',
    tier: S,
    mode: 'ship',
    ...room({ lead: 3, top: 1, bottom: 11, inner: 36 }),
    hazards: [
      { type: 'pillar', x: 10, on: 'floor', h: 4.2 },
      { type: 'spike', x: 10, y: 6.8, dir: 'up' },
      { type: 'pillar', x: 19, on: 'ceil', h: 4.2 },
      { type: 'spike', x: 19, y: 5.2, dir: 'down' },
      { type: 'pillar', x: 28, on: 'floor', h: 4.2 },
      { type: 'spike', x: 28, y: 6.8, dir: 'up' },
      { type: 'orb', x: 36, y: 3.4, r: 1, chain: true },
    ],
  },
  { id: 'f3', tier: W, ...w3, hazards: [{ type: 'orb', x: /** @type {number} */ (w3.at[1]) + 6, y: 8.4, r: 1.05 }, { type: 'orb', x: /** @type {number} */ (w3.at[1]) + 10.5, y: 3.6, r: 1.05, chain: true }, { type: 'orb', x: /** @type {number} */ (w3.at[1]) + 15, y: 8.4, r: 1.05 }] },
  {
    id: 'f4',
    tier: S,
    mode: 'ship',
    ...room({ lead: 3, top: 1, bottom: 11, inner: 38 }),
    hazards: [
      { type: 'saw', x: 10, y: 9.3, r: 1.45 },
      { type: 'saw', x: 18, y: 2.7, r: 1.45 },
      { type: 'saw', x: 26, y: 9.3, r: 1.45 },
      { type: 'saw', x: 34, y: 2.7, r: 1.45 },
    ],
  },
  { id: 'f5', tier: W, ...tunnel({ gap: 3, legs: [-3, 4, -4, 4, -4, 3, 3, -3] }), hazards: [] },
  {
    id: 'f6',
    tier: S,
    mode: 'ship',
    length: 46,
    ceil: '2 r5 d2 r8 u2 r8 d2 r8 u2 r9',
    floor: '10 r9 u2 r8 d2 r8 u2 r8 d2 r5',
    hazards: [
      { type: 'halfSpike', x: 13, on: 'floor', count: 4 },
      { type: 'halfSpike', x: 32, on: 'floor', count: 4 },
      { type: 'orb', x: 22, y: 2.9, r: 0.9, chain: true },
    ],
  },
  { id: 'f7', tier: W, ...tunnel({ gap: 3, legs: [4, -3, -3, 4, -4, 3, 3, -4] }), hazards: [] },
  {
    id: 'f8',
    tier: S,
    mode: 'ship',
    ...room({ lead: 3, top: 1, bottom: 11, inner: 38 }),
    hazards: [
      { type: 'block', x: 9, y: 1, w: 2, h: 3.6 },
      { type: 'spike', x: 9, y: 4.6, dir: 'down', count: 2 },
      { type: 'orb', x: 16, y: 8.8, r: 1.2 },
      { type: 'block', x: 22, y: 7.4, w: 2, h: 3.6 },
      { type: 'spike', x: 22, y: 7.4, dir: 'up', count: 2 },
      { type: 'orb', x: 29, y: 3.2, r: 1.2, chain: true },
      { type: 'block', x: 35, y: 1, w: 2, h: 3.6 },
      { type: 'spike', x: 35, y: 4.6, dir: 'down', count: 2 },
    ],
  },
  { id: 'f9', tier: W, ...w9, hazards: [] },
];
