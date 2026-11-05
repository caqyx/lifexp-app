// @ts-check
// Robot Rush's fixed numbers (docs/v2/PLAN.md 9.1, stage rr-b): Rush's fourth mode, on the
// shared engine (../../_engine/world.js: grid, joints, camera, clock). One vehicle, the
// ROBOT: it runs on the floor (or, upside down, on the ceiling) and on the top of any
// solid; a press on the ground jumps, and the longer the press is held the higher it goes
// — up to a top hold time, after which it falls as usual. Held on, it jumps again as soon
// as it lands. A solid's vertical side and any hazard are a crash (physics.js has the
// exact rule).
import { BASE_SPEED } from '../../_engine/world.js';
import { range } from '../../_engine/sectors.js';

export {
  BASE_SPEED,
  CAMERA_LEAD,
  INPUT_BUFFER_MS,
  JOINT,
  JOINT_CLEAR,
  MAX_FRAME,
  MIN_VIEW_W,
  PLAY_H,
  RESPAWN_BACK,
  RESTART_LOCK,
  START_PAD,
  STEP,
  VIEW_H,
  VIEW_TOP,
} from '../../_engine/world.js';
export { bandOf, sectionStyle } from '../../_engine/sectors.js';

/**
 * The robot (stage rr-b research of the genre's feel, in cells and seconds; no numbers
 * copied from anyone's code): a jump that starts slower than a cube's and keeps climbing at
 * that speed while held — the "thrusters" — for at most `boost` seconds, then falls under
 * gravity like the ball does. A tap of one step clears about 0.7 cells, a tap of 0.12 s
 * about 2, a full hold about 3.4: the jump's height is the player's to choose. The mini
 * robot is smaller and lighter: a lower, shorter jump.
 * @typedef {{ gravity: number, terminal: number, jump: number, boost: number, half: number, radius: number, size: number }} Robot
 *   gravity: cells/s²; terminal: the fall's top speed; jump: the climbing speed while the
 *   thrusters fire; boost: their longest burn (s); half: half the side of the square body
 *   that rests on surfaces and hits their sides; radius: the circle hazards are tested
 *   against; size: the drawn size (cells).
 */
export const ROBOT = {
  /** @type {Robot} */
  normal: { gravity: 80, terminal: 28, jump: 10.5, boost: 0.26, half: 0.3, radius: 0.28, size: 1 },
  /** @type {Robot} */
  mini: { gravity: 80, terminal: 28, jump: 8.6, boost: 0.2, half: 0.18, radius: 0.17, size: 0.6 },
};

/** A robot that was at most SNAP past a surface the step before lands on it (as the ball). */
export const SNAP = 0.33;

/**
 * Human limits per difficulty tier (owner: "possible for a human"), as Flip Rush's: the
 * validator (prove.js) proves every section keeps them. A robot's hold has a length that
 * matters, so the validator also shifts every release alone (a press held a little too
 * long or too short) by the tolerance.
 * @typedef {{ speed: number, minInterval: number, tolerance: number, clearance: number, maxRate: number }} Tier
 * @type {Record<string, Tier>}
 */
export const TIERS = {
  easy: { speed: 0.8, minInterval: 0.12, tolerance: 0.04, clearance: 6, maxRate: 6 },
  normal: { speed: 0.85, minInterval: 0.11, tolerance: 0.035, clearance: 5, maxRate: 7 },
  hard: { speed: 1.0, minInterval: 0.1, tolerance: 0.03, clearance: 4, maxRate: 8 },
  harder: { speed: 1.1, minInterval: 0.09, tolerance: 0.028, clearance: 3.6, maxRate: 9 },
  insane: { speed: 1.25, minInterval: 0.085, tolerance: 0.025, clearance: 3.3, maxRate: 10 },
  easyDemon: { speed: 1.25, minInterval: 0.085, tolerance: 0.025, clearance: 3.3, maxRate: 10 },
  hardDemon: { speed: 1.4, minInterval: 0.08, tolerance: 0.023, clearance: 3.1, maxRate: 11 },
  insaneDemon: { speed: 1.55, minInterval: 0.075, tolerance: 0.02, clearance: 2.9, maxRate: 12 },
  extremeDemon: { speed: 1.7, minInterval: 0.07, tolerance: 0.018, clearance: 2.8, maxRate: 13 },
  // The finale "Neonowy Szczyt": between the Demon's Hard and Insane, held for its whole length.
  finale: { speed: 1.45, minInterval: 0.08, tolerance: 0.022, clearance: 3, maxRate: 11 },
};

