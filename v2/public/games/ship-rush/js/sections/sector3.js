// @ts-check
// Ship Rush sector 3 "Trudny" (docs/v2/PLAN.md 9.1, stage s-1): 15 sections, 1–5 then
// 6–15 (each group shuffled), speed 1.0, one gravity flip for two sections — so every
// section here is proven both ways up. Openings ≥ 4 ship bodies: tight gates, a snaking
// tunnel, mines in a corridor, saw gates, switchbacks, block steps, windows, a pillar
// forest, a saw tunnel, a gauntlet, chained mines and the squeeze. Every section is
// proven fair by v2/tests/ship-rush.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR3 = [
  {
    // Tight gates: four pillars, floor and ceiling in turn, meeting at mid-height.
    id: 's3-01',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 8, on: 'floor', h: 3.7 },
      { type: 'pillar', x: 13.5, on: 'ceil', h: 3.7 },
      { type: 'pillar', x: 19, on: 'floor', h: 3.7 },
      { type: 'pillar', x: 24.5, on: 'ceil', h: 3.7 },
    ],
  },
  {
    // The snake: a tunnel stepping down, up and down again.
    id: 's3-02',
    length: 30,
    ceil: '2 r7 +2 r5 +1 r5 -1.5 r5 +1 r4 -2.5 r4',
    floor: '10 r7 -2.5 r5 +1 r5 -1 r5 +0.5 r4 +2 r4',
    hazards: [
      { type: 'halfSpike', x: 13.5, on: 'floor', count: 2 },
      { type: 'halfSpike', x: 18.5, on: 'ceil', count: 2 },
    ],
  },
  {
    // Mines in a corridor, high and low in turn.
    id: 's3-03',
    length: 30,
    ceil: '2 r5 +1.5 r20 -1.5 r5',
    floor: '10 r5 -1 r20 +1 r5',
    hazards: [
      { type: 'mine', x: 9, y: 5, r: 0.6 },
      { type: 'mine', x: 13, y: 7.5, r: 0.6 },
      { type: 'mine', x: 17, y: 5, r: 0.6 },
      { type: 'mine', x: 21, y: 7.4, r: 0.6 },
      { type: 'halfSpike', x: 10.5, on: 'floor', count: 2 },
      { type: 'halfSpike', x: 18.5, on: 'floor', count: 2 },
    ],
  },
  {
    // Saw gates: three pairs of blades, the gap between them high, middle and low.
    id: 's3-04',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 8, y: 2.4, r: 1.1 },
      { type: 'saw', x: 8, y: 7.6, r: 1.1 },
      { type: 'saw', x: 15, y: 3.6, r: 1.1 },
      { type: 'saw', x: 15, y: 9.4, r: 1.1 },
      { type: 'saw', x: 22, y: 2.4, r: 1.1 },
      { type: 'saw', x: 22, y: 7.6, r: 1.1 },
      { type: 'spike', x: 11, on: 'ceil', count: 2 },
      { type: 'spike', x: 18, on: 'ceil', count: 2 },
    ],
  },
  {
    // Switchbacks: spike beds on the floor and the ceiling in turn.
    id: 's3-05',
    length: 30,
    ceil: '2 r6 +1.5 r20 -1.5 r4',
    floor: '10 r6 -1 r20 +1 r4',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 3 },
      { type: 'spike', x: 12, on: 'ceil', count: 3 },
      { type: 'spike', x: 17, on: 'floor', count: 3 },
      { type: 'spike', x: 22, on: 'ceil', count: 3 },
    ],
  },
  {
    // Block steps: a block on the floor, one from the ceiling, one on the floor; spikes on top.
    id: 's3-06',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 6, y: 7, w: 3, h: 3 },
      { type: 'spike', x: 7, y: 7, dir: 'up' },
      { type: 'block', x: 12, y: 2, w: 3, h: 3.5 },
      { type: 'spike', x: 13, y: 5.5, dir: 'down' },
      { type: 'block', x: 18, y: 6.5, w: 3, h: 3.5 },
      { type: 'spike', x: 19, y: 6.5, dir: 'up' },
    ],
  },
  {
    // Windows: three walls, each with an opening at its own height.
    id: 's3-07',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 8, on: 'floor', h: 4.3 },
      { type: 'pillar', x: 8, on: 'ceil', h: 0.6 },
      { type: 'pillar', x: 15, on: 'floor', h: 1.8 },
      { type: 'pillar', x: 15, on: 'ceil', h: 3 },
      { type: 'pillar', x: 22, on: 'floor', h: 3 },
      { type: 'pillar', x: 22, on: 'ceil', h: 1.8 },
    ],
  },
  {
    // Platform hops: four slabs over a long spike bed, spikes over the high ones.
    id: 's3-08',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 5, on: 'floor', count: 20 },
      { type: 'block', x: 6, y: 7.2, w: 2.5, h: 0.6 },
      { type: 'block', x: 11, y: 6.2, w: 2.5, h: 0.6 },
      { type: 'spike', x: 11, on: 'ceil', count: 2 },
      { type: 'block', x: 16, y: 7.2, w: 2.5, h: 0.6 },
      { type: 'block', x: 21, y: 6.2, w: 2.5, h: 0.6 },
    ],
  },
  {
    // Stairs up under ceiling spikes, then a low ceiling over a spike bed.
    id: 's3-09',
    length: 30,
    ceil: '2 r18 +2 r8 -2 r4',
    floor: '10 r6 -1 r4 -1 r4 -1 r4 +3 r12',
    hazards: [
      { type: 'spike', x: 11, on: 'ceil', count: 3 },
      { type: 'spike', x: 20, on: 'floor', count: 4 },
      { type: 'halfSpike', x: 7.5, on: 'floor' },
      { type: 'halfSpike', x: 15.5, on: 'floor' },
    ],
  },
  {
    // A dense mine field: eight mines, every height.
    id: 's3-10',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 7, y: 4, r: 0.6 },
      { type: 'mine', x: 9.5, y: 7.5, r: 0.6 },
      { type: 'mine', x: 12, y: 5.2, r: 0.6 },
      { type: 'mine', x: 14.5, y: 8.4, r: 0.6 },
      { type: 'mine', x: 17, y: 3.6, r: 0.6 },
      { type: 'mine', x: 19.5, y: 6.6, r: 0.6 },
      { type: 'mine', x: 22.5, y: 4.6, r: 0.6 },
      { type: 'mine', x: 25, y: 8, r: 0.6 },
      { type: 'halfSpike', x: 10, on: 'ceil', count: 4 },
    ],
  },
  {
    // A pillar forest: five pairs, the opening between them moving up and down.
    id: 's3-11',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 7, on: 'floor', h: 2.8 },
      { type: 'pillar', x: 7, on: 'ceil', h: 1.9 },
      { type: 'pillar', x: 11.25, on: 'floor', h: 1.3 },
      { type: 'pillar', x: 11.25, on: 'ceil', h: 3.4 },
      { type: 'pillar', x: 16, on: 'floor', h: 3.3 },
      { type: 'pillar', x: 16, on: 'ceil', h: 1.4 },
      { type: 'pillar', x: 20.75, on: 'floor', h: 1.8 },
      { type: 'pillar', x: 20.75, on: 'ceil', h: 2.9 },
      { type: 'pillar', x: 25.5, on: 'floor', h: 3.8 },
      { type: 'pillar', x: 25.5, on: 'ceil', h: 0.9 },
    ],
  },
  {
    // The saw tunnel: blades set into the ceiling and the floor in turn.
    id: 's3-12',
    length: 30,
    ceil: '2 r5 +1.5 r20 -1.5 r5',
    floor: '10 r5 -1.5 r20 +1.5 r5',
    hazards: [
      { type: 'saw', x: 8, y: 3.5, r: 1.2 },
      { type: 'saw', x: 13, y: 8.5, r: 1.2 },
      { type: 'saw', x: 18, y: 3.5, r: 1.2 },
      { type: 'saw', x: 23, y: 8.5, r: 1.2 },
      { type: 'halfSpike', x: 9.5, on: 'floor', count: 2 },
      { type: 'halfSpike', x: 15, on: 'ceil', count: 2 },
      { type: 'halfSpike', x: 19.5, on: 'floor', count: 2 },
    ],
  },
  {
    // The gauntlet: two spiked slabs (over the first, under the second), then ceiling spikes.
    id: 's3-13',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 8, y: 5.5, w: 4, h: 1.5 },
      { type: 'spike', x: 8, y: 7, dir: 'down', count: 4 },
      { type: 'block', x: 17, y: 4.5, w: 4, h: 1.5 },
      { type: 'spike', x: 17, y: 4.5, dir: 'up', count: 4 },
      { type: 'spike', x: 23, on: 'ceil', count: 3 },
    ],
  },
  {
    // Chained mines: four mines hang from the ceiling at different lengths.
    id: 's3-14',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 8, y: 6, r: 0.7, chain: true },
      { type: 'mine', x: 13, y: 4.5, r: 0.7, chain: true },
      { type: 'mine', x: 18, y: 7.2, r: 0.7, chain: true },
      { type: 'mine', x: 23, y: 5, r: 0.7, chain: true },
      { type: 'spike', x: 10, on: 'floor', count: 2 },
      { type: 'spike', x: 20, on: 'floor', count: 2 },
    ],
  },
  {
    // The squeeze: a corridor two and a half bodies wide for eight cells, then a saw.
    id: 's3-15',
    length: 30,
    ceil: '2 r6 +2.5 r10 -2.5 r14',
    floor: '10 r8 -2.9 r8 +2.9 r14',
    hazards: [
      { type: 'saw', x: 21, y: 7.8, r: 1 },
      { type: 'spike', x: 24, on: 'ceil' },
      { type: 'spike', x: 17.5, on: 'floor', count: 2 },
    ],
  },
];
