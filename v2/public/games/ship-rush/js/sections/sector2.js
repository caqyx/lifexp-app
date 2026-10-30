// @ts-check
// Ship Rush sector 2 "Normalny" (docs/v2/PLAN.md 9.1, stage s-1): 15 sections, 1–5 then
// 6–15 (each group shuffled), speed 0.85, no portals. Openings ≥ 5 ship bodies; the
// ideas of sector 1 combined and closer together: zig-zag gates, a storm tunnel, mine
// fields, ceiling-then-floor rides, platform chains, saw stacks and stepped gates.
// Every section is proven fair by v2/tests/ship-rush.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR2 = [
  {
    // Double gates: floor, ceiling, floor, ceiling — a gentle zig-zag.
    id: 's2-01',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 7, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 11.5, on: 'ceil', h: 3.5 },
      { type: 'pillar', x: 17, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 21.5, on: 'ceil', h: 3.5 },
    ],
  },
  {
    // Spike shelves: two slabs over a long bed, the second under ceiling spikes.
    id: 's2-02',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6, on: 'floor', count: 18 },
      { type: 'block', x: 8, y: 7, w: 4, h: 0.8 },
      { type: 'block', x: 16, y: 6.2, w: 4, h: 0.8 },
      { type: 'spike', x: 16, on: 'ceil', count: 4 },
    ],
  },
  {
    // The storm tunnel: ceiling and floor close in; a half-spike below, a spike above.
    id: 's2-03',
    length: 28,
    ceil: '2 r6 +3 r16 -3 r6',
    floor: '10 r6 -1 r16 +1 r6',
    hazards: [
      { type: 'halfSpike', x: 11, on: 'floor', count: 2 },
      { type: 'spike', x: 18, on: 'ceil' },
    ],
  },
  {
    // A mine field: five mines, high and low in turn.
    id: 's2-04',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 8, y: 4, r: 0.8 },
      { type: 'mine', x: 12, y: 7.6, r: 0.8 },
      { type: 'mine', x: 15.5, y: 4.6, r: 0.8 },
      { type: 'mine', x: 19.5, y: 8.2, r: 0.8 },
      { type: 'mine', x: 23.5, y: 5.4, r: 0.75 },
    ],
  },
  {
    // Ceiling, then floor: ride the low ceiling over a spike bed, slip under a saw, ride the floor.
    id: 's2-05',
    length: 30,
    ceil: '2 r5 +1.5 r10 -1.5 r15',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6, on: 'floor', count: 9 },
      { type: 'saw', x: 16.5, y: 6.5, r: 0.8 },
      { type: 'spike', x: 19, on: 'ceil', count: 6 },
    ],
  },
  {
    // The ceiling comes down in two steps over spikes, then a saw by the floor.
    id: 's2-06',
    length: 30,
    ceil: '2 r5 +1.5 r5 +1.5 r6 -3 r14',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 11, on: 'floor', count: 3 },
      { type: 'spike', x: 17, on: 'floor', count: 2 },
      { type: 'saw', x: 24, y: 8.4, r: 0.9 },
    ],
  },
  {
    // A slalom: five pillars, floor and ceiling in turn, five cells apart.
    id: 's2-07',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 5.5, on: 'floor', h: 3.2 },
      { type: 'pillar', x: 10.5, on: 'ceil', h: 3.2 },
      { type: 'pillar', x: 15.5, on: 'floor', h: 3.2 },
      { type: 'pillar', x: 20.5, on: 'ceil', h: 3.2 },
      { type: 'pillar', x: 25.5, on: 'floor', h: 3.2 },
    ],
  },
  {
    // A platform chain over a spike bed: low, high, low.
    id: 's2-08',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 5, on: 'floor', count: 19 },
      { type: 'block', x: 6, y: 7.5, w: 3, h: 0.8 },
      { type: 'block', x: 12, y: 6, w: 3, h: 0.8 },
      { type: 'block', x: 18, y: 7.5, w: 3, h: 0.8 },
    ],
  },
  {
    // Saw stacks: through a pair, under a single one, through a pair again.
    id: 's2-09',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 9, y: 3.3, r: 1 },
      { type: 'saw', x: 9, y: 8.7, r: 1 },
      { type: 'saw', x: 16, y: 5.6, r: 1 },
      { type: 'saw', x: 23.5, y: 3.3, r: 1 },
      { type: 'saw', x: 23.5, y: 8.7, r: 1 },
    ],
  },
  {
    // A narrow tunnel with a stub from below and one from above.
    id: 's2-10',
    length: 30,
    ceil: '2 r5 +2 r20 -2 r5',
    floor: '10 r5 -1.5 r20 +1.5 r5',
    hazards: [
      { type: 'pillar', x: 12, on: 'floor', h: 1 },
      { type: 'pillar', x: 19, on: 'ceil', h: 1 },
    ],
  },
  {
    // Mines over a spike bed: under, over and under again.
    id: 's2-11',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6, on: 'floor', count: 18 },
      { type: 'mine', x: 10, y: 4.5, r: 0.7 },
      { type: 'mine', x: 16.5, y: 6.8, r: 0.7 },
      { type: 'mine', x: 22, y: 4.4, r: 0.7 },
    ],
  },
  {
    // Rails: spikes on the floor, on the ceiling, on the floor — switch sides twice.
    id: 's2-12',
    length: 30,
    ceil: '2 r6 +2 r19 -2 r5',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'floor', count: 5 },
      { type: 'spike', x: 13, on: 'ceil', count: 4 },
      { type: 'spike', x: 19, on: 'floor', count: 5 },
    ],
  },
  {
    // Stepped gates: the floor rises twice, a stub from the ceiling over each step.
    id: 's2-13',
    length: 30,
    ceil: '2 r30',
    floor: '10 r6 -1.5 r8 -1.5 r8 +3 r8',
    hazards: [
      { type: 'pillar', x: 9.5, on: 'ceil', h: 2 },
      { type: 'pillar', x: 17.5, on: 'ceil', h: 1.5 },
    ],
  },
  {
    // Lightning rods: three tall pillars, a spike on the ceiling above each.
    id: 's2-14',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 8, on: 'floor', h: 3.8 },
      { type: 'spike', x: 8, on: 'ceil' },
      { type: 'pillar', x: 14.5, on: 'floor', h: 3.8 },
      { type: 'spike', x: 14.5, on: 'ceil' },
      { type: 'pillar', x: 21, on: 'floor', h: 3.8 },
      { type: 'spike', x: 21, on: 'ceil' },
    ],
  },
  {
    // Shelves on both sides: under the first slab, over the second.
    id: 's2-15',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 7, y: 4.5, w: 6, h: 1 },
      { type: 'spike', x: 7, on: 'floor', count: 6 },
      { type: 'block', x: 16, y: 6.5, w: 6, h: 1 },
      { type: 'spike', x: 16, on: 'ceil', count: 6 },
    ],
  },
];
