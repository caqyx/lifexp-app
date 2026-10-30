// @ts-check
// Ship Rush sector 6 "Demon" (docs/v2/PLAN.md 9.1, stage s-2): 30 sections in four tiers,
// each shuffled within itself, the tiers in order — Easy Demon 1–10 (speed 1.25), Hard
// Demon 11–15 (1.4), Insane Demon 16–25 (1.55), Extreme Demon 26–30 (1.7), each with its
// own limits, look and practice checkpoint. Portals per tier (config.js): Easy one flip
// for two sections, Hard one mini stretch, Insane two flips and a mini stretch, Extreme
// one flip and a mini stretch; the mini sections are d-15, d-25 and d-30. The layouts are
// hand-made; the Demon's ornament (ornament.js) is added on top, denser tier by tier.
// Every section is proven fair by v2/tests/ship-rush-sections.test.ts.
import { ornament } from './ornament.js';

/** @typedef {import('../../../_engine/geometry.js').SectionData} SectionData */

/** The joint corridor, `length` long. @param {number} length */
const open = (length) => ({ length, ceil: `2 r${length}`, floor: `10 r${length}` });

/**
 * Walls with an opening each: [x, top, bottom] — a pillar from the ceiling down to `top`
 * and one from the floor up to `bottom`.
 * @param {[number, number, number][]} list @returns {import('../../../_engine/geometry.js').HazardData[]}
 */
const windows = (list) =>
  list.flatMap(([x, top, bottom]) => [
    { type: /** @type {const} */ ('pillar'), x, on: /** @type {const} */ ('ceil'), h: top - 2 },
    { type: /** @type {const} */ ('pillar'), x, on: /** @type {const} */ ('floor'), h: 10 - bottom },
  ]);

