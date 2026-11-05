// @ts-check
// Robot Rush sector 6 "Demon" (docs/v2/PLAN.md 9.1, stage rr-b): 30 sections in four bands —
// Easy (1–10), Hard (11–15), Insane (16–25) and Extreme (26–30) Demon — every idea of the
// run combined: speed portals, gravity turned over inside sections (those run 36 cells),
// moving saws, the dark, orbs and pads, spiked roofs; a mini section in Hard, Insane and
// Extreme. Every section is proven fair at its band's tier.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR6 = [
  {
    // A slow speed portal, gravity turned over and back.
    id: 'rd-01',
    mode: 'robot',
    length: 36,
    ceil: '2 r36',
    floor: '10 r36',
    hazards: [
      { type: 'portal', x: 9, kind: 'flip' },
      { type: 'spike', x: 16.6, on: 'ceil', count: 2 },
      { type: 'portal', x: 23.3, kind: 'flip' },
      { type: 'speed', x: 30.3, k: 'slow' },
    ],
  },
  {
    // 1 spike bed, a spiked roof to hop under, saws.
    id: 'rd-02',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 9.6, y: 9.6, r: 0.6 },
      { type: 'spike', x: 18, on: 'floor', count: 2 },
      { type: 'block', x: 17, y: 2, w: 4, h: 1.8 },
      { type: 'spike', x: 17, y: 3.8, dir: 'down', count: 4 },
    ],
  },
  {
    // 1 spike bed, columns to jump, a jump orb, in the dark.
    id: 'rd-03',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 9, on: 'floor', h: 2 },
      { type: 'spike', x: 17.5, on: 'floor', count: 6 },
      { type: 'ring', kind: 'jump', x: 20.5, y: 7.6 },
      { type: 'dark', from: 8, to: 28 },
    ],
  },
  {
    // 2 spike beds, a spiked roof to hop under, a stepping stone over a pit.
    id: 'rd-04',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9, on: 'floor', count: 5 },
      { type: 'block', x: 12, y: 8.4, w: 1.5, h: 0.6 },
      { type: 'spike', x: 21.8, on: 'floor', count: 2 },
      { type: 'block', x: 20.8, y: 2, w: 4, h: 1.8 },
      { type: 'spike', x: 20.8, y: 3.8, dir: 'down', count: 4 },
    ],
  },
  {
    // 1 spike bed, a moving saw, a fast speed portal, a jump pad.
    id: 'rd-05',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 9, on: 'floor' },
      { type: 'spike', x: 10.5, on: 'floor', count: 3 },
      { type: 'speed', x: 20.7, k: 'fast' },
      { type: 'saw', x: 23.7, y: 7.9, r: 0.7, move: { dx: 0, dy: 1.2, every: 6, phase: 0 } },
    ],
  },
  {
    // Ledges to climb, saws, in the dark.
    id: 'rd-06',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 9, y: 9, w: 3, h: 1 },
      { type: 'block', x: 13.3, y: 8, w: 3, h: 2 },
      { type: 'saw', x: 23.9, y: 9.6, r: 0.6 },
      { type: 'dark', from: 8, to: 28 },
    ],
  },
  {
    // Gravity turned over and back.
    id: 'rd-07',
    mode: 'robot',
    length: 36,
    ceil: '2 r36',
    floor: '10 r36',
    hazards: [
      { type: 'portal', x: 9, kind: 'flip' },
      { type: 'spike', x: 17.5, on: 'ceil', count: 1 },
      { type: 'portal', x: 23.8, kind: 'flip' },
    ],
  },
  {
    // 2 spike beds.
    id: 'rd-08',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9, on: 'floor', count: 1 },
      { type: 'spike', x: 16.4, on: 'floor', count: 2 },
    ],
  },
  {
    // 2 spike beds, saws, a slow speed portal, in the dark.
    id: 'rd-09',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 9, k: 'slow' },
      { type: 'saw', x: 11.7, y: 9.6, r: 0.7 },
      { type: 'spike', x: 18, on: 'floor', count: 1 },
      { type: 'spike', x: 23.6, on: 'floor', count: 2 },
      { type: 'dark', from: 8, to: 28 },
    ],
  },
  {
    // 2 spike beds, saws, a jump orb.
    id: 'rd-10',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9, on: 'floor', count: 6 },
      { type: 'ring', kind: 'jump', x: 11.4, y: 7.6 },
      { type: 'spike', x: 21.4, on: 'floor', count: 3 },
      { type: 'saw', x: 22.9, y: 5, r: 0.7 },
    ],
  },
  {
    // 1 spike bed, columns to jump, ledges to climb.
    id: 'rd-11',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 9.8, y: 9, w: 4, h: 1 },
      { type: 'spike', x: 13.8, on: 'floor', count: 3 },
      { type: 'pillar', x: 24.3, on: 'floor', h: 2.5 },
    ],
  },
  {
    // Gravity turned over and back.
    id: 'rd-12',
    mode: 'robot',
    length: 36,
    ceil: '2 r36',
    floor: '10 r36',
    hazards: [
      { type: 'portal', x: 11.2, kind: 'flip' },
      { type: 'spike', x: 21, on: 'ceil', count: 2 },
      { type: 'portal', x: 29.4, kind: 'flip' },
    ],
  },
  {
    // 1 spike bed, ledges to climb, a slow speed portal.
    id: 'rd-13',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.8, on: 'floor', count: 4 },
      { type: 'speed', x: 20.9, k: 'slow' },
      { type: 'block', x: 22.9, y: 9, w: 4, h: 1 },
    ],
  },
  {
    // 1 spike bed, a spiked roof to hop under.
    id: 'rd-14',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 12.2, on: 'floor', count: 3 },
      { type: 'block', x: 11.2, y: 2, w: 5, h: 1.4 },
      { type: 'spike', x: 11.2, y: 3.4, dir: 'down', count: 5 },
    ],
  },
  {
    // Mini robot: columns to jump, saws.
    id: 'rd-15',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    mini: true,
    hazards: [
      { type: 'pillar', x: 9.8, on: 'floor', h: 1.2 },
      { type: 'saw', x: 18.7, y: 9.7, r: 0.5 },
    ],
  },
  {
    // Columns to jump.
    id: 'rd-16',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 12.2, on: 'floor', h: 2.5 },
    ],
  },
  {
    // 1 spike bed, a stepping stone over a pit, a veryFast speed portal.
    id: 'rd-17',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 10.6, on: 'floor', count: 5 },
      { type: 'block', x: 13.6, y: 8, w: 1.5, h: 0.6 },
      { type: 'speed', x: 23.3, k: 'veryFast' },
    ],
  },
  {
    // Gravity turned over and back.
    id: 'rd-18',
    mode: 'robot',
    length: 36,
    ceil: '2 r36',
    floor: '10 r36',
    hazards: [
      { type: 'portal', x: 10.6, kind: 'flip' },
      { type: 'spike', x: 20.2, on: 'ceil', count: 1 },
      { type: 'portal', x: 27.4, kind: 'flip' },
    ],
  },
  {
    // Ledges to climb.
    id: 'rd-19',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 10.6, y: 8.8, w: 3, h: 1.2 },
      { type: 'block', x: 15.2, y: 7.6, w: 4, h: 2.4 },
    ],
  },
  {
    // 1 spike bed, a spiked roof to hop under, a moving saw.
    id: 'rd-20',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 11.6, y: 9.6, r: 0.7, move: { dx: 1.2, dy: 0, every: 8, phase: 0.5 } },
      { type: 'spike', x: 23.4, on: 'floor', count: 2 },
      { type: 'block', x: 22.4, y: 2, w: 4, h: 1.4 },
      { type: 'spike', x: 22.4, y: 3.4, dir: 'down', count: 4 },
    ],
  },
  {
    // 2 spike beds, a veryFast speed portal, in the dark.
    id: 'rd-21',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 10.6, k: 'veryFast' },
      { type: 'spike', x: 12.6, on: 'floor', count: 2 },
      { type: 'spike', x: 23.4, on: 'floor', count: 3 },
      { type: 'dark', from: 9.6, to: 28 },
    ],
  },
  {
    // Gravity turned over and back.
    id: 'rd-22',
    mode: 'robot',
    length: 36,
    ceil: '2 r36',
    floor: '10 r36',
    hazards: [
      { type: 'portal', x: 12.2, kind: 'flip' },
      { type: 'spike', x: 22.8, on: 'ceil', count: 1 },
      { type: 'portal', x: 30.9, kind: 'flip' },
    ],
  },
  {
    // 2 spike beds, saws, a jump orb.
    id: 'rd-23',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 10.6, on: 'floor', count: 6 },
      { type: 'ring', kind: 'jump', x: 13, y: 7.2 },
      { type: 'spike', x: 24.3, on: 'floor', count: 2 },
      { type: 'saw', x: 25.3, y: 4.6, r: 0.7 },
    ],
  },
  {
    // 1 spike bed, columns to jump, ledges to climb, in the dark.
    id: 'rd-24',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 10.6, y: 8.5, w: 6, h: 1.5 },
      { type: 'spike', x: 16.6, on: 'floor', count: 2 },
      { type: 'pillar', x: 26.3, on: 'floor', h: 2.5 },
      { type: 'dark', from: 9.6, to: 28 },
    ],
  },
  {
    // Mini robot: columns to jump, saws.
    id: 'rd-25',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    mini: true,
    hazards: [
      { type: 'pillar', x: 10.6, on: 'floor', h: 1.5 },
      { type: 'saw', x: 20.8, y: 9.7, r: 0.5 },
    ],
  },
  {
    // 1 spike bed.
    id: 'rd-26',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 11.3, on: 'floor', count: 3 },
    ],
  },
  {
    // 2 spike beds, a spiked roof to hop under.
    id: 'rd-27',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 12.3, on: 'floor', count: 3 },
      { type: 'block', x: 11.3, y: 2, w: 5, h: 2.2 },
      { type: 'spike', x: 11.3, y: 4.2, dir: 'down', count: 5 },
      { type: 'spike', x: 24.8, on: 'floor', count: 2 },
    ],
  },
  {
    // 1 spike bed, saws.
    id: 'rd-28',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 12, y: 9.6, r: 0.7 },
      { type: 'spike', x: 21.6, on: 'floor', count: 2 },
      { type: 'saw', x: 22.6, y: 4.6, r: 0.7 },
    ],
  },
  {
    // 1 spike bed, ledges to climb, a fast speed portal.
    id: 'rd-29',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 11.3, k: 'fast' },
      { type: 'block', x: 13.3, y: 9, w: 4, h: 1 },
      { type: 'spike', x: 17.3, on: 'floor', count: 3 },
    ],
  },
  {
    // Mini robot: 1 spike bed, ledges to climb.
    id: 'rd-30',
    mode: 'robot',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    mini: true,
    hazards: [
      { type: 'block', x: 11.3, y: 9, w: 5, h: 1 },
      { type: 'spike', x: 16.3, on: 'floor', count: 2 },
    ],
  },
];
