// @ts-check
// Robot Rush sector 4 "Trudniejszy" (docs/v2/PLAN.md 9.1, stage rr-b): 10 sections, speed 1.1,
// under the elevated railway. New: moving saws (swinging up and down or to and fro, keyed
// to the robot's place) and one mini section between its own mini portals. Every section
// is proven fair.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR4 = [
  {
    // 1 spike bed, a moving saw.
    id: 'rb4-01',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 9.2, y: 8, r: 0.6, move: { dx: 0, dy: 1.2, every: 6, phase: 0.75 } },
      { type: 'spike', x: 17.5, on: 'floor', count: 3 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, a moving saw.
    id: 'rb4-02',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 8.2, y: 8, w: 4, h: 2 },
      { type: 'spike', x: 12.2, on: 'floor', count: 2 },
      { type: 'saw', x: 20.9, y: 9.6, r: 0.6, move: { dx: 1.2, dy: 0, every: 8, phase: 0.25 } },
    ],
  },
  {
    // Open.
    id: 'rb4-03',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 18.5, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ledges to climb, a moving saw.
    id: 'rb4-04',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 9.2, y: 9.6, r: 0.6, move: { dx: 1.2, dy: 0, every: 8, phase: 0.25 } },
      { type: 'block', x: 17.5, y: 9, w: 3, h: 1 },
      { type: 'block', x: 21.7, y: 7.6, w: 3, h: 2.4 },
    ],
  },
  {
    // Columns to jump, a moving saw, a slow speed portal.
    id: 'rb4-05',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 8.2, k: 'slow' },
      { type: 'saw', x: 11.2, y: 8, r: 0.6, move: { dx: 0, dy: 1.2, every: 7, phase: 0.25 } },
      { type: 'pillar', x: 18.3, on: 'floor', h: 3 },
    ],
  },
  {
    // 1 spike bed, a spiked roof to hop under, a moving saw.
    id: 'rb4-06',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.2, on: 'floor', count: 3 },
      { type: 'block', x: 8.2, y: 2, w: 5, h: 1.8 },
      { type: 'spike', x: 8.2, y: 3.8, dir: 'down', count: 5 },
      { type: 'saw', x: 19.9, y: 7.9, r: 0.7, move: { dx: 0, dy: 1.2, every: 6, phase: 0.25 } },
    ],
  },
  {
    // 1 spike bed, a stepping stone over a pit, a moving saw.
    id: 'rb4-07',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 9.2, y: 9.6, r: 0.6, move: { dx: 1.2, dy: 0, every: 8, phase: 0.75 } },
      { type: 'spike', x: 17.5, on: 'floor', count: 5 },
      { type: 'block', x: 20.5, y: 8, w: 1.5, h: 0.6 },
    ],
  },
  {
    // 2 spike beds, ledges to climb, saws.
    id: 'rb4-08',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8.2, on: 'floor', count: 3 },
      { type: 'saw', x: 9.7, y: 5, r: 0.7 },
      { type: 'block', x: 17.4, y: 9, w: 5, h: 1 },
      { type: 'spike', x: 22.4, on: 'floor', count: 2 },
    ],
  },
  {
    // 2 spike beds, a moving saw.
    id: 'rb4-09',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 9.2, y: 7.9, r: 0.7, move: { dx: 0, dy: 1.2, every: 6, phase: 0.25 } },
      { type: 'spike', x: 17.5, on: 'floor', count: 1 },
      { type: 'spike', x: 23.1, on: 'floor', count: 3 },
    ],
  },
  {
    // Mini robot: 1 spike bed, columns to jump, saws.
    id: 'rb4-10',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    mini: true,
    hazards: [
      { type: 'spike', x: 8.2, on: 'floor', count: 2 },
      { type: 'pillar', x: 16.1, on: 'floor', h: 1.2 },
      { type: 'saw', x: 24, y: 9.7, r: 0.5 },
    ],
  },
];
