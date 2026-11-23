// @ts-check
// Świetlik (Glimmer): the patterns — each puts one idea in the arena: a fan of sparks from
// an edge, rain, a ring with a gap, a spiral from a flower, beams that warn then burn, a
// beam that sweeps a wedge, walls with a gap, slow seekers. `level` (0 = the start, growing
// with time) sets how many and how fast; randomness only from the game's generator.
//
// Fairness, the same in every pattern: nothing appears within SAFE_RADIUS of the wisp
// (shots come from outside the arena or from a point far from it); beams and walls warn
// first (WARN seconds, never under MIN_WARN); a ring's gap and a wall's gap are always wider
// than the wisp; a sweep covers a wedge, never the whole arena.

import { SAFE_RADIUS } from './config.js';
import { int, next, pick, range } from './rng.js';
import { addBeam, addShot, addWall, emit, speedFactor } from './sim.js';

/** @typedef {import('./sim.js').Game} Game */
/** @typedef {'aimed' | 'rain' | 'ring' | 'spiral' | 'beams' | 'sweep' | 'walls' | 'seekers'} PatternId */

const WARN = 0.95;
const MIN_WARN = 0.65;
/** A wall's gap is never narrower than this (the wisp's sprite is 7 wide). */
export const MIN_GAP = 26;
/** A ring's gap, in missing shots: wide enough to slip through. */
export const RING_GAP = 4;

/** How long beams and walls warn at a level (shorter as it grows, never under MIN_WARN). @param {number} level */
const warnFor = (level) => Math.max(MIN_WARN, WARN - level * 0.04);

/**
 * A point just outside the arena, on a random side (shots aimed inward from it).
 * @param {Game} game @returns {{ x: number, y: number, side: number }}
 */
function edgePoint(game) {
  const w = game.width;
  const h = game.height;
  const p = game.player;
  // A few tries for a point not beside the wisp (it may be hugging an edge).
  for (let tries = 0; tries < 12; tries++) {
    const side = int(game.rng, 0, 3);
    const along = range(game.rng, 0, side % 2 === 0 ? w : h);
    const point =
      side === 0 ? { x: along, y: -8, side } : side === 1 ? { x: w + 8, y: along, side } : side === 2 ? { x: along, y: h + 8, side } : { x: -8, y: along, side };
    if (Math.hypot(point.x - p.x, point.y - p.y) >= SAFE_RADIUS) return point;
  }
  // None far enough (the wisp in a corner, bad luck): the opposite corner, outside.
  return { x: p.x < w / 2 ? w + 8 : -8, y: p.y < h / 2 ? h + 8 : -8, side: p.x < w / 2 ? 1 : 3 };
}

/**
 * A point inside the arena at least `away` from the wisp (from the corners inward if the
 * wisp is in the middle of a small arena), for emitters and ring centres.
 * @param {Game} game @param {number} away
 */
export function farPoint(game, away) {
  const p = game.player;
  for (let tries = 0; tries < 24; tries++) {
    const x = range(game.rng, 20, game.width - 20);
    const y = range(game.rng, 20, game.height - 20);
    if (Math.hypot(x - p.x, y - p.y) >= away) return { x, y };
  }
  // The corner farthest from the wisp.
  return { x: p.x < game.width / 2 ? game.width - 16 : 16, y: p.y < game.height / 2 ? game.height - 16 : 16 };
}

/** A fan of sparks from an edge toward the wisp, in volleys. @param {Game} game @param {number} level */
function aimed(game, level) {
  const sf = speedFactor(game.time);
  const volleys = Math.min(4, 1 + Math.floor(level / 1.3) + int(game.rng, 0, 1));
  const count = Math.min(9, 3 + Math.floor(level * 1.5));
  const spread = 0.55 + Math.min(0.5, level * 0.08);
  for (let v = 0; v < volleys; v++) {
    const from = edgePoint(game);
    const aim = Math.atan2(game.player.y - from.y, game.player.x - from.x);
    const speed = 62 * sf;
    for (let i = 0; i < count; i++) {
      const a = aim + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
      addShot(game, 'spark', from.x, from.y, Math.cos(a) * speed, Math.sin(a) * speed, { r: 2, delay: v * 0.55 });
    }
  }
}

/** Drops falling from the top, drifting a little sideways. @param {Game} game @param {number} level */
function rain(game, level) {
  const sf = speedFactor(game.time);
  const n = Math.min(60, Math.round((14 + level * 9) * (game.width / 180)));
  const drift = range(game.rng, -12, 12);
  for (let i = 0; i < n; i++) {
    const x = range(game.rng, -10, game.width + 10);
    // From high enough above that even a wisp at the top edge sees them come.
    addShot(game, 'drop', x, -SAFE_RADIUS - 2, drift, range(game.rng, 46, 70) * sf, { r: 1.5, delay: range(game.rng, 0, 3.2), ax: 0, ay: 6 });
  }
}

/** Rings of orbs from a far point, each with a gap (the next ring's gap turned). @param {Game} game @param {number} level */
function ring(game, level) {
  const sf = speedFactor(game.time);
  const c = farPoint(game, SAFE_RADIUS + 26);
  const rings = Math.min(3, 1 + Math.floor(level / 1.6));
  const count = Math.min(40, 20 + Math.floor(level * 4));
  const warn = 0.6;
  emit(game, 'ring', c.x, c.y, warn);
  let gap = int(game.rng, 0, count - 1);
  for (let k = 0; k < rings; k++) {
    for (let i = 0; i < count; i++) {
      const off = (i - gap + count) % count;
      if (off < RING_GAP) continue;
      const a = (i / count) * Math.PI * 2;
      addShot(game, 'orb', c.x, c.y, Math.cos(a) * 40 * sf, Math.sin(a) * 40 * sf, { r: 2.5, delay: warn + k * 1.1 });
    }
    gap = (gap + int(game.rng, 4, count - 4)) % count;
  }
}

