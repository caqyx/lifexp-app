// @ts-check
// Flip Rush sector 6 "Demon" (docs/v2/PLAN.md 9.1, stage f-2): 30 sections in four tiers,
// each shuffled within itself, the tiers in order — Easy 1–10, Hard 11–15, Insane 16–25,
// Extreme 26–30 — each with its own speed, limits, look and practice checkpoint. Ball and
// spider are dealt out in turns, so the vehicle changes at every joint (about every two
// seconds); dense chains of orbs off jump pads for the ball, orbs by both surfaces for the
// spider; mini sections d-15, d-25 and d-30. The engine's ornament (chains, gears, frames)
// is added on top, denser tier by tier (owner: denser than Wave Rush's demons; it never
// comes near a hazard, an orb or a pad). Proven fair by v2/tests/flip-rush-sections.test.ts.
import { ornament } from '../../../_engine/ornament.js';

/** @typedef {import('../../../_engine/geometry.js').SectionData} SectionData */

/** @type {SectionData[]} */
const AUTHORED = [
  {
    // Ball: a jump pad, 1 orb, 2 beds.
    id: 'd-01',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 11.6, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 16.9, y: 8.3 },
      { type: 'spike', x: 13.6, on: 'floor', count: 9 },
      { type: 'spike', x: 13.6, on: 'ceil', count: 9 },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, columns.
    id: 'd-02',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 8.4, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 13.7, on: 'ceil', h: 3.5 },
      { type: 'ring', kind: 'jump', x: 16.7, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 16.7, y: 2.65 },
      { type: 'spike', x: 17.9, on: 'floor', count: 2 },
      { type: 'spike', x: 17.9, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 beds.
    id: 'd-03',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8.4, on: 'floor', count: 3 },
      { type: 'spike', x: 18, on: 'ceil', count: 3 },
      { type: 'pad', kind: 'jump', x: 23, on: 'floor' },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, columns.
    id: 'd-04',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'ring', kind: 'jump', x: 8.4, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 8.4, y: 2.65 },
      { type: 'spike', x: 9.6, on: 'floor', count: 2 },
      { type: 'spike', x: 9.6, on: 'ceil', count: 2 },
      { type: 'pillar', x: 16.8, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 22.2, on: 'ceil', h: 3.5 },
    ],
  },
  {
    // Ball: a jump pad, 1 orb, 2 beds.
    id: 'd-05',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'jump', x: 8.4, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 13.6, y: 8.3 },
      { type: 'spike', x: 10.4, on: 'floor', count: 9 },
      { type: 'spike', x: 10.4, on: 'ceil', count: 9 },
    ],
  },
  {
    // Spider: 3 beds.
    id: 'd-06',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8.4, on: 'floor', count: 2 },
      { type: 'spike', x: 15.3, on: 'ceil', count: 2 },
      { type: 'spike', x: 22.3, on: 'floor', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 beds.
    id: 'd-07',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 8.4, on: 'floor', count: 3 },
      { type: 'spike', x: 18, on: 'ceil', count: 3 },
      { type: 'pad', kind: 'jump', x: 23, on: 'floor' },
    ],
  },
  {
    // Spider: 2 beds, mines.
    id: 'd-08',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 8.4, y: 9.2, r: 0.7 },
      { type: 'mine', x: 13.9, y: 2.8, r: 0.7 },
      { type: 'spike', x: 16.9, on: 'ceil', count: 2 },
      { type: 'spike', x: 23.8, on: 'floor', count: 2 },
    ],
  },
  {
    // Ball: a gravity pad, 1 orb, 1 beds.
    id: 'd-09',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'gravity', x: 8.4, on: 'floor' },
      { type: 'spike', x: 10.4, on: 'floor', count: 5 },
      { type: 'pad', kind: 'jump', x: 17.4, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 22.6, y: 8.3 },
    ],
  },
  {
    // Spider: 2 orbs, 4 beds.
    id: 'd-10',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'ring', kind: 'jump', x: 8.4, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 8.4, y: 2.65 },
      { type: 'spike', x: 9.6, on: 'floor', count: 2 },
      { type: 'spike', x: 9.6, on: 'ceil', count: 2 },
      { type: 'spike', x: 16.8, on: 'ceil', count: 2 },
      { type: 'spike', x: 23.8, on: 'floor', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 beds.
    id: 'd-11',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.1, on: 'floor', count: 3 },
      { type: 'spike', x: 19.2, on: 'ceil', count: 3 },
      { type: 'pad', kind: 'jump', x: 24.2, on: 'floor' },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, columns.
    id: 'd-12',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 9.1, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 14.8, on: 'ceil', h: 3.5 },
      { type: 'ring', kind: 'jump', x: 17.8, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 17.8, y: 2.65 },
      { type: 'spike', x: 19, on: 'floor', count: 2 },
      { type: 'spike', x: 19, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 beds.
    id: 'd-13',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.1, on: 'floor', count: 3 },
      { type: 'spike', x: 19.2, on: 'ceil', count: 3 },
      { type: 'pad', kind: 'jump', x: 24.2, on: 'floor' },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, columns.
    id: 'd-14',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'ring', kind: 'jump', x: 9.1, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 9.1, y: 2.65 },
      { type: 'spike', x: 10.3, on: 'floor', count: 2 },
      { type: 'spike', x: 10.3, on: 'ceil', count: 2 },
      { type: 'pillar', x: 18.2, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 24, on: 'ceil', h: 3.5 },
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
      { type: 'spike', x: 18.2, on: 'ceil', count: 2 },
      { type: 'pillar', x: 22.2, on: 'floor', h: 4.5 },
    ],
  },
  {
    // Spider: 2 orbs, 4 beds.
    id: 'd-16',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.8, on: 'floor', count: 2 },
      { type: 'spike', x: 17.5, on: 'ceil', count: 2 },
      { type: 'ring', kind: 'jump', x: 21.5, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 21.5, y: 2.65 },
      { type: 'spike', x: 22.7, on: 'floor', count: 2 },
      { type: 'spike', x: 22.7, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 beds.
    id: 'd-17',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.8, on: 'floor', count: 3 },
      { type: 'spike', x: 20.4, on: 'ceil', count: 3 },
      { type: 'pad', kind: 'jump', x: 25.4, on: 'floor' },
    ],
  },
  {
    // Spider: 1 beds, mines.
    id: 'd-18',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 9.8, y: 9.2, r: 0.7 },
      { type: 'mine', x: 16.2, y: 2.8, r: 0.7 },
      { type: 'spike', x: 19.2, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a gravity pad, 1 orb, 1 beds.
    id: 'd-19',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'gravity', x: 9.8, on: 'floor' },
      { type: 'spike', x: 11.8, on: 'floor', count: 5 },
      { type: 'pad', kind: 'jump', x: 18.8, on: 'floor' },
      { type: 'ring', kind: 'jump', x: 25.4, y: 8.3 },
    ],
  },
  {
    // Spider: 2 orbs, 3 beds.
    id: 'd-20',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'ring', kind: 'jump', x: 9.8, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 9.8, y: 2.65 },
      { type: 'spike', x: 11, on: 'floor', count: 2 },
      { type: 'spike', x: 11, on: 'ceil', count: 2 },
      { type: 'spike', x: 19.7, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 beds.
    id: 'd-21',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.8, on: 'floor', count: 3 },
      { type: 'spike', x: 20.4, on: 'ceil', count: 3 },
      { type: 'pad', kind: 'jump', x: 25.4, on: 'floor' },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, columns.
    id: 'd-22',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pillar', x: 9.8, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 15.9, on: 'ceil', h: 3.5 },
      { type: 'ring', kind: 'jump', x: 18.9, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 18.9, y: 2.65 },
      { type: 'spike', x: 20.1, on: 'floor', count: 2 },
      { type: 'spike', x: 20.1, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a jump pad, 2 beds.
    id: 'd-23',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 9.8, on: 'floor', count: 3 },
      { type: 'spike', x: 20.4, on: 'ceil', count: 3 },
      { type: 'pad', kind: 'jump', x: 25.4, on: 'floor' },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds, columns.
    id: 'd-24',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'ring', kind: 'jump', x: 9.8, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 9.8, y: 2.65 },
      { type: 'spike', x: 11, on: 'floor', count: 2 },
      { type: 'spike', x: 11, on: 'ceil', count: 2 },
      { type: 'pillar', x: 19.7, on: 'floor', h: 3.5 },
      { type: 'pillar', x: 25.9, on: 'ceil', h: 3.5 },
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
      { type: 'spike', x: 9.8, on: 'floor', count: 2 },
      { type: 'spike', x: 19.4, on: 'ceil', count: 2 },
      { type: 'pillar', x: 23.4, on: 'floor', h: 4.5 },
    ],
  },
  {
    // Spider: 2 orbs, 2 beds.
    id: 'd-26',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 10.5, on: 'floor', count: 2 },
      { type: 'spike', x: 20.5, on: 'ceil', count: 2 },
      { type: 'ring', kind: 'jump', x: 24.5, y: 9.35 },
      { type: 'ring', kind: 'jump', x: 24.5, y: 2.65 },
    ],
  },
  {
    // Ball: 2 beds.
    id: 'd-27',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'spike', x: 10.5, on: 'floor', count: 3 },
      { type: 'spike', x: 21.7, on: 'ceil', count: 3 },
    ],
  },
  {
    // Spider: 1 beds, mines.
    id: 'd-28',
    mode: 'spider',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'mine', x: 10.5, y: 9.2, r: 0.7 },
      { type: 'mine', x: 17.4, y: 2.8, r: 0.7 },
      { type: 'spike', x: 20.4, on: 'ceil', count: 2 },
    ],
  },
  {
    // Ball: a gravity pad, 1 beds.
    id: 'd-29',
    mode: 'ball',
    length: 30,
    ceil: '2 r30',
    floor: '10 r30',
    hazards: [
      { type: 'pad', kind: 'gravity', x: 10.5, on: 'floor' },
      { type: 'spike', x: 12.5, on: 'floor', count: 5 },
      { type: 'pad', kind: 'jump', x: 19.5, on: 'floor' },
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
      { type: 'spike', x: 18.7, on: 'ceil', count: 2 },
      { type: 'pillar', x: 22.7, on: 'floor', h: 4.5 },
    ],
  },
];

/** Ornament density by tier: Easy, Hard, Insane, Extreme. @param {number} n the section's number */
const densityOf = (n) => (n <= 10 ? 1 : n <= 15 ? 1.3 : n <= 25 ? 1.6 : 2);

/** The Demon's sections, ornament denser tier by tier. @type {SectionData[]} */
export const SECTOR6 = AUTHORED.map((d, i) => ornament(d, densityOf(i + 1), { high: 'gear' }));
