// @ts-check
// Flip Rush sector 4 "Trudniejszy" (docs/v2/PLAN.md 9.1, stage f-2): 10 sections, all shuffled,
// speed 1.1, three gravity flips (each back one section later) and one mini stretch around
// r4-10; dealt out by vehicle in turns. The turbine hall: beds and columns in turn, orb
// chains off jump pads, orbs for the spider, mines, saws, a gravity pad. Built from the
// section templates of stage f-2 and proven fair by v2/tests/flip-rush-sections.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR4 = [
  {
    // Ball: 2 beds, columns.
    id: 'r4-01',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.6, on: 'floor', count: 3 },
      { type: 'spike', x: 16.7, on: 'ceil', count: 3 },
      { type: 'pillar', x: 21.7, on: 'floor', h: 3.5 },
    ],
  },
  {
    // Spider: 2 orbs, 4 beds.
    id: 'r4-02',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.6, on: 'floor', count: 2 },
      { type: 'spike', x: 14.2, on: 'ceil', count: 2 },
      { type: 'ring', kind: 'jump', x: 18.2, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 18.2, y: 2.65 },
      { type: 'spike', x: 19.4, on: 'floor', count: 2 },
      { type: 'spike', x: 19.4, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 orbs, 2 beds.
    id: 'r4-03',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 7.6, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 12.3, y: 8.3 },
      { type: 'ring', kind: 'jump', x: 17.5, y: 8.3 },
      { type: 'spike', x: 9.6, on: 'floor', count: 13 },
      { type: 'spike', x: 9.6, on: 'ceil', count: 13 },
    ],
  },
  {
    // Spider: columns, mines.
    id: 'r4-04',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 7.6, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 12.6, on: 'ceil', h: 3.5 },
      { type: 'mine', x: 15.6, y: 9.2, r: 0.7 },
      { type: 'mine', x: 20.7, y: 2.8, r: 0.7 },
    ],
  },
  {
    // Ball: 3 beds, a saw.
    id: 'r4-05',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.6, on: 'floor', count: 2 },
      { type: 'saw', x: 13.7, y: 6, r: 0.8 },
      { type: 'spike', x: 13.7, on: 'ceil', count: 2 },
      { type: 'spike', x: 17.7, on: 'ceil', count: 3 },
    ],
  },
  {
    // Spider: 3 beds, a platform.
    id: 'r4-06',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.6, on: 'floor', count: 5 },
      { type: 'block', x: 7.6, y: 5.8, w: 5, h: 0.8 },
      { type: 'spike', x: 15.9, on: 'ceil', count: 2 },
      { type: 'spike', x: 19.9, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a gravity pad, 2 beds.
    id: 'r4-07',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'gravity', x: 7.6, on: 'floor' },
      { type: 'spike', x: 9.6, on: 'floor', count: 5 },
      { type: 'spike', x: 16.6, on: 'ceil', count: 3 },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, columns.
    id: 'r4-08',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'ring', kind: 'jump', x: 7.6, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 7.6, y: 2.65 },
      { type: 'spike', x: 8.8, on: 'floor', count: 2 },
      { type: 'spike', x: 8.8, on: 'ceil', count: 2 },
      { type: 'pillar', x: 15.4, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 20.4, on: 'ceil', h: 3.5 },
      { type: 'pillar', x: 25.4, on: 'floor', h: 3.5 },
    ],
  },
  {
    // Ball: a jump pad, 2 beds.
    id: 'r4-09',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.6, on: 'floor', count: 3 },
      { type: 'spike', x: 16.7, on: 'ceil', count: 3 },
      { type: 'pad', kind: 'jump', x: 21.7, on: 'floor' },
    ],
  },
  {
    // Spider (mini): 2 beds, columns.
    id: 'r4-10',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    mini: true,
    hazards: [
      { type: 'spike', x: 7.6, on: 'floor', count: 2 },
      { type: 'spike', x: 14.2, on: 'ceil', count: 2 },
      { type: 'pillar', x: 18.2, on: 'floor', h: 4.5 },
      { type: 'pillar', x: 23.2, on: 'ceil', h: 4.5 },
    ],
  },
];
