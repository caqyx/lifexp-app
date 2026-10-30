// @ts-check
// Ship Rush's fixed numbers (docs/v2/PLAN.md 9.1, stage s-1). The world (grid, joints,
// camera, clock) is the Rush engine's, shared with Wave Rush (../../_engine/world.js).
//
// The ship: hold to thrust up, let go and gravity pulls it down; the vertical speed
// changes smoothly and is capped. It may rest or slide on the top and the underside of
// any solid (the floor, the ceiling, blocks, pillars) and dies on a solid's vertical side
// and on any hazard (spikes, saws, mines). The exact rule is in physics.js.
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
 * @typedef {{ upRise: number, upFall: number, downRise: number, downFall: number, capUp: number, capDown: number,
 *   half: number, radius: number, size: number }} ShipKind
 *   Accelerations in cells/s², measured against gravity's pull: held — `upRise` while
 *   climbing, `upFall` while still falling (it brakes harder than it climbs); released —
 *   `downRise` while still climbing, `downFall` while falling (it sinks softer than it
 *   brakes). Speed caps: `capUp` climbing, `capDown` falling. half: half the side of the
 *   square body that rests on surfaces and hits their sides; radius: the circle hazards
 *   are tested against (inside the body); size: the drawn length (cells).
 */

/**
 * The ship and the mini ship (stage f-0: matched to the genre's feel, docs/v2/PLAN.md
 * 9.1). In the genre's units a cube falls at g ≈ 115 cells/s²; the ship climbs at 0.4 g,
 * brakes a fall at 0.5 g, sinks at 0.32 g and brakes a climb at 0.48 g, climbing at most
 * 16 cells/s and falling at most 12.8. The mini ship is the same ship ÷ 0.85: quicker in
 * everything and faster at its caps.
 */
export const SHIP = {
  /** @type {ShipKind} */
  normal: { upRise: 46, upFall: 57.5, downRise: 55.2, downFall: 36.8, capUp: 16, capDown: 12.8, half: 0.3, radius: 0.28, size: 1.1 },
  /** @type {ShipKind} */
  mini: { upRise: 54.1, upFall: 67.6, downRise: 64.9, downFall: 43.3, capUp: 18.8, capDown: 15.1, half: 0.18, radius: 0.17, size: 0.66 },
};

/**
 * A landing forgives this much: a body that was at most SNAP below a surface's level
 * the step before is put back on it (a sharper edge would read as a wall to the player).
 */
export const SNAP = 0.2;

/**
 * Human limits per difficulty tier, as in Wave Rush (owner, 2026-10-29: "possible for a
 * human, not just for a bot"). The validator (prove.js, v2/tests/ship-rush.test.ts)
 * proves that every authored section has a path that keeps them:
 * - minInterval: seconds between two input changes (hold ↔ release), at least;
 * - tolerance: seconds each tap (press and release together) may be early or late and
 *   the path still survives;
 * - clearance: the corridor's vertical opening, in ship body heights, everywhere;
 * - maxRate: input changes in any one second, at most.
 * `speed` is the multiplier of BASE_SPEED. Owner (stage s-1): sectors 1–2 must not feel
 * slow, so they start at 0.8 as Wave Rush's do, and the ramp follows Wave Rush's.
 * @typedef {{ speed: number, minInterval: number, tolerance: number, clearance: number, maxRate: number }} Tier
 * @type {Record<string, Tier>}
 */
export const TIERS = {
  easy: { speed: 0.8, minInterval: 0.24, tolerance: 0.045, clearance: 6, maxRate: 3.5 },
  normal: { speed: 0.85, minInterval: 0.21, tolerance: 0.04, clearance: 5, maxRate: 4 },
  hard: { speed: 1.0, minInterval: 0.17, tolerance: 0.03, clearance: 4, maxRate: 5 },
  harder: { speed: 1.1, minInterval: 0.16, tolerance: 0.028, clearance: 3.6, maxRate: 5.5 },
  insane: { speed: 1.25, minInterval: 0.15, tolerance: 0.025, clearance: 3.3, maxRate: 6 },
  easyDemon: { speed: 1.25, minInterval: 0.15, tolerance: 0.025, clearance: 3.3, maxRate: 6 },
  hardDemon: { speed: 1.4, minInterval: 0.14, tolerance: 0.023, clearance: 3.1, maxRate: 6.5 },
  insaneDemon: { speed: 1.55, minInterval: 0.125, tolerance: 0.02, clearance: 2.9, maxRate: 7 },
  extremeDemon: { speed: 1.7, minInterval: 0.115, tolerance: 0.018, clearance: 2.8, maxRate: 7.5 },
  // The finale's ship stretches, and its wave stretches (clearance in wave diameters,
  // the same 0.6 cells as the ship's body).
  finaleShip: { speed: 1.5, minInterval: 0.13, tolerance: 0.02, clearance: 3, maxRate: 7 },
  finaleWave: { speed: 1.3, minInterval: 0.15, tolerance: 0.025, clearance: 3.5, maxRate: 6 },
};

