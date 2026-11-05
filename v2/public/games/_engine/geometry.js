// @ts-check
// A section's shape and what it means to touch it (docs/v2/PLAN.md 9.1, stage w-1).
//
// Shared by both Rush games (Ship Rush adds its solid blocks on top: ship-rush/js/solids.js).
// The data (sections/*.js) is hand-authored. The ceiling and the floor are profiles,
// written as short strings: the start height, then runs — `r4` flat for 4 cells, `d3`
// a 45° slope 3 down (y grows), `u3` 3 up, `+1` / `-1` a vertical step down / up (stairs).
// Everything else is a list of hazards (spikes, half-spikes, blocks, pillars, saws,
// spike orbs, spiked mines) and deco that never hurts (chains with ornaments, stars, diamonds,
// sawtooth edges, gears).
//
// Collision rule: the wave's hit circle touching any solid is a crash, EXCEPT a 45°
// terrain slope that runs exactly along the wave's current direction: that one may be
// grazed (only the wave's centre crossing it counts). The same functions serve the game,
// the solver and the tests; the solver also asks about a vertical "capsule" (the circle
// swept over [ya, yb]) to model a mistimed tap.
import { JOINT, JOINT_CLEAR, PLAY_H } from './world.js';

/**
 * @typedef {[number, number]} Pt
 * @typedef {{ x0: number, y0: number, x1: number, y1: number, slope: number | null, prevSlope: number, nextSlope: number, away: number }} Seg
 *   slope: dy/dx (−1, 0, 1) or null for a vertical step; prev/next: the neighbours' slope when it is ±1, else 0;
 *   away: the wave's direction that leaves this surface (−1 up off a floor, +1 down off a ceiling).
 * @typedef {{ rot?: number, fx?: boolean, fy?: boolean, sx?: number, sy?: number }} Transform
 *   Stage r-4 (the level editor): an item turned `rot` degrees clockwise, mirrored across
 *   (fx) or up and down (fy) and scaled (sx, sy) about its own centre; the hit shape turns
 *   with the drawing. Missing fields are the identity, so the official sections (which
 *   have none) stay exactly as they were.
 * @typedef {{ type: 'spike' | 'halfSpike', x: number, on?: 'floor' | 'ceil', count?: number, y?: number, dir?: 'up' | 'down' } & Transform} SpikeData
 * @typedef {{ type: 'block', x: number, y: number, w: number, h: number } & Transform} BlockData
 * @typedef {{ type: 'pillar', x: number, on: 'floor' | 'ceil', h: number, w?: number, y?: number } & Transform} PillarData
 *   y (stage r-4): the pillar's top, anywhere, instead of standing on its surface.
 * @typedef {{ dx: number, dy: number, every: number, phase?: number }} Move
 *   A moving hazard (stage r-2): it swings by (dx, dy) cells along a sine, a whole swing
 *   every `every` cells the vehicle runs (keyed to the vehicle's place, as the genre's move
 *   triggers are, so a proof and the game see the same thing at the same x).
 * @typedef {{ type: 'saw' | 'orb' | 'mine', x: number, y: number, r: number, chain?: boolean, move?: Move, sx?: number, sy?: number, rot?: number }} RoundData
 *   chain: hangs on a chain from the ceiling (drawn only; the chain never hurts); sx, sy
 *   (stage r-4): a round hazard stays round, its radius × the larger of the two; rot
 *   turns only its drawing.
 * @typedef {'jump' | 'small' | 'gravity' | 'gravityJump' | 'dash'} RingKind
 * @typedef {'jump' | 'small' | 'gravity'} PadKind
 * @typedef {{ type: 'ring', kind: RingKind, x: number, y: number, sx?: number, sy?: number }
 *   | { type: 'pad', kind: PadKind, x: number, on: 'floor' | 'ceil', y?: number, fy?: boolean, rot?: number }} BoosterData
 *   Flip Rush's orbs (`ring`, at its centre) and pads (`pad`, one cell from x, on the floor
 *   or the ceiling under/over x + 0.5, or on a block's top or underside at `y`): they help,
 *   never hurt (flip-rush/js/boosters.js has their effects). Stage r-4: an orb's reach and
 *   drawing × the larger of sx, sy; a pad turned upside down (fy, or rot near 180°) faces
 *   the other way; pads keep their size.
 * @typedef {'slow' | 'normal' | 'fast' | 'veryFast'} SpeedKind
 * @typedef {'flip' | 'down' | 'up' | 'mini' | 'big' | VehicleMode} SectionPortalKind
 *   A portal inside a section: gravity turned over (flip), gravity down (normal) or up
 *   (upside down), mini or full size, or a vehicle (stage r-5; the editor's levels — the
 *   game's own sections use flip, mini and big only).
 * @typedef {{ type: 'speed', x: number, k: SpeedKind }
 *   | { type: 'portal', x: number, kind: SectionPortalKind, y?: number, sy?: number }
 *   | { type: 'dark', from: number, to: number }
 *   | { type: 'invert', from: number, to: number }} EffectData
 *   Stage r-2, inside a section: a speed portal (the tier's speed × SPEED_FACTORS[k] from
 *   x to the section's end or the next one); a gravity flip or a size portal (flips come in
 *   pairs and a mini stretch ends in `big`, so a section ends as it began); a dark stretch
 *   (the view narrows round the vehicle — drawing only); an inverted-controls stretch.
 *   A portal spans the corridor where it stands; a gravity or size portal with `y`
 *   (stage r-4) is a gate GATE × sy cells high centred on y, passed only by a vehicle
 *   inside it. A speed portal always spans the corridor (the speed belongs to the place).
 * @typedef {SpikeData | BlockData | PillarData | RoundData | BoosterData | EffectData} HazardData
 * @typedef {{ type: 'chain', x: number, len: number, ornament?: 'diamond' | 'star' | 'triangle' | 'eye' | 'debris' | 'none' }
 *   | { type: 'star' | 'diamond' | 'gear' | 'eye', x: number, y: number, size: number }
 *   | { type: 'frame', x: number, y: number, w: number, h: number }
 *   | { type: 'wreck', x: number, y: number, size: number }
 *   | { type: 'sawtooth', from: number, to: number, on: 'floor' | 'ceil' }} DecoData
 *   frame: a glowing outlined truss far behind the corridor; wreck: a broken hull's
 *   outline; both dim, like all deco, so hazards read first (stage s-2).
 * @typedef {{ id: string, length: number, ceil: string, floor: string, hazards: HazardData[], deco?: DecoData[],
 *   mini?: boolean, tier?: string, mode?: VehicleMode }} SectionData
 *   mini: designed (and proven) for the mini wave, flown between its own mini portals;
 *   tier: its own speed and limits (the finale); mode: the vehicle it is flown with (Wave
 *   Rush: the wave unless `ship`; Ship Rush: the ship unless `wave`; Flip Rush: ball or spider).
 * @typedef {'wave' | 'ship' | 'ball' | 'spider' | 'robot'} VehicleMode
 *
 * @typedef {{ type: 'spike' | 'halfSpike' | 'block' | 'pillar', shape: 'poly', pts: Pt[], vis: Pt[], dir: 'up' | 'down' | 'none', bbox: number[], tilted?: boolean, rot?: number }} PolyHazard
 *   tilted (stage r-4): a block or pillar turned by other than a right angle — no surface
 *   to ride, deadly like a spike; rot: its turn (a pillar's capitals follow it).
 * @typedef {{ type: 'saw' | 'orb' | 'mine', shape: 'circle', x: number, y: number, r: number, hit: number, bbox: number[], chain: boolean, move?: Move, rot?: number }} CircleHazard
 * @typedef {PolyHazard | CircleHazard} Hazard
 * @typedef {{ type: 'ring', kind: RingKind, x: number, y: number, dir: 'none', scale?: number } | { type: 'pad', kind: PadKind, x: number, y: number, dir: 'up' | 'down' }} Booster
 *   A pad's x is its centre and y the surface it sits on; dir: the way it faces; scale: an
 *   orb's size and reach (stage r-4).
 * @typedef {{ id: string, length: number, ceil: Pt[], floor: Pt[], ceilSegs: Seg[], floorSegs: Seg[],
 *   mini: boolean, tier: string | null, mode: VehicleMode,
 *   hazards: Hazard[], boosters: Booster[], deco: DecoData[], buckets: Map<number, Hazard[]>, segBuckets: Map<number, Seg[]>,
 *   speeds: { x: number, k: SpeedKind }[], portals: { x: number, kind: SectionPortalKind, y0?: number, y1?: number }[],
 *   dark: { from: number, to: number }[], invert: { from: number, to: number }[] }} Geometry
 */