/** @type {SectionData[]} */
const EASY = [
  {
    // Chained gates: pillars floor, ceiling, floor; mines on chains between them.
    id: 'd-01',
    ...open(30),
    hazards: [
      { type: 'pillar', x: 9, on: 'floor', h: 3.6 },
      { type: 'mine', x: 12.5, y: 4.6, r: 0.55, chain: true },
      { type: 'pillar', x: 15.5, on: 'ceil', h: 3.6 },
      { type: 'mine', x: 18.5, y: 4.2, r: 0.55, chain: true },
      { type: 'pillar', x: 22, on: 'floor', h: 3.6 },
    ],
  },
  {
    // A tunnel of spike beds, mines in the middle, high and low.
    id: 'd-02',
    length: 32,
    ceil: '2 r6 +1.2 r20 -1.2 r6',
    floor: '10 r6 -1.2 r20 +1.2 r6',
    hazards: [
      { type: 'spike', x: 7, on: 'ceil', count: 18 },
      { type: 'spike', x: 7, on: 'floor', count: 18 },
      { type: 'mine', x: 11, y: 5.3, r: 0.45 },
      { type: 'mine', x: 17, y: 6.7, r: 0.45 },
      { type: 'mine', x: 23, y: 5.3, r: 0.45 },
    ],
  },
  {
    // Spiked steps: a block on the floor, one from the ceiling, one on the floor.
    id: 'd-03',
    ...open(30),
    hazards: [
      { type: 'block', x: 9, y: 7, w: 3, h: 3 },
      { type: 'spike', x: 10, y: 7, dir: 'up' },
      { type: 'block', x: 15.5, y: 2, w: 3, h: 3.6 },
      { type: 'spike', x: 16.5, y: 5.6, dir: 'down' },
      { type: 'block', x: 22, y: 6.6, w: 3, h: 3.4 },
      { type: 'spike', x: 23, y: 6.6, dir: 'up' },
    ],
  },
  {
    // The saw tunnel: blades set into the ceiling and the floor in turn.
    id: 'd-04',
    length: 32,
    ceil: '2 r6 +1.5 r20 -1.5 r6',
    floor: '10 r6 -1.5 r20 +1.5 r6',
    hazards: [
      { type: 'saw', x: 9.5, y: 3.5, r: 1.1 },
      { type: 'saw', x: 14, y: 8.5, r: 1.1 },
      { type: 'saw', x: 18.5, y: 3.5, r: 1.1 },
      { type: 'saw', x: 23, y: 8.5, r: 1.1 },
    ],
  },
  {
    // Windows: five walls, an opening at a new height in each.
    id: 'd-05',
    ...open(30),
    hazards: windows([[11, 3.6, 6.2], [15, 5, 7.6], [19, 3.8, 6.4], [23, 5.2, 7.8]]),
  },
  {
    // A mine swarm: ten mines over every height.
    id: 'd-06',
    ...open(30),
    hazards: [
      { type: 'mine', x: 7.5, y: 4, r: 0.5 },
      { type: 'mine', x: 9.5, y: 7.5, r: 0.5 },
      { type: 'mine', x: 11.5, y: 5.5, r: 0.5 },
      { type: 'mine', x: 13.5, y: 3.2, r: 0.5 },
      { type: 'mine', x: 15.5, y: 8.4, r: 0.5 },
      { type: 'mine', x: 17.5, y: 6, r: 0.5 },
      { type: 'mine', x: 19.5, y: 3.6, r: 0.5 },
      { type: 'mine', x: 21.5, y: 7.2, r: 0.5 },
      { type: 'mine', x: 23.5, y: 4.6, r: 0.5 },
      { type: 'mine', x: 25.5, y: 8, r: 0.5 },
    ],
  },
  {
    // Platform hops over a long bed, spikes over the high ones.
    id: 'd-07',
    ...open(30),
    hazards: [
      { type: 'spike', x: 6, on: 'floor', count: 20 },
      { type: 'block', x: 7, y: 7.2, w: 2.5, h: 0.5 },
      { type: 'block', x: 12, y: 6.2, w: 2.5, h: 0.5 },
      { type: 'spike', x: 12, on: 'ceil', count: 2 },
      { type: 'block', x: 17, y: 7.2, w: 2.5, h: 0.5 },
      { type: 'block', x: 22, y: 6.2, w: 2.5, h: 0.5 },
      { type: 'spike', x: 22, on: 'ceil', count: 2 },
    ],
  },
  {
    // The snake: a tunnel stepping down, up and down, a spike at its low turn.
    id: 'd-08',
    length: 32,
    ceil: '2 r8 +2 r5 +1 r5 -1.5 r5 +1 r5 -2.5 r4',
    floor: '10 r8 -2.5 r5 +1 r5 -1 r5 +0.5 r5 +2 r4',
    hazards: [{ type: 'halfSpike', x: 14, on: 'floor', count: 2 }],
  },
  {
    // Teeth: long ones from the ceiling, the floor and the ceiling.
    id: 'd-09',
    ...open(30),
    hazards: [
      { type: 'pillar', x: 10, on: 'ceil', h: 4.2 },
      { type: 'pillar', x: 17, on: 'floor', h: 4.2 },
      { type: 'pillar', x: 24, on: 'ceil', h: 4.2 },
    ],
  },
  {
    // A wreck: a torn hull to fly through.
    id: 'd-10',
    ...open(30),
    hazards: [
      { type: 'block', x: 8, y: 2, w: 3, h: 2.5 },
      { type: 'spike', x: 8, y: 4.5, dir: 'down', count: 3 },
      { type: 'block', x: 8, y: 8, w: 6, h: 2 },
      { type: 'block', x: 14, y: 4, w: 5, h: 1 },
      { type: 'spike', x: 15, y: 4, dir: 'up', count: 3 },
      { type: 'block', x: 20, y: 6.5, w: 3, h: 3.5 },
      { type: 'mine', x: 24, y: 4.2, r: 0.55, chain: true },
    ],
  },
];

