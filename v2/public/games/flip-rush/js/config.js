// @ts-check
// Flip Rush's fixed numbers (docs/v2/PLAN.md 9.1, stage f-1): the third Rush game, on the
// shared engine (../../_engine/world.js: grid, joints, camera, clock). Two vehicles take
// turns, a vehicle portal in the joint wherever a section is designed for the other one:
// - the BALL rolls on the floor or the ceiling; a tap on the ground flips gravity and kicks
//   it toward the other side, where it lands and rolls on;
// - the SPIDER runs on the floor or the ceiling; a tap on the ground snaps it at once to the
//   first surface straight across, flipping gravity.
// Both rest and run on the top and the underside of any solid and die on a solid's
// vertical side and on any hazard (physics.js has the exact rule).
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
 * The genre's numbers (stage f-0 research, docs/v2/PLAN.md 9.1), in cells and seconds: a
 * cube falls at g ≈ 115 cells/s²; ball and spider fall at 0.6 g up to 30 cells/s; a ball's
 * flip leaves the ground at 0.6 of a cube's jump speed (22.4 cells/s). The mini vehicles
 * are smaller (a body 0.6 as big) and the mini ball's kick is 0.8 of the full one.
 * @typedef {{ gravity: number, terminal: number, kick: number, half: number, radius: number, size: number }} Body
 *   gravity: cells/s²; terminal: the fall's top speed; kick: the ball's flip speed;
 *   half: half the side of the square body that rests on surfaces and hits their sides;
 *   radius: the circle hazards are tested against; size: the drawn size (cells).
 */
export const BODY = {
  /** @type {Body} */
  normal: { gravity: 69, terminal: 30, kick: 13.4, half: 0.3, radius: 0.28, size: 1 },
  /** @type {Body} */
  mini: { gravity: 69, terminal: 30, kick: 10.7, half: 0.18, radius: 0.17, size: 0.6 },
};

/** A ball or spider that was at most SNAP past a surface the step before lands on it (the genre's ground modes: 1/3 of a cell). */
export const SNAP = 0.33;
/** The spider's streak after a snap, seconds (drawing only). */
export const STREAK_TIME = 0.14;

/**
 * Human limits per difficulty tier for tapping modes (owner: "possible for a human"). The
 * validator (prove.js) proves that every section has a path that keeps them:
 * - minInterval: seconds between two input changes, at least — a press is held at least
 *   this long and two presses are at least twice this apart;
 * - tolerance: seconds each tap may come early or late and the path still survives
 *   (a press held through a landing still counts, as in the genre);
 * - clearance: the corridor's opening in body heights, everywhere;
 * - maxRate: input changes (presses and releases) in any one second, at most.
 * `speed` is the multiplier of BASE_SPEED, on Wave Rush's ramp.
 * @typedef {{ speed: number, minInterval: number, tolerance: number, clearance: number, maxRate: number }} Tier
 * @type {Record<string, Tier>}
 */
export const TIERS = {
  easy: { speed: 0.8, minInterval: 0.12, tolerance: 0.045, clearance: 6, maxRate: 6 },
  normal: { speed: 0.85, minInterval: 0.11, tolerance: 0.04, clearance: 5, maxRate: 7 },
  hard: { speed: 1.0, minInterval: 0.1, tolerance: 0.03, clearance: 4, maxRate: 8 },
  harder: { speed: 1.1, minInterval: 0.09, tolerance: 0.028, clearance: 3.6, maxRate: 9 },
  insane: { speed: 1.25, minInterval: 0.085, tolerance: 0.025, clearance: 3.3, maxRate: 10 },
  easyDemon: { speed: 1.25, minInterval: 0.085, tolerance: 0.025, clearance: 3.3, maxRate: 10 },
  hardDemon: { speed: 1.4, minInterval: 0.08, tolerance: 0.023, clearance: 3.1, maxRate: 11 },
  insaneDemon: { speed: 1.55, minInterval: 0.075, tolerance: 0.02, clearance: 2.9, maxRate: 12 },
  extremeDemon: { speed: 1.7, minInterval: 0.07, tolerance: 0.018, clearance: 2.8, maxRate: 13 },
};

/** @typedef {import('../../_engine/sectors.js').SectorDef} SectorDef */

/**
 * The run: Wave Rush's structure exactly (owner) — 10, 15, 15, 10, 10 and 30 sections in
 * the same shuffle groups and portals. Stage f-1 authors sectors 1–3; f-2 the rest.
 * @type {SectorDef[]}
 */
export const SECTORS = [
  { id: 1, key: 'easy', tier: 'easy', theme: 'hall', groups: [range(1, 10)], portals: [] },
  { id: 2, key: 'normal', tier: 'normal', theme: 'mine', groups: [range(1, 5), range(6, 15)], portals: [] },
  {
    id: 3,
    key: 'hard',
    tier: 'hard',
    theme: 'foundry',
    groups: [range(1, 5), range(6, 15)],
    portals: [{ kind: 'gravity', count: 1, span: 2 }],
    // From sector 3 the vehicle changes more often (owner): the shuffle is dealt out by
    // vehicle in turns, a portal at nearly every joint.
    alternate: true,
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
export const bodyOf = (mini) => (mini ? BODY.mini : BODY.normal);
