// @ts-check
// The Rush level editor's file (docs/v2/PLAN.md 9.1, stage r-3; described in README.md
// next to this file): one level of one game — its tier (speed and human limits), a name
// and its sections, each the same data the game's own sections are written in. Reading a
// file checks everything a level needs and says plainly what is wrong and where.
import { JOINT } from '../world.js';
import { buildGeometry, parseProfile } from '../geometry.js';

/**
 * @typedef {import('../geometry.js').SectionData} SectionData
 * @typedef {{ format: 'LifeXP Rush level', version: 1, game: string, name: string, tier: string, sections: SectionData[] }} Level
 * @typedef {{ id: string, tiers: string[], modes: string[], items: string[], moving?: boolean }} Palette
 *   What a game allows: its tier keys, its vehicles and the item types of its sections;
 *   moving: round hazards may move (its validator proves them).
 * @typedef {{ path: string, key: string, values?: Record<string, string | number> }} Problem
 *   path: where (e.g. "sections[2].hazards[5].x"); key: the text that says what (editor i18n).
 */

export const FORMAT = 'LifeXP Rush level';
export const VERSION = 1;
export const MAX_SECTIONS = 60;
export const LENGTH = { min: 10, max: 80 };

/** The fields each item type has (numbers unless listed in TEXT; `?` optional). */
const FIELDS = /** @type {Record<string, string[]>} */ ({
  spike: ['x', 'on?', 'y?', 'dir?', 'count?'],
  halfSpike: ['x', 'on?', 'y?', 'dir?', 'count?'],
  block: ['x', 'y', 'w', 'h'],
  pillar: ['x', 'on', 'h', 'w?'],
  saw: ['x', 'y', 'r', 'chain?', 'move?'],
  mine: ['x', 'y', 'r', 'chain?', 'move?'],
  orb: ['x', 'y', 'r', 'chain?', 'move?'],
  ring: ['x', 'y', 'kind'],
  pad: ['x', 'on', 'kind', 'y?'],
  speed: ['x', 'k'],
  portal: ['x', 'kind'],
  dark: ['from', 'to'],
  invert: ['from', 'to'],
});
/** Fields that hold a word, and the words they may hold. */
const WORDS = /** @type {Record<string, string[]>} */ ({
  on: ['floor', 'ceil'],
  dir: ['up', 'down'],
  k: ['slow', 'normal', 'fast', 'veryFast'],
  'ring.kind': ['jump', 'small', 'gravity', 'gravityJump', 'dash'],
  'pad.kind': ['jump', 'small', 'gravity'],
  'portal.kind': ['flip', 'mini', 'big'],
});

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/** @param {unknown} v @returns {v is number} */
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * An empty level: one open section of the game's first vehicle.
 * @param {Palette} palette @param {string} name
 * @returns {Level}
 */
export function emptyLevel(palette, name) {
  return { format: FORMAT, version: VERSION, game: palette.id, name, tier: /** @type {string} */ (palette.tiers[0]), sections: [emptySection(palette, 1)] };
}

/**
 * An open section (the joints' corridor), `length` cells.
 * @param {Palette} palette @param {number} n its number @param {number} [length]
 * @returns {SectionData}
 */
export function emptySection(palette, n, length = 30) {
  return { id: sectionId(n), length, ceil: `${JOINT.ceil} r${length}`, floor: `${JOINT.floor} r${length}`, hazards: [], mode: /** @type {SectionData['mode']} */ (palette.modes[0]) };
}

/** @param {number} n */
export const sectionId = (n) => `e-${String(n).padStart(2, '0')}`;

/**
 * The text of a level's file (ids are the editor's own and are left out).
 * @param {Level} level
 */
export function toJson(level) {
  return JSON.stringify(
    { format: FORMAT, version: VERSION, game: level.game, name: level.name, tier: level.tier, sections: level.sections.map(({ id: _id, deco: _deco, ...s }) => s) },
    null,
    2,
  );
}

