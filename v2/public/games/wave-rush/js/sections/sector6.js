// @ts-check
// Sector 6 "Demon" (docs/v2/PLAN.md 9.1, stage w-2): 30 sections in four tiers, each
// shuffled within itself, the tiers in order: Easy Demon 1–10 (speed 1.3), Hard Demon
// 11–15 (1.5), Insane Demon 16–25 (1.7), Extreme Demon 26–30 (1.9). Mostly diagonal
// zig-zag corridors (the wave grazes their 45° walls), broken by chambers of spike orbs,
// some hanging on chains; the difficulty comes from density and rhythm (legs of
// different lengths), not from corridors tighter than the tier allows. One mini section
// in each of Hard, Insane and Extreme.
import { join, open, room, tunnel } from './kit.js';

/** @typedef {import('../geometry.js').HazardData} HazardData */

/**
 * Spike orbs in a chamber, alternating high (on a chain) and low.
 * @param {number} x0 first orb @param {number} step @param {number} count @param {number} high @param {number} low @param {number} r
 * @returns {HazardData[]}
 */
function orbRow(x0, step, count, high, low, r) {
  return Array.from({ length: count }, (_, i) =>
    i % 2 === 0 ? { type: 'orb', x: x0 + i * step, y: low, r } : { type: 'orb', x: x0 + i * step, y: high, r, chain: true },
  );
}

// Easy Demon (1–10): corridors ≥ 2.8 high.
const d02 = join(tunnel({ gap: 3, legs: [2, -4, 2], tail: 2 }), room({ lead: 2, top: 1, bottom: 11, inner: 14 }));
const d08 = join(tunnel({ gap: 3, legs: [3, -3, 3, -3], tail: 2 }), tunnel({ lead: 3, gap: 3, legs: [-3, 3, -3, 3] }));
// Hard Demon (11–15)
const d13 = join(tunnel({ gap: 2.8, legs: [-3, 3, -3, 3], tail: 2 }), room({ lead: 2, top: 1, bottom: 11, inner: 12 }), tunnel({ lead: 2, gap: 2.8, legs: [3, -3] }));
// Insane Demon (16–25)
const d17 = join(tunnel({ gap: 2.8, legs: [4, -4, 3, -3], tail: 2 }), room({ lead: 2, top: 1, bottom: 11, inner: 12 }), tunnel({ lead: 2, gap: 2.8, legs: [-3, 3, -3, 3] }));
const d23 = join(room({ top: 1, bottom: 11, inner: 12, tail: 2 }), tunnel({ lead: 2, gap: 2.8, legs: [3, -4, 4, -4, 4, -3] }));
// Extreme Demon (26–30)
const d27 = join(tunnel({ gap: 3, legs: [3, -3, 4, -4, 3, -3], tail: 2 }), room({ lead: 2, top: 1, bottom: 11, inner: 14 }), tunnel({ lead: 2, gap: 3, legs: [-4, 4, -3, 3] }));
const d30 = join(tunnel({ gap: 3, legs: [4, -4, 4, -4], tail: 2 }), open(4), tunnel({ lead: 2, gap: 3, legs: [-3, 3, -4, 4, -3, 3] }));

