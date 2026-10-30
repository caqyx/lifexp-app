// @ts-check
// Sector 5 "Insane" (docs/v2/PLAN.md 9.1, stage w-2): 10 sections at speed 1.3; 1–5
// shuffled and played first, then 6–10. Corridors ≥ 3.5 hitboxes, the narrow ones
// diagonal; two gravity flips per run and one mini stretch (section 9).
import { room, tunnel } from './kit.js';

/** @type {import('../../../_engine/geometry.js').SectionData[]} */
export const SECTOR5 = [
  // ── 1–5 ──
  { id: 's5-01', ...tunnel({ gap: 2.8, legs: [3, -3, 3, -3, 3, -3] }), hazards: [], deco: [{ type: 'sawtooth', from: 8, to: 26, on: 'ceil' }] },
  {
    id: 's5-02',
    length: 42,
    ceil: '2 r42',
    floor: '10 r42',
    hazards: [
      { type: 'orb', x: 8, y: 7.4, r: 1.1 },
      { type: 'orb', x: 13, y: 4.4, r: 1.1, chain: true },
      { type: 'orb', x: 18, y: 7.6, r: 1.1 },
      { type: 'orb', x: 23, y: 4.4, r: 1.1, chain: true },
      { type: 'orb', x: 28, y: 7.6, r: 1.1 },
      { type: 'orb', x: 33, y: 4.4, r: 1.1, chain: true },
    ],
  },
  {
    id: 's5-03',
    length: 42,
    ceil: '2 r42',
    floor: '10 r42',
    hazards: [
      { type: 'pillar', x: 7, on: 'floor', h: 3 },
      { type: 'spike', x: 7, y: 7, dir: 'up' },
      { type: 'pillar', x: 13, on: 'ceil', h: 3 },
      { type: 'spike', x: 13, y: 5, dir: 'down' },
      { type: 'pillar', x: 19, on: 'floor', h: 3 },
      { type: 'spike', x: 19, y: 7, dir: 'up' },
      { type: 'pillar', x: 25, on: 'ceil', h: 3 },
      { type: 'spike', x: 25, y: 5, dir: 'down' },
      { type: 'pillar', x: 31, on: 'floor', h: 3 },
      { type: 'spike', x: 31, y: 7, dir: 'up' },
    ],
  },
  { id: 's5-04', ...tunnel({ gap: 3, legs: [-2, 4, -4, 4, -4, 2] }), hazards: [], deco: [{ type: 'chain', x: 4.5, len: 1, ornament: 'star' }] },
  {
    id: 's5-05',
    length: 42,
    ceil: '2 r6 d2 r5 u2 r6 d2 r5 u2 r12',
    floor: '10 r42',
    hazards: [
      { type: 'spike', x: 8, on: 'ceil', count: 5 },
      { type: 'spike', x: 23, on: 'ceil', count: 5 },
      { type: 'halfSpike', x: 15, on: 'floor', count: 3 },
      { type: 'saw', x: 33, y: 7.8, r: 1.2 },
    ],
  },
  // ── 6–10 ──
  { id: 's5-06', ...tunnel({ gap: 2.6, legs: [2, -4, 4, -4, 4, -4, 2] }), hazards: [], deco: [{ type: 'sawtooth', from: 7, to: 33, on: 'floor' }] },
  {
    id: 's5-07',
    length: 42,
    ceil: '2 r42',
    floor: '10 r42',
    hazards: [
      { type: 'block', x: 6, y: 2, w: 2, h: 2.8 },
      { type: 'spike', x: 6, y: 4.8, dir: 'down', count: 2 },
      { type: 'saw', x: 12, y: 8.6, r: 1.3 },
      { type: 'block', x: 17, y: 2, w: 2, h: 2.8 },
      { type: 'spike', x: 17, y: 4.8, dir: 'down', count: 2 },
      { type: 'saw', x: 23, y: 8.6, r: 1.3 },
      { type: 'block', x: 28, y: 2, w: 2, h: 2.8 },
      { type: 'spike', x: 28, y: 4.8, dir: 'down', count: 2 },
      { type: 'orb', x: 34, y: 8.4, r: 1 },
    ],
  },
  {
    id: 's5-08',
    length: 42,
    ceil: '2 r5 +1 r3 +1 r3 +1 r5 -1 r3 -1 r3 -1 r20',
    floor: '10 r19 -1 r3 -1 r3 -1 r5 +1 r3 +1 r3 +1 r6',
    hazards: [
      { type: 'halfSpike', x: 12, on: 'floor', count: 3 },
      { type: 'halfSpike', x: 29, on: 'ceil', count: 3 },
      { type: 'orb', x: 18.5, y: 6, r: 0.6 },
    ],
  },
  {
    id: 's5-09',
    mini: true,
    ...room({ lead: 2, top: 0.5, bottom: 11.5, inner: 32, tail: 2 }),
    hazards: [
      { type: 'saw', x: 10, y: 9.6, r: 1.6 },
      { type: 'saw', x: 17, y: 2.4, r: 1.6 },
      { type: 'saw', x: 24, y: 9.6, r: 1.6 },
      { type: 'saw', x: 31, y: 2.4, r: 1.6 },
    ],
  },
  { id: 's5-10', ...tunnel({ gap: 2.6, legs: [-3, 3, 3, -3, -3, 3, 3, -3] }), hazards: [], deco: [{ type: 'sawtooth', from: 8, to: 32, on: 'ceil' }] },
];
