// @ts-check
// Flip Rush sector 2 "Normalny" (docs/v2/PLAN.md 9.1, stage f-1): 15 sections, 1–5 then
// 6–15 (each group shuffled), speed 0.85, no portals; eight for the ball, seven for the
// spider. The mine: tighter beds, platforms in pairs, saws and stepped floors, closer
// together. Every section is proven fair by v2/tests/flip-rush-sections.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR2 = [
  {
    // Ball: four beds, floor and ceiling in turn.
    id: 'r2-01',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 3 },
      { type: 'spike', x: 12, on: 'ceil', count: 3 },
      { type: 'spike', x: 17, on: 'floor', count: 3 },
      { type: 'spike', x: 22, on: 'ceil', count: 3 },
    ],
  },
  {
    // Spider: a bed under a platform, a bed over the next.
    id: 'r2-02',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 8, y: 5.8, w: 4, h: 0.8 },
      { type: 'spike', x: 8, on: 'floor', count: 4 },
      { type: 'block', x: 17, y: 5.4, w: 4, h: 0.8 },
      { type: 'spike', x: 17, on: 'ceil', count: 4 },
    ],
  },
  {
    // Ball: a low tunnel of beds.
    id: 'r2-03',
    mode: 'ball',
    length: 30,
    ceil: '2 r6 +1.5 r18 -1.5 r6',
    floor: '10 r6 -1 r18 +1 r6',
    hazards: [
      { type: 'spike', x: 8, on: 'floor', count: 3 },
      { type: 'spike', x: 14, on: 'ceil', count: 3 },
      { type: 'spike', x: 20, on: 'floor', count: 3 },
    ],
  },
  {
    // Spider: a stepped floor and a stepped ceiling.
    id: 'r2-04',
    mode: 'spider',
    length: 30,
    ceil: '2 r14 +1.5 r10 -1.5 r6',
    floor: '10 r7 -1.5 r9 +1.5 r14',
    hazards: [
      { type: 'spike', x: 9, on: 'ceil', count: 3 },
      { type: 'spike', x: 18, on: 'floor', count: 3 },
    ],
  },
  {
    // Ball: saws high and low across the way.
    id: 'r2-05',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 2 },
      { type: 'saw', x: 13, y: 7, r: 0.8 },
      { type: 'spike', x: 17, on: 'ceil', count: 2 },
      { type: 'saw', x: 22, y: 5, r: 0.8 },
    ],
  },
  {
    // Spider: pillars, closer.
    id: 'r2-06',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 8, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 13, on: 'ceil', h: 3.5 },
      { type: 'pillar', x: 18, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 23, on: 'ceil', h: 3.5 },
    ],
  },
  {
    // Ball: a raised floor between beds.
    id: 'r2-07',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r12 -2 r6 +2 r12',
    hazards: [
      { type: 'spike', x: 8, on: 'floor', count: 3 },
      { type: 'spike', x: 13, on: 'ceil', count: 4 },
      { type: 'spike', x: 21, on: 'floor', count: 3 },
    ],
  },
  {
    // Spider: a platform to stand on over a long bed, ceiling spikes above it.
    id: 'r2-08',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8, on: 'floor', count: 16 },
      { type: 'block', x: 9, y: 6, w: 6, h: 0.8 },
      { type: 'spike', x: 12, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a small pad over a short bed, then a gravity pad that throws it to the ceiling over a long one.
    id: 'r2-09',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'small', x: 7, on: 'floor' },
      { type: 'spike', x: 9, on: 'floor', count: 2 },
      { type: 'pad', kind: 'gravity', x: 14, on: 'floor' },
      { type: 'spike', x: 16, on: 'floor', count: 4 },
      { type: 'spike', x: 22, on: 'ceil', count: 3 },
    ],
  },
  {
    // Spider: a saw by each surface, in turn.
    id: 'r2-10',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 9, y: 9.4, r: 0.9 },
      { type: 'saw', x: 15, y: 2.6, r: 0.9 },
      { type: 'saw', x: 21, y: 9.4, r: 0.9 },
    ],
  },
  {
    // Ball: a block in the middle to land on.
    id: 'r2-11',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 14 },
      { type: 'block', x: 12, y: 6, w: 4, h: 1 },
      { type: 'spike', x: 13, on: 'ceil', count: 2 },
    ],
  },
  {
    // Spider: a jump orb over beds on both sides (the first orb), then a gravity pad across.
    id: 'r2-12',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 10, on: 'floor', count: 3 },
      { type: 'spike', x: 10, on: 'ceil', count: 3 },
      { type: 'ring', kind: 'jump', x: 9.5, y: 9.35 },
      { type: 'pad', kind: 'gravity', x: 17, on: 'floor' },
      { type: 'spike', x: 19, on: 'floor', count: 3 },
    ],
  },
  {
    // Ball: a stepped ceiling over a stepped floor.
    id: 'r2-13',
    mode: 'ball',
    length: 30,
    ceil: '2 r8 +1 r8 -1 r14',
    floor: '10 r16 -1 r8 +1 r6',
    hazards: [
      { type: 'spike', x: 10, on: 'floor', count: 3 },
      { type: 'spike', x: 18, on: 'ceil', count: 3 },
    ],
  },
  {
    // Spider: beds both sides in turn, two cells apart.
    id: 'r2-14',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6, on: 'floor', count: 3 },
      { type: 'spike', x: 11, on: 'ceil', count: 3 },
      { type: 'spike', x: 16, on: 'floor', count: 3 },
      { type: 'spike', x: 21, on: 'ceil', count: 3 },
    ],
  },
  {
    // Ball: a jump pad onto a chain of jump orbs between long beds on both sides.
    id: 'r2-15',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 5, on: 'floor' },
      { type: 'spike', x: 7, on: 'floor', count: 13 },
      { type: 'ring', kind: 'jump', x: 9.1, y: 8.3 },
      { type: 'ring', kind: 'jump', x: 12.9, y: 8.3 },
      { type: 'ring', kind: 'jump', x: 16.7, y: 8.3 },
      { type: 'spike', x: 7, on: 'ceil', count: 13 },
    ],
  },
];
