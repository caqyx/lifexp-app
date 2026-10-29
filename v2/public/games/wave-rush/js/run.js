// @ts-check
// A run: every sector in order, each built from its hand-authored sections in the
// sector's shuffle (docs/v2/PLAN.md 9.1, stage w-1), with its portals placed at
// section boundaries. Positions are world x in cells; a section's own geometry is local
// (0..length) and placed at x0.
import { JOINT, RESPAWN_BACK, SECTORS, START_PAD, sectorSpeed } from './config.js';
import { buildGeometry, capsuleHits } from './geometry.js';
import { shuffle } from './rng.js';
import { SECTION_LIBRARY } from './sections/index.js';

/**
 * @typedef {import('./config.js').SectorDef} SectorDef
 * @typedef {import('./geometry.js').Geometry} Geometry
 * @typedef {import('./geometry.js').SectionData} SectionData
 * @typedef {{ g: Geometry, x0: number, x1: number, sector: number, number: number, place: number, kind: 'section' | 'pad' }} Piece
 *   sector: index into run.sectors; number: the section's number in its data (1-based);
 *   place: its position in the sector's shuffle (1-based); pads have 0.
 * @typedef {{ boundary: number, kind: 'gravity' | 'mini', on: boolean }} PortalSlot
 * @typedef {{ x: number, kind: 'gravity' | 'mini', on: boolean, sector: number }} Portal
 * @typedef {{ def: SectorDef, x0: number, x1: number, speed: number, order: number[], first: number, count: number }} PlacedSector
 *   first: index of its first piece.
 * @typedef {{ sectors: PlacedSector[], pieces: Piece[], portals: Portal[], startX: number, finishX: number, length: number }} Run
 */

/** Where a portal stands after the boundary it belongs to: inside the next section's open lead. */
export const PORTAL_OFFSET = 1;
/** Open corridor drawn before the start and after the last sector (the camera sees that far). */
export const END_PAD = 40;
const BEFORE_PAD = 40;

/** @type {Map<string, Geometry>} */
const geometryCache = new Map();

/** @param {SectionData} data */
export function geometryOf(data) {
  let g = geometryCache.get(data.id);
  if (!g) {
    g = buildGeometry(data);
    geometryCache.set(data.id, g);
  }
  return g;
}

/** An open stretch of the joint corridor (before sector 1 and after the last). @param {string} id @param {number} length */
export function padGeometry(id, length) {
  return geometryOf({ id, length, ceil: `${JOINT.ceil} r${length}`, floor: `${JOINT.floor} r${length}`, hazards: [] });
}

/**
 * The order a sector's sections are played in this run: each group shuffled, groups in order.
 * @param {SectorDef} sector @param {() => number} rng
 */
export function orderSections(sector, rng) {
  return sector.groups.flatMap((group) => shuffle(group, rng));
}

/**
 * The sector's portals at section boundaries (boundary b = between places b and b+1).
 * Each rule's `count` pairs turn the state on and, `span` sections later, off. Pairs do
 * not overlap or touch, never stand at the sector's very start, and each boundary holds
 * at most one portal. Seeded, so the count is exact every run.
 * @param {SectorDef} sector @param {number} sections @param {() => number} rng
 * @returns {PortalSlot[]}
 */
export function placePortals(sector, sections, rng) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const placed = tryPlacePortals(sector, sections, rng);
    if (placed) return placed.sort((a, b) => a.boundary - b.boundary);
  }
  throw new Error(`no room for the portals of sector ${sector.id}`);
}

/**
 * One random try at placing every portal pair; null when it painted itself into a corner.
 * @param {SectorDef} sector @param {number} sections @param {() => number} rng
 * @returns {PortalSlot[] | null}
 */
function tryPlacePortals(sector, sections, rng) {
  /** @type {PortalSlot[]} */
  const slots = [];
  const used = new Set();
  for (const rule of sector.portals) {
    for (let n = 0; n < rule.count; n++) {
      const options = [];
      for (let b = 1; b + rule.span <= sections - 1; b++) {
        let clash = false;
        for (let k = b - 1; k <= b + rule.span + 1; k++) if (used.has(`${rule.kind}:${k}`)) clash = true;
        if (used.has(`any:${b}`) || used.has(`any:${b + rule.span}`)) clash = true;
        if (!clash) options.push(b);
      }
      if (!options.length) return null;
      const b = /** @type {number} */ (options[Math.floor(rng() * options.length)]);
      for (let k = b; k <= b + rule.span; k++) used.add(`${rule.kind}:${k}`);
      used.add(`any:${b}`);
      used.add(`any:${b + rule.span}`);
      slots.push({ boundary: b, kind: rule.kind, on: true }, { boundary: b + rule.span, kind: rule.kind, on: false });
    }
  }
  return slots;
}

/**
 * @param {SectorDef} sector
 * @param {Record<number, SectionData[]>} library
 */
function sectionsOf(sector, library) {
  const list = library[sector.id];
  if (!list) throw new Error(`sector ${sector.id} has no sections`);
  return list;
}

/**
 * Builds a whole run. Pads before and after; sectors back to back.
 * @param {() => number} rng
 * @param {{ sectors?: SectorDef[], library?: Record<number, SectionData[]> }} [options]
 * @returns {Run}
 */
