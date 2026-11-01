// @ts-check
// Flip Rush's finale "Serce Fabryki" (docs/v2/PLAN.md 9.1, stages f-2 and r-2): an original
// level, not a copy of any other — ten fixed stretches of 44 cells (never shuffled), ball and
// spider in turn at the finale's tier (1.45), every idea of the run combined: chains of orbs
// off jump pads, spider mazes, saws that swing, gravity flipped inside a stretch, speed
// portals, a dark stretch. Built from seeded templates (none like another section) and each
// stretch proven fair by v2/tests/flip-rush-sections.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const FINALE_SECTIONS = [
  {
    // Ball: a jump pad, 1 orb, 3 beds.
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
      { type: 'spike', x: 37.1, on: 'ceil', count: 2 },
    ],
  },
  {
    // Spider: 2 orbs, 4 beds, platforms, a slow speed portal.
    id: 'f-02',
    mode: 'spider',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'spike', x: 9.3, on: 'floor', count: 9 },
      { type: 'block', x: 9.8, y: 5.4, w: 3, h: 0.8 },
      { type: 'block', x: 14.3, y: 6.2, w: 3, h: 0.8 },
      { type: 'spike', x: 14.3, on: 'ceil', count: 2 },
      { type: 'speed', x: 21.8, k: 'slow' },
      { type: 'ring', kind: 'jump', x: 24.3, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 24.3, y: 2.65 },
      { type: 'spike', x: 25.5, on: 'floor', count: 2 },
      { type: 'spike', x: 25.5, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 orbs, 2 beds, columns, moving saws.
    id: 'f-03',
    mode: 'ball',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'pad', kind: 'jump', x: 9.3, on: 'floor' },
      { type: 'ring', kind: 'dash', x: 12.3, y: 7.4 },
      { type: 'pillar', x: 14.1, on: 'ceil', h: 4.6 },
      { type: 'saw', x: 22.1, y: 6, r: 1, move: { dx: 0, dy: 2.4, every: 10, phase: 0.5 } },
      { type: 'pad', kind: 'jump', x: 26.6, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 32.8, y: 8.3 },
      { type: 'spike', x: 28.6, on: 'floor', count: 11 },
      { type: 'spike', x: 28.6, on: 'ceil', count: 11 },
    ],
  },
  {
    // Spider: 3 beds, mines, platforms, gravity flipped and back, in the dark.
    id: 'f-04',
    mode: 'spider',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'portal', x: 9.3, kind: 'flip' },
      { type: 'spike', x: 17.8, on: 'ceil', count: 2 },
      { type: 'portal', x: 24.4, kind: 'flip' },
      { type: 'spike', x: 26.9, on: 'floor', count: 11 },
      { type: 'block', x: 27.4, y: 5, w: 4, h: 0.8 },
      { type: 'block', x: 32.4, y: 6.6, w: 4, h: 0.8 },
      { type: 'spike', x: 32.4, on: 'ceil', count: 3 },
      { type: 'mine', x: 38.4, y: 2.8, r: 0.6 },
      { type: 'dark', from: 8.3, to: 40.9 },
    ],
  },
  {
    // Ball: a jump pad, 1 orb, 1 bed, columns, moving saws.
    id: 'f-05',
    mode: 'ball',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'pad', kind: 'jump', x: 9.3, on: 'floor' },
      { type: 'ring', kind: 'gravityJump', x: 13.4, y: 7.6 },
      { type: 'spike', x: 11.3, on: 'floor', count: 4 },
      { type: 'saw', x: 25.4, y: 6, r: 0.9, move: { dx: 0, dy: 2.4, every: 7, phase: 0 } },
      { type: 'pillar', x: 29.8, on: 'floor', h: 3 },
      { type: 'pillar', x: 37.9, on: 'ceil', h: 3 },
    ],
  },
  {
    // Spider: a jump pad, 3 beds, moving saws.
    id: 'f-06',
    mode: 'spider',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'pad', kind: 'small', x: 9.3, on: 'floor' },
      { type: 'spike', x: 10.9, on: 'floor', count: 2 },
      { type: 'saw', x: 22.8, y: 6, r: 0.9, move: { dx: 1.6, dy: 1.2, every: 9, phase: 0.25 } },
      { type: 'spike', x: 27.2, on: 'ceil', count: 2 },
      { type: 'spike', x: 35.2, on: 'floor', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 orbs, 2 beds, in the dark.
    id: 'f-07',
    mode: 'ball',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'pad', kind: 'jump', x: 13.1, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 19.2, y: 8.3 },
      { type: 'ring', kind: 'jump', x: 26.2, y: 8.3 },
      { type: 'spike', x: 15.1, on: 'floor', count: 18 },
      { type: 'spike', x: 15.1, on: 'ceil', count: 18 },
      { type: 'dark', from: 12.1, to: 35.6 },
    ],
  },
  {
    // Spider: 1 orb, 3 beds, mines, platforms.
    id: 'f-08',
    mode: 'spider',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'mine', x: 9.3, y: 9.059999999999999, r: 0.7 },
      { type: 'mine', x: 16.1, y: 2.94, r: 0.7 },
      { type: 'spike', x: 19.1, on: 'floor', count: 9 },
      { type: 'block', x: 19.6, y: 5, w: 3.5, h: 0.8 },
      { type: 'block', x: 23.6, y: 6.6, w: 3.5, h: 0.8 },
      { type: 'spike', x: 23.6, on: 'ceil', count: 3 },
      { type: 'ring', kind: 'gravity', x: 31.6, y: 9.35 },
      { type: 'spike', x: 32.8, on: 'floor', count: 4 },
    ],
  },
  {
    // Ball: a jump pad, 1 orb, 1 bed, columns, gravity flipped and back.
    id: 'f-09',
    mode: 'ball',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'portal', x: 9.3, kind: 'flip' },
      { type: 'spike', x: 17.8, on: 'floor', count: 2 },
      { type: 'portal', x: 24.4, kind: 'flip' },
      { type: 'pad', kind: 'jump', x: 26.9, on: 'floor' },
      { type: 'ring', kind: 'dash', x: 29.9, y: 7.4 },
      { type: 'pillar', x: 31.7, on: 'ceil', h: 4.6 },
      { type: 'pad', kind: 'jump', x: 35.2, on: 'floor' },
    ],
  },
  {
    // Spider: 2 orbs, 4 beds, platforms, a slow speed portal.
    id: 'f-10',
    mode: 'spider',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'speed', x: 9.3, k: 'slow' },
      { type: 'ring', kind: 'jump', x: 11.8, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 11.8, y: 2.65 },
      { type: 'spike', x: 13, on: 'floor', count: 2 },
      { type: 'spike', x: 13, on: 'ceil', count: 2 },
      { type: 'spike', x: 20.7, on: 'floor', count: 10 },
      { type: 'block', x: 21.2, y: 5, w: 3.5, h: 0.8 },
      { type: 'block', x: 25.7, y: 6.6, w: 3.5, h: 0.8 },
      { type: 'spike', x: 25.7, on: 'ceil', count: 3 },
    ],
  },
];
