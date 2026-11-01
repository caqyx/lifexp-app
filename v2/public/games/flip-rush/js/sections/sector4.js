// @ts-check
// Flip Rush sector 4 "Trudniejszy" (docs/v2/PLAN.md 9.1, stages f-2 and r-2): 10 sections,
// all shuffled, speed 1.1, three gravity flips (each back one section later) and one mini
// stretch around r4-10; dealt out by vehicle in turns. The turbine hall. Its new idea
// (stage r-2): saws that swing as the vehicle comes, and spider mazes of platforms at two
// heights; with beds, columns and orb chains. Built from seeded templates (no two sections
// alike) and proven fair by v2/tests/flip-rush-sections.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR4 = [
  {
    // Ball: 2 beds, moving saws.
    id: 'r4-01',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.6, on: 'ceil', count: 2 },
      { type: 'spike', x: 15.5, on: 'floor', count: 2 },
      { type: 'saw', x: 22.9, y: 6, r: 0.9, move: { dx: 0, dy: 2.4, every: 10, phase: 0 } },
    ],
  },
  {
    // Spider: 2 beds, platforms.
    id: 'r4-02',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.6, on: 'floor', count: 9 },
      { type: 'block', x: 8.1, y: 5.4, w: 3, h: 0.8 },
      { type: 'block', x: 12.6, y: 6.2, w: 3, h: 0.8 },
      { type: 'spike', x: 12.6, on: 'ceil', count: 3 },
    ],
  },
  {
    // Ball: a jump pad, 1 orb, 2 beds.
    id: 'r4-03',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 10.5, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 15.1, y: 8.3 },
      { type: 'spike', x: 12.5, on: 'floor', count: 7 },
      { type: 'spike', x: 12.5, on: 'ceil', count: 7 },
    ],
  },
  {
    // Spider: 3 beds, mines, platforms.
    id: 'r4-04',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.6, on: 'floor', count: 10 },
      { type: 'block', x: 8.1, y: 5, w: 3, h: 0.8 },
      { type: 'block', x: 13.6, y: 7, w: 3, h: 0.8 },
      { type: 'spike', x: 13.6, on: 'ceil', count: 2 },
      { type: 'mine', x: 18.6, y: 2.8, r: 0.6 },
      { type: 'spike', x: 21.1, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: columns, moving saws.
    id: 'r4-05',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 11.1, y: 6, r: 0.9, move: { dx: 0, dy: 2.4, every: 8, phase: 0.25 } },
      { type: 'pillar', x: 15.5, on: 'ceil', h: 3.5 },
      { type: 'pillar', x: 22.7, on: 'floor', h: 3.5 },
    ],
  },
  {
    // Spider: 2 orbs, 4 beds, platforms.
    id: 'r4-06',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'ring', kind: 'jump', x: 7.6, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 7.6, y: 2.65 },
      { type: 'spike', x: 8.8, on: 'floor', count: 2 },
      { type: 'spike', x: 8.8, on: 'ceil', count: 2 },
      { type: 'spike', x: 15.4, on: 'floor', count: 10 },
      { type: 'block', x: 15.9, y: 5.4, w: 4, h: 0.8 },
      { type: 'block', x: 19.9, y: 6.6, w: 4, h: 0.8 },
      { type: 'spike', x: 19.9, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a gravity pad, 1 bed, moving saws.
    id: 'r4-07',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'gravity', x: 10.5, on: 'floor' },
      { type: 'spike', x: 12.5, on: 'floor', count: 4 },
      { type: 'saw', x: 22.9, y: 6, r: 1, move: { dx: 1.6, dy: 1.2, every: 10, phase: 0.25 } },
    ],
  },
  {
    // Spider: columns, moving saws.
    id: 'r4-08',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 11.1, y: 6, r: 0.8, move: { dx: 0, dy: 2.4, every: 8, phase: 0 } },
      { type: 'pillar', x: 15.4, on: 'floor', h: 3 },
      { type: 'pillar', x: 21, on: 'ceil', h: 3 },
    ],
  },
  {
    // Ball: a jump pad, 1 orb, 2 beds, a saw.
    id: 'r4-09',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.6, on: 'floor', count: 2 },
      { type: 'saw', x: 14.2, y: 6, r: 0.8 },
      { type: 'spike', x: 14.2, on: 'ceil', count: 2 },
      { type: 'pad', kind: 'jump', x: 18.2, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 22.8, y: 8.3 },
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
      { type: 'spike', x: 7.6, on: 'ceil', count: 2 },
      { type: 'spike', x: 14.5, on: 'floor', count: 2 },
      { type: 'pillar', x: 18.5, on: 'ceil', h: 4.5 },
      { type: 'pillar', x: 23.1, on: 'floor', h: 4.5 },
    ],
  },
];