const EPS = 1e-9;
/** Spikes forgive a graze: the hit triangle is smaller than the drawing. */
const SPIKE_HIT = { inset: 0.2, tip: 0.75 };
const HALF_SPIKE_HIT = { inset: 0.15, tip: 0.38 };
/** Round hazards: the hit circle is this share of the drawn radius (a mine's spikes are thin: its core counts). */
const ROUND_HIT = { saw: 0.8, orb: 0.72, mine: 0.66 };
/** A portal gate's height at sy = 1 (stage r-4). */
export const GATE = 3;
/** Scales an item may have (stage r-4). */
export const SCALE = { min: 0.25, max: 4 };

// ── Profiles ─────────────────────────────────────────────────────────────────

/**
 * Parses a profile string into points from x = 0.
 * @param {string} text
 * @returns {Pt[]}
 */
export function parseProfile(text) {
  const tokens = text.trim().split(/\s+/);
  const start = Number(tokens.shift());
  if (!Number.isFinite(start)) throw new Error(`profile "${text}": no start height`);
  /** @type {Pt[]} */
  const points = [[0, start]];
  let x = 0;
  let y = start;
  for (const token of tokens) {
    const m = /^([rdu+-])(\d+(?:\.\d+)?)$/.exec(token);
    if (!m) throw new Error(`profile "${text}": bad token ${token}`);
    const n = Number(m[2]);
    if (m[1] === 'r') x += n;
    else if (m[1] === 'd') {
      x += n;
      y += n;
    } else if (m[1] === 'u') {
      x += n;
      y -= n;
    }
    else if (m[1] === '+') y += n;
    else y -= n;
    x = Math.round(x * 1e6) / 1e6;
    y = Math.round(y * 1e6) / 1e6;
    points.push([x, y]);
  }
  return points;
}

