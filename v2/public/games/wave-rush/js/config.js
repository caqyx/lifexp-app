// @ts-check
// Wave Rush's fixed numbers (docs/v2/PLAN.md 9.1, stage w-1). Units: the world is a grid
// of cells (one block = 1 × 1), y grows downwards, time is in seconds.
//
// The wave never moves sideways in the air: it always flies at ±45° (mini: dy:dx = 2:1),
// up while held, down while released. There is no floor or ceiling slide: every
// corridor is closed by solid terrain, and touching anything solid is a crash, except
// grazing a 45° slope that runs exactly along the wave's current direction.

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
import { BASE_SPEED } from '../../_engine/world.js';
import { bandOf, range, sectionStyle } from '../../_engine/sectors.js';

export { bandOf, sectionStyle };

export const WAVE = {
  /** Hit circle radius; the drawing is larger, so a near miss looks like one. */
  radius: 0.3,
  miniRadius: 0.2,
  /** |dy/dx|: 45° normally, 2:1 (≈63.4°) in mini. */
  slope: 1,
  miniSlope: 2,
  /** Drawn size (cells). */
  size: 1.05,
  miniSize: 0.68,
};

/**
 * Human limits per difficulty tier (owner, 2026-10-29: "possible for a human, not just
 * for a bot"). The validator (solver.js, v2/tests/wave-rush.test.ts) proves that every
 * authored section has a path that keeps them:
 * - minInterval: seconds between two input changes (hold ↔ release), at least;
 * - tolerance: seconds each tap (press and release together) may be early or late and
 *   the path still survives;
 * - clearance: the corridor's vertical opening, in wave hitbox diameters, everywhere;
 * - maxRate: input changes in any one second, at most.
 * `speed` is the multiplier of BASE_SPEED. Tiers 4–6 are the plan for stage w-2.
 * @typedef {{ speed: number, minInterval: number, tolerance: number, clearance: number, maxRate: number }} Tier
 * @type {Record<string, Tier>}
 */
export const TIERS = {
  easy: { speed: 0.8, minInterval: 0.24, tolerance: 0.045, clearance: 7, maxRate: 3.5 },
  normal: { speed: 0.8, minInterval: 0.21, tolerance: 0.04, clearance: 6, maxRate: 4 },
  hard: { speed: 1.0, minInterval: 0.17, tolerance: 0.03, clearance: 4.5, maxRate: 5 },
  harder: { speed: 1.1, minInterval: 0.16, tolerance: 0.028, clearance: 4, maxRate: 5.5 },
  insane: { speed: 1.3, minInterval: 0.15, tolerance: 0.025, clearance: 3.5, maxRate: 6 },
  easyDemon: { speed: 1.3, minInterval: 0.15, tolerance: 0.025, clearance: 3.5, maxRate: 6 },
  hardDemon: { speed: 1.5, minInterval: 0.14, tolerance: 0.023, clearance: 3.2, maxRate: 6.5 },
  insaneDemon: { speed: 1.7, minInterval: 0.125, tolerance: 0.02, clearance: 3, maxRate: 7 },
  extremeDemon: { speed: 1.9, minInterval: 0.115, tolerance: 0.018, clearance: 3, maxRate: 7.5 },
  // The finale's ship stretches (its wave stretches use extremeDemon).
  finale: { speed: 1.5, minInterval: 0.12, tolerance: 0.02, clearance: 3.5, maxRate: 7 },
};

/**
 * The ship (finale only): hold to thrust up, let go and gravity pulls it down; the
 * vertical speed changes smoothly and is capped. Cells and seconds.
 */
export const SHIP = { up: 34, down: 30, maxV: 8.5, radius: 0.3, size: 1.45 };

/**
 * @typedef {import('../../_engine/sectors.js').PortalRule} PortalRule
 * @typedef {import('../../_engine/sectors.js').Band} Band
 * @typedef {import('../../_engine/sectors.js').SectorDef} SectorDef
 */

/** The run: sectors 1–6. Finishing it (the whole Demon) unlocks the last skin and the finale. @type {SectorDef[]} */
export const SECTORS = [
  { id: 1, key: 'easy', tier: 'easy', theme: 'lagoon', groups: [range(1, 10)], portals: [] },
  { id: 2, key: 'normal', tier: 'normal', theme: 'mesa', groups: [range(1, 5), range(6, 15)], portals: [] },
  {
    id: 3,
    key: 'hard',
    tier: 'hard',
    theme: 'citadel',
    groups: [range(1, 5), range(6, 15)],
    portals: [{ kind: 'gravity', count: 1, span: 2 }],
  },
  {
    id: 4,
    key: 'harder',
    tier: 'harder',
    theme: 'forge',
    groups: [range(1, 10)],
    portals: [{ kind: 'gravity', count: 3, span: 1 }, { kind: 'mini', count: 1 }],
  },
  {
    id: 5,
    key: 'insane',
    tier: 'insane',
    theme: 'aurora',
    groups: [range(1, 5), range(6, 10)],
    portals: [{ kind: 'gravity', count: 2, span: 1 }, { kind: 'mini', count: 1 }],
  },
  {
    id: 6,
    key: 'demon',
    tier: 'easyDemon',
    theme: 'demonBlue',
    groups: [range(1, 10), range(11, 15), range(16, 25), range(26, 30)],
    bands: [
      { from: 1, to: 10, tier: 'easyDemon', theme: 'demonBlue', key: 'easyDemon' },
      { from: 11, to: 15, tier: 'hardDemon', theme: 'demonPurple', key: 'hardDemon' },
      { from: 16, to: 25, tier: 'insaneDemon', theme: 'demonRed', key: 'insaneDemon' },
      { from: 26, to: 30, tier: 'extremeDemon', theme: 'demonExtreme', key: 'extremeDemon' },
    ],
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

/** @param {SectorDef} sector */
export function sectorSpeed(sector) {
  return tierSpeed(sector.tier);
}

/** @param {SectorDef} sector @returns {Tier} */
export function sectorTier(sector) {
  return tierOf(sector.tier);
}

/**
 * How tall a corridor with a flat floor and ceiling must be for a human to zig-zag
 * through it at this tier: two legs at the shortest allowed interval, plus the hitbox.
 * @param {Tier} tier @param {boolean} [mini]
 */
export function flatCorridorMinHeight(tier, mini = false) {
  const slope = mini ? WAVE.miniSlope : WAVE.slope;
  const radius = mini ? WAVE.miniRadius : WAVE.radius;
  return 2 * tier.speed * BASE_SPEED * tier.minInterval * slope + 2 * radius;
}
