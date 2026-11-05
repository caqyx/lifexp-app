// @ts-check
// Robot Rush sector 2 "Normalny" (docs/v2/PLAN.md 9.1, stage rr-b): 15 sections, speed 0.85,
// the avenue of shop signs. New: speed portals (fast and slow) inside a section — the jumps
// after one are timed for the new speed. Every section is proven fair.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR2 = [
  {
    // 2 spike beds, columns to jump, ledges to climb, a slow speed portal.
    id: 'rb2-01',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 6.9, k: 'slow' },
      { type: 'spike', x: 8.9, on: 'floor', count: 2 },
      { type: 'pillar', x: 14.7, on: 'floor', h: 2.5 },
      { type: 'block', x: 19.8, y: 8, w: 5, h: 2 },
      { type: 'spike', x: 24.8, on: 'floor', count: 2 },
    ],
  },
  {
    // 3 spike beds, ledges to climb.
    id: 'rb2-02',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 6.9, y: 8.5, w: 4, h: 1.5 },
      { type: 'spike', x: 10.9, on: 'floor', count: 2 },
      { type: 'spike', x: 17.4, on: 'floor', count: 2 },
      { type: 'spike', x: 23.3, on: 'floor', count: 2 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, a slow speed portal.
    id: 'rb2-03',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 6.9, y: 9, w: 4, h: 1 },
      { type: 'block', x: 11.8, y: 8, w: 3, h: 2 },
      { type: 'speed', x: 19.7, k: 'slow' },
      { type: 'spike', x: 21.7, on: 'floor', count: 3 },
    ],
  },
  {
    // 1 spike bed, a spiked roof to hop under, columns to jump, saws.
    id: 'rb2-04',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7.9, on: 'floor', count: 2 },
      { type: 'block', x: 6.9, y: 2, w: 4, h: 1.4 },
      { type: 'spike', x: 6.9, y: 3.4, dir: 'down', count: 4 },
      { type: 'saw', x: 16, y: 9.6, r: 0.6 },
      { type: 'pillar', x: 21.6, on: 'floor', h: 2.5 },
    ],
  },
  {
    // 2 spike beds, ledges to climb, a stepping stone over a pit, a slow speed portal.
    id: 'rb2-05',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 6.9, k: 'slow' },
      { type: 'spike', x: 8.9, on: 'floor', count: 7 },
      { type: 'block', x: 11.9, y: 8.4, w: 1.5, h: 0.6 },
      { type: 'block', x: 19.6, y: 8.5, w: 4, h: 1.5 },
      { type: 'spike', x: 23.6, on: 'floor', count: 3 },
    ],
  },
  {
    // 2 spike beds, columns to jump, saws.
    id: 'rb2-06',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6.9, on: 'floor', count: 3 },
      { type: 'saw', x: 8.4, y: 5, r: 0.7 },
      { type: 'pillar', x: 14.8, on: 'floor', h: 2.5 },
      { type: 'spike', x: 20.5, on: 'floor', count: 4 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, saws, a fast speed portal.
    id: 'rb2-07',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 6.9, k: 'fast' },
      { type: 'block', x: 8.9, y: 8, w: 5, h: 2 },
      { type: 'spike', x: 13.9, on: 'floor', count: 3 },
      { type: 'saw', x: 23.1, y: 9.6, r: 0.7 },
    ],
  },
  {
    // 2 spike beds, ledges to climb.
    id: 'rb2-08',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6.9, on: 'floor', count: 1 },
      { type: 'spike', x: 11.6, on: 'floor', count: 3 },
      { type: 'block', x: 19, y: 9, w: 3, h: 1 },
      { type: 'block', x: 22.9, y: 8, w: 4, h: 2 },
    ],
  },
  {
    // 2 spike beds, a spiked roof to hop under, a stepping stone over a pit.
    id: 'rb2-09',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6.9, on: 'floor', count: 7 },
      { type: 'block', x: 9.9, y: 8.4, w: 1.5, h: 0.6 },
      { type: 'spike', x: 19.4, on: 'floor', count: 3 },
      { type: 'block', x: 18.4, y: 2, w: 5, h: 2.2 },
      { type: 'spike', x: 18.4, y: 4.2, dir: 'down', count: 5 },
    ],
  },
  {
    // 2 spike beds, columns to jump, a slow speed portal.
    id: 'rb2-10',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 6.9, k: 'slow' },
      { type: 'pillar', x: 8.9, on: 'floor', h: 3 },
      { type: 'spike', x: 14.1, on: 'floor', count: 1 },
      { type: 'spike', x: 18.7, on: 'floor', count: 2 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, saws.
    id: 'rb2-11',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 7.6, y: 9.6, r: 0.7 },
      { type: 'block', x: 13.4, y: 8.5, w: 5, h: 1.5 },
      { type: 'spike', x: 18.4, on: 'floor', count: 2 },
    ],
  },
  {
    // 2 spike beds, a spiked roof to hop under, a fast speed portal.
    id: 'rb2-12',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 6.9, k: 'fast' },
      { type: 'spike', x: 9.9, on: 'floor', count: 2 },
      { type: 'block', x: 8.9, y: 2, w: 4, h: 2.2 },
      { type: 'spike', x: 8.9, y: 4.2, dir: 'down', count: 4 },
      { type: 'spike', x: 18.7, on: 'floor', count: 3 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, saws.
    id: 'rb2-13',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6.9, on: 'floor', count: 2 },
      { type: 'saw', x: 7.9, y: 4.6, r: 0.7 },
      { type: 'block', x: 13.8, y: 9, w: 4, h: 1 },
      { type: 'block', x: 18.7, y: 8, w: 4, h: 2 },
    ],
  },
  {
    // 2 spike beds, a stepping stone over a pit, saws.
    id: 'rb2-14',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6.9, on: 'floor', count: 3 },
      { type: 'spike', x: 14.5, on: 'floor', count: 7 },
      { type: 'block', x: 17.5, y: 8, w: 1.5, h: 0.6 },
      { type: 'saw', x: 26.6, y: 9.6, r: 0.6 },
    ],
  },
  {
    // 1 spike bed, columns to jump, saws, a fast speed portal.
    id: 'rb2-15',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 6.9, k: 'fast' },
      { type: 'spike', x: 8.9, on: 'floor', count: 3 },
      { type: 'saw', x: 10.4, y: 5, r: 0.7 },
      { type: 'pillar', x: 17.9, on: 'floor', h: 2 },
    ],
  },
];