/** @param {Pt[]} points @param {'ceil' | 'floor'} [side] @returns {Seg[]} */
export function profileSegments(points, side = 'floor') {
  const away = side === 'floor' ? -1 : 1;
  /** @type {Seg[]} */
  const segs = [];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = /** @type {Pt} */ (points[i - 1]);
    const [x1, y1] = /** @type {Pt} */ (points[i]);
    if (x0 === x1 && y0 === y1) continue;
    const slope = x1 === x0 ? null : (y1 - y0) / (x1 - x0);
    segs.push({ x0, y0, x1, y1, slope, prevSlope: 0, nextSlope: 0, away });
  }
  for (let i = 0; i < segs.length; i++) {
    const seg = /** @type {Seg} */ (segs[i]);
    const prev = segs[i - 1];
    const next = segs[i + 1];
    seg.prevSlope = prev && (prev.slope === 1 || prev.slope === -1) ? prev.slope : 0;
    seg.nextSlope = next && (next.slope === 1 || next.slope === -1) ? next.slope : 0;
  }
  return segs;
}

/**
 * The profile's height at x. On a vertical step the more closed side counts:
 * the lowest ceiling, the highest floor.
 * @param {Pt[]} points @param {number} x @param {'ceil' | 'floor'} side
 */
export function profileY(points, x, side) {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (/** @type {Pt} */ (points[mid])[0] < x) lo = mid + 1;
    else hi = mid;
  }
  let best = side === 'ceil' ? -Infinity : Infinity;
  for (let i = Math.max(1, lo); i < points.length; i++) {
    const [x0, y0] = /** @type {Pt} */ (points[i - 1]);
    const [x1, y1] = /** @type {Pt} */ (points[i]);
    if (x0 > x + EPS) break;
    if (x1 < x - EPS) continue;
    const y = x1 === x0 ? (side === 'ceil' ? Math.max(y0, y1) : Math.min(y0, y1)) : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    best = side === 'ceil' ? Math.max(best, y) : Math.min(best, y);
  }
  if (!Number.isFinite(best)) {
    const edge = x <= 0 ? points[0] : points[points.length - 1];
    return /** @type {Pt} */ (edge)[1];
  }
  return best;
}

/**
 * Is the profile flat over [x0, x1]? Spikes and pillars stand only on flat ground.
 * @param {Pt[]} points @param {number} x0 @param {number} x1
 */
export function isFlatBetween(points, x0, x1) {
  const y = profileY(points, (x0 + x1) / 2, 'floor');
  return profileSegments(points).every((s) => s.x1 <= x0 + EPS || s.x0 >= x1 - EPS || (s.slope === 0 && Math.abs(s.y0 - y) < EPS));
}

// ── Hazards ──────────────────────────────────────────────────────────────────

/**
 * A spike's drawn triangle and its smaller hit triangle.
 * @param {number} x @param {number} y base height @param {'up' | 'down'} dir @param {boolean} half
 * @returns {{ vis: Pt[], pts: Pt[] }}
 */
