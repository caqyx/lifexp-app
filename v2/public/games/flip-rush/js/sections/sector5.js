// @ts-check
// Flip Rush sector 5 "Insane" (docs/v2/PLAN.md 9.1, stage f-2): 10 sections, 1–5 then 6–10,
// speed 1.25, two gravity flips (each back one section later) and one mini stretch around
// r5-10; dealt out by vehicle in turns. The reactor's core: the same ideas, closer and
// combined — orb chains after beds, orbs before platforms. Proven fair by
// v2/tests/flip-rush-sections.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR5 = [
  {
    // Ball: a jump pad, 1 orb, 2 beds.
    id: 'r5-01',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 11.6, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 16.9, y: 8.3 },
      { type: 'spike', x: 13.6, on: 'floor', count: 9 },
      { type: 'spike', x: 13.6, on: 'ceil', count: 9 },
    ],
  },
  {
    // Spider: 2 orbs, 4 beds.
    id: 'r5-02',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'ring', kind: 'jump', x: 8.4, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 8.4, y: 2.65 },
      { type: 'spike', x: 9.6, on: 'floor', count: 2 },
      { type: 'spike', x: 9.6, on: 'ceil', count: 2 },
      { type: 'spike', x: 16.8, on: 'ceil', count: 2 },
      { type: 'spike', x: 23.8, on: 'floor', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 beds.
    id: 'r5-03',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8.4, on: 'floor', count: 3 },
      { type: 'spike', x: 18, on: 'ceil', count: 3 },
      { type: 'pad', kind: 'jump', x: 23, on: 'floor' },
    ],
  },
  {
    // Spider: 2 beds, mines.
    id: 'r5-04',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 8.4, y: 9.2, r: 0.7 },
      { type: 'mine', x: 13.9, y: 2.8, r: 0.7 },
      { type: 'spike', x: 16.9, on: 'ceil', count: 2 },
      { type: 'spike', x: 23.8, on: 'floor', count: 2 },
    ],
  },
  {
    // Ball: a gravity pad, 1 orb, 1 beds.
    id: 'r5-05',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'gravity', x: 8.4, on: 'floor' },
      { type: 'spike', x: 10.4, on: 'floor', count: 5 },
      { type: 'pad', kind: 'jump', x: 17.4, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 22.6, y: 8.3 },
    ],
  },
  {
    // Spider: 2 orbs, 3 beds, a platform.
    id: 'r5-06',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'ring', kind: 'jump', x: 8.4, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 8.4, y: 2.65 },
      { type: 'spike', x: 9.6, on: 'floor', count: 2 },
      { type: 'spike', x: 9.6, on: 'ceil', count: 2 },
      { type: 'spike', x: 16.8, on: 'floor', count: 5 },
      { type: 'block', x: 16.8, y: 5.8, w: 5, h: 0.8 },
    ],
  },
  {
    // Ball: 2 beds, columns.
    id: 'r5-07',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8.4, on: 'floor', count: 3 },
      { type: 'spike', x: 18, on: 'ceil', count: 3 },
      { type: 'pillar', x: 23, on: 'floor', h: 3.5 },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, columns.
    id: 'r5-08',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 8.4, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 13.7, on: 'ceil', h: 3.5 },
      { type: 'ring', kind: 'jump', x: 16.7, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 16.7, y: 2.65 },
      { type: 'spike', x: 17.9, on: 'floor', count: 2 },
      { type: 'spike', x: 17.9, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 1 orb, 2 beds.
    id: 'r5-09',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 11.6, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 16.9, y: 8.3 },
      { type: 'spike', x: 13.6, on: 'floor', count: 9 },
      { type: 'spike', x: 13.6, on: 'ceil', count: 9 },
    ],
  },
  {
    // Ball (mini): 2 beds, columns.
    id: 'r5-10',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    mini: true,
    hazards: [
      { type: 'spike', x: 8.4, on: 'floor', count: 2 },
      { type: 'spike', x: 17, on: 'ceil', count: 2 },
      { type: 'pillar', x: 21, on: 'floor', h: 4.5 },
    ],
  },
];
