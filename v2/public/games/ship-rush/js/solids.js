// @ts-check
// What the ship can stand on (docs/v2/PLAN.md 9.1, stage s-1). A Ship Rush section is the
// engine's geometry (../../_engine/geometry.js: profiles, hazards, deco) read the ship's
// way: the floor's and the ceiling's level runs, blocks and pillars are SOLIDS — boxes the
// ship may rest on or slide under (physics.js says exactly when) — and everything else
// that hurts (spikes, half-spikes, saws, orbs, mines) is a HAZARD, deadly on any touch.
// Ship terrain is level runs and vertical steps only: a slope would be a surface the ship
// can neither rest on nor be told apart from a wall, so sections never have one.
import { capsuleHitsHazard } from '../../_engine/geometry.js';
import { pieceIndexAt } from '../../_engine/level.js';

/**
 * @typedef {import('../../_engine/geometry.js').Geometry} Geometry
 * @typedef {import('../../_engine/geometry.js').Hazard} Hazard
 * @typedef {import('../../_engine/level.js').Run} Run
 * @typedef {{ x0: number, x1: number, y0: number, y1: number }} Solid
 *   A box: x0..x1 across, y0 (top) .. y1 (bottom); the floor reaches down to +∞ and the
 *   ceiling up to −∞.
 * @typedef {{ solids: Map<number, Solid[]>, hazard: (x: number, ya: number, yb: number, r: number) => boolean }} World
 *   solids: by integer x (each box listed one cell beyond its ends); hazard: does the
 *   circle swept over ya..yb touch a hazard at x?
 */

/** Blocks and pillars are solid in Ship Rush. @param {Hazard} h */
export const isSolid = (h) => h.type === 'block' || h.type === 'pillar';

/**
 * The level runs of a profile as boxes reaching away from the corridor; consecutive runs
 * at one height are one box (no seam to catch on). A slope is refused.
 * @param {Geometry} g @param {'ceil' | 'floor'} side @returns {Solid[]}
 */
function terrainSolids(g, side) {
  const segs = side === 'floor' ? g.floorSegs : g.ceilSegs;
  /** @type {Solid[]} */
  const out = [];
  for (const s of segs) {
    if (s.slope === null) continue;
    if (s.slope !== 0) throw new Error(`${g.id}: ${side} has a slope at x=${s.x0} (ship terrain is level runs and steps)`);
    const last = out[out.length - 1];
    const level = s.y0;
    if (last && Math.abs(last.x1 - s.x0) < 1e-9 && (side === 'floor' ? last.y0 : last.y1) === level) {
      last.x1 = s.x1;
      continue;
    }
    out.push(side === 'floor' ? { x0: s.x0, x1: s.x1, y0: level, y1: Infinity } : { x0: s.x0, x1: s.x1, y0: -Infinity, y1: level });
  }
  return out;
}

/** @type {WeakMap<Geometry, Solid[]>} */
const solidCache = new WeakMap();

/**
 * A section's solids, local x: the floor, the ceiling, its blocks and pillars.
 * @param {Geometry} g @returns {Solid[]}
 */
export function solidsOf(g) {
  let list = solidCache.get(g);
  if (!list) {
    list = [...terrainSolids(g, 'ceil'), ...terrainSolids(g, 'floor')];
    for (const h of g.hazards) {
      if (!isSolid(h)) continue;
      const [x0, y0, x1, y1] = /** @type {[number, number, number, number]} */ (h.bbox);
      list.push({ x0, x1, y0, y1 });
    }
    solidCache.set(g, list);
  }
  return list;
}

/** @param {Solid[]} solids */
function bucketSolids(solids) {
  /** @type {Map<number, Solid[]>} */
  const map = new Map();
  for (const s of solids) {
    for (let c = Math.floor(s.x0) - 1; c <= Math.floor(s.x1) + 1; c++) {
      const list = map.get(c);
      if (list) list.push(s);
      else map.set(c, [s]);
    }
  }
  return map;
}

/**
 * One section on its own, at local x (the validator's world). Its joints go on a few
 * cells beyond its ends, as the next section's do in a run (no wall where they meet).
 * @param {Geometry} g @returns {World}
 */
export function sectionWorld(g) {
  const reach = 4;
  const solids = solidsOf(g).map((s) => {
    const terrain = s.y0 === -Infinity || s.y1 === Infinity;
    return terrain ? { ...s, x0: s.x0 <= 1e-9 ? -reach : s.x0, x1: s.x1 >= g.length - 1e-9 ? g.length + reach : s.x1 } : s;
  });
  return {
    solids: bucketSolids(solids),
    hazard(x, ya, yb, r) {
      const list = g.buckets.get(Math.floor(x));
      if (list) for (const h of list) if (!isSolid(h) && capsuleHitsHazard(h, x, ya, yb, r)) return true;
      return false;
    },
  };
}

/** @type {WeakMap<Run, World>} */
const runCache = new WeakMap();

/**
 * A whole run, at world x: every piece's solids placed and joined where two pieces meet
 * at one height (the game's world).
 * @param {Run} run @returns {World}
 */
export function runWorld(run) {
  const cached = runCache.get(run);
  if (cached) return cached;
  /** @type {Solid[]} */
  const floors = [];
  /** @type {Solid[]} */
  const ceilings = [];
  /** @type {Solid[]} */
  const boxes = [];
  for (const p of run.pieces) {
    for (const s of solidsOf(p.g)) {
      const placed = { x0: s.x0 + p.x0, x1: s.x1 + p.x0, y0: s.y0, y1: s.y1 };
      const into = s.y1 === Infinity ? floors : s.y0 === -Infinity ? ceilings : boxes;
      const last = into === boxes ? null : into[into.length - 1];
      if (last && Math.abs(last.x1 - placed.x0) < 1e-6 && last.y0 === placed.y0 && last.y1 === placed.y1) last.x1 = placed.x1;
      else into.push(placed);
    }
  }
  /** @type {World} */
  const world = {
    solids: bucketSolids([...floors, ...ceilings, ...boxes]),
    hazard(x, ya, yb, r) {
      const i = pieceIndexAt(run, x);
      for (let k = Math.max(0, i - 1); k <= Math.min(run.pieces.length - 1, i + 1); k++) {
        const p = /** @type {import('../../_engine/level.js').Piece} */ (run.pieces[k]);
        if (x + r < p.x0 - 1 || x - r > p.x1 + 1) continue;
        const local = x - p.x0;
        const list = p.g.buckets.get(Math.floor(local));
        if (list) for (const h of list) if (!isSolid(h) && capsuleHitsHazard(h, local, ya, yb, r)) return true;
      }
      return false;
    },
  };
  runCache.set(run, world);
  return world;
}