export function spikeTriangles(x, y, dir, half) {
  const height = half ? 0.5 : 1;
  const hit = half ? HALF_SPIKE_HIT : SPIKE_HIT;
  const s = dir === 'up' ? -1 : 1;
  return {
    vis: [[x, y], [x + 0.5, y + s * height], [x + 1, y]],
    pts: [[x + hit.inset, y], [x + 0.5, y + s * hit.tip], [x + 1 - hit.inset, y]],
  };
}

/** @param {Pt[]} pts */
function bboxOf(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @returns {Pt[]} */
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** @param {number} v (a right-angle turn's cos 6e-17 is 0) */
const clean = (v) => Math.round(v * 1e9) / 1e9;

/** Does the item have a turn, a mirror or a scale (stage r-4)? @param {Transform} t */
export const hasTransform = (t) => Boolean(t.rot || t.fx || t.fy || (t.sx ?? 1) !== 1 || (t.sy ?? 1) !== 1);

/** The turn in [0, 360). @param {Transform} t */
export const turnOf = (t) => (((t.rot ?? 0) % 360) + 360) % 360;

/** Is the turn a right angle (or none)? @param {Transform} t */
export const isRightTurn = (t) => Math.abs(turnOf(t) / 90 - Math.round(turnOf(t) / 90)) < 1e-9;

/**
 * Points scaled, mirrored and then turned (clockwise on screen: y grows down) about (cx, cy).
 * @param {Pt[]} pts @param {number} cx @param {number} cy @param {Transform} t
 * @returns {Pt[]}
 */
export function transformPts(pts, cx, cy, t) {
  const sx = (t.sx ?? 1) * (t.fx ? -1 : 1);
  const sy = (t.sy ?? 1) * (t.fy ? -1 : 1);
  const a = (turnOf(t) * Math.PI) / 180;
  const cos = clean(Math.cos(a));
  const sin = clean(Math.sin(a));
  return pts.map(([x, y]) => {
    const dx = (x - cx) * sx;
    const dy = (y - cy) * sy;
    return /** @type {Pt} */ ([clean(cx + dx * cos - dy * sin), clean(cy + dx * sin + dy * cos)]);
  });
}

/** The centre of points' box. @param {Pt[]} pts @returns {Pt} */
function centreOf(pts) {
  const [x0, y0, x1, y1] = /** @type {[number, number, number, number]} */ (bboxOf(pts));
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

/**
 * A box (block or pillar) as a hazard, turned: by a right angle it is still a box (its
 * corners in order from the top left, a solid to ride); by any other angle it is tilted.
 * @param {'block' | 'pillar'} type @param {Pt[]} box @param {'up' | 'down' | 'none'} dir @param {Transform} t
 * @returns {PolyHazard}
 */
function boxHazard(type, box, dir, t) {
  if (!hasTransform(t)) return { type, shape: 'poly', pts: box, vis: box, dir, bbox: bboxOf(box) };
  const [cx, cy] = centreOf(box);
  const pts = transformPts(box, cx, cy, t);
  if (isRightTurn(t)) {
    const [x0, y0, x1, y1] = /** @type {[number, number, number, number]} */ (bboxOf(pts));
    const out = rect(x0, y0, x1, y1);
    return { type, shape: 'poly', pts: out, vis: out, dir, bbox: [x0, y0, x1, y1], ...(t.rot ? { rot: turnOf(t) } : {}) };
  }
  return { type, shape: 'poly', pts, vis: pts, dir, bbox: bboxOf(pts), tilted: true, rot: turnOf(t) };
}

/**
 * @param {SpikeData} data @param {Pt[]} ceil @param {Pt[]} floor
 * @returns {PolyHazard[]}
 */
function resolveSpikes(data, ceil, floor) {
  const half = data.type === 'halfSpike';
  const count = data.count ?? 1;
  /** @type {PolyHazard[]} */
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = data.x + i;
    let y = data.y;
    let dir = data.dir ?? 'up';
    if (data.on === 'floor') {
      y = profileY(floor, x + 0.5, 'floor');
      dir = 'up';
    } else if (data.on === 'ceil') {
      y = profileY(ceil, x + 0.5, 'ceil');
      dir = 'down';
    }
    if (y === undefined) throw new Error('spike without y or on');
    const tri = spikeTriangles(x, y, dir, half);
    out.push({ type: data.type, shape: 'poly', pts: tri.pts, vis: tri.vis, dir, bbox: bboxOf(tri.vis) });
  }
  if (!hasTransform(data) || !out.length) return out;
  // A row turns, mirrors and scales as one, about its centre; each hit triangle with its drawing.
  const [cx, cy] = centreOf(out.flatMap((h) => h.vis));
  return out.map((h) => {
    const vis = transformPts(h.vis, cx, cy, data);
    return { ...h, vis, pts: transformPts(h.pts, cx, cy, data), bbox: bboxOf(vis) };
  });
}

/**
 * @param {HazardData} data @param {Pt[]} ceil @param {Pt[]} floor
 * @returns {Hazard[]}
 */
function resolveHazard(data, ceil, floor) {
  if (data.type === 'ring' || data.type === 'pad' || data.type === 'speed' || data.type === 'portal' || data.type === 'dark' || data.type === 'invert') return [];
  if (data.type === 'spike' || data.type === 'halfSpike') return resolveSpikes(data, ceil, floor);
  if (data.type === 'block') return [boxHazard('block', rect(data.x, data.y, data.x + data.w, data.y + data.h), 'none', data)];
  if (data.type === 'pillar') {
    const w = data.w ?? 1;
    const dir = data.on === 'floor' ? 'up' : 'down';
    if (data.y !== undefined) return [boxHazard('pillar', rect(data.x, data.y, data.x + w, data.y + data.h), dir, data)];
    const base = data.on === 'floor' ? profileY(floor, data.x + w / 2, 'floor') : profileY(ceil, data.x + w / 2, 'ceil');
    const pts = data.on === 'floor' ? rect(data.x, base - data.h, data.x + w, base) : rect(data.x, base, data.x + w, base + data.h);
    return [boxHazard('pillar', pts, dir, data)];
  }
  if (data.type !== 'saw' && data.type !== 'orb' && data.type !== 'mine') throw new Error('unknown hazard');
  const r = data.r * Math.max(data.sx ?? 1, data.sy ?? 1);
  const hit = r * ROUND_HIT[data.type];
  const mx = Math.abs(data.move?.dx ?? 0);
  const my = Math.abs(data.move?.dy ?? 0);
  return [{ type: data.type, shape: 'circle', x: data.x, y: data.y, r, hit, bbox: [data.x - r - mx, data.y - r - my, data.x + r + mx, data.y + r + my], chain: data.chain === true, ...(data.move ? { move: data.move } : {}), ...(data.rot ? { rot: turnOf(data) } : {}) }];
}

/**
 * A portal's gate, if it has one (stage r-4): from y0 to y1.
 * @param {{ y?: number, sy?: number }} data
 */
function gateOf(data) {
  if (data.y === undefined) return {};
  const half = (GATE * (data.sy ?? 1)) / 2;
  return { y0: data.y - half, y1: data.y + half };
}

/** Is a pad turned upside down (stage r-4)? @param {{ fy?: boolean, rot?: number }} data */
const padTurned = (data) => {
  const turn = turnOf(data);
  return (data.fy === true) !== (turn > 90 && turn < 270);
};

/**
 * An orb or a pad placed (a pad on its surface), or nothing for any other item.
 * @param {HazardData} data @param {Pt[]} ceil @param {Pt[]} floor
 * @returns {Booster[]}
 */
function resolveBooster(data, ceil, floor) {
  if (data.type === 'ring') {
    const scale = Math.max(data.sx ?? 1, data.sy ?? 1);
    return [{ type: 'ring', kind: data.kind, x: data.x, y: data.y, dir: 'none', ...(scale !== 1 ? { scale } : {}) }];
  }
  if (data.type !== 'pad') return [];
  const x = data.x + 0.5;
  const y = data.y ?? (data.on === 'floor' ? profileY(floor, x, 'floor') : profileY(ceil, x, 'ceil'));
  const up = (data.on === 'floor') !== padTurned(data);
  return [{ type: 'pad', kind: data.kind, x, y, dir: up ? 'up' : 'down' }];
}

/**
 * Puts items in integer-x buckets by their x extent, for quick lookup.
 * @template T
 * @param {T[]} items @param {(item: T) => [number, number]} extent
 */
function bucketize(items, extent) {
  /** @type {Map<number, T[]>} */
  const map = new Map();
  for (const item of items) {
    const [a, b] = extent(item);
    for (let c = Math.floor(a) - 1; c <= Math.floor(b) + 1; c++) {
      const list = map.get(c);
      if (list) list.push(item);
      else map.set(c, [item]);
    }
  }
  return map;
}

/**
 * A section's data turned into geometry: profiles, segments, hazards in buckets.
 * @param {SectionData} data
 * @returns {Geometry}
 */
export function buildGeometry(data) {
  const ceil = parseProfile(data.ceil);
  const floor = parseProfile(data.floor);
  const ceilSegs = profileSegments(ceil, 'ceil');
  const floorSegs = profileSegments(floor, 'floor');
  const hazards = data.hazards.flatMap((h) => resolveHazard(h, ceil, floor));
  const boosters = data.hazards.flatMap((h) => resolveBooster(h, ceil, floor));
  /** @type {Geometry['speeds']} */
  const speeds = [];
  /** @type {Geometry['portals']} */
  const portals = [];
  /** @type {Geometry['dark']} */
  const dark = [];
  /** @type {Geometry['invert']} */
  const invert = [];
  for (const h of data.hazards) {
    if (h.type === 'speed') speeds.push({ x: h.x, k: h.k });
    if (h.type === 'portal') portals.push({ x: h.x, kind: h.kind, ...gateOf(h) });
    if (h.type === 'dark') dark.push({ from: h.from, to: h.to });
    if (h.type === 'invert') invert.push({ from: h.from, to: h.to });
  }
  speeds.sort((a, b) => a.x - b.x);
  portals.sort((a, b) => a.x - b.x);
  return {
    id: data.id,
    length: data.length,
    mini: data.mini === true,
    tier: data.tier ?? null,
    mode: data.mode ?? 'wave',
    ceil,
    floor,
    ceilSegs,
    floorSegs,
    hazards,
    boosters,
    speeds,
    portals,
    dark,
    invert,
    deco: data.deco ?? [],
    buckets: bucketize(hazards, (h) => [/** @type {number} */ (h.bbox[0]), /** @type {number} */ (h.bbox[2])]),
    segBuckets: bucketize([...ceilSegs, ...floorSegs], (s) => [Math.min(s.x0, s.x1), Math.max(s.x0, s.x1)]),
  };
}

// ── Distances ────────────────────────────────────────────────────────────────

/**
 * Squared distance from point p to segment ab, and where on ab (0..1) it is closest.
 * @param {number} px @param {number} py @param {number} ax @param {number} ay @param {number} bx @param {number} by
 */
export function pointSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
  const qx = ax + t * dx - px;
  const qy = ay + t * dy - py;
  return { d2: qx * qx + qy * qy, t };
}

/**
 * Squared distance between a vertical segment (x, ya..yb) and segment ab, and the
 * closest parameter on ab.
 * @param {number} x @param {number} ya @param {number} yb
 * @param {number} ax @param {number} ay @param {number} bx @param {number} by
 */
export function verticalSegment(x, ya, yb, ax, ay, bx, by) {
  // Crossing: ab passes x between ya and yb.
  if ((ax - x) * (bx - x) <= 0 && ax !== bx) {
    const t = (x - ax) / (bx - ax);
    const y = ay + t * (by - ay);
    if (y >= ya - EPS && y <= yb + EPS) return { d2: 0, t };
  } else if (ax === bx && ax === x && Math.max(ay, by) >= ya && Math.min(ay, by) <= yb) {
    return { d2: 0, t: 0.5 };
  }
  let best = pointSegment(x, ya, ax, ay, bx, by);
  if (yb !== ya) {
    const other = pointSegment(x, yb, ax, ay, bx, by);
    if (other.d2 < best.d2) best = other;
    for (const [px, py, t] of /** @type {[number, number, number][]} */ ([[ax, ay, 0], [bx, by, 1]])) {
      const yy = Math.min(yb, Math.max(ya, py));
      const d2 = (px - x) ** 2 + (py - yy) ** 2;
      if (d2 < best.d2) best = { d2, t };
    }
  }
  return best;
}

/**
 * Is (x, y) inside a convex polygon (either winding)?
 * @param {Pt[]} pts @param {number} x @param {number} y
 */
export function insideConvex(pts, x, y) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = /** @type {Pt} */ (pts[i]);
    const [bx, by] = /** @type {Pt} */ (pts[(i + 1) % pts.length]);
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) < EPS) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