/** @typedef {import('../../_engine/sectors.js').SectorDef} SectorDef */

/**
 * The run: the other modes' structure exactly (owner) — 10, 15, 15, 10, 10 and 30
 * sections in the same shuffle groups, a new idea per sector from sector 2: speed portals
 * (2), gravity turned over inside a section (3), moving saws and the mini robot (4), the
 * dark and orbs and pads (5), then all of it (the Demon).
 * @type {SectorDef[]}
 */
export const SECTORS = [
  { id: 1, key: 'easy', tier: 'easy', theme: 'rooftops', groups: [range(1, 10)], portals: [] },
  { id: 2, key: 'normal', tier: 'normal', theme: 'avenue', groups: [range(1, 5), range(6, 15)], portals: [] },
  // The robot's gravity flips are inside its sections (from sector 3), each section drawn
  // for its own upside-down stretch: a section drawn for the floor cannot be run on the
  // ceiling, so no gravity portal stands at a joint (unlike the other modes).
  { id: 3, key: 'hard', tier: 'hard', theme: 'cranes', groups: [range(1, 5), range(6, 15)], portals: [] },
  { id: 4, key: 'harder', tier: 'harder', theme: 'tunnels', groups: [range(1, 10)], portals: [{ kind: 'mini', count: 1 }] },
  { id: 5, key: 'insane', tier: 'insane', theme: 'storm', groups: [range(1, 5), range(6, 10)], portals: [{ kind: 'mini', count: 1 }] },
  {
    id: 6,
    key: 'demon',
    tier: 'easyDemon',
    theme: 'grid',
    groups: [range(1, 10), range(11, 15), range(16, 25), range(26, 30)],
    bands: [
      { from: 1, to: 10, tier: 'easyDemon', theme: 'grid', key: 'easyDemon' },
      { from: 11, to: 15, tier: 'hardDemon', theme: 'signs', key: 'hardDemon' },
      { from: 16, to: 25, tier: 'insaneDemon', theme: 'blackout', key: 'insaneDemon' },
      { from: 26, to: 30, tier: 'extremeDemon', theme: 'overload', key: 'extremeDemon' },
    ],
    // As the other modes' Demon: the mini stretch in Hard, Insane and Extreme (its gravity
    // flips are inside its sections).
    portals: [
      { kind: 'mini', count: 1, band: 1 },
      { kind: 'mini', count: 1, band: 2 },
      { kind: 'mini', count: 1, band: 3 },
    ],
  },
];

/** @param {string} key @returns {Tier} */
export function tierOf(key) {
  const tier = TIERS[key];
  if (!tier) throw new Error(`unknown tier ${key}`);
  return tier;
}

/** Cells per second of a tier. @param {string} key */
export function tierSpeed(key) {
  return tierOf(key).speed * BASE_SPEED;
}

/** @param {boolean} mini */
export const robotOf = (mini) => (mini ? ROBOT.mini : ROBOT.normal);

/** The finale's number among the sector-like levels (its sections live under this id). */
export const FINALE_ID = 7;

/**
 * The finale "Neonowy Szczyt" (stage rr-b): one fixed sequence (never shuffled) of ten
 * original stretches up to the city's highest tower, every idea of the run at one tier.
 * Unlocked by finishing the Demon; its own record and achievement.
 * @type {SectorDef}
 */
export const FINALE = {
  id: FINALE_ID,
  key: 'finale',
  tier: 'finale',
  theme: 'summit',
  groups: [range(1, 10)],
  portals: [],
  fixed: true,
};