/**
 * @typedef {import('../../_engine/sectors.js').SectorDef} SectorDef
 */

/**
 * The run: Wave Rush's structure exactly (owner, stage s-1) — sectors with 10, 15, 15,
 * 10, 10 and 30 sections in the same shuffle groups and portals. Stage s-1 authors
 * sectors 1–3; sectors 4–6, the Demon and the finale come in stage s-2.
 * @type {SectorDef[]}
 */
export const SECTORS = [
  { id: 1, key: 'easy', tier: 'easy', theme: 'daySky', groups: [range(1, 10)], portals: [] },
  { id: 2, key: 'normal', tier: 'normal', theme: 'storm', groups: [range(1, 5), range(6, 15)], portals: [] },
  {
    id: 3,
    key: 'hard',
    tier: 'hard',
    theme: 'aurora',
    groups: [range(1, 5), range(6, 15)],
    portals: [{ kind: 'gravity', count: 1, span: 2 }],
  },
  {
    id: 4,
    key: 'harder',
    tier: 'harder',
    theme: 'orbit',
    groups: [range(1, 10)],
    portals: [{ kind: 'gravity', count: 3, span: 1 }, { kind: 'mini', count: 1 }],
  },
  {
    id: 5,
    key: 'insane',
    tier: 'insane',
    theme: 'deepSpace',
    groups: [range(1, 5), range(6, 10)],
    portals: [{ kind: 'gravity', count: 2, span: 1 }, { kind: 'mini', count: 1 }],
  },
  {
    id: 6,
    key: 'demon',
    tier: 'easyDemon',
    theme: 'nebulaBlue',
    groups: [range(1, 10), range(11, 15), range(16, 25), range(26, 30)],
    bands: [
      { from: 1, to: 10, tier: 'easyDemon', theme: 'nebulaBlue', key: 'easyDemon' },
      { from: 11, to: 15, tier: 'hardDemon', theme: 'nebulaViolet', key: 'hardDemon' },
      { from: 16, to: 25, tier: 'insaneDemon', theme: 'nebulaCrimson', key: 'insaneDemon' },
      { from: 26, to: 30, tier: 'extremeDemon', theme: 'nebulaExtreme', key: 'extremeDemon' },
    ],
    // Easy: one flip for two sections; Hard: the mini stretch; Insane: two flips and the
    // mini stretch; Extreme: one flip and the mini stretch (as Wave Rush's Demon).
    portals: [
      { kind: 'gravity', count: 1, span: 2, band: 0 },
      { kind: 'mini', count: 1, band: 1 },
      { kind: 'gravity', count: 2, span: 1, band: 2 },
      { kind: 'mini', count: 1, band: 2 },
      { kind: 'gravity', count: 1, span: 1, band: 3 },
      { kind: 'mini', count: 1, band: 3 },
    ],
  },
];

/** The finale's number among the sector-like levels (its sections live under this id). */
export const FINALE_ID = 7;

/**
 * The finale "Horyzont Zdarzeń": one fixed sequence (never shuffled), mostly the ship with
 * wave stretches between, a vehicle portal at every change. Unlocked by the Demon.
 * @type {SectorDef}
 */
export const FINALE = {
  id: FINALE_ID,
  key: 'finale',
  tier: 'finaleShip',
  theme: 'eventHorizon',
  groups: [range(1, 10)],
  portals: [],
  fixed: true,
};

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
export const shipKind = (mini) => (mini ? SHIP.mini : SHIP.normal);