// ── Collision ────────────────────────────────────────────────────────────────

/**
 * Does the swept circle (x, ya..yb, radius r) touch a hazard?
 * @param {Hazard} h @param {number} x @param {number} ya @param {number} yb @param {number} r
 */
export function capsuleHitsHazard(h, x, ya, yb, r) {
  if (h.shape === 'circle' && h.move) h = movedAt(h, x);
  if (x + r < /** @type {number} */ (h.bbox[0]) || x - r > /** @type {number} */ (h.bbox[2])) return false;
  if (yb + r < /** @type {number} */ (h.bbox[1]) || ya - r > /** @type {number} */ (h.bbox[3])) return false;
  if (h.shape === 'circle') {
    const yy = Math.min(yb, Math.max(ya, h.y));
    return (x - h.x) ** 2 + (yy - h.y) ** 2 < (r + h.hit) ** 2;
  }
  if (insideConvex(h.pts, x, ya) || insideConvex(h.pts, x, yb)) return true;
  for (let i = 0; i < h.pts.length; i++) {
    const [ax, ay] = /** @type {Pt} */ (h.pts[i]);
    const [bx, by] = /** @type {Pt} */ (h.pts[(i + 1) % h.pts.length]);
    if (verticalSegment(x, ya, yb, ax, ay, bx, by).d2 < r * r) return true;
  }
  return false;
}

