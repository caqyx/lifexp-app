// @ts-check
// Flip Rush's finale "Serce Fabryki" (docs/v2/PLAN.md 9.1, stage f-2): an original level, not
// a copy of any other — ten fixed stretches of 44 cells (never shuffled), ball and spider in
// turn at the finale's tier (1.45), every kind of orb and pad: chains of jump orbs off jump
// pads, gravity orbs over beds, a dash orb under a column, a gravity-jump orb over a bed, a
// small pad. Each stretch is proven fair by v2/tests/flip-rush-sections.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const FINALE_SECTIONS = [
  {
    // Ball: a jump pad, 2 orbs, 3 beds.
    id: 'f-01',
    mode: 'ball',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'pad', kind: 'jump', x: 13.1, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 19.2, y: 8.3 },
      { type: 'spike', x: 15.1, on: 'floor', count: 11 },
      { type: 'spike', x: 15.1, on: 'ceil', count: 11 },
      { type: 'ring', kind: 'gravity', x: 28.6, y: 9.35 },
      { type: 'spike', x: 29.8, on: 'floor', count: 5 },
    ],
  },
  {
    // Spider: 3 orbs, 4 beds, columns.
    id: 'f-02',
    mode: 'spider',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'ring', kind: 'jump', x: 9.3, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 9.3, y: 2.65 },
      { type: 'spike', x: 10.5, on: 'floor', count: 2 },
      { type: 'spike', x: 10.5, on: 'ceil', count: 2 },
      { type: 'ring', kind: 'gravity', x: 19.8, y: 9.35 },
      { type: 'spike', x: 21, on: 'floor', count: 5 },
      { type: 'spike', x: 30.8, on: 'ceil', count: 3 },
      { type: 'pillar', x: 35.8, on: 'floor', h: 3.5 },
    ],
  },
  {
    // Ball: a jump pad, 2 orbs, 2 beds, columns.
    id: 'f-03',
    mode: 'ball',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'pad', kind: 'jump', x: 9.3, on: 'floor' },
      { type: 'ring', kind: 'dash', x: 12.3, y: 7.4 },
      { type: 'pillar', x: 14.1, on: 'ceil', h: 4.6 },
      { type: 'spike', x: 17.6, on: 'ceil', count: 3 },
      { type: 'spike', x: 27.9, on: 'floor', count: 3 },
      { type: 'pad', kind: 'jump', x: 32.9, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 39.1, y: 8.3 },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, columns.
    id: 'f-04',
    mode: 'spider',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'ring', kind: 'jump', x: 9.3, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 9.3, y: 2.65 },
      { type: 'spike', x: 10.5, on: 'floor', count: 2 },
      { type: 'spike', x: 10.5, on: 'ceil', count: 2 },
      { type: 'pillar', x: 18.7, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 24.6, on: 'ceil', h: 3.5 },
      { type: 'pillar', x: 30.6, on: 'floor', h: 3.5 },
    ],
  },
  {
    // Ball: a jump pad, 2 orbs, 3 beds.
    id: 'f-05',
    mode: 'ball',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'pad', kind: 'jump', x: 9.3, on: 'floor' },
      { type: 'ring', kind: 'gravityJump', x: 13.4, y: 7.6 },
      { type: 'spike', x: 11.3, on: 'floor', count: 4 },
      { type: 'pad', kind: 'jump', x: 20.8, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 27, y: 8.3 },
      { type: 'spike', x: 22.8, on: 'floor', count: 11 },
      { type: 'spike', x: 22.8, on: 'ceil', count: 11 },
    ],
  },
  {
    // Spider: a jump pad, 2 orbs, 3 beds, columns.
    id: 'f-06',
    mode: 'spider',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'pad', kind: 'small', x: 9.3, on: 'floor' },
      { type: 'spike', x: 10.9, on: 'floor', count: 2 },
      { type: 'pillar', x: 18.3, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 24.2, on: 'ceil', h: 3.5 },
      { type: 'ring', kind: 'jump', x: 27.2, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 27.2, y: 2.65 },
      { type: 'spike', x: 28.4, on: 'floor', count: 2 },
      { type: 'spike', x: 28.4, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 orbs, 4 beds.
    id: 'f-07',
    mode: 'ball',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'ring', kind: 'gravity', x: 9.3, y: 9.35 },
      { type: 'spike', x: 10.5, on: 'floor', count: 5 },
      { type: 'spike', x: 20.3, on: 'ceil', count: 3 },
      { type: 'pad', kind: 'jump', x: 25.3, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 31.5, y: 8.3 },
      { type: 'spike', x: 27.3, on: 'floor', count: 11 },
      { type: 'spike', x: 27.3, on: 'ceil', count: 11 },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, columns.
    id: 'f-08',
    mode: 'spider',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'ring', kind: 'jump', x: 9.3, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 9.3, y: 2.65 },
      { type: 'spike', x: 10.5, on: 'floor', count: 2 },
      { type: 'spike', x: 10.5, on: 'ceil', count: 2 },
      { type: 'pillar', x: 18.7, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 24.6, on: 'ceil', h: 3.5 },
      { type: 'pillar', x: 30.6, on: 'floor', h: 3.5 },
    ],
  },
  {
    // Ball: a jump pad, 2 orbs, 3 beds, columns.
    id: 'f-09',
    mode: 'ball',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'pad', kind: 'jump', x: 13.1, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 19.2, y: 8.3 },
      { type: 'spike', x: 15.1, on: 'floor', count: 11 },
      { type: 'spike', x: 15.1, on: 'ceil', count: 11 },
      { type: 'pad', kind: 'jump', x: 28.6, on: 'floor' },
      { type: 'ring', kind: 'dash', x: 31.6, y: 7.4 },
      { type: 'pillar', x: 33.4, on: 'ceil', h: 4.6 },
      { type: 'spike', x: 36.9, on: 'floor', count: 3 },
    ],
  },
  {
    // Spider: 3 orbs, 5 beds.
    id: 'f-10',
    mode: 'spider',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'ring', kind: 'jump', x: 9.3, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 9.3, y: 2.65 },
      { type: 'spike', x: 10.5, on: 'floor', count: 2 },
      { type: 'spike', x: 10.5, on: 'ceil', count: 2 },
      { type: 'spike', x: 19.8, on: 'ceil', count: 2 },
      { type: 'spike', x: 28.1, on: 'floor', count: 2 },
      { type: 'ring', kind: 'gravity', x: 32.1, y: 9.35 },
      { type: 'spike', x: 33.3, on: 'floor', count: 5 },
    ],
  },
];