/**
 * Reads a level's file: the level, or what is wrong with it (every problem, each with
 * where it is).
 * @param {string} text @param {Palette} palette
 * @returns {{ level: Level | null, problems: Problem[] }}
 */
export function fromJson(text, palette) {
  /** @type {unknown} */
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { level: null, problems: [{ path: '', key: 'errJson', values: { detail: /** @type {Error} */ (error).message } }] };
  }
  return checkLevel(raw, palette);
}

/**
 * Checks a level read from anywhere.
 * @param {unknown} raw @param {Palette} palette
 * @returns {{ level: Level | null, problems: Problem[] }}
 */
export function checkLevel(raw, palette) {
  /** @type {Problem[]} */
  const problems = [];
  if (!isObject(raw)) return { level: null, problems: [{ path: '', key: 'errNotObject' }] };
  if (raw.format !== FORMAT) problems.push({ path: 'format', key: 'errFormat', values: { expected: FORMAT } });
  if (raw.version !== VERSION) problems.push({ path: 'version', key: 'errVersion', values: { expected: VERSION } });
  if (raw.game !== palette.id) problems.push({ path: 'game', key: 'errGame', values: { expected: palette.id, got: String(raw.game) } });
  const name = typeof raw.name === 'string' ? raw.name.slice(0, 60) : '';
  if (typeof raw.tier !== 'string' || !palette.tiers.includes(raw.tier)) problems.push({ path: 'tier', key: 'errTier', values: { allowed: palette.tiers.join(', ') } });
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) {
    problems.push({ path: 'sections', key: 'errSections' });
    return { level: null, problems };
  }
  if (raw.sections.length > MAX_SECTIONS) problems.push({ path: 'sections', key: 'errTooMany', values: { max: MAX_SECTIONS } });
  /** @type {SectionData[]} */
  const sections = [];
  raw.sections.slice(0, MAX_SECTIONS).forEach((s, i) => {
    const section = checkSectionData(s, `sections[${i}]`, palette, problems);
    if (section) sections.push({ ...section, id: sectionId(i + 1) });
  });
  if (problems.length) return { level: null, problems };
  return { level: { format: FORMAT, version: VERSION, game: palette.id, name, tier: /** @type {string} */ (raw.tier), sections }, problems };
}

/**
 * One section's data, checked.
 * @param {unknown} s @param {string} path @param {Palette} palette @param {Problem[]} problems
 * @returns {SectionData | null}
 */
function checkSectionData(s, path, palette, problems) {
  if (!isObject(s)) {
    problems.push({ path, key: 'errNotObject' });
    return null;
  }
  const before = problems.length;
  if (!isNumber(s.length) || s.length < LENGTH.min || s.length > LENGTH.max) problems.push({ path: `${path}.length`, key: 'errLength', values: { min: LENGTH.min, max: LENGTH.max } });
  for (const side of /** @type {const} */ (['ceil', 'floor'])) {
    const text = s[side];
    if (typeof text !== 'string') {
      problems.push({ path: `${path}.${side}`, key: 'errProfile', values: { detail: '—' } });
      continue;
    }
    try {
      const pts = parseProfile(text);
      const last = /** @type {[number, number]} */ (pts[pts.length - 1]);
      if (isNumber(s.length) && Math.abs(last[0] - s.length) > 1e-6) problems.push({ path: `${path}.${side}`, key: 'errProfileLength', values: { got: last[0], length: s.length } });
    } catch (error) {
      problems.push({ path: `${path}.${side}`, key: 'errProfile', values: { detail: /** @type {Error} */ (error).message } });
    }
  }
  if (s.mode !== undefined && (typeof s.mode !== 'string' || !palette.modes.includes(s.mode))) problems.push({ path: `${path}.mode`, key: 'errMode', values: { allowed: palette.modes.join(', ') } });
  if (s.mini !== undefined && typeof s.mini !== 'boolean') problems.push({ path: `${path}.mini`, key: 'errBoolean' });
  if (!Array.isArray(s.hazards)) problems.push({ path: `${path}.hazards`, key: 'errHazards' });
  else s.hazards.forEach((h, j) => checkItem(h, `${path}.hazards[${j}]`, palette, isNumber(s.length) ? s.length : LENGTH.max, problems));
  if (problems.length > before) return null;
  const data = /** @type {SectionData} */ ({ id: 'x', length: s.length, ceil: s.ceil, floor: s.floor, hazards: s.hazards, ...(s.mode ? { mode: s.mode } : {}), ...(s.mini ? { mini: true } : {}) });
  try {
    buildGeometry(data);
  } catch (error) {
    problems.push({ path, key: 'errBuild', values: { detail: /** @type {Error} */ (error).message } });
    return null;
  }
  return data;
}

