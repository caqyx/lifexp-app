// @ts-check
// A run: every sector in order, each built from its hand-authored sections in the
// sector's shuffle (docs/v2/PLAN.md 9.1, stages w-1 and w-2), with its portals placed
// at section boundaries. The finale is built the same way from one fixed sector.
// Positions are world x in cells; a section's own geometry is local (0..length) and
// placed at x0. Every piece knows its tier (speed and human limits) and its look.
import { FINALE_ID, JOINT, RESPAWN_BACK, SECTORS, START_PAD, sectionStyle, tierSpeed } from './config.js';
import { buildGeometry, capsuleHits } from './geometry.js';
import { shuffle } from './rng.js';
import { FINALE, SECTION_LIBRARY } from './sections/index.js';

/**
 * @typedef {import('./config.js').SectorDef} SectorDef
 * @typedef {import('./geometry.js').Geometry} Geometry
 * @typedef {import('./geometry.js').SectionData} SectionData
 * @typedef {{ g: Geometry, x0: number, x1: number, sector: number, number: number, place: number, kind: 'section' | 'pad',
 *   tier: string, theme: string, speed: number, band: number, mode: 'wave' | 'ship' }} Piece
 *   sector: index into run.sectors; number: the section's number in its data (1-based);
 *   place: its position in the sector's shuffle (1-based); pads have 0; band: index of
 *   its Demon tier in the sector's bands, or -1.
 * @typedef {{ kind: 'gravity', boundary: number, on: boolean } | { kind: 'mini', place: number, on: boolean }} PortalSlot
 *   gravity: at a boundary (b = between places b and b+1); mini: inside its section's own joints.
 * @typedef {'gravity' | 'mini' | 'ship'} PortalKind
 * @typedef {{ x: number, kind: PortalKind, on: boolean, sector: number }} Portal
 * @typedef {{ def: SectorDef, x0: number, x1: number, order: number[], first: number, count: number }} PlacedSector
 *   first: index of its first piece.
 * @typedef {{ kind: 'run' | 'finale', sectors: PlacedSector[], pieces: Piece[], portals: Portal[], startX: number, finishX: number, length: number }} Run
 */

/** Where portals stand inside a section's open lead-in (and a mini's way back in its lead-out). */
export const PORTAL_OFFSET = { gravity: 0.7, mini: 1.3, miniBack: 0.7, ship: 1 };
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
 * The order a sector's sections are played in this run: each group shuffled, groups in
 * order (a fixed sector, the finale, is never shuffled).
 * @param {SectorDef} sector @param {() => number} rng
 */
export function orderSections(sector, rng) {
  return sector.groups.flatMap((group) => (sector.fixed ? group.slice() : shuffle(group, rng)));
}

/**
 * The places (1-based) a rule may use: the whole sector, or its band.
 * @param {SectorDef} sector @param {number[]} order @param {number | undefined} band
 */
function placesOf(sector, order, band) {
  const b = band === undefined ? null : sector.bands?.[band];
  const places = [];
  for (let p = 1; p <= order.length; p++) {
    const n = /** @type {number} */ (order[p - 1]);
    if (!b || (n >= b.from && n <= b.to)) places.push(p);
  }
  return places;
}

/**
 * The sector's portals. Gravity: each flip upside down at a boundary inside the rule's
 * range (never at the sector's or the band's very start) and the way back `span`
 * sections later, still inside it; flips never overlap or share a boundary, so the
 * sector always ends upright. Mini: one pair around every section marked `mini` in the
 * range, wherever the shuffle put it. Seeded, so every count is exact on every run.
 * @param {SectorDef} sector @param {number[]} order @param {SectionData[]} data @param {() => number} rng
 * @returns {PortalSlot[]}
 */
export function placePortals(sector, order, data, rng) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const placed = tryPlacePortals(sector, order, data, rng);
    if (placed) return placed;
  }
  throw new Error(`no room for the portals of sector ${sector.id}`);
}

