// @ts-check
// Ship Rush sector 4 "Trudniejszy" (docs/v2/PLAN.md 9.1, stage s-2): 10 sections, all
// shuffled, speed 1.1, three gravity flips (each one section long) and one mini stretch
// around the section marked `mini` — so every section is proven both ways up, the mini
// one as the mini ship. In orbit: solar arrays, a docking tunnel, satellites, antenna
// forests, debris, station modules. Openings ≥ 3.6 ship bodies (mini: its own bodies).
// Every section is proven fair by v2/tests/ship-rush-sections.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR4 = [
  {
    // Solar arrays: four thin panels over a spike bed, low and high in turn.
    id: 's4-01',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 5, on: 'floor', count: 21 },
      { type: 'block', x: 6, y: 5.5, w: 4, h: 0.5 },
      { type: 'block', x: 12, y: 7, w: 4, h: 0.5 },
      { type: 'block', x: 18, y: 5, w: 4, h: 0.5 },
      { type: 'block', x: 23.5, y: 6.5, w: 3.5, h: 0.5 },
    ],
  },
  {
    // The docking tunnel: it narrows in two steps and opens again, spikes at the throat.
    id: 's4-02',
    length: 30,
    ceil: '2 r7 +2 r6 +1 r6 -1 r6 -2 r5',
    floor: '10 r7 -1 r6 -1 r6 +1 r6 +1 r5',
    hazards: [
      { type: 'halfSpike', x: 9, on: 'floor', count: 2 },
      { type: 'halfSpike', x: 15, on: 'floor', count: 2 },
      { type: 'halfSpike', x: 21, on: 'ceil', count: 2 },
    ],
  },
  {
    // A satellite: under its spiked body, then over a second one spiked below.
    id: 's4-03',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 8, y: 4.5, w: 5, h: 2.5 },
      { type: 'spike', x: 8, y: 4.5, dir: 'up', count: 5 },
      { type: 'block', x: 18, y: 5.5, w: 5, h: 2 },
      { type: 'spike', x: 18, y: 7.5, dir: 'down', count: 5 },
    ],
  },
  {
    // An antenna forest: masts from the floor and the ceiling, each tipped with a spike.
    id: 's4-04',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 7, on: 'floor', h: 2.6 },
      { type: 'spike', x: 7, y: 7.4, dir: 'up' },
      { type: 'pillar', x: 11.5, on: 'ceil', h: 2.6 },
      { type: 'spike', x: 11.5, y: 4.6, dir: 'down' },
      { type: 'pillar', x: 16, on: 'floor', h: 2.6 },
      { type: 'spike', x: 16, y: 7.4, dir: 'up' },
      { type: 'pillar', x: 20.5, on: 'ceil', h: 2.6 },
      { type: 'spike', x: 20.5, y: 4.6, dir: 'down' },
      { type: 'pillar', x: 25, on: 'floor', h: 2.6 },
      { type: 'spike', x: 25, y: 7.4, dir: 'up' },
    ],
  },
  {
    // A debris field: mines and tumbling plates, every height.
    id: 's4-05',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 8, y: 4.5, r: 0.6 },
      { type: 'block', x: 10.5, y: 7, w: 1.5, h: 1.5 },
      { type: 'mine', x: 14, y: 8.6, r: 0.6 },
      { type: 'block', x: 16.5, y: 3.4, w: 1.5, h: 1.5 },
      { type: 'mine', x: 19.5, y: 6.2, r: 0.6 },
      { type: 'block', x: 22, y: 7.6, w: 1.5, h: 1.5 },
      { type: 'mine', x: 25, y: 4.2, r: 0.6 },
    ],
  },
  {
    // A ceiling bed, then a floor bed, in a lowered corridor.
    id: 's4-06',
    length: 30,
    ceil: '2 r5 +1.5 r20 -1.5 r5',
    floor: '10 r5 -1.5 r20 +1.5 r5',
    hazards: [
      { type: 'spike', x: 7, on: 'ceil', count: 7 },
      { type: 'spike', x: 15, on: 'floor', count: 8 },
    ],
  },
  {
    // A narrow orbit: a corridor under three bodies high, swaying half a cell.
    id: 's4-07',
    length: 30,
    ceil: '2 r8 +2 r6 +0.5 r6 -0.5 r5 -2 r5',
    floor: '10 r8 -3.2 r6 +0.5 r6 -0.5 r5 +3.2 r5',
    hazards: [],
  },
  {
    // Panels with saws on their tips.
    id: 's4-08',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 7, y: 6, w: 4, h: 0.6 },
      { type: 'saw', x: 11, y: 6.3, r: 0.8 },
      { type: 'block', x: 16, y: 4.6, w: 4, h: 0.6 },
      { type: 'saw', x: 20, y: 4.9, r: 0.8 },
      { type: 'spike', x: 16, on: 'floor', count: 4 },
      { type: 'saw', x: 24.5, y: 8.4, r: 0.9 },
    ],
  },
  {
    // Station modules: a module on the floor, one from the ceiling, one on the floor.
    id: 's4-09',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 8, y: 6.5, w: 4, h: 3.5 },
      { type: 'halfSpike', x: 9, y: 6.5, dir: 'up', count: 2 },
      { type: 'block', x: 15, y: 2, w: 4, h: 3.5 },
      { type: 'halfSpike', x: 16, y: 5.5, dir: 'down', count: 2 },
      { type: 'block', x: 22, y: 6.5, w: 4, h: 3.5 },
    ],
  },
  {
    // Mini: a cave of micro-debris only the small ship slips through.
    id: 's4-10',
    length: 30,
    mini: true,
    ceil: '2 r6 +2.5 r18 -2.5 r6',
    floor: '10 r6 -2 r18 +2 r6',
    hazards: [
      { type: 'mine', x: 9, y: 5.4, r: 0.4 },
      { type: 'mine', x: 12, y: 7.3, r: 0.4 },
      { type: 'mine', x: 15, y: 5.3, r: 0.4 },
      { type: 'mine', x: 18, y: 7.4, r: 0.4 },
      { type: 'mine', x: 21, y: 5.5, r: 0.4 },
    ],
  },
];