/**
 * One item of a section, checked: a type this game has, its fields of the right kind and
 * inside the section.
 * @param {unknown} h @param {string} path @param {Palette} palette @param {number} length @param {Problem[]} problems
 */
function checkItem(h, path, palette, length, problems) {
  if (!isObject(h)) {
    problems.push({ path, key: 'errNotObject' });
    return;
  }
  const type = typeof h.type === 'string' ? h.type : '';
  const fields = FIELDS[type];
  if (!fields || !palette.items.includes(type)) {
    problems.push({ path: `${path}.type`, key: 'errType', values: { got: String(h.type), allowed: palette.items.join(', ') } });
    return;
  }
  const known = new Set(['type', ...fields.map((f) => f.replace('?', ''))]);
  for (const key of Object.keys(h)) if (!known.has(key)) problems.push({ path: `${path}.${key}`, key: 'errField', values: { field: key } });
  for (const f of fields) {
    const name = f.replace('?', '');
    const optional = f.endsWith('?');
    const value = h[name];
    if (value === undefined) {
      if (!optional) problems.push({ path: `${path}.${name}`, key: 'errMissing', values: { field: name } });
      continue;
    }
    const words = WORDS[`${type}.${name}`] ?? WORDS[name];
    if (words) {
      if (typeof value !== 'string' || !words.includes(value)) problems.push({ path: `${path}.${name}`, key: 'errWord', values: { allowed: words.join(', ') } });
    } else if (name === 'chain') {
      if (typeof value !== 'boolean') problems.push({ path: `${path}.${name}`, key: 'errBoolean' });
    } else if (name === 'move') {
      const m = value;
      if (!palette.moving) problems.push({ path: `${path}.move`, key: 'errNoMove' });
      if (!isObject(m) || !isNumber(m.dx) || !isNumber(m.dy) || !isNumber(m.every) || m.every <= 0 || (m.phase !== undefined && !isNumber(m.phase))) problems.push({ path: `${path}.move`, key: 'errMove' });
    } else if (!isNumber(value)) problems.push({ path: `${path}.${name}`, key: 'errNumber', values: { field: name } });
    else if ((name === 'x' || name === 'from' || name === 'to') && (value < 0 || value > length)) problems.push({ path: `${path}.${name}`, key: 'errInside', values: { length } });
    else if (name === 'y' && (value < -1.5 || value > 13.5)) problems.push({ path: `${path}.y`, key: 'errHeight' });
    else if ((name === 'count' && (value < 1 || value > 40 || !Number.isInteger(value))) || ((name === 'w' || name === 'h' || name === 'r') && (value <= 0 || value > 12))) problems.push({ path: `${path}.${name}`, key: 'errSize', values: { field: name } });
  }
  if ((type === 'spike' || type === 'halfSpike') && h.on === undefined && h.y === undefined) problems.push({ path, key: 'errSpikePlace' });
  if ((type === 'dark' || type === 'invert') && isNumber(h.from) && isNumber(h.to) && h.to <= h.from) problems.push({ path: `${path}.to`, key: 'errRange' });
}
