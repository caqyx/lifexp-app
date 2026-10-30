// @ts-check
// Ship Rush's finale "Horyzont Zdarzeń" (docs/v2/PLAN.md 9.1, stage s-2): an original
// level, not a copy of any existing one — ten stretches in a fixed order, seven flown as
// the ship (tier `finaleShip`, speed 1.5) and three as the wave (`finaleWave`, 1.3), with
// a vehicle portal in the open joint wherever the vehicle changes. It falls toward a
// black hole: gates and mines, a zig-zag tunnel, chained mines and teeth, rapid windows,
// a wave slalom between pillars, a tunnel of spike beds, a saw curtain, a last narrow
// zig-zag and the final gates. Every stretch is proven by v2/tests/ship-rush-sections.test.ts.
import { ornament } from './ornament.js';

/** @typedef {import('../../../_engine/geometry.js').SectionData} SectionData */

/** @param {number} length */
const open = (length) => ({ length, ceil: `2 r${length}`, floor: `10 r${length}` });

/** @type {SectionData[]} */
const STRETCHES = [
  {
    // Ship: gates from the floor and the ceiling, a mine between.
    id: 'f-01',
    tier: 'finaleShip',
    ...open(32),
    hazards: [
      { type: 'pillar', x: 11, on: 'floor', h: 3.8 },
      { type: 'mine', x: 15, y: 4.2, r: 0.5, chain: true },
      { type: 'pillar', x: 19, on: 'ceil', h: 3.8 },
      { type: 'pillar', x: 26, on: 'floor', h: 3.8 },
    ],
  },
  {
    // Ship: a field of mines.
    id: 'f-02',
    tier: 'finaleShip',
    ...open(32),
    hazards: [
      { type: 'mine', x: 10, y: 4.2, r: 0.5 },
      { type: 'mine', x: 13, y: 7.6, r: 0.5 },
      { type: 'mine', x: 16, y: 5, r: 0.5 },
      { type: 'mine', x: 19, y: 8.2, r: 0.5 },
      { type: 'mine', x: 22, y: 4, r: 0.5 },
      { type: 'mine', x: 25, y: 6.8, r: 0.5 },
    ],
  },
  {
    // Wave: a zig-zag tunnel at 45°.
    id: 'f-03',
    tier: 'finaleWave',
    mode: 'wave',
    length: 32.8,
    ceil: '2 r5 d1.5 r1.4 d3 u3 d3 u3 d3 u3 u1.5 r1.4 r4',
    floor: '10 r5 u2.9 d3 u3 d3 u3 d3 u3 d2.9 r4',
    hazards: [],
  },
  {
    // Ship: chained mines, then long teeth from the ceiling and the floor.
    id: 'f-04',
    tier: 'finaleShip',
    ...open(34),
    hazards: [
      { type: 'mine', x: 10, y: 4.6, r: 0.5, chain: true },
      { type: 'pillar', x: 16, on: 'ceil', h: 3.9 },
      { type: 'pillar', x: 23, on: 'floor', h: 3.9 },
      { type: 'mine', x: 28, y: 5, r: 0.5, chain: true },
    ],
  },
  {
    // Ship: rapid windows.
    id: 'f-05',
    tier: 'finaleShip',
    ...open(32),
    hazards: [
      { type: 'pillar', x: 11, on: 'ceil', h: 1.6 },
      { type: 'pillar', x: 11, on: 'floor', h: 3.6 },
      { type: 'pillar', x: 17, on: 'ceil', h: 2.8 },
      { type: 'pillar', x: 17, on: 'floor', h: 2.4 },
      { type: 'pillar', x: 23, on: 'ceil', h: 1.8 },
      { type: 'pillar', x: 23, on: 'floor', h: 3.4 },
    ],
  },
  {
    // Wave: a slalom between pillars from the floor and the ceiling.
    id: 'f-06',
    tier: 'finaleWave',
    mode: 'wave',
    ...open(30),
    hazards: [
      { type: 'pillar', x: 9, on: 'floor', h: 3.8 },
      { type: 'pillar', x: 14, on: 'ceil', h: 3.8 },
      { type: 'pillar', x: 19, on: 'floor', h: 3.8 },
      { type: 'pillar', x: 24, on: 'ceil', h: 3.8 },
    ],
  },
  {
    // Ship: a tunnel of spike beds, a mine in the middle.
    id: 'f-07',
    tier: 'finaleShip',
    length: 32,
    ceil: '2 r8 +1 r18 -1 r6',
    floor: '10 r8 -1 r18 +1 r6',
    hazards: [
      { type: 'spike', x: 9, on: 'ceil', count: 16 },
      { type: 'spike', x: 9, on: 'floor', count: 16 },
      { type: 'mine', x: 17, y: 6, r: 0.45 },
    ],
  },
  {
    // Ship: a saw curtain, high and low.
    id: 'f-08',
    tier: 'finaleShip',
    ...open(34),
    hazards: [
      { type: 'saw', x: 11, y: 3.6, r: 1.2 },
      { type: 'saw', x: 17.5, y: 8.4, r: 1.2 },
      { type: 'saw', x: 24, y: 3.6, r: 1.2 },
    ],
  },
  {
    // Wave: the last narrow zig-zag, its legs shorter.
    id: 'f-09',
    tier: 'finaleWave',
    mode: 'wave',
    length: 29.6,
    ceil: '2 r5 d2 r0.8 d2.5 u2.5 d2.5 u2.5 d2.5 u2.5 u2 r0.8 r4',
    floor: '10 r5 u2.8 d2.5 u2.5 d2.5 u2.5 d2.5 u2.5 d2.8 r4',
    hazards: [],
  },
  {
    // Ship: the final gates, and then only the dark.
    id: 'f-10',
    tier: 'finaleShip',
    ...open(34),
    hazards: [
      { type: 'pillar', x: 11, on: 'ceil', h: 3.7 },
      { type: 'mine', x: 15, y: 7.6, r: 0.5 },
      { type: 'pillar', x: 19, on: 'floor', h: 3.7 },
      { type: 'pillar', x: 26, on: 'ceil', h: 3.7 },
    ],
  },
];

/** The finale's stretches, with the Extreme's ornament. @type {SectionData[]} */
export const FINALE_SECTIONS = STRETCHES.map((d) => ornament(d, 1.6));
