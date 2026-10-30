// @ts-check
// What a body can stand on (docs/v2/PLAN.md 9.1, stages s-1 and f-1; shared by Ship Rush's
// ship and Flip Rush's ball and spider). A section is the engine's geometry (geometry.js:
// profiles, hazards, deco) read the body's way: the floor's and the ceiling's level runs,
// blocks and pillars are SOLIDS — boxes it may rest on or slide under (`settle` says
// exactly when) — and everything else that hurts (spikes, half-spikes, saws, orbs, mines)
// is a HAZARD, deadly on any touch.
// Ship terrain is level runs and vertical steps only: a slope would be a surface the ship
// can neither rest on nor be told apart from a wall, so ship sections never have one
// (prove.js checks). The finale's wave stretches have 45° slopes; they are no solid for
// the ship (it never flies there: the vehicle portal stands in the stretch's open joint).
import { capsuleHitsHazard } from './geometry.js';
import { pieceIndexAt } from './level.js';

/**
 * @typedef {import('./geometry.js').Geometry} Geometry
 * @typedef {import('./geometry.js').Hazard} Hazard
 * @typedef {import('./level.js').Run} Run
 * @typedef {{ x0: number, x1: number, y0: number, y1: number }} Solid
 *   A box: x0..x1 across, y0 (top) .. y1 (bottom); the floor reaches down to +∞ and the
 *   ceiling up to −∞.
 * @typedef {import('./geometry.js').Booster & { id: string }} PlacedBooster
 * @typedef {{ solids: Map<number, Solid[]>, hazard: (x: number, ya: number, yb: number, r: number) => boolean,
 *   boosters: (x: number) => PlacedBooster[] }} World
 *   solids: by integer x (each box listed one cell beyond its ends); hazard: does the
 *   circle swept over ya..yb touch a hazard at x? boosters: the orbs and pads within about
 *   two cells of x, at world x, each with an id of its own in the world.
 */

/**
 * Orbs and pads bucketed by integer x (each listed two cells beyond itself).
 * @param {PlacedBooster[]} list
 */
function bucketBoosters(list) {
  /** @type {Map<number, PlacedBooster[]>} */
  const map = new Map();
  for (const b of list) {
    for (let c = Math.floor(b.x) - 2; c <= Math.floor(b.x) + 2; c++) {
      const into = map.get(c);
      if (into) into.push(b);
      else map.set(c, [b]);
    }
  }
  return map;
}

/** @type {PlacedBooster[]} */
const NONE = [];

/** Blocks and pillars are solid in Ship Rush. @param {Hazard} h */
export const isSolid = (h) => h.type === 'block' || h.type === 'pillar';

/**
 * The level runs of a profile as boxes reaching away from the corridor; consecutive runs
 * at one height are one box (no seam to catch on). Slopes are skipped.
 * @param {Geometry} g @param {'ceil' | 'floor'} side @returns {Solid[]}
 */
function terrainSolids(g, side) {
  const segs = side === 'floor' ? g.floorSegs : g.ceilSegs;
  /** @type {Solid[]} */
  const out = [];
  for (const s of segs) {
    if (s.slope === null || s.slope !== 0) continue;
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
  const boosters = bucketBoosters(g.boosters.map((b, i) => ({ ...b, id: `${g.id}:${i}` })));
  return {
    solids: bucketSolids(solids),
    hazard(x, ya, yb, r) {
      const list = g.buckets.get(Math.floor(x));
      if (list) for (const h of list) if (!isSolid(h) && capsuleHitsHazard(h, x, ya, yb, r)) return true;
      return false;
    },
    boosters: (x) => boosters.get(Math.floor(x)) ?? NONE,
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
  const placedBoosters = bucketBoosters(
    run.pieces.flatMap((p, k) => p.g.boosters.map((b, i) => ({ ...b, x: b.x + p.x0, id: `${k}:${i}` }))),
  );
  /** @type {World} */
  const world = {
    solids: bucketSolids([...floors, ...ceilings, ...boxes]),
    boosters: (x) => placedBoosters.get(Math.floor(x)) ?? NONE,
    hazard(x, ya, yb, r) {
      const i = pieceIndexAt(run, x);
      for (let k = Math.max(0, i - 1); k <= Math.min(run.pieces.length - 1, i + 1); k++) {
        const p = /** @type {import('./level.js').Piece} */ (run.pieces[k]);
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

const EPS = 1e-9;

/**
 * Does a body at (x, y) overlap the box (touching does not count)?
 * @param {Solid} s @param {number} x @param {number} y @param {number} half
 */
function overlaps(s, x, y, half) {
  return x + half > s.x0 + EPS && x - half < s.x1 - EPS && y + half > s.y0 + EPS && y - half < s.y1 - EPS;
}

/**
 * Where a square body (half side `half`) ends up after moving to (x, y) from height
 * `prevY`: every box it now overlaps is judged by where it was the step before — above
 * the box's top (at most `snap` below it): put back on the top (landed); below its
 * underside (at most `snap` above it): put back under it (bumped); otherwise it came in
 * from the side: a crash. Squeezed between a top and an underside, or still overlapping
 * after being put back: a crash.
 * @param {World} world @param {number} prevY @param {number} x @param {number} y @param {number} half @param {number} snap
 * @returns {{ y: number, crash: boolean, landed: boolean, bumped: boolean }}
 */
export function settle(world, prevY, x, y, half, snap) {
  const list = world.solids.get(Math.floor(x)) ?? [];
  let top = Infinity;
  let under = -Infinity;
  for (const s of list) {
    if (!overlaps(s, x, y, half)) continue;
    if (prevY + half <= s.y0 + snap) top = Math.min(top, s.y0 - half);
    else if (prevY - half >= s.y1 - snap) under = Math.max(under, s.y1 + half);
    else return { y, crash: true, landed: false, bumped: false };
  }
  if (top < under - EPS) return { y, crash: true, landed: true, bumped: true };
  const settled = Math.max(under, Math.min(y, top));
  for (const s of list) if (overlaps(s, x, settled, half)) return { y: settled, crash: true, landed: false, bumped: false };
  return { y: settled, crash: false, landed: settled < y - EPS, bumped: settled > y + EPS };
}

/**
 * The search's "room to spare" (the validators): no hazard within `band` above or below,
 * and no box's left side (a wall ahead) within the body's width and `band` of its height.
 * Resting on a box whose left side is behind is no danger.
 * @param {World} world @param {number} x @param {number} y @param {number} half @param {number} radius @param {number} band
 */
export function roomyAt(world, x, y, half, radius, band) {
  if (world.hazard(x, y - band, y + band, radius)) return false;
  if (band <= 0) return true;
  const list = world.solids.get(Math.floor(x)) ?? [];
  for (const s of list) {
    if (s.x0 <= x - half + EPS || s.x0 >= x + half - EPS) continue;
    if (y + half + band > s.y0 + EPS && y - half - band < s.y1 - EPS) return false;
  }
  return true;
}

/**
 * Does a body at (x, y) overlap any solid (touching does not count)? A body resting on a
 * surface does not; one inside a wall does.
 * @param {World} world @param {number} x @param {number} y @param {number} half
 */
export function overlapsSolid(world, x, y, half) {
  for (const s of world.solids.get(Math.floor(x)) ?? []) if (overlaps(s, x, y, half)) return true;
  return false;
}

