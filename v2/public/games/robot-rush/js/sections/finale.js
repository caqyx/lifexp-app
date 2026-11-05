// @ts-check
// Robot Rush's finale "Neonowy Szczyt" (docs/v2/PLAN.md 9.1, stage rr-b): ten fixed stretches
// (never shuffled), 44 cells each, up to the top of the city's highest tower at the finale's
// tier — every idea of the run, three or four at a time. Every stretch is proven fair.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const FINALE_SECTIONS = [
  {
    // 1 spike bed, a jump orb.
    id: 'n-01',
    mode: 'robot',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'spike', x: 10, on: 'floor', count: 7 },
      { type: 'ring', kind: 'jump', x: 13.5, y: 7.6 },
      { type: 'spike', x: 34.1, on: 'ceil', count: 3 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, a moving saw, a slow speed portal.
    id: 'n-02',
    mode: 'robot',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'speed', x: 10, k: 'slow' },
      { type: 'saw', x: 13, y: 8, r: 0.6, move: { dx: 0, dy: 1.2, every: 6, phase: 0.25 } },
      { type: 'block', x: 21.7, y: 9, w: 3, h: 1 },
      { type: 'block', x: 25.9, y: 7.6, w: 3, h: 2.4 },
      { type: 'spike', x: 35.4, on: 'floor', count: 4 },
    ],
  },
  {
    // 2 spike beds, columns to jump, a stepping stone over a pit, a jump pad, in the dark.
    id: 'n-03',
    mode: 'robot',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'pad', kind: 'jump', x: 10, on: 'floor' },
      { type: 'spike', x: 11.5, on: 'floor', count: 3 },
      { type: 'spike', x: 21.8, on: 'floor', count: 7 },
      { type: 'block', x: 24.8, y: 8.4, w: 1.5, h: 0.6 },
      { type: 'pillar', x: 36.1, on: 'floor', h: 2 },
      { type: 'dark', from: 9, to: 42 },
    ],
  },
  {
    // 1 spike bed, ledges to climb.
    id: 'n-04',
    mode: 'robot',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'block', x: 10, y: 8, w: 5, h: 2 },
      { type: 'spike', x: 15, on: 'floor', count: 3 },
      { type: 'spike', x: 35.1, on: 'ceil', count: 3 },
    ],
  },
  {
    // 2 spike beds, a spiked roof to hop under, a moving saw.
    id: 'n-05',
    mode: 'robot',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'spike', x: 11, on: 'floor', count: 3 },
      { type: 'block', x: 10, y: 2, w: 5, h: 1.8 },
      { type: 'spike', x: 10, y: 3.8, dir: 'down', count: 5 },
      { type: 'saw', x: 23.3, y: 9.6, r: 0.6, move: { dx: 1.2, dy: 0, every: 6, phase: 0 } },
      { type: 'spike', x: 33.6, on: 'floor', count: 1 },
    ],
  },
  {
    // 1 spike bed, saws, gravity turned over and back, in the dark.
    id: 'n-06',
    mode: 'robot',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'portal', x: 10, kind: 'flip' },
      { type: 'spike', x: 19.8, on: 'ceil', count: 3 },
      { type: 'portal', x: 29.6, kind: 'flip' },
      { type: 'spike', x: 37.7, on: 'floor', count: 2 },
      { type: 'saw', x: 38.7, y: 5, r: 0.7 },
      { type: 'dark', from: 9, to: 42 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, a veryFast speed portal, a jump orb.
    id: 'n-07',
    mode: 'robot',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'speed', x: 10, k: 'veryFast' },
      { type: 'spike', x: 12, on: 'floor', count: 6 },
      { type: 'ring', kind: 'jump', x: 15, y: 7.2 },
      { type: 'block', x: 28.7, y: 9, w: 4, h: 1 },
      { type: 'block', x: 35, y: 7.6, w: 3, h: 2.4 },
    ],
  },
  {
    // 1 spike bed, a spiked roof to hop under, a moving saw.
    id: 'n-08',
    mode: 'robot',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'saw', x: 11, y: 7.9, r: 0.7, move: { dx: 0, dy: 1.2, every: 8, phase: 0.5 } },
      { type: 'spike', x: 22.3, on: 'floor', count: 2 },
      { type: 'block', x: 21.3, y: 2, w: 4, h: 1.4 },
      { type: 'spike', x: 21.3, y: 3.4, dir: 'down', count: 4 },
    ],
  },
  {
    // 3 spike beds, a stepping stone over a pit, a jump orb, in the dark.
    id: 'n-09',
    mode: 'robot',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'spike', x: 10, on: 'floor', count: 5 },
      { type: 'block', x: 12, y: 8, w: 1.5, h: 0.6 },
      { type: 'spike', x: 22.3, on: 'floor', count: 7 },
      { type: 'ring', kind: 'jump', x: 25.1, y: 7.2 },
      { type: 'spike', x: 36.6, on: 'floor', count: 4 },
      { type: 'dark', from: 9, to: 42 },
    ],
  },
  {
    // 1 spike bed, a veryFast speed portal, a jump pad.
    id: 'n-10',
    mode: 'robot',
    length: 44,
    ceil: '2 r44',
    floor: '10 r44',
    hazards: [
      { type: 'speed', x: 10, k: 'veryFast' },
      { type: 'pad', kind: 'jump', x: 12, on: 'floor' },
      { type: 'spike', x: 13.5, on: 'floor', count: 4 },
    ],
  },
];