/** @type {SectionData[]} */
const HARD = [
  {
    // Saw stairs: pairs of blades, the gap stepping up, then down.
    id: 'd-11',
    ...open(30),
    hazards: [
      { type: 'saw', x: 9, y: 3.3, r: 1.1 },
      { type: 'saw', x: 9, y: 8.4, r: 1.1 },
      { type: 'saw', x: 15, y: 2.3, r: 1.1 },
      { type: 'saw', x: 15, y: 7.4, r: 1.1 },
      { type: 'saw', x: 21, y: 4.3, r: 1.1 },
      { type: 'saw', x: 21, y: 9.4, r: 1.1 },
    ],
  },
  {
    // A curtain of chained mines at every length.
    id: 'd-12',
    ...open(30),
    hazards: [
      { type: 'mine', x: 8, y: 4.2, r: 0.55, chain: true },
      { type: 'mine', x: 11, y: 6.6, r: 0.55, chain: true },
      { type: 'mine', x: 14, y: 4.8, r: 0.55, chain: true },
      { type: 'mine', x: 17, y: 7, r: 0.55, chain: true },
      { type: 'mine', x: 20, y: 4.2, r: 0.55, chain: true },
      { type: 'mine', x: 23, y: 6.4, r: 0.55, chain: true },
      { type: 'mine', x: 26, y: 5, r: 0.55, chain: true },
    ],
  },
  {
    // Narrow stairs: a corridor two and a half cells high climbing and coming back.
    id: 'd-13',
    length: 32,
    ceil: '2 r12 +2 r4 -0.5 r4 -0.5 r4 +0.5 r4 -1.5 r4',
    floor: '10 r12 -3.5 r4 -0.5 r4 -0.5 r4 +0.5 r4 +4 r4',
    hazards: [],
  },
  {
    // Spiked slabs: spikes on top, below, on top.
    id: 'd-14',
    ...open(30),
    hazards: [
      { type: 'block', x: 7, y: 6, w: 4, h: 1 },
      { type: 'spike', x: 7, y: 6, dir: 'up', count: 4 },
      { type: 'block', x: 14, y: 5, w: 4, h: 1 },
      { type: 'spike', x: 14, y: 6, dir: 'down', count: 4 },
      { type: 'block', x: 21, y: 6, w: 4, h: 1 },
      { type: 'spike', x: 21, y: 6, dir: 'up', count: 4 },
    ],
  },
  {
    // Mini: a needle maze of stubs in a low corridor.
    id: 'd-15',
    length: 32,
    mini: true,
    ceil: '2 r9 +2.4 r17 -2.4 r6',
    floor: '10 r9 -2.4 r17 +2.4 r6',
    hazards: [
      { type: 'pillar', x: 12, on: 'floor', h: 1.1, w: 0.5 },
      { type: 'pillar', x: 15.5, on: 'ceil', h: 1.1, w: 0.5 },
      { type: 'pillar', x: 19, on: 'floor', h: 1.1, w: 0.5 },
      { type: 'pillar', x: 22.5, on: 'ceil', h: 1.1, w: 0.5 },
    ],
  },
];

