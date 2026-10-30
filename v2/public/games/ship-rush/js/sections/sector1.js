// @ts-check
// Ship Rush sector 1 "Łatwy" (docs/v2/PLAN.md 9.1, stage s-1): 10 sections, all shuffled,
// speed 0.8, no portals. Wide openings (≥ 6 ship bodies everywhere), one idea per
// section, every one of them flown as the ship: hops over spikes, platforms to land on,
// a low ceiling, gates, saws, a ride along the ceiling, stairs, mines, a shelf and a
// window. Format: the engine's geometry (blocks and pillars are solid: solids.js). Every
// section is proven fair by v2/tests/ship-rush.test.ts.

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR1 = [
  {
    // Runway: three short rows of spikes on the floor, a hop over each.
    id: 's1-01',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6, on: 'floor', count: 2 },
      { type: 'spike', x: 13, on: 'floor', count: 3 },
      { type: 'spike', x: 22, on: 'floor', count: 2 },
    ],
    deco: [{ type: 'star', x: 15, y: 4, size: 0.5 }],
  },
  {
    // Platforms: two floating slabs over spike beds; land on them or fly over.
    id: 's1-02',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 7, y: 7, w: 5, h: 1 },
      { type: 'spike', x: 7, on: 'floor', count: 5 },
      { type: 'block', x: 17, y: 6.5, w: 5, h: 1 },
      { type: 'spike', x: 17, on: 'floor', count: 5 },
    ],
  },
  {
    // A low ceiling: the sky closes down to a tunnel with a spike on each side.
    id: 's1-03',
    length: 30,
    ceil: '2 r7 +2.5 r14 -2.5 r9',
    floor: '10 r30',
    hazards: [
      { type: 'halfSpike', x: 11, on: 'floor', count: 2 },
      { type: 'spike', x: 17, on: 'ceil' },
    ],
  },
  {
    // Gates: pillars from the floor, the ceiling and the floor again.
    id: 's1-04',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 8, on: 'floor', h: 3 },
      { type: 'pillar', x: 15, on: 'ceil', h: 3 },
      { type: 'pillar', x: 22, on: 'floor', h: 3 },
    ],
  },
  {
    // Saws: three spinning blades, low, high and low.
    id: 's1-05',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 9, y: 8.4, r: 1 },
      { type: 'saw', x: 17, y: 3.8, r: 1 },
      { type: 'saw', x: 24, y: 7.8, r: 0.9 },
    ],
  },
  {
    // Ride the ceiling: a long spike bed below, a lowered ceiling to hold on to.
    id: 's1-06',
    length: 30,
    ceil: '2 r6 +1 r18 -1 r6',
    floor: '10 r30',
    hazards: [{ type: 'spike', x: 9, on: 'floor', count: 12 }],
  },
  {
    // Stairs: the floor climbs three steps and comes down again; every riser is a wall.
    id: 's1-07',
    length: 30,
    ceil: '2 r30',
    floor: '10 r6 -1 r4 -1 r4 -1 r4 +1 r4 +1 r4 +1 r4',
    hazards: [{ type: 'spike', x: 15, on: 'ceil' }],
  },
  {
    // Mines: three of them hang in the open air.
    id: 's1-08',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 10, y: 5, r: 0.8 },
      { type: 'mine', x: 16.5, y: 8.2, r: 0.8 },
      { type: 'mine', x: 23, y: 4.4, r: 0.8 },
    ],
  },
  {
    // A shelf: one long slab above a spike bed; over it, or along its top.
    id: 's1-09',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 9, y: 6, w: 11, h: 1 },
      { type: 'spike', x: 10, on: 'floor', count: 9 },
    ],
  },
  {
    // A window: a wall from the floor and a stub from the ceiling, a gap between them.
    id: 's1-10',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 12, on: 'floor', h: 3.2, w: 2 },
      { type: 'pillar', x: 12, on: 'ceil', h: 1, w: 2 },
      { type: 'saw', x: 22, y: 8.6, r: 0.8 },
    ],
  },
];
