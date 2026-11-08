// @ts-check
// Strażnicy Doliny: the player's own maps (docs/v2/PLAN.md 9.1, td-5) — pure rules, no DOM.
// A map is painted on the same 9 × 15 grid as the campaign's: a road of cells from the top
// row (the entrance) to the bottom row (the gate), one cell after another (side by side,
// never diagonal), never doubling back or brushing past itself; build spots anywhere off
// the road. It becomes an ordinary MapDef (its road as corners), so the game plays it like
// any map, in one of the three looks. Saved on the device under a key of its own.

import { COLS, ROWS } from './maps.js';
import { readJson, writeJson } from './records.js';

/** @typedef {import('./maps.js').MapDef} MapDef */
/** @typedef {'meadow' | 'canyon' | 'marsh'} Look */
/** @typedef {readonly [number, number]} Cell */
/**
 * A map as the player made it.
 * @typedef {{ id: string, name: string, look: Look, path: Cell[], pads: Cell[] }} CustomMap
 */
/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} MapStorage */

export const CUSTOM_KEY = 'lifexp-wardens-custom';
export const LOOKS = /** @type {const} */ (['meadow', 'canyon', 'marsh']);
export const MIN_PADS = 3;
export const MAX_PADS = 20;
export const MAX_MAPS = 8;
export const MAX_NAME = 16;

/** @param {Cell} a @param {Cell} b */
function touching(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

/** @param {Cell} cell */
function inside(cell) {
  return cell[0] >= 0 && cell[0] < COLS && cell[1] >= 0 && cell[1] < ROWS;
}

/** @param {readonly Cell[]} cells @param {Cell} cell */
function has(cells, cell) {
  return cells.some((c) => c[0] === cell[0] && c[1] === cell[1]);
}

/**
 * Whether the road can grow by `cell`: the first cell is in the top row; each next one is
 * beside the last, new, and touches no other road cell (the road never brushes itself).
 * @param {readonly Cell[]} path @param {Cell} cell
 */
export function canExtend(path, cell) {
  if (!inside(cell)) return false;
  const last = path[path.length - 1];
  if (!last) return cell[1] === 0;
  if (last[1] === ROWS - 1 && path.length > 1) return false;
  if (!touching(last, cell) || has(path, cell)) return false;
  return path.every((c, i) => i === path.length - 1 || !touching(c, cell));
}

/**
 * What is wrong with a road, or '' when it is a whole one: 'empty', 'start' (not from the
 * top row), 'end' (not to the bottom row), 'gap' (two cells not side by side), 'repeat'
 * (a cell twice) or 'touch' (it brushes past itself).
 * @param {readonly Cell[]} path
 */
export function pathProblem(path) {
  if (path.length === 0) return 'empty';
  if (!path.every(inside)) return 'gap';
  if ((path[0]?.[1] ?? -1) !== 0) return 'start';
  for (let i = 1; i < path.length; i++) {
    const cell = /** @type {Cell} */ (path[i]);
    if (has(path.slice(0, i), cell)) return 'repeat';
    if (!touching(/** @type {Cell} */ (path[i - 1]), cell)) return 'gap';
    for (let j = 0; j < i - 1; j++) if (touching(/** @type {Cell} */ (path[j]), cell)) return 'touch';
  }
  if ((path[path.length - 1]?.[1] ?? -1) !== ROWS - 1) return 'end';
  return '';
}

/**
 * What is wrong with a whole map, or '': its road (see pathProblem), 'pads' (fewer than
 * MIN_PADS or more than MAX_PADS) or 'padOnRoad'.
 * @param {{ path: readonly Cell[], pads: readonly Cell[] }} map
 */
export function mapProblem(map) {
  const road = pathProblem(map.path);
  if (road) return road;
  if (map.pads.length < MIN_PADS || map.pads.length > MAX_PADS) return 'pads';
  if (map.pads.some((p) => has(map.path, p) || !inside(p))) return 'padOnRoad';
  return '';
}

/**
 * The road as the game wants it: its corners (cell coordinates), from just above the map
 * to just below it, like the campaign's maps.
 * @param {readonly Cell[]} path @returns {[number, number][]}
 */
export function roadCorners(path) {
  const first = /** @type {Cell} */ (path[0]);
  const last = /** @type {Cell} */ (path[path.length - 1]);
  /** @type {[number, number][]} */
  const corners = [[first[0], -1.2]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = /** @type {Cell} */ (path[i - 1]);
    const b = /** @type {Cell} */ (path[i]);
    const c = /** @type {Cell} */ (path[i + 1]);
    if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1]) corners.push([b[0], b[1]]);
  }
  corners.push([last[0], ROWS + 0.2]);
  return corners;
}