/** @type {SectionData[]} */
const INSANE = [
  {
    // Tight teeth: three long ones, under, over, under.
    id: 'd-16',
    length: 32,
    ceil: '2 r32',
    floor: '10 r32',
    hazards: [
      { type: 'pillar', x: 12, on: 'ceil', h: 3.9 },
      { type: 'pillar', x: 19, on: 'floor', h: 3.9 },
      { type: 'pillar', x: 26, on: 'ceil', h: 3.9 },
    ],
  },
  {
    // Bed rapids: spike beds above and below, two mines between.
    id: 'd-17',
    length: 32,
    ceil: '2 r7 +1 r18 -1 r7',
    floor: '10 r7 -1 r18 +1 r7',
    hazards: [
      { type: 'spike', x: 8, on: 'ceil', count: 16 },
      { type: 'spike', x: 8, on: 'floor', count: 16 },
      { type: 'mine', x: 13, y: 5.2, r: 0.45 },
      { type: 'mine', x: 20, y: 6.8, r: 0.45 },
    ],
  },
  {
    // Saw pairs: the gap in the middle, high, then low.
    id: 'd-18',
    length: 32,
    ceil: '2 r32',
    floor: '10 r32',
    hazards: [
      { type: 'saw', x: 10, y: 3.4, r: 1.1 },
      { type: 'saw', x: 10, y: 8.6, r: 1.1 },
      { type: 'saw', x: 17, y: 2.4, r: 1.1 },
      { type: 'saw', x: 17, y: 7.6, r: 1.1 },
      { type: 'saw', x: 24, y: 4.4, r: 1.1 },
      { type: 'saw', x: 24, y: 9.6, r: 1.1 },
    ],
  },
  {
    // A mine lattice: two rows, offset.
    id: 'd-19',
    length: 32,
    ceil: '2 r32',
    floor: '10 r32',
    hazards: [
      { type: 'mine', x: 9, y: 4.4, r: 0.45 },
      { type: 'mine', x: 12, y: 7.6, r: 0.45 },
      { type: 'mine', x: 15, y: 4.4, r: 0.45 },
      { type: 'mine', x: 18, y: 7.6, r: 0.45 },
      { type: 'mine', x: 21, y: 4.4, r: 0.45 },
      { type: 'mine', x: 24, y: 7.6, r: 0.45 },
    ],
  },
  {
    // Rapid windows.
    id: 'd-20',
    length: 32,
    ceil: '2 r32',
    floor: '10 r32',
    hazards: windows([[10, 3.6, 6.4], [15, 4.8, 7.6], [20, 3.4, 6.2], [25, 4.6, 7.4]]),
  },
  {
    // A block slalom: blocks from the floor and the ceiling, spiked where they reach out.
    id: 'd-21',
    length: 32,
    ceil: '2 r32',
    floor: '10 r32',
    hazards: [
      { type: 'block', x: 11, y: 7, w: 2, h: 3 },
      { type: 'spike', x: 11.5, y: 7, dir: 'up' },
      { type: 'block', x: 18, y: 2, w: 2, h: 3 },
      { type: 'spike', x: 18.5, y: 5, dir: 'down' },
      { type: 'block', x: 25, y: 7, w: 2, h: 3 },
      { type: 'spike', x: 25.5, y: 7, dir: 'up' },
    ],
  },
  {
    // The squeeze: two and a half cells for eight, then a saw by the floor.
    id: 'd-22',
    length: 32,
    ceil: '2 r12 +2.5 r10 -2.5 r10',
    floor: '10 r12 -3 r10 +3 r10',
    hazards: [{ type: 'saw', x: 26.5, y: 8.4, r: 1 }],
  },
  {
    // Chained debris over a spike bed.
    id: 'd-23',
    length: 32,
    ceil: '2 r32',
    floor: '10 r32',
    hazards: [
      { type: 'spike', x: 8, on: 'floor', count: 18 },
      { type: 'mine', x: 11, y: 5.6, r: 0.55, chain: true },
      { type: 'mine', x: 17.5, y: 4.2, r: 0.55, chain: true },
      { type: 'mine', x: 24, y: 5.8, r: 0.55, chain: true },
    ],
  },
  {
    // A stair gauntlet: the floor climbs, spikes over each step.
    id: 'd-24',
    length: 32,
    ceil: '2 r32',
    floor: '10 r8 -1 r5 -1 r5 -1 r5 +3 r9',
    hazards: [
      { type: 'spike', x: 10, on: 'ceil' },
      { type: 'spike', x: 15, on: 'ceil' },
      { type: 'spike', x: 20, on: 'ceil' },
      { type: 'halfSpike', x: 26, on: 'floor', count: 2 },
    ],
  },
  {
    // Mini: micro-mines in a low tunnel.
    id: 'd-25',
    length: 32,
    mini: true,
    ceil: '2 r9 +2.5 r17 -2.5 r6',
    floor: '10 r9 -2.5 r17 +2.5 r6',
    hazards: [
      { type: 'mine', x: 12, y: 5.2, r: 0.4 },
      { type: 'mine', x: 15, y: 6.8, r: 0.4 },
      { type: 'mine', x: 18, y: 5.2, r: 0.4 },
      { type: 'mine', x: 21, y: 6.8, r: 0.4 },
      { type: 'mine', x: 24, y: 5.2, r: 0.4 },
    ],
  },
];

