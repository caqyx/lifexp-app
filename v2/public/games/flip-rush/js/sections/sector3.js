// @ts-check
// Flip Rush sector 3 "Trudny" (docs/v2/PLAN.md 9.1, stage f-1): 15 sections, 1–5 then
// 6–15 (each group shuffled), speed 1.0, one gravity flip for two sections; seven for the
// ball, eight for the spider, so the vehicle changes more often than before. The foundry:
// short beds in quick turns, platforms in a row, saws over molten floors, a tunnel of
// steps, mines. Every section is proven fair by v2/tests/flip-rush-sections.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR3 = [
  {
    // Spider: beds in quick turns.
    id: 'r3-01',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6, on: 'floor', count: 3 },
      { type: 'spike', x: 10.5, on: 'ceil', count: 3 },
      { type: 'spike', x: 15, on: 'floor', count: 3 },
      { type: 'spike', x: 19.5, on: 'ceil', count: 3 },
      { type: 'spike', x: 24, on: 'floor', count: 2 },
    ],
  },
  {
    // Ball: beds in a lowered corridor.
    id: 'r3-02',
    mode: 'ball',
    length: 30,
    ceil: '2 r9 +1.5 r15 -1.5 r6',
    floor: '10 r9 -1.5 r15 +1.5 r6',
    hazards: [
      { type: 'spike', x: 11, on: 'floor', count: 3 },
      { type: 'spike', x: 15, on: 'ceil', count: 3 },
      { type: 'spike', x: 19.5, on: 'floor', count: 3 },
    ],
  },
  {
    // Spider: platforms in a row over a bed, ceiling spikes between them.
    id: 'r3-03',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 18 },
      { type: 'block', x: 8, y: 6, w: 5, h: 0.8 },
      { type: 'spike', x: 10, on: 'ceil', count: 2 },
      { type: 'block', x: 16, y: 6, w: 5, h: 0.8 },
      { type: 'spike', x: 17, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: saws over the floor and under the ceiling.
    id: 'r3-04',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 9, y: 9.3, r: 1 },
      { type: 'saw', x: 15, y: 2.7, r: 1 },
      { type: 'saw', x: 21, y: 9.3, r: 1 },
      { type: 'saw', x: 26, y: 2.7, r: 1 },
    ],
  },
  {
    // Spider: a lowered ceiling and a raised floor, a wall each to snap away from.
    id: 'r3-05',
    mode: 'spider',
    length: 30,
    ceil: '2 r10.5 +1.5 r11.5 -1.5 r8',
    floor: '10 r15 -1.5 r9 +1.5 r6',
    hazards: [
      { type: 'spike', x: 6, on: 'floor', count: 2 },
      { type: 'spike', x: 11.5, on: 'ceil', count: 2 },
      { type: 'spike', x: 18, on: 'floor', count: 2 },
    ],
  },
  {
    // Ball: columns, closer.
    id: 'r3-06',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 8, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 13.5, on: 'ceil', h: 3.5 },
      { type: 'pillar', x: 19, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 24.5, on: 'ceil', h: 3.5 },
    ],
  },
  {
    // Spider: mines by the surfaces, closer.
    id: 'r3-07',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 8, y: 9.2, r: 0.7 },
      { type: 'mine', x: 12, y: 2.8, r: 0.7 },
      { type: 'mine', x: 16, y: 9.2, r: 0.7 },
      { type: 'mine', x: 20, y: 2.8, r: 0.7 },
      { type: 'mine', x: 24, y: 9.2, r: 0.7 },
    ],
  },
  {
    // Ball: a block to bounce from over a bed.
    id: 'r3-08',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 16 },
      { type: 'block', x: 11, y: 6.2, w: 4, h: 0.8 },
      { type: 'spike', x: 12, on: 'ceil', count: 2 },
    ],
  },
  {
    // Spider: pillars, closer.
    id: 'r3-09',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 7, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 11.5, on: 'ceil', h: 3.5 },
      { type: 'pillar', x: 16, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 20.5, on: 'ceil', h: 3.5 },
      { type: 'pillar', x: 25, on: 'floor', h: 2.5 },
    ],
  },
  {
    // Ball: a raised floor and a lowered ceiling in turn.
    id: 'r3-10',
    mode: 'ball',
    length: 30,
    ceil: '2 r16 +1.5 r8 -1.5 r6',
    floor: '10 r8 -1.5 r8 +1.5 r14',
    hazards: [
      { type: 'spike', x: 10, on: 'ceil', count: 3 },
      { type: 'spike', x: 18, on: 'floor', count: 3 },
    ],
  },
  {
    // Spider: two saws to snap past.
    id: 'r3-11',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 10, y: 9.3, r: 1 },
      { type: 'spike', x: 14, on: 'ceil', count: 3 },
      { type: 'saw', x: 21, y: 9.3, r: 1 },
    ],
  },
  {
    // Ball: beds and a saw between.
    id: 'r3-12',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 3 },
      { type: 'saw', x: 13, y: 6, r: 0.8 },
      { type: 'spike', x: 17, on: 'ceil', count: 3 },
      { type: 'spike', x: 23, on: 'floor', count: 2 },
    ],
  },
  {
    // Spider: a ledge to drop from.
    id: 'r3-13',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r7 -3 r8 +3 r15',
    hazards: [
      { type: 'spike', x: 9, on: 'ceil', count: 3 },
      { type: 'spike', x: 17, on: 'floor', count: 3 },
      { type: 'spike', x: 22, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: mines in the middle.
    id: 'r3-14',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 2 },
      { type: 'mine', x: 12.5, y: 6, r: 0.6 },
      { type: 'spike', x: 16, on: 'ceil', count: 2 },
      { type: 'mine', x: 21, y: 6, r: 0.6 },
    ],
  },
  {
    // Spider: blocks on both sides, a corridor between.
    id: 'r3-15',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 8, y: 7, w: 3, h: 3 },
      { type: 'block', x: 15, y: 2, w: 3, h: 3 },
      { type: 'block', x: 22, y: 7, w: 3, h: 3 },
    ],
  },
];
