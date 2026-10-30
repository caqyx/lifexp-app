// @ts-check
// Flip Rush sector 1 "Łatwy" (docs/v2/PLAN.md 9.1, stage f-1): 10 sections, all shuffled,
// speed 0.8, no portals; six for the ball, four for the spider. Wide openings, one idea
// per section: spike beds to flip away from, a platform to hang under, a raised floor to
// snap onto, saws in the middle of the way across, pillars. Every section is proven fair
// by v2/tests/flip-rush-sections.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR1 = [
  {
    // Ball: beds on the floor, the ceiling and the floor — flip, flip back, flip again.
    id: 'r1-01',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8, on: 'floor', count: 3 },
      { type: 'spike', x: 15, on: 'ceil', count: 3 },
      { type: 'spike', x: 22, on: 'floor', count: 3 },
    ],
  },
  {
    // Spider: short beds, floor and ceiling in turn.
    id: 'r1-02',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 2 },
      { type: 'spike', x: 12, on: 'ceil', count: 3 },
      { type: 'spike', x: 18, on: 'floor', count: 2 },
      { type: 'spike', x: 23, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a long floor bed, then a column from the ceiling to slip under.
    id: 'r1-03',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9, on: 'floor', count: 8 },
      { type: 'pillar', x: 22, on: 'ceil', h: 3 },
    ],
  },
  {
    // Spider: a raised floor to snap down onto between a wall and ceiling spikes.
    id: 'r1-04',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r8 -2 r9 +2 r13',
    hazards: [{ type: 'spike', x: 11, on: 'ceil', count: 3 }],
  },
  {
    // Ball: a saw in the middle of the way across.
    id: 'r1-05',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8, on: 'floor', count: 3 },
      { type: 'saw', x: 15, y: 6.3, r: 0.7 },
      { type: 'spike', x: 19, on: 'ceil', count: 3 },
    ],
  },
  {
    // Spider: a platform to hang under over a bed, then off its end up to the ceiling.
    id: 'r1-06',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 9, y: 5.6, w: 5, h: 0.8 },
      { type: 'spike', x: 10, on: 'floor', count: 4 },
      { type: 'spike', x: 20, on: 'ceil', count: 3 },
    ],
  },
  {
    // Ball: a step up in the floor, ceiling spikes over it.
    id: 'r1-07',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r10 -1.5 r8 +1.5 r12',
    hazards: [{ type: 'spike', x: 12, on: 'ceil', count: 5 }],
  },
  {
    // Spider: pillars from the floor, the ceiling and the floor.
    id: 'r1-08',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 9, on: 'floor', h: 3 },
      { type: 'pillar', x: 15.5, on: 'ceil', h: 3 },
      { type: 'pillar', x: 22, on: 'floor', h: 3 },
    ],
  },
  {
    // Ball: jump pads over two beds with beds over them too (the first pads).
    id: 'r1-09',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 7, on: 'floor' },
      { type: 'spike', x: 8.4, on: 'floor', count: 2 },
      { type: 'spike', x: 8.4, on: 'ceil', count: 2 },
      { type: 'pad', kind: 'jump', x: 17, on: 'floor' },
      { type: 'spike', x: 18.4, on: 'floor', count: 2 },
      { type: 'spike', x: 18.4, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: beds and a saw on the ceiling's edge.
    id: 'r1-10',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 2 },
      { type: 'saw', x: 15, y: 2.4, r: 1 },
      { type: 'spike', x: 21, on: 'floor', count: 3 },
    ],
  },
];