/** @type {SectionData[]} */
const EXTREME = [
  {
    // The spike tunnel: beds above and below, narrowing.
    id: 'd-26',
    length: 34,
    ceil: '2 r8 +1 r8 +0.5 r8 -1.5 r10',
    floor: '10 r8 -1 r8 -0.5 r8 +1.5 r10',
    hazards: [
      { type: 'spike', x: 9, on: 'ceil', count: 7 },
      { type: 'spike', x: 9, on: 'floor', count: 7 },
      { type: 'halfSpike', x: 17, on: 'ceil', count: 7 },
      { type: 'halfSpike', x: 17, on: 'floor', count: 7 },
    ],
  },
  {
    // A saw curtain: four blades, high and low.
    id: 'd-27',
    length: 34,
    ceil: '2 r34',
    floor: '10 r34',
    hazards: [
      { type: 'saw', x: 10, y: 3.6, r: 1.2 },
      { type: 'saw', x: 16, y: 8.4, r: 1.2 },
      { type: 'saw', x: 22, y: 3.6, r: 1.2 },
      { type: 'saw', x: 28, y: 8.4, r: 1.2 },
    ],
  },
  {
    // A mine storm.
    id: 'd-28',
    length: 34,
    ceil: '2 r34',
    floor: '10 r34',
    hazards: [
      { type: 'mine', x: 9, y: 4, r: 0.5 },
      { type: 'mine', x: 11.5, y: 7.8, r: 0.5 },
      { type: 'mine', x: 14, y: 5, r: 0.5 },
      { type: 'mine', x: 16.5, y: 8.4, r: 0.5, chain: false },
      { type: 'mine', x: 19, y: 3.6, r: 0.5, chain: true },
      { type: 'mine', x: 21.5, y: 6.8, r: 0.5 },
      { type: 'mine', x: 24, y: 4.4, r: 0.5, chain: true },
      { type: 'mine', x: 27, y: 7.6, r: 0.5 },
    ],
  },
  {
    // The last gates: windows with spiked sills.
    id: 'd-29',
    length: 34,
    ceil: '2 r34',
    floor: '10 r34',
    hazards: [
      ...windows([[11, 3.4, 6.4], [18, 4.8, 7.8], [25, 3.6, 6.6]]),
      { type: 'halfSpike', x: 14, on: 'floor', count: 2 },
      { type: 'halfSpike', x: 21, on: 'ceil', count: 2 },
    ],
  },
  {
    // Mini: the eye of the needle — stubs and mines in a low tunnel.
    id: 'd-30',
    length: 34,
    mini: true,
    ceil: '2 r10 +2.5 r18 -2.5 r6',
    floor: '10 r10 -2.5 r18 +2.5 r6',
    hazards: [
      { type: 'pillar', x: 13, on: 'floor', h: 1.1, w: 0.5 },
      { type: 'mine', x: 16.5, y: 5.1, r: 0.4 },
      { type: 'pillar', x: 20, on: 'ceil', h: 1.1, w: 0.5 },
      { type: 'mine', x: 23.5, y: 6.9, r: 0.4 },
    ],
  },
];

/** The Demon's sections, ornament denser tier by tier. @type {SectionData[]} */
export const SECTOR6 = [
  ...EASY.map((d) => ornament(d, 1)),
  ...HARD.map((d) => ornament(d, 1.25)),
  ...INSANE.map((d) => ornament(d, 1.5)),
  ...EXTREME.map((d) => ornament(d, 1.9)),
];