/** @type {import('../geometry.js').SectionData[]} */
export const SECTOR6 = [
  // ── Easy Demon ──
  { id: 'd01', ...tunnel({ gap: 3.2, legs: [3, -3, 3, -3, 3, -3] }), hazards: [], deco: [{ type: 'chain', x: 4, len: 1.2, ornament: 'triangle' }] },
  { id: 'd02', ...d02, hazards: orbRow(/** @type {number} */ (d02.at[1]) + 8, 4.5, 3, 3.6, 8.2, 1.1), deco: [{ type: 'star', x: /** @type {number} */ (d02.at[1]) + 10.2, y: 5.9, size: 0.6 }] },
  { id: 'd03', ...tunnel({ gap: 3, legs: [-2, 4, -4, 4, -2] }), hazards: [] },
  {
    id: 'd04',
    ...room({ top: 1, bottom: 11, inner: 28 }),
    hazards: orbRow(9, 4.6, 6, 3.6, 8.4, 1.15),
    deco: [
      { type: 'chain', x: 11.3, len: 1.2, ornament: 'triangle' },
      { type: 'chain', x: 20.5, len: 1.2, ornament: 'triangle' },
      { type: 'chain', x: 29.7, len: 1.2, ornament: 'triangle' },
      { type: 'star', x: 15.9, y: 6, size: 0.5 },
      { type: 'star', x: 25.1, y: 6, size: 0.5 },
    ],
  },
  { id: 'd05', ...tunnel({ gap: 3, legs: [4, -2, -2, 4, -4, 2] }), hazards: [] },
  {
    id: 'd06',
    length: 40,
    ceil: '2 r40',
    floor: '10 r40',
    hazards: [
      { type: 'pillar', x: 7, on: 'floor', h: 3 },
      { type: 'spike', x: 7, y: 7, dir: 'up' },
      { type: 'orb', x: 13, y: 4, r: 1, chain: true },
      { type: 'pillar', x: 19, on: 'floor', h: 3 },
      { type: 'spike', x: 19, y: 7, dir: 'up' },
      { type: 'orb', x: 25, y: 4, r: 1, chain: true },
      { type: 'pillar', x: 31, on: 'floor', h: 3 },
      { type: 'spike', x: 31, y: 7, dir: 'up' },
    ],
  },
  { id: 'd07', ...tunnel({ gap: 3, legs: [3, -3, -2, 2, 3, -3] }), hazards: [] },
  { id: 'd08', ...d08, hazards: [] },
  { id: 'd09', ...tunnel({ gap: 2.8, legs: [-3, 5, -5, 3] }), hazards: [], deco: [{ type: 'chain', x: 4, len: 1, ornament: 'diamond' }] },
  {
    id: 'd10',
    ...room({ top: 1, bottom: 11, inner: 28 }),
    hazards: [
      { type: 'saw', x: 9, y: 9.4, r: 1.6 },
      { type: 'orb', x: 14, y: 3.4, r: 1.1, chain: true },
      { type: 'saw', x: 19, y: 9.4, r: 1.6 },
      { type: 'orb', x: 24, y: 3.4, r: 1.1, chain: true },
      { type: 'saw', x: 29, y: 9.4, r: 1.6 },
    ],
    deco: [
      { type: 'chain', x: 19, len: 1.4, ornament: 'diamond' },
      { type: 'star', x: 11.5, y: 6.2, size: 0.5 },
      { type: 'star', x: 26.5, y: 6.2, size: 0.5 },
    ],
  },
  // ── Hard Demon ──
  { id: 'd11', ...tunnel({ gap: 2.8, legs: [3, -3, 3, -3, 4, -4, 3, -3] }), hazards: [] },
  {
    id: 'd12',
    mini: true,
    ...room({ lead: 2, top: 0.5, bottom: 11.5, inner: 30, tail: 2 }),
    hazards: [
      { type: 'saw', x: 9, y: 10, r: 1.7 },
      { type: 'orb', x: 16, y: 2.4, r: 1.2, chain: true },
      { type: 'saw', x: 23, y: 10, r: 1.7 },
      { type: 'orb', x: 30, y: 2.4, r: 1.2, chain: true },
    ],
  },
  { id: 'd13', ...d13, hazards: orbRow(/** @type {number} */ (d13.at[1]) + 6, 4, 3, 3.8, 8.2, 1.05) },
  { id: 'd14', ...tunnel({ gap: 2.8, legs: [2, -4, 4, -2, -2, 4, -2] }), hazards: [] },
  {
    id: 'd15',
    ...room({ top: 1, bottom: 11, inner: 28 }),
    hazards: [
      { type: 'pillar', x: 8, on: 'floor', h: 4.2 },
      { type: 'spike', x: 8, y: 6.8, dir: 'up' },
      { type: 'orb', x: 13.5, y: 3.6, r: 1.1, chain: true },
      { type: 'pillar', x: 19, on: 'ceil', h: 4.2 },
      { type: 'spike', x: 19, y: 5.2, dir: 'down' },
      { type: 'orb', x: 24.5, y: 8.4, r: 1.1 },
      { type: 'pillar', x: 30, on: 'floor', h: 4.2 },
      { type: 'spike', x: 30, y: 6.8, dir: 'up' },
    ],
  },
  // ── Insane Demon ──
  { id: 'd16', ...tunnel({ gap: 2.6, legs: [3, -3, 3, -3, 3, -3, 3, -3] }), hazards: [] },
  { id: 'd17', ...d17, hazards: orbRow(/** @type {number} */ (d17.at[1]) + 6, 4, 3, 3.6, 8.4, 1.05) },
  { id: 'd18', ...tunnel({ gap: 2.6, legs: [-3, 3, 4, -4, -3, 3, 4, -4] }), hazards: [] },
  {
    id: 'd19',
    ...room({ top: 1, bottom: 11, inner: 30 }),
    hazards: [...orbRow(9, 4.2, 7, 3.4, 8.6, 1.05)],
    deco: [
      { type: 'chain', x: 11.1, len: 1.1, ornament: 'triangle' },
      { type: 'chain', x: 19.5, len: 1.1, ornament: 'triangle' },
      { type: 'chain', x: 27.9, len: 1.1, ornament: 'triangle' },
      { type: 'diamond', x: 15.3, y: 6, size: 0.5 },
      { type: 'diamond', x: 23.7, y: 6, size: 0.5 },
    ],
  },
  { id: 'd20', ...tunnel({ gap: 2.6, legs: [4, -3, -3, 4, -4, 3, 3, -4] }), hazards: [] },
  {
    id: 'd21',
    mini: true,
    ...room({ lead: 2, top: 0.5, bottom: 11.5, inner: 32, tail: 2 }),
    hazards: [
      { type: 'orb', x: 9, y: 9.8, r: 1.4 },
      { type: 'orb', x: 15, y: 2.2, r: 1.4, chain: true },
      { type: 'orb', x: 21, y: 9.8, r: 1.4 },
      { type: 'orb', x: 27, y: 2.2, r: 1.4, chain: true },
      { type: 'orb', x: 33, y: 9.8, r: 1.4 },
    ],
  },
  { id: 'd22', ...tunnel({ gap: 2.6, legs: [2, -4, 4, -4, 4, -4, 2] }), hazards: [] },
  { id: 'd23', ...d23, hazards: orbRow(9, 4, 3, 3.6, 8.4, 1.05) },
  { id: 'd24', ...tunnel({ gap: 2.6, legs: [-4, 4, -3, 3, -4, 4, -3, 3] }), hazards: [] },
  {
    id: 'd25',
    length: 42,
    ceil: '2 r42',
    floor: '10 r42',
    hazards: [
      { type: 'block', x: 7, y: 2, w: 2, h: 2.6 },
      { type: 'spike', x: 7, y: 4.6, dir: 'down', count: 2 },
      { type: 'orb', x: 12.5, y: 8.4, r: 1.1 },
      { type: 'block', x: 18, y: 2, w: 2, h: 2.6 },
      { type: 'spike', x: 18, y: 4.6, dir: 'down', count: 2 },
      { type: 'orb', x: 23.5, y: 8.4, r: 1.1 },
      { type: 'block', x: 29, y: 2, w: 2, h: 2.6 },
      { type: 'spike', x: 29, y: 4.6, dir: 'down', count: 2 },
      { type: 'orb', x: 34.5, y: 8.4, r: 1.1 },
    ],
  },
  // ── Extreme Demon ──
  { id: 'd26', ...tunnel({ gap: 3, legs: [3, -3, 4, -4, 3, -3, 4, -4] }), hazards: [] },
  { id: 'd27', ...d27, hazards: orbRow(/** @type {number} */ (d27.at[1]) + 6, 4.4, 3, 3.6, 8.4, 1.05) },
  {
    id: 'd28',
    mini: true,
    ...room({ lead: 2, top: 0.5, bottom: 11.5, inner: 34, tail: 2 }),
    hazards: [
      { type: 'saw', x: 13, y: 10.5, r: 1.2 },
      { type: 'saw', x: 27, y: 1.5, r: 1.2 },
    ],
  },
  { id: 'd29', ...tunnel({ gap: 3, legs: [-3, 4, -4, 3, -3, 4, -4, 3] }), hazards: [] },
  { id: 'd30', ...d30, hazards: [] },
];