/**
 * One random try at placing every gravity pair; null when it painted itself into a corner.
 * @param {SectorDef} sector @param {number[]} order @param {SectionData[]} data @param {() => number} rng
 * @returns {PortalSlot[] | null}
 */
function tryPlacePortals(sector, order, data, rng) {
  /** @type {PortalSlot[]} */
  const slots = [];
  const used = new Set();
  for (const rule of sector.portals) {
    const places = placesOf(sector, order, rule.band);
    if (rule.kind === 'mini') {
      const minis = places.filter((p) => data[/** @type {number} */ (order[p - 1]) - 1]?.mini);
      if (minis.length !== rule.count) throw new Error(`sector ${sector.id}: ${minis.length} mini sections for ${rule.count} mini portals`);
      for (const place of minis) slots.push({ kind: 'mini', place, on: true }, { kind: 'mini', place, on: false });
      continue;
    }
    const span = rule.span ?? 1;
    const first = /** @type {number} */ (places[0]);
    const last = /** @type {number} */ (places[places.length - 1]);
    for (let n = 0; n < rule.count; n++) {
      const options = [];
      // Boundary b lies between places b and b+1: the flip starts with place b+1.
      for (let b = first; b + span <= last - 1; b++) {
        let clash = false;
        for (let k = b; k <= b + span; k++) if (used.has(k)) clash = true;
        if (!clash) options.push(b);
      }
      if (!options.length) return null;
      const b = /** @type {number} */ (options[Math.floor(rng() * options.length)]);
      for (let k = b; k <= b + span; k++) used.add(k);
      slots.push({ kind: 'gravity', boundary: b, on: true }, { kind: 'gravity', boundary: b + span, on: false });
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
 * Places one sector's sections and portals after x.
 * @param {SectorDef} def @param {number} s its index @param {number} x
 * @param {{ pieces: Piece[], portals: Portal[], library: Record<number, SectionData[]>, rng: () => number }} into
 */
function placeSector(def, s, x, into) {
  const data = sectionsOf(def, into.library);
  const order = orderSections(def, into.rng);
  const first = into.pieces.length;
  const x0 = x;
  order.forEach((number, i) => {
    const d = /** @type {SectionData} */ (data[number - 1]);
    const g = geometryOf(d);
    const style = sectionStyle(def, number);
    const tier = d.tier ?? style.tier;
    const band = def.bands ? def.bands.findIndex((b) => number >= b.from && number <= b.to) : -1;
    into.pieces.push({ g, x0: x, x1: x + g.length, sector: s, number, place: i + 1, kind: 'section', tier, theme: style.theme, speed: tierSpeed(tier), band, mode: g.mode });
    x += g.length;
  });
  for (const slot of placePortals(def, order, data, into.rng)) {
    if (slot.kind === 'gravity') {
      const next = /** @type {Piece} */ (into.pieces[first + slot.boundary]);
      into.portals.push({ x: next.x0 + PORTAL_OFFSET.gravity, kind: 'gravity', on: slot.on, sector: s });
    } else {
      const piece = /** @type {Piece} */ (into.pieces[first + slot.place - 1]);
      into.portals.push({ x: slot.on ? piece.x0 + PORTAL_OFFSET.mini : piece.x1 - PORTAL_OFFSET.miniBack, kind: 'mini', on: slot.on, sector: s });
    }
  }
  // Ship and wave portals where the vehicle changes (the finale).
  for (let i = first; i < into.pieces.length; i++) {
    const piece = /** @type {Piece} */ (into.pieces[i]);
    const before = i === first ? 'wave' : /** @type {Piece} */ (into.pieces[i - 1]).mode;
    if (piece.mode !== before) into.portals.push({ x: piece.x0 + PORTAL_OFFSET.ship, kind: 'ship', on: piece.mode === 'ship', sector: s });
  }
  into.portals.sort((a, b) => a.x - b.x);
  return { def, x0, x1: x, order, first, count: order.length };
}

/**
 * The pads around a level: they fly like the piece they touch.
 * @param {string} id @param {number} x0 @param {number} length @param {Piece} like
 * @returns {Piece}
 */
function pad(id, x0, length, like) {
  return { g: padGeometry(id, length), x0, x1: x0 + length, sector: like.sector, number: 0, place: 0, kind: 'pad', tier: like.tier, theme: like.theme, speed: like.speed, band: like.band, mode: 'wave' };
}

/**
 * Builds a level from sectors: pads before and after, sectors back to back.
 * @param {'run' | 'finale'} kind @param {SectorDef[]} defs @param {Record<number, SectionData[]>} library @param {() => number} rng
 * @returns {Run}
 */
function buildLevel(kind, defs, library, rng) {
  /** @type {Piece[]} */
  const pieces = [];
  /** @type {Portal[]} */
  const portals = [];
  /** @type {PlacedSector[]} */
  const sectors = [];
  let x = 0;
  defs.forEach((def, s) => {
    const placed = placeSector(def, s, x, { pieces, portals, library, rng });
    sectors.push(placed);
    x = placed.x1;
  });
  const first = /** @type {Piece} */ (pieces[0]);
  const last = /** @type {Piece} */ (pieces[pieces.length - 1]);
  pieces.unshift(pad('pad-start', -BEFORE_PAD, BEFORE_PAD, first));
  pieces.push(pad('pad-end', x, END_PAD, last));
  for (const s of sectors) s.first += 1;
  return { kind, sectors, pieces, portals, startX: -START_PAD + 2, finishX: x + 2, length: x };
}

/**
 * The run: sectors 1–6 (or the given ones).
 * @param {() => number} rng
 * @param {{ sectors?: SectorDef[], library?: Record<number, SectionData[]> }} [options]
 * @returns {Run}
 */
export function buildRun(rng, options = {}) {
  return buildLevel('run', options.sectors ?? SECTORS, options.library ?? SECTION_LIBRARY, rng);
}

/** The finale: one fixed sequence of ship and wave stretches. @returns {Run} */
export function buildFinale() {
  return buildLevel('finale', [FINALE], { [FINALE_ID]: SECTION_LIBRARY[FINALE_ID] ?? [] }, () => 0);
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

/** The flying speed at x (cells per second): the tier of the piece there. @param {Run} run @param {number} x */
export const speedAt = (run, x) => pieceAt(run, x).speed;

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
 * Gravity, size and vehicle at x: the portals of x's sector already passed (a sector starts normal).
 * @param {Run} run @param {number} x
 * @returns {{ gravity: 1 | -1, mini: boolean, ship: boolean }}
 */
export function stateAt(run, x) {
  const sector = pieceAt(run, x).sector;
  /** @type {1 | -1} */
  let gravity = 1;
  let mini = false;
  let ship = false;
  for (const p of run.portals) {
    if (p.sector !== sector || p.x > x) continue;
    if (p.kind === 'gravity') gravity = p.on ? -1 : 1;
    else if (p.kind === 'mini') mini = p.on;
    else ship = p.on;
  }
  return { gravity, mini, ship };
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
 * The start of the checkpoint unit holding a piece: its sector, or its Demon tier.
 * @param {Run} run @param {Piece} piece
 */
function unitStart(run, piece) {
  const sector = /** @type {PlacedSector} */ (run.sectors[piece.sector]);
  if (piece.band < 0) return sector.x0;
  for (let i = sector.first; i < sector.first + sector.count; i++) {
    const p = /** @type {Piece} */ (run.pieces[i]);
    if (p.band === piece.band) return p.x0;
  }
  return sector.x0;
}

/**
 * Where a practice attempt starts again: the start of x's sector (each Demon tier counts
 * as one), or of its section.
 * @param {Run} run @param {number} x @param {'sector' | 'section'} by
 */
export function checkpointX(run, x, by) {
  const piece = pieceAt(run, x);
  if (piece.kind === 'pad') return piece.x0 < 0 ? run.startX : /** @type {PlacedSector} */ (run.sectors[piece.sector]).x0;
  return by === 'section' ? piece.x0 : unitStart(run, piece);
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
