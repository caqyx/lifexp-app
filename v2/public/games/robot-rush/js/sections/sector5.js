// @ts-check
// Robot Rush sector 5 "Insane" (docs/v2/PLAN.md 9.1, stage rr-b): 10 sections, speed 1.25,
// a storm over the towers. New: the dark (the view closes in round the robot) and orbs and
// pads — a jump orb pressed in the air over a long pit, a jump pad on the way. One mini
// section. Every section is proven fair.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR5 = [
  {
    // 2 spike beds, a jump orb, in the dark.
    id: 'rb5-01',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9, on: 'floor', count: 7 },
      { type: 'ring', kind: 'jump', x: 12.5, y: 7.6 },
      { type: 'spike', x: 22.4, on: 'floor', count: 4 },
      { type: 'dark', from: 8, to: 28 },
    ],
  },
  {
    // 1 spike bed, columns to jump, a jump pad.
    id: 'rb5-02',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 9, on: 'floor' },
      { type: 'spike', x: 10.5, on: 'floor', count: 4 },
      { type: 'pillar', x: 20.9, on: 'floor', h: 2 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, a moving saw, in the dark.
    id: 'rb5-03',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 10, y: 7.9, r: 0.7, move: { dx: 0, dy: 1.2, every: 8, phase: 0.5 } },
      { type: 'block', x: 19.2, y: 8.5, w: 4, h: 1.5 },
      { type: 'spike', x: 23.2, on: 'floor', count: 3 },
      { type: 'dark', from: 8, to: 28 },
    ],
  },
  {
    // 1 spike bed, a jump orb.
    id: 'rb5-04',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9, on: 'floor', count: 7 },
      { type: 'ring', kind: 'jump', x: 11.8, y: 7.6 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, a jump pad, in the dark.
    id: 'rb5-05',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 9, on: 'floor' },
      { type: 'spike', x: 10.5, on: 'floor', count: 4 },
      { type: 'block', x: 20.9, y: 9, w: 4, h: 1 },
      { type: 'dark', from: 8, to: 28 },
    ],
  },
  {
    // 1 spike bed, saws, a fast speed portal, a jump orb.
    id: 'rb5-06',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 9, k: 'fast' },
      { type: 'spike', x: 11, on: 'floor', count: 6 },
      { type: 'ring', kind: 'jump', x: 13.4, y: 7.2 },
      { type: 'saw', x: 25.5, y: 9.6, r: 0.7 },
    ],
  },
  {
    // 2 spike beds, a spiked roof to hop under, a jump pad, in the dark.
    id: 'rb5-07',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 10, on: 'floor', count: 3 },
      { type: 'block', x: 9, y: 2, w: 5, h: 1.4 },
      { type: 'spike', x: 9, y: 3.4, dir: 'down', count: 5 },
      { type: 'pad', kind: 'jump', x: 20.4, on: 'floor' },
      { type: 'spike', x: 21.9, on: 'floor', count: 3 },
      { type: 'dark', from: 8, to: 28 },
    ],
  },
  {
    // 1 spike bed, ledges to climb.
    id: 'rb5-08',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 9, y: 8, w: 5, h: 2 },
      { type: 'spike', x: 14, on: 'floor', count: 2 },
      { type: 'block', x: 22.4, y: 8.8, w: 4, h: 1.2 },
    ],
  },
  {
    // 1 spike bed, a stepping stone over a pit, a moving saw, in the dark.
    id: 'rb5-09',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9, on: 'floor', count: 7 },
      { type: 'block', x: 11, y: 8.4, w: 1.5, h: 0.6 },
      { type: 'saw', x: 23.4, y: 8, r: 0.6, move: { dx: 0, dy: 1.2, every: 7, phase: 0.75 } },
      { type: 'dark', from: 8, to: 28 },
    ],
  },
  {
    // Mini robot: 1 spike bed, columns to jump.
    id: 'rb5-10',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    mini: true,
    hazards: [
      { type: 'spike', x: 9, on: 'floor', count: 2 },
      { type: 'pillar', x: 18, on: 'floor', h: 1.2 },
    ],
  },
];
