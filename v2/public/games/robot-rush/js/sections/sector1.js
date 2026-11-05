// @ts-check
// Robot Rush sector 1 "Łatwy" (docs/v2/PLAN.md 9.1, stage rr-b): 10 sections, all shuffled, speed 0.8,
// rooftops at dusk. The robot's basics: spike beds to jump, columns and ledges to clear,
// a spiked roof that wants a short hop (hold the press for a long jump, tap it for a low
// one). Every section is proven fair by v2/tests/robot-rush-sections.test.ts.
// Generated from templates with seeded variants, then each proven (stage rr-b).

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR1 = [
  {
    // 2 spike beds, columns to jump, a stepping stone over a pit.
    id: 'rb1-01',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6.7, on: 'floor', count: 3 },
      { type: 'pillar', x: 13.9, on: 'floor', h: 1.5 },
      { type: 'spike', x: 19.8, on: 'floor', count: 6 },
      { type: 'block', x: 21.8, y: 8, w: 1.5, h: 0.6 },
    ],
  },
  {
    // 2 spike beds, ledges to climb.
    id: 'rb1-02',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 6.7, y: 8.5, w: 4, h: 1.5 },
      { type: 'spike', x: 10.7, on: 'floor', count: 3 },
      { type: 'spike', x: 17.9, on: 'floor', count: 3 },
    ],
  },
  {
    // 1 spike bed, ledges to climb.
    id: 'rb1-03',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 6.7, y: 9, w: 4, h: 1 },
      { type: 'block', x: 11.5, y: 7.6, w: 3, h: 2.4 },
      { type: 'spike', x: 19.2, on: 'floor', count: 3 },
    ],
  },
  {
    // 2 spike beds, a spiked roof to hop under, columns to jump.
    id: 'rb1-04',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.7, on: 'floor', count: 2 },
      { type: 'block', x: 6.7, y: 2, w: 4, h: 1.8 },
      { type: 'spike', x: 6.7, y: 3.8, dir: 'down', count: 4 },
      { type: 'pillar', x: 14.9, on: 'floor', h: 2 },
      { type: 'spike', x: 20.4, on: 'floor', count: 3 },
    ],
  },
  {
    // 2 spike beds, saws.
    id: 'rb1-05',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6.7, on: 'floor', count: 1 },
      { type: 'spike', x: 11.2, on: 'floor', count: 2 },
      { type: 'saw', x: 18.1, y: 9.6, r: 0.6 },
    ],
  },
  {
    // 1 spike bed, columns to jump, a stepping stone over a pit.
    id: 'rb1-06',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6.7, on: 'floor', count: 6 },
      { type: 'block', x: 8.7, y: 8, w: 1.5, h: 0.6 },
      { type: 'pillar', x: 16.9, on: 'floor', h: 2.5 },
    ],
  },
  {
    // 1 spike bed, columns to jump, ledges to climb.
    id: 'rb1-07',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 6.7, on: 'floor', h: 1.5 },
      { type: 'block', x: 12.4, y: 8.5, w: 4, h: 1.5 },
      { type: 'spike', x: 16.4, on: 'floor', count: 3 },
    ],
  },
  {
    // Ledges to climb, saws.
    id: 'rb1-08',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 7.3, y: 9.6, r: 0.6 },
      { type: 'block', x: 12.9, y: 8.8, w: 4, h: 1.2 },
      { type: 'block', x: 17.8, y: 8, w: 3, h: 2 },
    ],
  },
  {
    // 2 spike beds, a spiked roof to hop under, ledges to climb.
    id: 'rb1-09',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6.7, on: 'floor', count: 1 },
      { type: 'spike', x: 12.8, on: 'floor', count: 3 },
      { type: 'block', x: 11.8, y: 2, w: 5, h: 1.4 },
      { type: 'spike', x: 11.8, y: 3.4, dir: 'down', count: 5 },
      { type: 'block', x: 21, y: 8, w: 6, h: 2 },
    ],
  },
  {
    // 3 spike beds, saws.
    id: 'rb1-10',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6.7, on: 'floor', count: 2 },
      { type: 'saw', x: 7.7, y: 4.6, r: 0.7 },
      { type: 'spike', x: 13.3, on: 'floor', count: 2 },
      { type: 'spike', x: 18.7, on: 'floor', count: 2 },
    ],
  },
];
