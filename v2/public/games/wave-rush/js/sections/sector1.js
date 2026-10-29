// @ts-check
// Sector 1 "Łatwy" (docs/v2/PLAN.md 9.1, stage w-1): 10 sections, all shuffled, speed
// 0.5, no portals. Wide corridors (≥ 7 hitboxes everywhere), few spikes, one idea per
// section. Format: geometry.js. Every section is proven fair by v2/tests/wave-rush.test.ts.

/** @type {import('../geometry.js').SectionData[]} */
export const SECTOR1 = [
  {
    id: 's1-01',
    length: 30,
    ceil: '2 r9 d2 r9 u2 r8',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 6, on: 'floor', count: 2 },
      { type: 'spike', x: 14, on: 'ceil' },
      { type: 'spike', x: 22, on: 'floor', count: 2 },
    ],
    deco: [{ type: 'chain', x: 25.5, len: 1.5, ornament: 'diamond' }],
  },
  {
    id: 's1-02',
    length: 30,
    ceil: '2 r30',
    floor: '10 r7 u3 r5 d3 r12',
    hazards: [
      { type: 'halfSpike', x: 11, on: 'floor' },
      { type: 'spike', x: 20, on: 'ceil', count: 2 },
      { type: 'saw', x: 25, y: 8.4, r: 0.9 },
    ],
    deco: [{ type: 'chain', x: 12.5, len: 1.2, ornament: 'none' }],
  },
  {
    id: 's1-03',
    length: 28,
    ceil: '2 r5 +1 r2 +1 r2 +1 r8 -1 r2 -1 r2 -1 r7',
    floor: '10 r28',
    hazards: [{ type: 'halfSpike', x: 12, on: 'floor', count: 3 }],
    deco: [{ type: 'chain', x: 22.5, len: 2, ornament: 'star' }],
  },
  {
    id: 's1-04',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 8, on: 'floor', h: 3 },
      { type: 'pillar', x: 15, on: 'ceil', h: 3 },
      { type: 'pillar', x: 22, on: 'floor', h: 3 },
    ],
    deco: [{ type: 'chain', x: 4.5, len: 1.5, ornament: 'triangle' }],
  },
  {
    id: 's1-05',
    length: 30,
    ceil: '2 r4 u1 r20 d1 r4',
    floor: '10 r4 d1 r20 u1 r4',
    hazards: [
      { type: 'block', x: 11, y: 5.2, w: 3, h: 1.6 },
      { type: 'block', x: 19, y: 5.2, w: 2, h: 1.6 },
    ],
    deco: [{ type: 'chain', x: 12.5, len: 3, ornament: 'diamond' }],
  },
  {
    id: 's1-06',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 10, y: 8.4, r: 1 },
      { type: 'saw', x: 19, y: 3.6, r: 1 },
      { type: 'spike', x: 24, on: 'floor' },
    ],
  },
  {
    id: 's1-07',
    length: 29,
    ceil: '2 r5 d1.5 r12 u1.5 r9',
    floor: '10 r5 u1.5 r12 d1.5 r9',
    hazards: [
      { type: 'halfSpike', x: 9, on: 'ceil', count: 2 },
      { type: 'halfSpike', x: 14, on: 'floor', count: 2 },
    ],
    deco: [{ type: 'chain', x: 22.5, len: 1.5, ornament: 'star' }],
  },
  {
    id: 's1-08',
    length: 31,
    ceil: '2 r3 d1 r2 d3 r2 u3 r2 d3 r2 u4 r6',
    floor: '10 r7 d1 r3 u1 r4 d1 r4 u1 r9',
    hazards: [],
    deco: [{ type: 'sawtooth', from: 9, to: 11, on: 'ceil' }],
  },
  {
    id: 's1-09',
    length: 30,
    ceil: '2 r30',
    floor: '10 r6 -1 r2 -1 r2 -1 r8 +1 r2 +1 r2 +1 r8',
    hazards: [
      { type: 'halfSpike', x: 13, on: 'ceil', count: 2 },
      { type: 'spike', x: 25, on: 'ceil' },
    ],
    deco: [{ type: 'gear', x: 15, y: 5, size: 1.4 }],
  },
  {
    id: 's1-10',
    length: 30,
    ceil: '2 r5 d2 r3 u2 r4 d2 r3 u2 r7',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 7, on: 'ceil', count: 2 },
      { type: 'halfSpike', x: 12, on: 'floor', count: 2 },
      { type: 'spike', x: 18, on: 'ceil', count: 2 },
    ],
  },
];
