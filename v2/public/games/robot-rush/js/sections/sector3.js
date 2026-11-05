// @ts-check
// Robot Rush sector 3 "Trudny" (docs/v2/PLAN.md 9.1, stage rr-b): 15 sections, speed 1.0,
// harbour cranes at night. New: gravity turned over inside a section and back — the robot
// falls to the ceiling, runs on it (a jump goes down), clears a bed there and falls back.
// Every section is proven fair.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR3 = [
  {
    // Gravity turned over and back.
    id: 'rb3-01',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'portal', x: 7.7, kind: 'flip' },
      { type: 'spike', x: 14.9, on: 'ceil', count: 3 },
      { type: 'portal', x: 22.6, kind: 'flip' },
    ],
  },
  {
    // 1 spike bed, ledges to climb.
    id: 'rb3-02',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 7.7, y: 8, w: 4, h: 2 },
      { type: 'spike', x: 11.7, on: 'floor', count: 3 },
    ],
  },
  {
    // 1 spike bed, columns to jump, a fast speed portal.
    id: 'rb3-03',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 7.7, k: 'fast' },
      { type: 'pillar', x: 9.7, on: 'floor', h: 2 },
      { type: 'spike', x: 18.1, on: 'floor', count: 1 },
    ],
  },
  {
    // Gravity turned over and back.
    id: 'rb3-04',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'portal', x: 7.7, kind: 'flip' },
      { type: 'spike', x: 14.9, on: 'ceil', count: 2 },
      { type: 'portal', x: 21.6, kind: 'flip' },
    ],
  },
  {
    // 1 spike bed, a spiked roof to hop under.
    id: 'rb3-05',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8.7, on: 'floor', count: 2 },
      { type: 'block', x: 7.7, y: 2, w: 4, h: 2.2 },
      { type: 'spike', x: 7.7, y: 4.2, dir: 'down', count: 4 },
      { type: 'spike', x: 24.1, on: 'ceil', count: 2 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, saws.
    id: 'rb3-06',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 7.7, y: 9, w: 3, h: 1 },
      { type: 'block', x: 11.7, y: 8, w: 3, h: 2 },
      { type: 'spike', x: 20.4, on: 'floor', count: 2 },
      { type: 'saw', x: 21.4, y: 4.6, r: 0.7 },
    ],
  },
  {
    // Gravity turned over and back.
    id: 'rb3-07',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'portal', x: 7.7, kind: 'flip' },
      { type: 'spike', x: 15.3, on: 'ceil', count: 3 },
      { type: 'portal', x: 23.3, kind: 'flip' },
    ],
  },
  {
    // 2 spike beds, a stepping stone over a pit, a slow speed portal.
    id: 'rb3-08',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.7, on: 'floor', count: 7 },
      { type: 'block', x: 9.7, y: 8.4, w: 1.5, h: 0.6 },
      { type: 'speed', x: 19.9, k: 'slow' },
      { type: 'spike', x: 21.9, on: 'floor', count: 3 },
    ],
  },
  {
    // Columns to jump.
    id: 'rb3-09',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 7.7, on: 'floor', h: 2 },
      { type: 'spike', x: 21.7, on: 'ceil', count: 3 },
    ],
  },
  {
    // Gravity turned over and back.
    id: 'rb3-10',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'portal', x: 8.7, kind: 'flip' },
      { type: 'spike', x: 17.2, on: 'ceil', count: 3 },
      { type: 'portal', x: 25.8, kind: 'flip' },
    ],
  },
  {
    // Ledges to climb, saws.
    id: 'rb3-11',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 8.3, y: 9.6, r: 0.6 },
      { type: 'block', x: 14.8, y: 8.8, w: 4, h: 1.2 },
      { type: 'block', x: 19.8, y: 8, w: 4, h: 2 },
    ],
  },
  {
    // A slow speed portal, gravity turned over and back.
    id: 'rb3-12',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 7.7, k: 'slow' },
      { type: 'portal', x: 9.7, kind: 'flip' },
      { type: 'spike', x: 15.8, on: 'ceil', count: 3 },
      { type: 'portal', x: 22.5, kind: 'flip' },
    ],
  },
  {
    // 2 spike beds, ledges to climb, saws.
    id: 'rb3-13',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 7.7, y: 8.5, w: 5, h: 1.5 },
      { type: 'spike', x: 12.7, on: 'floor', count: 2 },
      { type: 'spike', x: 19.9, on: 'floor', count: 2 },
      { type: 'saw', x: 20.9, y: 4.6, r: 0.7 },
    ],
  },
  {
    // Open.
    id: 'rb3-14',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 18, on: 'ceil', count: 3 },
    ],
  },
  {
    // 2 spike beds, columns to jump.
    id: 'rb3-15',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.7, on: 'floor', count: 1 },
      { type: 'spike', x: 13.2, on: 'floor', count: 2 },
      { type: 'pillar', x: 20.4, on: 'floor', h: 2.5 },
    ],
  },
];
