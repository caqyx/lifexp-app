// @ts-check
// Flip Rush sector 6 "Demon" (docs/v2/PLAN.md 9.1, stage f-2): 30 sections in four tiers,
// each shuffled within itself, the tiers in order — Easy 1–10, Hard 11–15, Insane 16–25,
// Extreme 26–30 — each with its own speed, limits, look and practice checkpoint. Ball and
// spider are dealt out in turns, so the vehicle changes at every joint (about every two
// seconds); dense chains of orbs off jump pads for the ball, orbs by both surfaces for the
// spider; mini sections d-15, d-25 and d-30. Stage r-2: every section from seeded
// templates (no two alike), combining all the run's ideas — moving saws, spider mazes,
// gravity flipped inside a section, speed portals (more in the later tiers), dark
// stretches (every third section). The engine's ornament (chains, gears, frames)
// is added on top, denser tier by tier (owner: denser than Wave Rush's demons; it never
// comes near a hazard, an orb or a pad). Proven fair by v2/tests/flip-rush-sections.test.ts.
import { ornament } from '../../../_engine/ornament.js';

/** @typedef {import('../../../_engine/geometry.js').SectionData} SectionData */

/** @type {SectionData[]} */
const AUTHORED = [
  {
    // Ball: 1 bed, moving saws.
    id: 'd-01',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 12.3, y: 6, r: 1, move: { dx: 1.6, dy: 1.2, every: 10, phase: 0.25 } },
      { type: 'spike', x: 24.3, on: 'floor', count: 2 },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, moving saws.
    id: 'd-02',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 12.3, y: 6, r: 0.8, move: { dx: 0, dy: 2.4, every: 7, phase: 0.5 } },
      { type: 'ring', kind: 'jump', x: 16.6, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 16.6, y: 2.65 },
      { type: 'spike', x: 17.8, on: 'floor', count: 2 },
      { type: 'spike', x: 17.8, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: 1 bed, columns, in the dark.
    id: 'd-03',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 10.3, on: 'ceil', h: 3.8 },
      { type: 'pillar', x: 18.3, on: 'floor', h: 3.8 },
      { type: 'spike', x: 21.3, on: 'ceil', count: 4 },
      { type: 'dark', from: 9.3, to: 28 },
    ],
  },
  {
    // Spider: 1 bed, mines, gravity flipped and back.
    id: 'd-04',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'portal', x: 8.4, kind: 'flip' },
      { type: 'spike', x: 15.9, on: 'floor', count: 2 },
      { type: 'portal', x: 21.8, kind: 'flip' },
      { type: 'mine', x: 24.3, y: 9.08, r: 0.6 },
    ],
  },
  {
    // Ball: a gravity pad, 1 bed.
    id: 'd-05',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'gravity', x: 11.6, on: 'floor' },
      { type: 'spike', x: 13.6, on: 'floor', count: 6 },
      { type: 'pad', kind: 'jump', x: 21.2, on: 'floor' },
    ],
  },
  {
    // Spider: 3 beds, platforms, in the dark.
    id: 'd-06',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8.4, on: 'floor', count: 4 },
      { type: 'block', x: 8.4, y: 5.6, w: 4, h: 0.8 },
      { type: 'spike', x: 16, on: 'ceil', count: 2 },
      { type: 'spike', x: 20, on: 'floor', count: 2 },
      { type: 'dark', from: 7.4, to: 28 },
    ],
  },
  {
    // Ball: 2 beds, a saw, a slow speed portal.
    id: 'd-07',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 8.4, k: 'slow' },
      { type: 'spike', x: 10.9, on: 'floor', count: 2 },
      { type: 'saw', x: 16.9, y: 5.5, r: 0.8 },
      { type: 'spike', x: 16.9, on: 'ceil', count: 2 },
    ],
  },
  {
    // Spider: 2 orbs, 4 beds, platforms.
    id: 'd-08',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8.4, on: 'floor', count: 11 },
      { type: 'block', x: 8.9, y: 5, w: 3.5, h: 0.8 },
      { type: 'block', x: 14.4, y: 6.6, w: 3.5, h: 0.8 },
      { type: 'spike', x: 14.4, on: 'ceil', count: 3 },
      { type: 'ring', kind: 'jump', x: 22.4, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 22.4, y: 2.65 },
      { type: 'spike', x: 23.6, on: 'floor', count: 2 },
      { type: 'spike', x: 23.6, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: 1 bed, moving saws, in the dark.
    id: 'd-09',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 12.3, y: 6, r: 0.8, move: { dx: 1.6, dy: 1.2, every: 10, phase: 0.75 } },
      { type: 'spike', x: 24.1, on: 'ceil', count: 2 },
      { type: 'dark', from: 7.4, to: 28 },
    ],
  },
  {
    // Spider: 1 bed, platforms, moving saws.
    id: 'd-10',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 12.3, y: 6, r: 0.8, move: { dx: 0, dy: 2.4, every: 10, phase: 0.5 } },
      { type: 'block', x: 17.1, y: 5, w: 3.5, h: 0.8 },
      { type: 'block', x: 22.6, y: 6.6, w: 3.5, h: 0.8 },
      { type: 'spike', x: 22.6, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: columns.
    id: 'd-11',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 11.2, on: 'floor', h: 3 },
      { type: 'pillar', x: 21.4, on: 'ceil', h: 3 },
    ],
  },
  {
    // Spider: 1 bed, mines, gravity flipped and back, in the dark.
    id: 'd-12',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'portal', x: 9.1, kind: 'flip' },
      { type: 'spike', x: 17.3, on: 'ceil', count: 2 },
      { type: 'portal', x: 23.7, kind: 'flip' },
      { type: 'mine', x: 26.2, y: 9.08, r: 0.6 },
      { type: 'dark', from: 8.1, to: 28 },
    ],
  },
  {
    // Ball: a gravity pad, 1 bed.
    id: 'd-13',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'gravity', x: 12.7, on: 'floor' },
      { type: 'spike', x: 14.7, on: 'floor', count: 5 },
      { type: 'pad', kind: 'jump', x: 23.6, on: 'floor' },
    ],
  },
  {
    // Spider: 3 beds, platforms.
    id: 'd-14',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.1, on: 'floor', count: 5 },
      { type: 'block', x: 9.1, y: 5.8, w: 5, h: 0.8 },
      { type: 'spike', x: 18.4, on: 'ceil', count: 2 },
      { type: 'spike', x: 22.4, on: 'ceil', count: 3 },
    ],
  },
  {
    // Ball (mini): 2 beds, columns.
    id: 'd-15',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    mini: true,
    hazards: [
      { type: 'spike', x: 9.1, on: 'floor', count: 2 },
      { type: 'spike', x: 17.7, on: 'ceil', count: 2 },
      { type: 'pillar', x: 21.7, on: 'floor', h: 4.5 },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, platforms, a fast speed portal.
    id: 'd-16',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 9.8, k: 'fast' },
      { type: 'spike', x: 12.3, on: 'floor', count: 10 },
      { type: 'block', x: 12.8, y: 5.4, w: 3, h: 0.8 },
      { type: 'block', x: 18.3, y: 7, w: 3, h: 0.8 },
      { type: 'spike', x: 18.3, on: 'ceil', count: 3 },
      { type: 'ring', kind: 'jump', x: 25.8, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 25.8, y: 2.65 },
    ],
  },
  {
    // Ball: 2 beds.
    id: 'd-17',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.8, on: 'floor', count: 4 },
      { type: 'spike', x: 22.7, on: 'ceil', count: 4 },
    ],
  },
  {
    // Spider: moving saws, a veryFast speed portal, in the dark.
    id: 'd-18',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'saw', x: 14.6, y: 6, r: 0.9, move: { dx: 0, dy: 2.4, every: 9, phase: 0.5 } },
      { type: 'speed', x: 19, k: 'veryFast' },
      { type: 'dark', from: 8.8, to: 21.5 },
    ],
  },
  {
    // Ball: columns.
    id: 'd-19',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 12.2, on: 'ceil', h: 3.8 },
      { type: 'pillar', x: 21.8, on: 'floor', h: 3.8 },
    ],
  },
  {
    // Spider: 1 bed, a slow speed portal, gravity flipped and back.
    id: 'd-20',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 9.8, k: 'slow' },
      { type: 'portal', x: 12.3, kind: 'flip' },
      { type: 'spike', x: 19.7, on: 'ceil', count: 2 },
      { type: 'portal', x: 25.6, kind: 'flip' },
    ],
  },
  {
    // Ball: a gravity pad, 1 bed, in the dark.
    id: 'd-21',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'gravity', x: 13.8, on: 'floor' },
      { type: 'spike', x: 15.8, on: 'floor', count: 5 },
      { type: 'pad', kind: 'jump', x: 23.4, on: 'floor' },
      { type: 'dark', from: 12.8, to: 28 },
    ],
  },
  {
    // Spider: 3 beds, platforms.
    id: 'd-22',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.8, on: 'floor', count: 4 },
      { type: 'block', x: 9.8, y: 6, w: 4, h: 0.8 },
      { type: 'spike', x: 19, on: 'ceil', count: 2 },
      { type: 'spike', x: 23, on: 'floor', count: 3 },
    ],
  },
  {
    // Ball: 2 beds, a saw, a fast speed portal.
    id: 'd-23',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 9.8, k: 'fast' },
      { type: 'spike', x: 12.3, on: 'floor', count: 2 },
      { type: 'saw', x: 21.2, y: 6, r: 0.8 },
      { type: 'spike', x: 21.2, on: 'ceil', count: 2 },
    ],
  },
  {
    // Spider: 2 beds, mines, platforms, a veryFast speed portal, in the dark.
    id: 'd-24',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 9.8, k: 'veryFast' },
      { type: 'spike', x: 12.3, on: 'floor', count: 11 },
      { type: 'block', x: 12.8, y: 5.4, w: 3.5, h: 0.8 },
      { type: 'block', x: 18.3, y: 6.6, w: 3.5, h: 0.8 },
      { type: 'spike', x: 18.3, on: 'ceil', count: 3 },
      { type: 'mine', x: 23.8, y: 2.8, r: 0.6 },
      { type: 'dark', from: 8.8, to: 28 },
    ],
  },
  {
    // Ball (mini): 2 beds, columns.
    id: 'd-25',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    mini: true,
    hazards: [
      { type: 'spike', x: 9.8, on: 'ceil', count: 2 },
      { type: 'spike', x: 20.4, on: 'floor', count: 2 },
      { type: 'pillar', x: 24.4, on: 'floor', h: 4.5 },
    ],
  },
  {
    // Spider: 2 beds, a slow speed portal.
    id: 'd-26',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 10.5, on: 'ceil', count: 3 },
      { type: 'spike', x: 19.6, on: 'floor', count: 3 },
      { type: 'speed', x: 24.6, k: 'slow' },
    ],
  },
  {
    // Ball: columns, in the dark.
    id: 'd-27',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 13.1, on: 'ceil', h: 3 },
      { type: 'pillar', x: 24.2, on: 'floor', h: 3 },
      { type: 'dark', from: 12.1, to: 28 },
    ],
  },
  {
    // Spider: 1 bed, a slow speed portal.
    id: 'd-28',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'speed', x: 10.5, k: 'slow' },
      { type: 'spike', x: 21, on: 'floor', count: 2 },
    ],
  },
  {
    // Ball: a gravity pad, 2 beds, a saw.
    id: 'd-29',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 10.5, on: 'floor', count: 2 },
      { type: 'saw', x: 18.2, y: 5.5, r: 0.8 },
      { type: 'spike', x: 18.2, on: 'ceil', count: 2 },
      { type: 'pad', kind: 'gravity', x: 22.2, on: 'floor' },
    ],
  },
  {
    // Spider (mini): 2 beds, columns.
    id: 'd-30',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    mini: true,
    hazards: [
      { type: 'spike', x: 10.5, on: 'floor', count: 2 },
      { type: 'spike', x: 18.9, on: 'ceil', count: 2 },
      { type: 'pillar', x: 22.9, on: 'floor', h: 4.5 },
    ],
  },
];

/** Ornament density by tier: Easy, Hard, Insane, Extreme. @param {number} n the section's number */
const densityOf = (n) => (n <= 10 ? 1 : n <= 15 ? 1.3 : n <= 25 ? 1.6 : 2);

/** The Demon's sections, ornament denser tier by tier. @type {SectionData[]} */
export const SECTOR6 = AUTHORED.map((d, i) => ornament(d, densityOf(i + 1), { high: 'gear' }));