export function buildRun(rng, options = {}) {
  const defs = options.sectors ?? SECTORS;
  const library = options.library ?? SECTION_LIBRARY;
  /** @type {Piece[]} */
  const pieces = [{ g: padGeometry('pad-start', BEFORE_PAD), x0: -BEFORE_PAD, x1: 0, sector: 0, number: 0, place: 0, kind: 'pad' }];
  /** @type {PlacedSector[]} */
  const sectors = [];
  /** @type {Portal[]} */
  const portals = [];
  let x = 0;
  defs.forEach((def, s) => {
    const data = sectionsOf(def, library);
    const order = orderSections(def, rng);
    const first = pieces.length;
    const x0 = x;
    order.forEach((number, i) => {
      const g = geometryOf(/** @type {SectionData} */ (data[number - 1]));
      pieces.push({ g, x0: x, x1: x + g.length, sector: s, number, place: i + 1, kind: 'section' });
      x += g.length;
    });
    for (const slot of placePortals(def, order.length, rng)) {
      const next = /** @type {Piece} */ (pieces[first + slot.boundary]);
      portals.push({ x: next.x0 + PORTAL_OFFSET, kind: slot.kind, on: slot.on, sector: s });
    }
    sectors.push({ def, x0, x1: x, speed: sectorSpeed(def), order, first, count: order.length });
  });
  pieces.push({ g: padGeometry('pad-end', END_PAD), x0: x, x1: x + END_PAD, sector: sectors.length - 1, number: 0, place: 0, kind: 'pad' });
  return { sectors, pieces, portals, startX: -START_PAD + 2, finishX: x + 2, length: x };
}

// ── Questions about a place in the run ───────────────────────────────────────

/** The index of the piece at x (the last one whose x0 ≤ x). @param {Run} run @param {number} x */
export function pieceIndexAt(run, x) {
  let lo = 0;
  let hi = run.pieces.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (/** @type {Piece} */ (run.pieces[mid]).x0 <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** @param {Run} run @param {number} x */
export const pieceAt = (run, x) => /** @type {Piece} */ (run.pieces[pieceIndexAt(run, x)]);

/** @param {Run} run @param {number} x */
export function sectorAt(run, x) {
  return /** @type {PlacedSector} */ (run.sectors[pieceAt(run, x).sector]);
}

/**
 * Does a wave at (x, ya..yb) touch anything? (The game asks with ya = yb.)
 * @param {Run} run @param {number} x @param {number} ya @param {number} yb @param {number} r @param {number} dir @param {number} slope
 */
export function runHits(run, x, ya, yb, r, dir, slope) {
  const i = pieceIndexAt(run, x);
  for (let k = Math.max(0, i - 1); k <= Math.min(run.pieces.length - 1, i + 1); k++) {
    const p = /** @type {Piece} */ (run.pieces[k]);
    if (x + r < p.x0 - 1 || x - r > p.x1 + 1) continue;
    if (capsuleHits(p.g, x - p.x0, ya, yb, r, dir, slope)) return true;
  }
  return false;
}

/**
 * Gravity and size at x: the portals of x's sector already passed (a sector starts normal).
 * @param {Run} run @param {number} x
 * @returns {{ gravity: 1 | -1, mini: boolean }}
 */
export function stateAt(run, x) {
  const sector = pieceAt(run, x).sector;
  /** @type {1 | -1} */
  let gravity = 1;
  let mini = false;
  for (const p of run.portals) {
    if (p.sector !== sector || p.x > x) continue;
    if (p.kind === 'gravity') gravity = p.on ? -1 : 1;
    else mini = p.on;
  }
  return { gravity, mini };
}

/** How far x is through the whole run, 0..100. @param {Run} run @param {number} x */
export function progressAt(run, x) {
  return Math.min(100, Math.max(0, (x / run.length) * 100));
}

/**
 * Sector and section (play position) at x, 1-based; the start pad counts as sector 1, section 1.
 * @param {Run} run @param {number} x
 */
export function locate(run, x) {
  const i = pieceIndexAt(run, x);
  const piece = /** @type {Piece} */ (run.pieces[i]);
  if (piece.kind === 'section') return { sector: piece.sector + 1, section: piece.place };
  if (i === 0) return { sector: 1, section: 1 };
  const last = /** @type {PlacedSector} */ (run.sectors[run.sectors.length - 1]);
  return { sector: run.sectors.length, section: last.count };
}

/**
 * Where a practice attempt starts again: the start of x's sector, or of its section.
 * @param {Run} run @param {number} x @param {'sector' | 'section'} by
 */
export function checkpointX(run, x, by) {
  const piece = pieceAt(run, x);
  if (piece.kind === 'pad') return piece.x0 < 0 ? run.startX : /** @type {PlacedSector} */ (run.sectors[piece.sector]).x0;
  return by === 'section' ? piece.x0 : /** @type {PlacedSector} */ (run.sectors[piece.sector]).x0;
}

/** The x a wave restarts from for a checkpoint (a little before it, in the open joint). @param {Run} run @param {number} cp */
export function respawnX(run, cp) {
  return cp <= run.startX ? run.startX : cp - RESPAWN_BACK;
}

/**
 * The start of a sector's section by play position (test jump), or null.
 * @param {Run} run @param {number} sector 1-based @param {number} section 1-based
 */
export function jumpX(run, sector, section) {
  const s = run.sectors[sector - 1];
  if (!s) return null;
  const piece = run.pieces[s.first + Math.min(section, s.count) - 1];
  return piece ? piece.x0 : null;
}