/**
 * Where a moving round hazard is when the vehicle is at local x (stage r-2): swung by
 * (dx, dy) along a sine, a whole swing every `every` cells.
 * @param {CircleHazard} h @param {number} x
 * @returns {CircleHazard}
 */
export function movedAt(h, x) {
  const m = h.move;
  if (!m) return h;
  const s = Math.sin(((x / m.every) + (m.phase ?? 0)) * Math.PI * 2);
  const cx = h.x + m.dx * s;
  const cy = h.y + m.dy * s;
  return { ...h, x: cx, y: cy, bbox: [cx - h.r, cy - h.r, cx + h.r, cy + h.r], move: undefined };
}

/**
 * Does the swept circle touch the terrain? `dir` is the wave's vertical direction
 * (+1 down, −1 up) and `slope` its |dy/dx|: a 45° slope running the same way may be
 * grazed, so for it only the centre line counts — and so for a corner it shares, and
 * for the surface right after it while the wave flies away from that surface.
 * @param {Geometry} g @param {number} x @param {number} ya @param {number} yb @param {number} r
 * @param {number} dir @param {number} slope
 */
export function capsuleHitsTerrain(g, x, ya, yb, r, dir, slope) {
  if (x >= 0 && x <= g.length) {
    if (ya < profileY(g.ceil, x, 'ceil') - EPS) return true;
    if (yb > profileY(g.floor, x, 'floor') + EPS) return true;
  }
  const aligned = slope === 1 ? dir : 0;
  const segs = g.segBuckets.get(Math.floor(x));
  if (!segs) return false;
  for (const s of segs) {
    if (aligned !== 0 && s.slope === aligned) continue;
    // Off the end of a slope it was grazing, the wave flies away from the next surface.
    if (aligned !== 0 && dir === s.away && (s.prevSlope === aligned || s.nextSlope === aligned)) continue;
    if (Math.max(s.x0, s.x1) < x - r || Math.min(s.x0, s.x1) > x + r) continue;
    const hit = verticalSegment(x, ya, yb, s.x0, s.y0, s.x1, s.y1);
    if (hit.d2 >= r * r) continue;
    if (aligned !== 0 && hit.t <= EPS && s.prevSlope === aligned) continue;
    if (aligned !== 0 && hit.t >= 1 - EPS && s.nextSlope === aligned) continue;
    return true;
  }
  return false;
}

