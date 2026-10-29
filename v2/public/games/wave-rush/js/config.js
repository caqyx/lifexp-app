// @ts-check
// Wave Rush's fixed numbers (docs/v2/PLAN.md 9.1, stage w-1). Units: the world is a grid
// of cells (one block = 1 × 1), y grows downwards, time is in seconds.
//
// The wave never moves sideways in the air: it always flies at ±45° (mini: dy:dx = 2:1),
// up while held, down while released. There is no floor or ceiling slide: every
// corridor is closed by solid terrain, and touching anything solid is a crash, except
// grazing a 45° slope that runs exactly along the wave's current direction.

/** One physics step: 240 per second whatever the screen's refresh rate. */
export const STEP = 1 / 240;
/** A longer frame (a stalled tab) is cut to this, so the game never jumps far ahead. */
export const MAX_FRAME = 0.25;

/** The playfield: the wave lives in y 0..PLAY_H; leaving it is a crash. */
export const PLAY_H = 12;
/** The band always on screen (terrain fills whatever is above and below it). */
export const VIEW_TOP = -1.5;
export const VIEW_H = 15;
/** A portrait phone still shows at least this many cells ahead and behind (letterboxed band). */
export const MIN_VIEW_W = 18;
/** Where the wave sits on screen: a share of the visible width, at most this many cells in. */
export const CAMERA_LEAD = { share: 0.3, max: 9 };

/** Every section starts and ends with this open corridor, so any order joins up. */
export const JOINT = { ceil: 2, floor: 10, lead: 2 };
/** Nothing that can hurt stands closer than this to a section's ends. */
export const JOINT_CLEAR = 2.5;

/** Speed 1.0 in cells per second (the feel of a classic "normal speed" level). */
export const BASE_SPEED = 10.4;

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

/** After a crash taps are ignored this long, so a frantic tap does not skip the result. */
export const RESTART_LOCK = 0.45;
/** A tap this close before the lock ends still counts. */
export const INPUT_BUFFER_MS = 130;
/** Where a run starts: this many open cells before sector 1. */
export const START_PAD = 8;
/** A respawn starts this far before its checkpoint (inside the open joint). */
export const RESPAWN_BACK = 2;

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
  easy: { speed: 0.5, minInterval: 0.22, tolerance: 0.04, clearance: 7, maxRate: 4 },
  normal: { speed: 0.5, minInterval: 0.2, tolerance: 0.036, clearance: 6, maxRate: 4.5 },
  hard: { speed: 1.0, minInterval: 0.17, tolerance: 0.03, clearance: 4.5, maxRate: 5 },
  harder: { speed: 1.1, minInterval: 0.16, tolerance: 0.028, clearance: 4, maxRate: 5.5 },
  insane: { speed: 1.3, minInterval: 0.15, tolerance: 0.025, clearance: 3.5, maxRate: 6 },
  easyDemon: { speed: 1.3, minInterval: 0.15, tolerance: 0.025, clearance: 3.5, maxRate: 6 },
  hardDemon: { speed: 1.5, minInterval: 0.14, tolerance: 0.023, clearance: 3.2, maxRate: 6.5 },
  insaneDemon: { speed: 1.7, minInterval: 0.125, tolerance: 0.02, clearance: 3, maxRate: 7 },
  extremeDemon: { speed: 1.9, minInterval: 0.115, tolerance: 0.018, clearance: 3, maxRate: 7.5 },
};

/**
 * @typedef {{ kind: 'gravity' | 'mini', count: number, span: number }} PortalRule
 *   `count` portal pairs per run of the sector; each turns the state on at a section
 *   boundary and back off `span` sections later.
 * @typedef {{
 *   id: number, key: string, tier: string, theme: string,
 *   groups: number[][], portals: PortalRule[],
 * }} SectorDef
 *   `groups`: section numbers (1-based) shuffled among themselves and played in this order.
 */

/** @param {number} from @param {number} to */
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The sectors built so far (w-1: 1–3). Finishing the last shows "coming soon". @type {SectorDef[]} */
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
];

/**
 * Stage w-2 hooks: the sectors still to come and the finale. The run ends after the
 * last of SECTORS; `complete` in the progress record (records.js) is what the finale
 * and the last skin will read.
 */
export const PLANNED = {
  sectors: ['harder', 'insane', 'demon'],
  finale: null,
};

/** @param {SectorDef} sector */
export function sectorSpeed(sector) {
  const tier = TIERS[sector.tier];
  if (!tier) throw new Error(`unknown tier ${sector.tier}`);
  return tier.speed * BASE_SPEED;
}

/** @param {SectorDef} sector @returns {Tier} */
export function sectorTier(sector) {
  const tier = TIERS[sector.tier];
  if (!tier) throw new Error(`unknown tier ${sector.tier}`);
  return tier;
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
