// @ts-check
// Świetlik (Glimmer): the second set of patterns (stage gl-2) — a snake of links swaying
// across, bouncers that turn back off the edges, splitters that burst into a ring, mines
// that pulse and go off, a comet that leaves burning embers on its (marked) path, a
// pinwheel of two turning beams, a grid of beams in two waves, and a zone that shrinks
// (outside it hurts). Each puts one idea in the arena; `level` sets how many and how fast.
//
// The same fairness as js/patterns.js: shots come from outside or from a point far from the
// wisp (a comet's path, a grid, a pinwheel and a zone warn instead, for at least MIN_WARN);
// rings keep a gap of RING_GAP; a pinwheel sweeps less than its arms' quarter turn, so a
// wedge between them stays safe; a grid's cells are wider than the wisp; a zone starts
// round the wisp and shrinks slower than it can walk while focusing.

import { SAFE_RADIUS } from './config.js';
import { edgePoint, farPoint } from './places.js';
import { next, range } from './rng.js';
import { addBeam, addShot, addZone, speedFactor } from './sim.js';

/** @typedef {import('./sim.js').Game} Game */

/** Warnings: as long as js/patterns.js's (never under MIN_WARN). */
export const MIN_WARN = 0.65;
const warnFor = (/** @type {number} */ level) => Math.max(MIN_WARN, 0.95 - level * 0.04);
/** A ring burst's gap, in missing shots. */
const BURST_GAP = 4;
/** The most a pinwheel's arms turn: well under their quarter turn apart. */
export const PINWHEEL_SWEEP = 0.8;
/** A grid's lines are at least this far apart (cells far wider than the wisp). */
export const GRID_SPACING = 46;
/** A zone's last radius, and how fast at most it shrinks (px/s; focusing walks 42). */
export const ZONE_MIN_RADIUS = 38;
export const ZONE_MAX_SHRINK = 20;

/** A point well inside the arena (where shots from an edge are aimed). @param {Game} game */
function innerPoint(game) {
  return { x: range(game.rng, game.width * 0.25, game.width * 0.75), y: range(game.rng, game.height * 0.25, game.height * 0.75) };
}

/**
 * A ring of `count` shots from (x, y) after `delay`, with a gap of BURST_GAP turned at random.
 * @param {Game} game @param {number} x @param {number} y @param {number} count @param {number} speed @param {number} delay
 * @param {import('./sim.js').ShotKind} kind @param {number} r
 */
function burst(game, x, y, count, speed, delay, kind, r) {
  const gap = Math.floor(next(game.rng) * count);
  const turn = next(game.rng) * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    if ((i - gap + count) % count < BURST_GAP) continue;
    const a = turn + (i / count) * Math.PI * 2;
    addShot(game, kind, x, y, Math.cos(a) * speed, Math.sin(a) * speed, { r, delay });
  }
}

/** A snake: a chain of links from an edge, swaying along one curve. @param {Game} game @param {number} level */
function snake(game, level) {
  const sf = speedFactor(game.time);
  const chains = level > 2.5 ? 2 : 1;
  const links = Math.min(14, 8 + Math.floor(level * 1.5));
  for (let c = 0; c < chains; c++) {
    const from = edgePoint(game);
    const to = innerPoint(game);
    const a = Math.atan2(to.y - from.y, to.x - from.x);
    const speed = 44 * sf;
    const phase = next(game.rng) * Math.PI * 2;
    for (let i = 0; i < links; i++) {
      addShot(game, 'link', from.x, from.y, Math.cos(a) * speed, Math.sin(a) * speed, { r: 2.2, delay: c * 1.2 + i * 0.11, wave: 46, freq: 3.2, phase });
    }
  }
}

/** Bouncers: slow orbs that turn back off the edges a few times, then leave. @param {Game} game @param {number} level */
function bouncers(game, level) {
  const sf = speedFactor(game.time);
  const n = Math.min(5, 2 + Math.floor(level / 1.5));
  const bounces = level > 3 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const from = edgePoint(game);
    const to = innerPoint(game);
    const a = Math.atan2(to.y - from.y, to.x - from.x);
    addShot(game, 'bouncer', from.x, from.y, Math.cos(a) * 46 * sf, Math.sin(a) * 46 * sf, { r: 3, delay: i * 0.35, bounces, life: 9 });
  }
}

/** Splitters: a big orb drifts to a point far from the wisp and bursts into a ring there. @param {Game} game @param {number} level */
function splitters(game, level) {
  const sf = speedFactor(game.time);
  const n = Math.min(3, 1 + Math.floor(level / 2));
  const pieces = Math.min(18, 10 + Math.floor(level * 1.5));
  for (let i = 0; i < n; i++) {
    const at = farPoint(game, SAFE_RADIUS + 24);
    const from = edgePoint(game);
    const dist = Math.hypot(at.x - from.x, at.y - from.y);
    const speed = 50 * sf;
    const travel = Math.max(1.2, dist / speed);
    const start = i * 0.7;
    addShot(game, 'splitter', from.x, from.y, ((at.x - from.x) / travel), ((at.y - from.y) / travel), { r: 4, delay: start, life: travel });
    burst(game, at.x, at.y, pieces, 52 * sf, start + travel, 'spark', 2);
  }
}