/**
 * A playable map from the player's own: the campaign's numbers for the first map (15
 * waves, its start gold and health), in the chosen look.
 * @param {CustomMap} custom @returns {MapDef}
 */
export function toMapDef(custom) {
  return {
    id: 'meadow',
    look: custom.look,
    custom: custom.id,
    name: custom.name,
    waves: 15,
    hpFactor: 1,
    startGold: 150,
    theme: { ground: '', groundAlt: '', road: '', roadEdge: '', pad: '', deco: '' },
    road: roadCorners(custom.path),
    pads: custom.pads.map((p) => /** @type {[number, number]} */ ([p[0], p[1]])),
  };
}

/** @param {unknown} v @returns {Cell | null} */
function cellOf(v) {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [c, r] = v;
  return Number.isInteger(c) && Number.isInteger(r) ? [c, r] : null;
}

/**
 * The saved maps, cleaned: a broken or invalid one is left out.
 * @param {MapStorage | null} storage @returns {CustomMap[]}
 */
export function readCustomMaps(storage) {
  const raw = /** @type {{ maps?: unknown } | null} */ (readJson(storage, CUSTOM_KEY));
  const list = Array.isArray(raw?.maps) ? raw.maps : [];
  /** @type {CustomMap[]} */
  const maps = [];
  for (const m of list) {
    if (!m || typeof m.id !== 'string' || typeof m.name !== 'string') continue;
    const look = LOOKS.includes(m.look) ? m.look : 'meadow';
    const path = Array.isArray(m.path) ? m.path.map(cellOf) : [];
    const pads = Array.isArray(m.pads) ? m.pads.map(cellOf) : [];
    if (path.includes(null) || pads.includes(null)) continue;
    const map = { id: m.id, name: m.name.slice(0, MAX_NAME), look, path: /** @type {Cell[]} */ (path), pads: /** @type {Cell[]} */ (pads) };
    if (!mapProblem(map)) maps.push(map);
  }
  return maps.slice(0, MAX_MAPS);
}

/** @param {MapStorage | null} storage @param {CustomMap[]} maps */
function writeCustomMaps(storage, maps) {
  writeJson(storage, CUSTOM_KEY, { maps });
}

/**
 * Saves a map (a new one, or over the one with its id); returns the list, or null when the
 * map is not whole or the list is full.
 * @param {MapStorage | null} storage @param {CustomMap[]} maps @param {CustomMap} map
 */
export function saveCustomMap(storage, maps, map) {
  if (mapProblem(map)) return null;
  const clean = { ...map, name: map.name.trim().slice(0, MAX_NAME) || 'Mapa' };
  const at = maps.findIndex((m) => m.id === clean.id);
  if (at < 0 && maps.length >= MAX_MAPS) return null;
  const next = at < 0 ? [...maps, clean] : maps.map((m, i) => (i === at ? clean : m));
  writeCustomMaps(storage, next);
  return next;
}

/** @param {MapStorage | null} storage @param {CustomMap[]} maps @param {string} id */
export function deleteCustomMap(storage, maps, id) {
  const next = maps.filter((m) => m.id !== id);
  writeCustomMaps(storage, next);
  return next;
}

/** A new map's id: unused by the saved ones. @param {readonly CustomMap[]} maps */
export function newMapId(maps) {
  let n = maps.length + 1;
  while (maps.some((m) => m.id === `m${n}`)) n += 1;
  return `m${n}`;
}