/**
 * Everything a wave at (x, ya..yb) could crash into in this section (local x).
 * @param {Geometry} g @param {number} x @param {number} ya @param {number} yb @param {number} r
 * @param {number} dir @param {number} slope
 */
export function capsuleHits(g, x, ya, yb, r, dir, slope) {
  if (ya - r < 0 || yb + r > PLAY_H) return true;
  if (capsuleHitsTerrain(g, x, ya, yb, r, dir, slope)) return true;
  const list = g.buckets.get(Math.floor(x));
  if (list) for (const h of list) if (capsuleHitsHazard(h, x, ya, yb, r)) return true;
  return false;
}

// ── Checks on authored data ──────────────────────────────────────────────────

/**
 * The vertical extent of a drawn hazard at x, or null.
 * @param {Hazard} h @param {number} x
 * @returns {[number, number] | null}
 */
function hazardSpanAt(h, x) {
  if (h.shape === 'circle') {
    const dx = Math.abs(x - h.x);
    if (dx >= h.r) return null;
    const half = Math.sqrt(h.r * h.r - dx * dx);
    return [h.y - half, h.y + half];
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < h.vis.length; i++) {
    const [ax, ay] = /** @type {Pt} */ (h.vis[i]);
    const [bx, by] = /** @type {Pt} */ (h.vis[(i + 1) % h.vis.length]);
    if ((ax - x) * (bx - x) > 0 || ax === bx) continue;
    const y = ay + ((by - ay) * (x - ax)) / (bx - ax);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  }
  return lo <= hi ? [lo, hi] : null;
}

