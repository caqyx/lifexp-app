// @ts-check
// Sector 2 "Normalny" (docs/v2/PLAN.md 9.1, stage w-1): 15 sections at speed 0.5, no
// portals. Sections 1–5 are shuffled and played first, then 6–15. A little more of
// everything than sector 1: more spikes, saws and narrower (≥ 6 hitboxes) corridors.

/** @type {import('../geometry.js').SectionData[]} */
export const SECTOR2 = [
  // ── 1–5: warm-up ──
  {
    id: 's2-01',
    length: 30,
    ceil: '2 r6 d2 r6 u2 r14',
    floor: '10 r14 u2 r6 d2 r6',
    hazards: [
      { type: 'spike', x: 9, on: 'ceil', count: 2 },
      { type: 'spike', x: 17, on: 'floor', count: 2 },
      { type: 'halfSpike', x: 11, on: 'floor', count: 2 },
    ],
    deco: [{ type: 'chain', x: 24.5, len: 1.5, ornament: 'diamond' }],
  },
  {
    id: 's2-02',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 7, on: 'floor', h: 3.2 },
      { type: 'spike', x: 7, y: 6.8, dir: 'up' },
      { type: 'pillar', x: 14, on: 'ceil', h: 3.2 },
      { type: 'spike', x: 14, y: 5.2, dir: 'down' },
      { type: 'pillar', x: 21, on: 'floor', h: 3.2 },
      { type: 'spike', x: 21, y: 6.8, dir: 'up' },
    ],
  },
  {
    id: 's2-03',
    length: 30,
    ceil: '2 r5 +1 r2 +1 r2 +1 r10 -1 r2 -1 r2 -1 r7',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 14, on: 'floor', count: 1 },
      { type: 'saw', x: 20, y: 8.6, r: 0.9 },
      { type: 'spike', x: 25, on: 'floor', count: 1 },
    ],
    deco: [{ type: 'gear', x: 16, y: 6.8, size: 1.2 }],
  },
  {
    id: 's2-04',
    length: 30,
    ceil: '2 r4 u1 r20 d1 r4',
    floor: '10 r4 d1 r20 u1 r4',
    hazards: [
      { type: 'block', x: 9, y: 4.6, w: 2, h: 2.2 },
      { type: 'spike', x: 9, y: 4.6, dir: 'up' },
      { type: 'spike', x: 10, y: 4.6, dir: 'up' },
      { type: 'block', x: 17, y: 5.4, w: 2, h: 2.2 },
      { type: 'spike', x: 17, y: 7.6, dir: 'down' },
      { type: 'spike', x: 18, y: 7.6, dir: 'down' },
    ],
    deco: [{ type: 'chain', x: 9.5, len: 1.5, ornament: 'none' }],
  },
  {
    id: 's2-05',
    length: 33,
    ceil: '2 r3 d2 r3 u2 r3 d2 r3 u2 r3 d2 r3 u2 r3',
    floor: '10 r33',
    hazards: [
      { type: 'spike', x: 5, on: 'ceil', count: 3 },
      { type: 'spike', x: 15, on: 'ceil', count: 3 },
      { type: 'halfSpike', x: 9, on: 'floor', count: 3 },
      { type: 'halfSpike', x: 19, on: 'floor', count: 3 },
    ],
  },
  // ── 6–15: the real thing ──
  {
    id: 's2-06',
    length: 32,
    ceil: '2 r4 d3 r4 u3 r2 d3 r4 u3 r6',
    floor: '10 r32',
    hazards: [
      { type: 'spike', x: 7, on: 'ceil', count: 4 },
      { type: 'spike', x: 19, on: 'ceil', count: 4 },
      { type: 'halfSpike', x: 12, on: 'floor', count: 3 },
      { type: 'saw', x: 26, y: 8.5, r: 1 },
    ],
    deco: [{ type: 'sawtooth', from: 7, to: 11, on: 'ceil' }],
  },
  {
    id: 's2-07',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 8, y: 7.8, r: 1.2 },
      { type: 'saw', x: 14, y: 4.2, r: 1.2 },
      { type: 'saw', x: 20, y: 7.8, r: 1.2 },
      { type: 'spike', x: 24, on: 'ceil', count: 2 },
    ],
    deco: [{ type: 'chain', x: 14, len: 1, ornament: 'none' }],
  },
  {
    id: 's2-08',
    length: 32,
    ceil: '2 r5 d2 r20 u2 r3',
    floor: '10 r5 u1.5 r21 d1.5 r3',
    hazards: [
      { type: 'halfSpike', x: 9, on: 'ceil', count: 3 },
      { type: 'halfSpike', x: 15, on: 'floor', count: 3 },
      { type: 'halfSpike', x: 21, on: 'ceil', count: 3 },
    ],
    deco: [{ type: 'star', x: 16, y: 3, size: 0.8 }],
  },
  {
    id: 's2-09',
    length: 32,
    ceil: '2 r32',
    floor: '10 r5 -0.75 r2 -0.75 r2 -0.75 r2 -0.75 r6 +0.75 r2 +0.75 r2 +0.75 r2 +0.75 r9',
    hazards: [
      { type: 'spike', x: 13, on: 'ceil', count: 3 },
      { type: 'spike', x: 7, on: 'floor', count: 1 },
      { type: 'spike', x: 24, on: 'floor', count: 1 },
    ],
  },
  {
    id: 's2-10',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 6, on: 'floor', h: 4.2 },
      { type: 'pillar', x: 11, on: 'ceil', h: 4.2 },
      { type: 'pillar', x: 16, on: 'floor', h: 4.2 },
      { type: 'pillar', x: 21, on: 'ceil', h: 4.2 },
    ],
    deco: [{ type: 'chain', x: 13.5, len: 1.4, ornament: 'triangle' }],
  },
  {
    id: 's2-11',
    length: 32,
    ceil: '2 r4 d3 r4 u3 r18',
    floor: '10 r14 u3 r4 d3 r8',
    hazards: [
      { type: 'spike', x: 7, on: 'ceil', count: 4 },
      { type: 'spike', x: 17, on: 'floor', count: 4 },
      { type: 'saw', x: 26, y: 7.5, r: 1 },
    ],
    deco: [{ type: 'sawtooth', from: 17, to: 21, on: 'floor' }],
  },
  {
    id: 's2-12',
    length: 30,
    ceil: '2 r4 u1 r20 d1 r4',
    floor: '10 r4 d1 r20 u1 r4',
    hazards: [
      { type: 'block', x: 9, y: 5, w: 3, h: 2 },
      { type: 'spike', x: 9, y: 5, dir: 'up', count: 3 },
      { type: 'saw', x: 17.5, y: 3, r: 1 },
      { type: 'saw', x: 17.5, y: 9, r: 1 },
      { type: 'block', x: 22, y: 5, w: 2, h: 2 },
      { type: 'spike', x: 22, y: 7, dir: 'down', count: 2 },
    ],
  },
  {
    id: 's2-13',
    length: 32,
    ceil: '2 r6 d3 r5 u3 r15',
    floor: '10 r16 u3 r5 d3 r5',
    hazards: [
      { type: 'halfSpike', x: 9, on: 'ceil', count: 5 },
      { type: 'halfSpike', x: 19, on: 'floor', count: 5 },
    ],
    deco: [{ type: 'chain', x: 25.5, len: 2, ornament: 'star' }],
  },
  {
    id: 's2-14',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'block', x: 7, y: 2, w: 2, h: 2.5 },
      { type: 'spike', x: 7, y: 4.5, dir: 'down', count: 2 },
      { type: 'block', x: 12, y: 7.5, w: 2, h: 2.5 },
      { type: 'spike', x: 12, y: 7.5, dir: 'up', count: 2 },
      { type: 'block', x: 17, y: 2, w: 2, h: 2.5 },
      { type: 'spike', x: 17, y: 4.5, dir: 'down', count: 2 },
      { type: 'block', x: 22, y: 7.5, w: 2, h: 2.5 },
      { type: 'spike', x: 22, y: 7.5, dir: 'up', count: 2 },
    ],
  },
  {
    id: 's2-15',
    length: 32,
    ceil: '2 r4 d4 r2 u4 r18',
    floor: '10 r16 u4 r2 d4 r6',
    hazards: [
      { type: 'spike', x: 26, on: 'floor', count: 2 },
      { type: 'halfSpike', x: 22, on: 'ceil', count: 2 },
      { type: 'saw', x: 13, y: 8.8, r: 0.9 },
    ],
    deco: [{ type: 'diamond', x: 16, y: 3.6, size: 0.7 }],
  },
];