/** Mines: laid far from the wisp, they pulse (harmless) and go off as a ring with a gap. @param {Game} game @param {number} level */
function mines(game, level) {
  const sf = speedFactor(game.time);
  const n = Math.min(4, 2 + Math.floor(level / 2));
  const pieces = Math.min(18, 10 + Math.floor(level * 1.5));
  /** @type {{ x: number, y: number }[]} */
  const laid = [];
  for (let i = 0; i < n; i++) {
    let at = farPoint(game, SAFE_RADIUS + 30);
    // Not on top of another mine.
    for (let tries = 0; tries < 6 && laid.some((m) => Math.hypot(m.x - at.x, m.y - at.y) < 30); tries++) at = farPoint(game, SAFE_RADIUS + 30);
    laid.push(at);
    const fuse = 1.4 + i * 0.35;
    addShot(game, 'mine', at.x, at.y, 0, 0, { r: 3, harmless: true, life: fuse });
    burst(game, at.x, at.y, pieces, 46 * sf, fuse, 'orb', 2.5);
  }
}

/**
 * A comet: its path is marked first, then it flies across and leaves embers that burn a
 * moment where it passed (one more, a beat later, from the second level on).
 * @param {Game} game @param {number} level
 */
function comet(game, level) {
  const sf = speedFactor(game.time);
  const count = level > 2 ? 2 : 1;
  for (let c = 0; c < count; c++) {
    const from = edgePoint(game);
    const through = innerPoint(game);
    const a = Math.atan2(through.y - from.y, through.x - from.x);
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const warn = warnFor(level) + 0.15 + c * 0.8;
    const speed = 150 * sf;
    addBeam(game, from.x, from.y, a, { half: 3, warn, active: 0, marker: true });
    addShot(game, 'comet', from.x, from.y, ux * speed, uy * speed, { r: 3.5, delay: warn });
    // The embers: every 8 px along the path inside the arena, each lit as the comet passes.
    const span = Math.hypot(game.width, game.height) + 16;
    for (let d = 8; d < span; d += 8) {
      const x = from.x + ux * d;
      const y = from.y + uy * d;
      if (x < 0 || y < 0 || x > game.width || y > game.height) continue;
      addShot(game, 'ember', x, y, 0, 0, { r: 2, delay: warn + d / speed, life: 1.1 });
    }
  }
}

/** A pinwheel: two crossed beams through a point far from the wisp, turning a little. @param {Game} game @param {number} level */
function pinwheel(game, level) {
  const c = farPoint(game, SAFE_RADIUS + 30);
  const start = next(game.rng) * Math.PI;
  const dir = next(game.rng) < 0.5 ? -1 : 1;
  const sweep = Math.min(PINWHEEL_SWEEP, 0.55 + level * 0.04);
  const active = 2.8;
  const warn = warnFor(level) + 0.3;
  for (const off of [0, Math.PI / 2]) addBeam(game, c.x, c.y, start + off, { half: 3, warn, active, spin: (dir * sweep) / active });
  game.areaLockUntil = game.time + warn + active;
}

/** A grid: lines across both ways, then (later) a second grid between them. @param {Game} game @param {number} level */
function grid(game, level) {
  const spacing = Math.max(GRID_SPACING, Math.min(game.width, game.height) / 3.2);
  const warn = warnFor(level) + 0.1;
  const active = 0.45;
  const waves = level > 3.5 ? 2 : 1;
  const ox = range(game.rng, spacing * 0.3, spacing * 0.7);
  const oy = range(game.rng, spacing * 0.3, spacing * 0.7);
  for (let w = 0; w < waves; w++) {
    const shift = w * spacing * 0.5;
    const wWarn = warn + w * (active + 0.6);
    for (let x = ox + shift; x < game.width; x += spacing) addBeam(game, x, 0, Math.PI / 2, { half: 3, warn: wWarn, active });
    for (let y = oy + shift; y < game.height; y += spacing) addBeam(game, 0, y, 0, { half: 3, warn: wWarn, active });
  }
  game.areaLockUntil = game.time + warn + waves * (active + 0.6);
}

/** A zone round the wisp that warns, then shrinks: stay inside. @param {Game} game @param {number} level */
function zone(game, level) {
  const p = game.player;
  const r1 = ZONE_MIN_RADIUS;
  const r0 = r1 + Math.min(80, 60 + level * 3);
  const active = Math.max((r0 - r1) / ZONE_MAX_SHRINK, 3.5);
  const warn = Math.max(1.1, warnFor(level) + 0.4);
  // The centre: near the wisp, with the last circle wholly in the arena.
  const a = next(game.rng) * Math.PI * 2;
  const d = range(game.rng, 10, 40);
  const m = r1 + 6;
  const cx = Math.min(game.width - m, Math.max(m, p.x + Math.cos(a) * d));
  const cy = Math.min(game.height - m, Math.max(m, p.y + Math.sin(a) * d));
  addZone(game, cx, cy, r0, r1, warn, active);
  game.areaLockUntil = game.time + warn + active;
}

/**
 * The second set, with the time from which each comes and its weight. `area`: it puts
 * beams, walls or a zone in the arena; `exclusive`: nothing else of the kind may be on while
 * it is (the director keeps them apart, and they never come as half of a combo).
 */
export const OBSTACLES = /** @type {const} */ ({
  snake: { from: 22, weight: 2, run: snake },
  bouncers: { from: 32, weight: 2, run: bouncers },
  splitters: { from: 42, weight: 2, run: splitters },
  mines: { from: 55, weight: 2, run: mines },
  comet: { from: 65, weight: 2, run: comet },
  pinwheel: { from: 80, weight: 2, run: pinwheel, area: true, exclusive: true },
  grid: { from: 95, weight: 2, run: grid, area: true, exclusive: true },
  zone: { from: 110, weight: 2, run: zone, area: true, exclusive: true },
});