/**
 * The tallest open space at x, between terrain and drawn hazards: the corridor a wave
 * has to fly through there.
 * @param {Geometry} g @param {number} x
 */
export function widestGapAt(g, x) {
  /** @type {[number, number][]} */
  const blocked = [[-Infinity, profileY(g.ceil, x, 'ceil')], [profileY(g.floor, x, 'floor'), Infinity]];
  for (const h of g.hazards) {
    const span = hazardSpanAt(h, x);
    if (span) blocked.push(span);
  }
  blocked.sort((a, b) => a[0] - b[0]);
  let reach = -Infinity;
  let widest = 0;
  for (const [a, b] of blocked) {
    if (a > reach) widest = Math.max(widest, a - reach);
    reach = Math.max(reach, b);
  }
  return widest;
}

/**
 * Problems with a section's data (empty when it is well formed): the ends join any
 * other section, slopes are 45° only, spikes and pillars stand on flat ground, nothing
 * hurts near the ends, and the corridor is never lower than `minGap`.
 * @param {SectionData} data @param {number} minGap
 * @returns {string[]}
 */
export function checkSection(data, minGap) {
  const problems = [];
  /** @type {Geometry} */
  let g;
  try {
    g = buildGeometry(data);
  } catch (error) {
    return [`${data.id}: ${/** @type {Error} */ (error).message}`];
  }
  for (const [side, points, joint] of /** @type {const} */ ([['ceil', g.ceil, JOINT.ceil], ['floor', g.floor, JOINT.floor]])) {
    const last = /** @type {Pt} */ (points[points.length - 1]);
    if (/** @type {Pt} */ (points[0])[1] !== joint || last[1] !== joint) problems.push(`${data.id}: ${side} must start and end at ${joint}`);
    if (Math.abs(last[0] - data.length) > EPS) problems.push(`${data.id}: ${side} is ${last[0]} long, not ${data.length}`);
    if (!isFlatBetween(points, 0, JOINT.lead) || !isFlatBetween(points, data.length - JOINT.lead, data.length)) {
      problems.push(`${data.id}: ${side} needs ${JOINT.lead} flat cells at each end`);
    }
    for (const s of profileSegments(points)) {
      if (s.slope !== null && s.slope !== 0 && Math.abs(Math.abs(s.slope) - 1) > EPS) problems.push(`${data.id}: ${side} slope ${s.slope} is not 45°`);
      if (s.x1 < s.x0) problems.push(`${data.id}: ${side} goes backwards`);
    }
  }
  for (const item of data.hazards) {
    if ((item.type === 'spike' || item.type === 'halfSpike') && item.on) {
      const points = item.on === 'floor' ? g.floor : g.ceil;
      if (!isFlatBetween(points, item.x, item.x + (item.count ?? 1))) problems.push(`${data.id}: spike at ${item.x} not on flat ${item.on}`);
    }
    if (item.type === 'pillar') {
      const points = item.on === 'floor' ? g.floor : g.ceil;
      if (!isFlatBetween(points, item.x, item.x + (item.w ?? 1))) problems.push(`${data.id}: pillar at ${item.x} not on flat ${item.on}`);
    }
  }
  if (g.portals.filter((p) => p.kind === 'flip').length % 2) problems.push(`${data.id}: gravity flips inside a section come in pairs`);
  if (g.portals.filter((p) => p.kind === 'mini').length !== g.portals.filter((p) => p.kind === 'big').length) problems.push(`${data.id}: a mini stretch inside a section ends in a big portal`);
  for (const p of [...g.portals, ...g.speeds]) {
    if (p.x < JOINT_CLEAR || p.x > data.length - JOINT_CLEAR) problems.push(`${data.id}: portal too close to an end`);
  }
  for (const b of g.boosters) {
    if (b.x - 0.5 < JOINT_CLEAR || b.x + 0.5 > data.length - JOINT_CLEAR) problems.push(`${data.id}: ${b.type} too close to an end`);
  }
  for (const h of g.hazards) {
    if (/** @type {number} */ (h.bbox[0]) < JOINT_CLEAR || /** @type {number} */ (h.bbox[2]) > data.length - JOINT_CLEAR) {
      problems.push(`${data.id}: ${h.type} too close to an end`);
    }
  }
  for (let x = 0; x <= data.length; x += 0.05) {
    const gap = widestGapAt(g, x);
    if (gap < minGap - EPS) {
      problems.push(`${data.id}: corridor ${gap.toFixed(2)} high at x=${x.toFixed(2)} (< ${minGap.toFixed(2)})`);
      break;
    }
  }
  return problems;
}
