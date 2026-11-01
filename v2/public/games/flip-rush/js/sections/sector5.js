// @ts-check
// Flip Rush sector 5 "Insane" (docs/v2/PLAN.md 9.1, stages f-2 and r-2): 10 sections, 1–5
// then 6–10, speed 1.25, two gravity flips (each back one section later) and one mini
// stretch around r5-10; dealt out by vehicle in turns. The reactor's core. Its new ideas
// (stage r-2): gravity flipped inside a section and back, dark stretches that close the
// view round the vehicle, speed portals; combined with sector 4's moving saws and mazes.
// Built from seeded templates (no two sections alike) and proven fair by
// v2/tests/flip-rush-sections.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR5 = [
  {
    // Ball: 1 bed, gravity flipped and back.
    id: 'r5-01',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'portal', x: 8.4, kind: 'flip' },
      { type: 'spike', x: 15.9, on: 'ceil', count: 2 },
      { type: 'portal', x: 21.8, kind: 'flip' },
    ],
  },
  {
    // Spider: 2 beds, platforms, in the dark.
    id: 'r5-02',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8.4, on: 'floor', count: 11 },
      { type: 'block', x: 8.9, y: 5, w: 3.5, h: 0.8 },
      { type: 'block', x: 14.4, y: 6.6, w: 3.5, h: 0.8 },
      { type: 'spike', x: 14.4, on: 'ceil', count: 2 },
      { type: 'dark', from: 7.4, to: 22.4 },
    ],
  },
  {
    // Ball: a jump pad, 1 orb, 2 beds, in the dark.
    id: 'r5-03',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 11.6, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 16.9, y: 8.3 },
      { type: 'spike', x: 13.6, on: 'floor', count: 9 },
      { type: 'spike', x: 13.6, on: 'ceil', count: 9 },
      { type: 'dark', from: 10.6, to: 25.1 },
    ],
  },
  {
    // Spider: 2 orbs, 1 bed, gravity flipped and back.
    id: 'r5-04',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'portal', x: 8.4, kind: 'flip' },
      { type: 'spike', x: 15.9, on: 'floor', count: 2 },
      { type: 'portal', x: 22.6, kind: 'flip' },
      { type: 'ring', kind: 'jump', x: 25.1, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 25.1, y: 2.65 },
    ],
  },
  {
    // Ball: columns, moving saws, a slow speed portal.
    id: 'r5-05',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 8.4, k: 'slow' },
      { type: 'saw', x: 14, y: 6, r: 0.8, move: { dx: 0, dy: 2.4, every: 9, phase: 0.25 } },
      { type: 'pillar', x: 18.3, on: 'floor', h: 3.8 },
      { type: 'pillar', x: 25, on: 'ceil', h: 3.8 },
    ],
  },
  {
    // Spider: 2 beds, mines, in the dark.
    id: 'r5-06',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 8.4, y: 9.08, r: 0.6 },
      { type: 'mine', x: 13.6, y: 2.92, r: 0.6 },
      { type: 'spike', x: 16.6, on: 'ceil', count: 2 },
      { type: 'spike', x: 23.2, on: 'floor', count: 2 },
      { type: 'dark', from: 7.4, to: 27.2 },
    ],
  },
  {
    // Ball: 1 bed, gravity flipped and back.
    id: 'r5-07',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'portal', x: 8.4, kind: 'flip' },
      { type: 'spike', x: 15.9, on: 'floor', count: 2 },
      { type: 'portal', x: 23.4, kind: 'flip' },
    ],
  },
  {
    // Spider: 2 beds, mines, platforms, a slow speed portal.
    id: 'r5-08',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 8.4, k: 'slow' },
      { type: 'spike', x: 10.9, on: 'floor', count: 11 },
      { type: 'block', x: 11.4, y: 5, w: 4, h: 0.8 },
      { type: 'block', x: 16.9, y: 6.2, w: 4, h: 0.8 },
      { type: 'spike', x: 16.9, on: 'ceil', count: 3 },
      { type: 'mine', x: 22.9, y: 2.8, r: 0.6 },
    ],
  },
  {
    // Ball: a gravity pad, 1 orb, 1 bed, in the dark.
    id: 'r5-09',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'gravity', x: 11.6, on: 'floor' },
      { type: 'spike', x: 13.6, on: 'floor', count: 6 },
      { type: 'pad', kind: 'jump', x: 20.6, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 25.9, y: 8.3 },
      { type: 'dark', from: 10.6, to: 28 },
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
      { type: 'spike', x: 8.4, on: 'ceil', count: 2 },
      { type: 'spike', x: 17.1, on: 'floor', count: 2 },
      { type: 'pillar', x: 21.1, on: 'ceil', h: 4.5 },
    ],
  },
];