/** A flower at a far point that spins out petals for a few seconds. @param {Game} game @param {number} level */
function spiral(game, level) {
  const sf = speedFactor(game.time);
  const c = farPoint(game, SAFE_RADIUS + 34);
  const arms = Math.min(4, 2 + Math.floor(level / 1.5));
  const duration = 3.2;
  const every = 0.14;
  const spin = (next(game.rng) < 0.5 ? -1 : 1) * (1.9 + level * 0.1);
  const start = range(game.rng, 0, Math.PI * 2);
  addShot(game, 'node', c.x, c.y, 0, 0, { r: 4, harmless: true, life: duration + 0.6 });
  for (let t = 0.5; t < duration; t += every) {
    for (let k = 0; k < arms; k++) {
      const a = start + spin * t + (k / arms) * Math.PI * 2;
      addShot(game, 'petal', c.x, c.y, Math.cos(a) * 36 * sf, Math.sin(a) * 36 * sf, { r: 2, delay: t });
    }
  }
}

/** Two or three straight beams across the arena: they warn, then burn for a moment. @param {Game} game @param {number} level */
function beams(game, level) {
  const n = Math.min(3, 2 + (level > 2 ? int(game.rng, 0, 1) : 0));
  const warn = warnFor(level);
  const horizontal = next(game.rng) < 0.5;
  // Parallel beams, spaced so that safe lanes stay between them.
  const span = horizontal ? game.height : game.width;
  const lane = span / (n + 1);
  for (let i = 0; i < n; i++) {
    const pos = lane * (i + 1) + range(game.rng, -lane * 0.25, lane * 0.25);
    addBeam(game, horizontal ? 0 : pos, horizontal ? pos : 0, horizontal ? 0 : Math.PI / 2, { half: 4, warn: warn + i * 0.12, active: 0.55 });
  }
  if (level > 3 && next(game.rng) < 0.5) {
    // A diagonal one too, a beat later.
    const c = farPoint(game, 0);
    addBeam(game, c.x, c.y, pick(game.rng, [Math.PI / 4, -Math.PI / 4]), { half: 3, warn: warn + 0.6, active: 0.5 });
  }
}

/** A beam from a corner that sweeps a wedge (shown while it warns). @param {Game} game @param {number} level */
function sweep(game, level) {
  const corner = int(game.rng, 0, 3);
  const px = corner % 2 === 0 ? 0 : game.width;
  const py = corner < 2 ? 0 : game.height;
  // Into the arena: the wedge is part of the quarter turn the corner faces.
  const base = Math.atan2(game.height / 2 - py, game.width / 2 - px);
  const wedge = Math.min(1.1, 0.7 + level * 0.06);
  const dir = next(game.rng) < 0.5 ? -1 : 1;
  const start = base - (dir * wedge) / 2;
  const duration = 1.9;
  addBeam(game, px, py, start, { half: 3.5, warn: warnFor(level) + 0.2, active: duration, spin: (dir * wedge) / duration });
}

/** Walls with a gap sweeping across (one after another, gaps apart). @param {Game} game @param {number} level */
function walls(game, level) {
  const sf = speedFactor(game.time);
  const horizontal = next(game.rng) < 0.6;
  const along = horizontal ? game.width : game.height;
  const across = horizontal ? game.height : game.width;
  const count = Math.min(3, 1 + Math.floor(level / 1.8));
  const gapW = Math.max(MIN_GAP, 50 - level * 4);
  const down = next(game.rng) < 0.5;
  for (let i = 0; i < count; i++) {
    const a = range(game.rng, 6, along - gapW - 6);
    const speed = 34 * sf * (down ? 1 : -1);
    addWall(game, horizontal, down ? -6 : across + 6, speed, a, a + gapW, { thick: 7, warn: warnFor(level) + i * (60 / Math.abs(speed)) });
  }
}

/** Slow seekers that turn toward the wisp for a while, then fade. @param {Game} game @param {number} level */
function seekers(game, level) {
  const sf = speedFactor(game.time);
  const n = Math.min(5, 2 + Math.floor(level / 1.4));
  for (let i = 0; i < n; i++) {
    const from = edgePoint(game);
    const a = Math.atan2(game.player.y - from.y, game.player.x - from.x);
    addShot(game, 'seeker', from.x, from.y, Math.cos(a) * 30 * sf, Math.sin(a) * 30 * sf, { r: 3, delay: i * 0.4, turn: 1.25, life: 7.5 });
  }
}

/** The patterns by id, with the time from which each comes and its weight. */
export const PATTERNS = /** @type {const} */ ({
  aimed: { from: 0, weight: 3, run: aimed },
  rain: { from: 0, weight: 2, run: rain },
  ring: { from: 0, weight: 2, run: ring },
  spiral: { from: 14, weight: 2, run: spiral },
  seekers: { from: 18, weight: 2, run: seekers },
  beams: { from: 28, weight: 2, run: beams },
  walls: { from: 36, weight: 2, run: walls },
  sweep: { from: 50, weight: 2, run: sweep },
});

/** @type {readonly PatternId[]} */
export const PATTERN_IDS = /** @type {PatternId[]} */ (Object.keys(PATTERNS));

/** Starts a pattern now. @param {Game} game @param {PatternId} id @param {number} level */
export function runPattern(game, id, level) {
  PATTERNS[id].run(game, level);
  game.lastPattern = id;
  game.patternsStarted += 1;
}
