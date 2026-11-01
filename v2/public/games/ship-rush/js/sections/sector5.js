// @ts-check
// Ship Rush sector 5 "Insane" (docs/v2/PLAN.md 9.1, stage s-2): 10 sections, 1–5 then
// 6–10 (each group shuffled), speed 1.25, two gravity flips (one section each) and one
// mini stretch around the section marked `mini`. Deep space: ring gates, an asteroid
// belt, a pillar comb, a tunnel run, spiked platforms, a wreck, double beds, stairs both
// ways and rapid windows. Openings ≥ 3.3 ship bodies. Every section is proven fair by
// v2/tests/ship-rush-sections.test.ts.
// Stage r-2: gravity flipped inside tunnels and in the open, the ship turned mini and
// back inside a section, speed with moving blades (s5-01, s5-03, s5-05, s5-06).

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR5 = [
  {
    // A tunnel with gravity turned over inside it and back (stage r-2 flip portals).
    id: 's5-01',
    length: 30,
    ceil: '2 r8 +2 r6 +1 r8 -3 r8',
    floor: '10 r8 -3 r6 +1 r8 +2 r8',
    hazards: [
      { type: 'portal', x: 10, kind: 'flip' },
      { type: 'portal', x: 18, kind: 'flip' },
    ],
  },
  {
    // An asteroid belt: nine small mines.
    id: 's5-02',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 7.5, y: 4.2, r: 0.5 },
      { type: 'mine', x: 9.5, y: 7.6, r: 0.5 },
      { type: 'mine', x: 11.5, y: 5.6, r: 0.5 },
      { type: 'mine', x: 13.5, y: 3.4, r: 0.5 },
      { type: 'mine', x: 15.5, y: 8.3, r: 0.5 },
      { type: 'mine', x: 17.5, y: 6, r: 0.5 },
      { type: 'mine', x: 19.5, y: 3.8, r: 0.5 },
      { type: 'mine', x: 22, y: 7.2, r: 0.5 },
      { type: 'mine', x: 24.5, y: 4.8, r: 0.5 },
    ],
  },
  {
    // Gravity flips in the open: columns flown upside down, then the right way up again.
    id: 's5-03',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 10, on: 'ceil', count: 3 },
      { type: 'spike', x: 16.5, on: 'floor', count: 2 },
      { type: 'portal', x: 8, kind: 'flip' },
      { type: 'pillar', x: 13, on: 'floor', h: 2.8 },
      { type: 'pillar', x: 20, on: 'ceil', h: 2.8 },
      { type: 'portal', x: 24, kind: 'flip' },
    ],
  },
  {
    // A tunnel run: a corridor two and a half cells high, stepping up and down.
    id: 's5-04',
    length: 30,
    ceil: '2 r8 +2.5 r6 -0.5 r6 +0.5 r6 -2.5 r4',
    floor: '10 r8 -3 r6 -0.5 r6 +0.5 r6 +3 r4',
    hazards: [],
  },
  {
    // The ship turns mini inside the section and slips through a slot, then back to full size.
    id: 's5-05',
    length: 30,
    ceil: '2 r8 +3 r14 -3 r8',
    floor: '10 r8 -2.8 r14 +2.8 r8',
    hazards: [
      { type: 'portal', x: 5, kind: 'mini' },
      { type: 'portal', x: 25, kind: 'big' },
    ],
  },
  {
    // Fast past two blades swinging out of step, back to normal before a column.
    id: 's5-06',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8, on: 'floor', count: 3 },
      { type: 'spike', x: 14.5, on: 'ceil', count: 2 },
      { type: 'spike', x: 20.5, on: 'floor', count: 2 },
      { type: 'speed', x: 5, k: 'fast' },
      { type: 'saw', x: 11, y: 6, r: 1, move: { dx: 0, dy: 2.2, every: 8 } },
      { type: 'saw', x: 18, y: 6, r: 1, move: { dx: 0, dy: 2.2, every: 8, phase: 0.5 } },
      { type: 'speed', x: 22, k: 'normal' },
      { type: 'pillar', x: 25, on: 'floor', h: 3 },
    ],
  },
  {
    // Mini: a micro-maze of stubs in a low corridor.
    id: 's5-07',
    length: 30,
    mini: true,
    ceil: '2 r6 +2 r18 -2 r6',
    floor: '10 r6 -2 r18 +2 r6',
    hazards: [
      { type: 'pillar', x: 8, on: 'floor', h: 1.4, w: 0.5 },
      { type: 'pillar', x: 11.5, on: 'ceil', h: 1.4, w: 0.5 },
      { type: 'pillar', x: 15, on: 'floor', h: 1.4, w: 0.5 },
      { type: 'pillar', x: 18.5, on: 'ceil', h: 1.4, w: 0.5 },
      { type: 'pillar', x: 22, on: 'floor', h: 1.4, w: 0.5 },
    ],
  },
  {
    // Double beds: spikes above and below, mines between.
    id: 's5-08',
    length: 30,
    ceil: '2 r5 +1 r20 -1 r5',
    floor: '10 r5 -1 r20 +1 r5',
    hazards: [
      { type: 'spike', x: 6, on: 'ceil', count: 19 },
      { type: 'spike', x: 6, on: 'floor', count: 19 },
      { type: 'mine', x: 11, y: 5.2, r: 0.5 },
      { type: 'mine', x: 16, y: 6.8, r: 0.5 },
      { type: 'mine', x: 21, y: 5.2, r: 0.5 },
    ],
  },
  {
    // Stairs both ways: the floor climbs while the ceiling climbs, then both come down.
    id: 's5-09',
    length: 30,
    ceil: '2 r8 +1 r4 -0.5 r4 -0.5 r4 +0.5 r4 -0.5 r6',
    floor: '10 r8 -2 r4 -0.5 r4 -0.5 r4 +0.5 r4 +2.5 r6',
    hazards: [
      { type: 'halfSpike', x: 9, on: 'floor' },
      { type: 'halfSpike', x: 17, on: 'ceil' },
    ],
  },
  {
    // Rapid windows: five walls, an opening at a new height every three and a half cells.
    id: 's5-10',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 8, on: 'floor', h: 3 },
      { type: 'pillar', x: 8, on: 'ceil', h: 2.2 },
      { type: 'pillar', x: 11.5, on: 'floor', h: 2 },
      { type: 'pillar', x: 11.5, on: 'ceil', h: 3.2 },
      { type: 'pillar', x: 15, on: 'floor', h: 3.4 },
      { type: 'pillar', x: 15, on: 'ceil', h: 1.8 },
      { type: 'pillar', x: 18.5, on: 'floor', h: 2.4 },
      { type: 'pillar', x: 18.5, on: 'ceil', h: 2.8 },
      { type: 'pillar', x: 22, on: 'floor', h: 3.2 },
      { type: 'pillar', x: 22, on: 'ceil', h: 2 },
    ],
  },
];
