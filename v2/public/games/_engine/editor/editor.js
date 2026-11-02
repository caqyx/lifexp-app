// @ts-check
// The Rush level editor (docs/v2/PLAN.md 9.1, stages r-3 and r-4), shared by the three
// games: each game's editor.html runs it with its own palette (vehicles, items, tiers,
// look). A level is a list of sections in the games' own section data; the board shows the
// whole level as one strip, painted as the game paints it, with the sections' borders.
//
// Tap with a tool to place its item anywhere (snapped to the grid: 1, ½, ¼ cell or free);
// with "Zaznacz" tap an item to select it (Shift adds), drag it to move it, drag on empty
// board to move the view, Shift-drag (or the "Obszar" tool) to select a box. The selection
// can be turned, mirrored, scaled, nudged, copied, pasted, duplicated and deleted (the
// keyboard too: arrows, Delete, Ctrl+C / V / D). "Testuj" plays the level in practice, from
// the start or from a section; "Zweryfikuj" asks its maker to finish it from the start in
// normal mode with no checkpoints — then the level is verified until it is changed.
// Export (a file and the text, with `verified`), import (checked, every problem named) and
// a few saves in this browser.
import { JOINT, VIEW_H } from '../world.js';
import { buildGeometry, movedAt, profileY } from '../geometry.js';
import { paintSection } from '../render/section.js';
import { drawMine, drawOrb, drawPortal, drawSaw } from '../render/sprites.js';
import { changedLevel, emptyLevel, emptySection, fromJson, playHash, toJson } from './format.js';
import { editorTranslator, pickLang } from './i18n.js';
import { canOf, itemBox, itemFor, keepInside, moveItem, pickItem, placeOf, shiftX, snapTo, transformItem } from './items.js';
import { keysFor, readJson, writeJson } from '../records.js';

/**
 * @typedef {import('./format.js').Level} Level
 * @typedef {import('./format.js').Palette} Palette
 * @typedef {import('./items.js').Item} Item
 * @typedef {import('./items.js').Change} Change
 * @typedef {import('../geometry.js').SectionData} SectionData
 * @typedef {import('../geometry.js').Booster} Booster
 * @typedef {import('../sectors.js').SectorDef} SectorDef
 * @typedef {import('../render/section.js').SurfaceTheme} Theme
 * @typedef {{
 *   palette: Palette, title: string, prefix: string,
 *   sectors: SectorDef[], finale: SectorDef | null, library: Record<number, SectionData[]>,
 *   themeOf: (id: string) => Theme, tools: string[],
 *   drawBooster?: (ctx: CanvasRenderingContext2D, booster: Booster, x: number, y: number, cell: number) => void,
 * }} EditorDef
 *   prefix: the game's storage prefix (its saves); tools: the item tools this game has;
 *   drawBooster: the game's own drawing of an orb or a pad (Flip Rush).
 * @typedef {{ s: number, i: number }} Ref an item: its section and its place in the section's list
 */

export { itemFor, pickItem } from './items.js';

const SLOTS = 5;
const HISTORY = 100;
/** Grid steps (0: free). */
const GRIDS = [1, 0.5, 0.25, 0];
/** Turn steps for the angle field. */
const TURN_STEPS = [15, 90, 1];

/** The options each tool shows, and their choices. */
const OPTIONS = /** @type {Record<string, { key: 'optCount' | 'optSize' | 'optKind', name: string, choices: (string | number)[] }[]>} */ ({
  spike: [{ key: 'optCount', name: 'count', choices: [1, 2, 3, 4, 6] }],
  block: [{ key: 'optSize', name: 'size', choices: ['1×1', '2×1', '3×0.8', '4×0.8', '2×3'] }],
  pillar: [{ key: 'optSize', name: 'h', choices: [2, 2.5, 3, 3.5, 4] }],
  saw: [{ key: 'optSize', name: 'r', choices: [0.6, 0.8, 1, 1.2] }],
  mine: [{ key: 'optSize', name: 'r', choices: [0.5, 0.6, 0.7] }],
  orb: [{ key: 'optSize', name: 'r', choices: [0.8, 1, 1.1] }],
  ring: [{ key: 'optKind', name: 'kind', choices: ['jump', 'small', 'gravity', 'gravityJump', 'dash'] }],
  pad: [{ key: 'optKind', name: 'kind', choices: ['jump', 'small', 'gravity'] }],
  speed: [{ key: 'optKind', name: 'k', choices: ['slow', 'normal', 'fast', 'veryFast'] }],
});
/** Tools whose items can move. */
const MOVABLE = new Set(['saw', 'mine', 'orb']);
const TOOL_KEYS = /** @type {const} */ ({
  select: 'toolSelect', box: 'toolBox', erase: 'toolErase', spike: 'toolSpike', block: 'toolBlock', pillar: 'toolPillar', saw: 'toolSaw', mine: 'toolMine',
  orb: 'toolOrb', ring: 'toolRing', pad: 'toolPad', flip: 'toolFlip', mini: 'toolMini', big: 'toolBig', speed: 'toolSpeed', dark: 'toolDark', invert: 'toolInvert',
});

/**
 * Runs the editor on its page.
 * @param {EditorDef} def
 */
export function runEditor(def) {
  const lang = pickLang(location.search);
  const t = editorTranslator(lang);
  document.documentElement.lang = lang;
  const storage = safeStorage(() => localStorage);
  const session = safeStorage(() => sessionStorage);
  // Every key is the game's own (records.js): its saves, and in this tab the level being
  // edited (kept while the game plays it), the level left for the game to play and the
  // game's word that the level was finished in a verification.
  const KEYS = keysFor(def.prefix);

  /** @param {string} id @returns {HTMLElement} */
  const $ = (id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`#${id} missing`);
    return el;
  };
  /** @param {string} id */
  const input = (id) => /** @type {HTMLInputElement} */ ($(id));
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(/** @type {any} */ (el.getAttribute('data-t')));
  for (const el of document.querySelectorAll('[data-label]')) el.setAttribute('aria-label', t(/** @type {any} */ (el.getAttribute('data-label'))));
  for (const el of document.querySelectorAll('[data-title]')) el.setAttribute('title', t(/** @type {any} */ (el.getAttribute('data-title'))));
  $('ed-game').textContent = def.title;

  const canvas = /** @type {HTMLCanvasElement} */ ($('ed-canvas'));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  canvas.setAttribute('aria-label', t('canvasLabel'));

  const state = {
    level: readWork() ?? emptyLevel(def.palette, t('untitled')),
    /** The section the section bar shows (the one in the middle of the view). */
    index: 0,
    tool: 'select',
    /** @type {Record<string, string | number | boolean>} */
    opt: {},
    camX: -2,
    zoom: 1,
    grid: 1,
    turnStep: 15,
    /** @type {Ref[]} */
    sel: [],
    /** @type {{ item: Item, dx: number }[]} copied items, x from the copy's left */
    clip: [],
    /** @type {string[]} */
    undo: [],
    /** @type {string[]} */
    redo: [],
    /** @type {[number, number, number, number] | null} a box being dragged out (world) */
    band: null,
  };
  acceptVerification();
  /** @type {Map<string, { canvas: HTMLCanvasElement, left: number, top: number }>} */
  const painted = new Map();

  // ── Level changes, with undo ────────────────────────────────────────────────

  /**
   * One change, undoable. Any change but the name's takes the verification away.
   * @param {(level: Level) => void} change @param {{ keepVerified?: boolean, from?: string }} [how]
   *   from: the level before (a drag changes the level as it goes, then is one step)
   */
  function edit(change, how = {}) {
    state.undo.push(how.from ?? JSON.stringify(state.level));
    if (state.undo.length > HISTORY) state.undo.shift();
    state.redo = [];
    const next = changedLevel(state.level, change, how);
    state.level = next;
    state.index = Math.min(state.index, next.sections.length - 1);
    saveWork();
    refresh();
  }

  /** @param {'undo' | 'redo'} which */
  function travel(which) {
    const from = which === 'undo' ? state.undo : state.redo;
    const to = which === 'undo' ? state.redo : state.undo;
    const prev = from.pop();
    if (!prev) return;
    to.push(JSON.stringify(state.level));
    state.level = JSON.parse(prev);
    state.index = Math.min(state.index, state.level.sections.length - 1);
    state.sel = state.sel.filter((r) => state.level.sections[r.s]?.hazards[r.i]);
    saveWork();
    refresh();
  }

  const current = () => /** @type {SectionData} */ (state.level.sections[state.index]);

  function saveWork() {
    writeJson(session, KEYS.editorWork, JSON.parse(toJson(state.level)));
  }

  /** @returns {Level | null} */
  function readWork() {
    const raw = readJson(safeStorage(() => sessionStorage), keysFor(def.prefix).editorWork);
    return raw ? fromJson(JSON.stringify(raw), def.palette).level : null;
  }

  /** Back from a verification: the game left word that the level was finished. */
  function acceptVerification() {
    const word = /** @type {any} */ (readJson(session, KEYS.editorVerified));
    if (!word) return;
    try {
      session?.removeItem(KEYS.editorVerified);
    } catch {
      // Storage blocked: the word stays, harmless (it names this level only).
    }
    if (word.game === def.palette.id && word.hash === playHash(state.level) && !state.level.verified) {
      state.level = { ...state.level, verified: true };
      saveWork();
      window.setTimeout(() => toast(t('verifiedToast')), 50);
    }
  }

  // ── The strip: every section side by side ───────────────────────────────────

  /** Each section's start on the strip. */
  function offsets() {
    let x = 0;
    return state.level.sections.map((s) => {
      const o = x;
      x += s.length;
      return o;
    });
  }
  const totalLength = () => state.level.sections.reduce((n, s) => n + s.length, 0);

  /** The section at strip x (the nearest end beyond the strip). @param {number} wx */
  function sectionAt(wx) {
    const offs = offsets();
    for (let i = offs.length - 1; i >= 0; i--) if (wx >= /** @type {number} */ (offs[i])) return i;
    return 0;
  }

  /** @param {Ref} r */
  const itemOf = (r) => /** @type {Item} */ (/** @type {SectionData} */ (state.level.sections[r.s]).hazards[r.i]);

  /** An item's box on the strip. @param {Ref} r @returns {[number, number, number, number]} */
  function worldBox(r) {
    const s = /** @type {SectionData} */ (state.level.sections[r.s]);
    const o = /** @type {number} */ (offsets()[r.s]);
    const [x0, y0, x1, y1] = itemBox(itemOf(r), s);
    return [x0 + o, y0, x1 + o, y1];
  }

  /** The item at strip (x, y), or null. @param {number} wx @param {number} y @returns {Ref | null} */
  function refAt(wx, y) {
    const s = sectionAt(wx);
    // An item may hang over its section's end: look in the neighbours too.
    for (const k of [s, s - 1, s + 1]) {
      const section = state.level.sections[k];
      if (!section) continue;
      const i = pickItem(section, wx - /** @type {number} */ (offsets()[k]), y);
      if (i >= 0) return { s: k, i };
    }
    return null;
  }

  const isSelected = (/** @type {Ref} */ r) => state.sel.some((q) => q.s === r.s && q.i === r.i);

  // ── The board ───────────────────────────────────────────────────────────────

  function cellSize() {
    return (canvas.height / VIEW_H) * state.zoom;
  }
  /** @param {number} x */
  const X = (x) => (x - state.camX) * cellSize();
  /** @param {number} y */
  const Y = (y) => canvas.height / 2 + (y - 6) * cellSize();
  /** @param {number} px @param {number} py */
  const toWorld = (px, py) => ({ x: px / cellSize() + state.camX, y: (py - canvas.height / 2) / cellSize() + 6 });

  function resize() {
    const r = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * ratio));
    canvas.height = Math.max(1, Math.round(r.height * ratio));
    painted.clear();
    draw();
  }

  function themeId() {
    const sector = def.sectors.find((s) => s.tier === state.level.tier) ?? def.sectors.find((s) => s.bands?.some((b) => b.tier === state.level.tier));
    const band = sector?.bands?.find((b) => b.tier === state.level.tier);
    return band?.theme ?? sector?.theme ?? def.finale?.theme ?? /** @type {SectorDef} */ (def.sectors[0]).theme;
  }

  /** The move handle's place (screen px) under the selection, or null. */
  function handleAt() {
    if (!state.sel.length) return null;
    const boxes = state.sel.map(worldBox);
    const x = (Math.min(...boxes.map((b) => b[0])) + Math.max(...boxes.map((b) => b[2]))) / 2;
    const y = Math.max(...boxes.map((b) => b[3]));
    const c = cellSize();
    return { x: X(x), y: Math.min(canvas.height - c * 0.6, Y(y) + c * 0.9), r: Math.max(16, c * 0.45) };
  }

  function draw() {
    const c = cellSize();
    const th = def.themeOf(themeId());
    ctx.fillStyle = '#0b0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const offs = offsets();
    const left = state.camX - 1;
    const right = state.camX + canvas.width / c + 1;
    const used = new Set();
    state.level.sections.forEach((s, k) => {
      const o = /** @type {number} */ (offs[k]);
      if (o > right || o + s.length < left) return;
      drawSection(s, k, o, c, th, used);
    });
    for (const key of painted.keys()) if (!used.has(key)) painted.delete(key);
    drawGrid(c, left, right);
    // Section borders and numbers.
    ctx.lineWidth = Math.max(2, c * 0.08);
    state.level.sections.forEach((s, k) => {
      const o = /** @type {number} */ (offs[k]);
      ctx.strokeStyle = k === state.index ? 'rgba(255, 214, 102, 0.9)' : 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.moveTo(X(o), Y(-1.5));
      ctx.lineTo(X(o), Y(13.5));
      ctx.stroke();
      ctx.fillStyle = k === state.index ? '#ffd666' : 'rgba(255, 255, 255, 0.75)';
      ctx.font = `700 ${Math.max(11, c * 0.38)}px system-ui, sans-serif`;
      ctx.fillText(`${t('sectionWord')} ${k + 1}`, X(o) + 6, Y(-0.9));
      if (k === state.level.sections.length - 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.moveTo(X(o + s.length), Y(-1.5));
        ctx.lineTo(X(o + s.length), Y(13.5));
        ctx.stroke();
      }
    });
    drawSelection(c);
  }

  /**
   * One section on the strip: painted as the game paints it, then what moves or is drawn
   * per frame in the game (round hazards, portals, stretches, orbs and pads).
   * @param {SectionData} s @param {number} k @param {number} o @param {number} c @param {Theme} th @param {Set<string>} used
   */
  function drawSection(s, k, o, c, th, used) {
    /** @type {import('../geometry.js').Geometry} */
    let g;
    try {
      g = buildGeometry(s);
    } catch {
      return;
    }
    const key = `${k}@${JSON.stringify(s)}@${c}@${th.id}`;
    used.add(key);
    let p = painted.get(key);
    if (!p) {
      p = paintSection(g, th, /** @type {any} */ ({ cell: c }));
      painted.set(key, p);
    }
    ctx.drawImage(p.canvas, X(o + p.left), Y(p.top));
    // The joints: the next section starts here.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(X(o), 0, JOINT.lead * c, canvas.height);
    ctx.fillRect(X(o + s.length - JOINT.lead), 0, JOINT.lead * c, canvas.height);
    for (const h of g.hazards) {
      if (h.shape !== 'circle') continue;
      if (h.move) {
        const a = movedAt(h, -h.move.every / 4 - (h.move.phase ?? 0) * h.move.every);
        const b = movedAt(h, h.move.every / 4 - (h.move.phase ?? 0) * h.move.every);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = Math.max(1, c * 0.05);
        ctx.setLineDash([c * 0.2, c * 0.2]);
        ctx.beginPath();
        ctx.moveTo(X(o + a.x), Y(a.y));
        ctx.lineTo(X(o + b.x), Y(b.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const paint = h.type === 'saw' ? drawSaw : h.type === 'mine' ? drawMine : drawOrb;
      paint(ctx, X(o + h.x), Y(h.y), h.r * c, ((h.rot ?? 0) * Math.PI) / 180, th, 0);
    }
    for (const p2 of g.portals) {
      const top = p2.y0 ?? profileY(g.ceil, p2.x, 'ceil');
      const bottom = p2.y1 ?? profileY(g.floor, p2.x, 'floor');
      /** @type {any} */
      const look = p2.kind === 'flip' ? { kind: 'flip', on: true } : { kind: 'mini', on: p2.kind === 'mini' };
      drawPortal(ctx, X(o + p2.x), Y(top + 0.25), Y(bottom - 0.25), c, look, 0, true);
    }
    for (const sp of g.speeds) {
      drawPortal(ctx, X(o + sp.x), Y(profileY(g.ceil, sp.x, 'ceil') + 0.25), Y(profileY(g.floor, sp.x, 'floor') - 0.25), c, /** @type {any} */ ({ kind: 'speed', on: false, speed: sp.k }), 0, true);
    }
    for (const [list, color, word] of /** @type {const} */ ([[g.dark, 'rgba(0, 0, 0, 0.45)', 'toolDark'], [g.invert, 'rgba(255, 60, 200, 0.18)', 'toolInvert']])) {
      for (const r of list) {
        ctx.fillStyle = color;
        ctx.fillRect(X(o + r.from), Y(JOINT.ceil), (r.to - r.from) * c, (JOINT.floor - JOINT.ceil) * c);
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(11, c * 0.4)}px system-ui, sans-serif`;
        ctx.fillText(t(word), X(o + r.from) + 4, Y(JOINT.ceil) + c * 0.6);
      }
    }
    for (const b of g.boosters) def.drawBooster?.(ctx, b, X(o + b.x), Y(b.y), c);
  }

  /** The grid at its step (every cell brighter, every fifth with its x on the strip). @param {number} c @param {number} left @param {number} right */
  function drawGrid(c, left, right) {
    const step = state.grid > 0 ? state.grid : 1;
    const end = totalLength();
    ctx.lineWidth = 1;
    for (let x = Math.max(0, Math.floor(left / step) * step); x <= Math.min(end, right); x += step) {
      const whole = Math.abs(x - Math.round(x)) < 1e-9;
      ctx.strokeStyle = whole && Math.round(x) % 5 === 0 ? 'rgba(255, 255, 255, 0.22)' : whole ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.035)';
      ctx.beginPath();
      ctx.moveTo(X(x), Y(-1));
      ctx.lineTo(X(x), Y(13));
      ctx.stroke();
    }
    for (let y = -1; y <= 13 + 1e-9; y += step) {
      const whole = Math.abs(y - Math.round(y)) < 1e-9;
      ctx.strokeStyle = whole ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.moveTo(X(Math.max(0, left)), Y(y));
      ctx.lineTo(X(Math.min(end, right)), Y(y));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `${Math.max(10, c * 0.32)}px system-ui, sans-serif`;
    for (let x = Math.max(0, Math.ceil(left / 5) * 5); x <= Math.min(end, right); x += 5) ctx.fillText(String(x), X(x) + 3, Y(13.4));
  }

  /** The selection's boxes, its move handle and a box being dragged out. @param {number} c */
  function drawSelection(c) {
    ctx.lineWidth = Math.max(2, c * 0.06);
    ctx.strokeStyle = '#4dd2ff';
    ctx.setLineDash([c * 0.18, c * 0.12]);
    for (const r of state.sel) {
      const [x0, y0, x1, y1] = worldBox(r);
      ctx.strokeRect(X(x0) - 3, Y(y0) - 3, X(x1) - X(x0) + 6, Y(y1) - Y(y0) + 6);
    }
    ctx.setLineDash([]);
    const h = handleAt();
    if (h) {
      ctx.fillStyle = 'rgba(77, 210, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();
      // A four-way arrow: drag here to move the selection.
      ctx.strokeStyle = '#06202b';
      ctx.lineWidth = Math.max(2, h.r * 0.14);
      const a = h.r * 0.6;
      ctx.beginPath();
      ctx.moveTo(h.x - a, h.y);
      ctx.lineTo(h.x + a, h.y);
      ctx.moveTo(h.x, h.y - a);
      ctx.lineTo(h.x, h.y + a);
      for (const [dx, dy] of /** @type {[number, number][]} */ ([[1, 0], [-1, 0], [0, 1], [0, -1]])) {
        const tx = h.x + dx * a;
        const ty = h.y + dy * a;
        ctx.moveTo(tx - dy * a * 0.35 - dx * a * 0.35, ty - dx * a * 0.35 - dy * a * 0.35);
        ctx.lineTo(tx, ty);
        ctx.lineTo(tx + dy * a * 0.35 - dx * a * 0.35, ty + dx * a * 0.35 - dy * a * 0.35);
      }
      ctx.stroke();
    }
    if (state.band) {
      const [x0, y0, x1, y1] = state.band;
      ctx.fillStyle = 'rgba(77, 210, 255, 0.12)';
      ctx.strokeStyle = '#4dd2ff';
      ctx.lineWidth = 1.5;
      ctx.fillRect(X(Math.min(x0, x1)), Y(Math.min(y0, y1)), Math.abs(X(x1) - X(x0)), Math.abs(Y(y1) - Y(y0)));
      ctx.strokeRect(X(Math.min(x0, x1)), Y(Math.min(y0, y1)), Math.abs(X(x1) - X(x0)), Math.abs(Y(y1) - Y(y0)));
    }
  }

  // ── Selection changes ───────────────────────────────────────────────────────

  /** The selected items, each on the strip (x from the strip's start). */
  function selectedOnStrip() {
    const offs = offsets();
    return state.sel.map((r) => shiftX(itemOf(r), /** @type {number} */ (offs[r.s])));
  }

  /**
   * Puts items given on the strip into the sections their middles are in (an item moved
   * past a border changes section) and selects them.
   * @param {Level} level @param {Item[]} items
   */
  function placeOnStrip(level, items) {
    let x = 0;
    const offs = level.sections.map((s) => {
      const o = x;
      x += s.length;
      return o;
    });
    const end = x;
    /** @type {Ref[]} */
    const refs = [];
    for (const item of items) {
      const s0 = level.sections[0];
      if (!s0) break;
      const [bx0, , bx1] = itemBox(item, { ...s0, length: end, ceil: `${JOINT.ceil} r${end}`, floor: `${JOINT.floor} r${end}` });
      const mid = Math.min(end - 1e-6, Math.max(0, (bx0 + bx1) / 2));
      let k = 0;
      for (let i = offs.length - 1; i >= 0; i--) {
        if (mid >= /** @type {number} */ (offs[i])) {
          k = i;
          break;
        }
      }
      const section = /** @type {SectionData} */ (level.sections[k]);
      section.hazards.push(keepInside(shiftX(item, -(/** @type {number} */ (offs[k]))), section.length));
      refs.push({ s: k, i: section.hazards.length - 1 });
    }
    return refs;
  }

  /** Takes the selected items out of a level (copy). @param {Level} level */
  function removeSelected(level) {
    const order = [...state.sel].sort((a, b) => b.s - a.s || b.i - a.i);
    for (const r of order) /** @type {SectionData} */ (level.sections[r.s]).hazards.splice(r.i, 1);
  }

  /**
   * Moves the selection by (dx, dy) cells, from the level `base` (a drag starts there).
   * @param {number} dx @param {number} dy @param {{ from?: string, refs?: Ref[] }} [how]
   */
  function moveSelection(dx, dy, how = {}) {
    if (!state.sel.length) return;
    const offs = offsets();
    const moved = state.sel.map((r) => {
      const s = /** @type {SectionData} */ (state.level.sections[r.s]);
      return shiftX(moveItem(itemOf(r), dx, dy, s), /** @type {number} */ (offs[r.s]));
    });
    /** @type {Ref[]} */
    let refs = [];
    edit(
      (l) => {
        removeSelected(l);
        refs = placeOnStrip(l, moved);
      },
      how.from ? { from: how.from } : {},
    );
    state.sel = refs;
    refresh();
  }

  /** @param {Change} change */
  function transformSelection(change) {
    if (!state.sel.length) return;
    const refs = state.sel;
    edit((l) => {
      for (const r of refs) {
        const s = /** @type {SectionData} */ (l.sections[r.s]);
        s.hazards[r.i] = transformItem(/** @type {Item} */ (s.hazards[r.i]), change, s);
      }
    });
  }

  function deleteSelection() {
    if (!state.sel.length) return;
    edit((l) => removeSelected(l));
    state.sel = [];
    refresh();
  }

  function copySelection() {
    if (!state.sel.length) return;
    const items = selectedOnStrip();
    const left = Math.min(...state.sel.map((r) => worldBox(r)[0]));
    state.clip = items.map((item) => ({ item: shiftX(item, -left), dx: 0 }));
    toast(t('copiedItems', { count: items.length }));
    refreshInspector();
  }

  /** Pastes the copied items: their left at the middle of the view. */
  function paste() {
    if (!state.clip.length) return;
    const at = snapTo(state.camX + canvas.width / cellSize() / 2, state.grid || 0.25);
    const items = state.clip.map((c) => shiftX(c.item, at));
    /** @type {Ref[]} */
    let refs = [];
    edit((l) => (refs = placeOnStrip(l, items)));
    state.sel = refs;
    refresh();
  }

  function duplicate() {
    if (!state.sel.length) return;
    const step = state.grid || 0.25;
    const items = selectedOnStrip().map((item) => shiftX(item, step));
    /** @type {Ref[]} */
    let refs = [];
    edit((l) => (refs = placeOnStrip(l, items)));
    state.sel = refs;
    refresh();
  }

  /** The step for nudges: the grid, or a tenth of a cell with none. */
  const nudgeStep = () => state.grid || 0.1;

  // ── Pointer: tap, drag, box, pinch ──────────────────────────────────────────

  /** @type {Map<number, { x: number, y: number, x0: number, y0: number }>} */
  const pointers = new Map();
  /**
   * What the drag does: move the selection (from the level as it was), pan, or draw a box.
   * refs: the selection when the drag began; pushed: the drag has its undo step.
   * @type {{ kind: 'move' | 'pan' | 'box' | 'none', from: string, start: { x: number, y: number }, last: { dx: number, dy: number }, moved: boolean, hit: Ref | null, shift: boolean, refs: Ref[] | null, pushed: boolean }}
   */
  let drag = { kind: 'none', from: '', start: { x: 0, y: 0 }, last: { dx: 0, dy: 0 }, moved: false, hit: null, shift: false, refs: null, pushed: false };
  let pinch = 0;

  const ratioNow = () => canvas.width / canvas.getBoundingClientRect().width;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY, x0: e.offsetX, y0: e.offsetY });
    if (pointers.size === 2) {
      // Two fingers: zoom (whatever the first one started is dropped).
      if (drag.kind === 'move' && drag.moved) travelBack();
      drag.kind = 'none';
      state.band = null;
      pinch = spread();
      return;
    }
    if (pointers.size > 2) return;
    const ratio = ratioNow();
    const px = e.offsetX * ratio;
    const py = e.offsetY * ratio;
    const w = toWorld(px, py);
    const h = handleAt();
    const hit = refAt(w.x, w.y);
    const shift = e.shiftKey || e.ctrlKey || e.metaKey;
    drag = { kind: 'pan', from: JSON.stringify(state.level), start: w, last: { dx: 0, dy: 0 }, moved: false, hit, shift, refs: null, pushed: false };
    if (h && Math.hypot(px - h.x, py - h.y) <= h.r * 1.2) drag.kind = 'move';
    else if (state.tool === 'erase') drag.kind = 'pan';
    else if (hit && isSelected(hit) && !shift) drag.kind = 'move';
    else if (hit && state.tool === 'select') {
      // Select it now, so a drag moves it straight away; Shift adds it (or takes it out).
      if (shift) state.sel = isSelected(hit) ? state.sel.filter((r) => r.s !== hit.s || r.i !== hit.i) : [...state.sel, hit];
      else state.sel = [hit];
      drag.kind = isSelected(hit) ? 'move' : 'none';
      refreshInspector();
      draw();
    } else if (state.tool === 'box' || (shift && (state.tool === 'select' || !hit))) drag.kind = 'box';
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const ratio = ratioNow();
    if (pointers.size === 2) {
      p.x = e.offsetX;
      p.y = e.offsetY;
      const now = spread();
      if (pinch > 0) zoomBy(now / pinch, e.offsetX * ratio);
      pinch = now;
      return;
    }
    if (Math.hypot(e.offsetX - p.x0, e.offsetY - p.y0) > 6) drag.moved = true;
    const w = toWorld(e.offsetX * ratio, e.offsetY * ratio);
    if (drag.moved) {
      if (drag.kind === 'pan') {
        state.camX -= ((e.offsetX - p.x) * ratio) / cellSize();
        followView();
      } else if (drag.kind === 'box') {
        state.band = [drag.start.x, drag.start.y, w.x, w.y];
        draw();
      } else if (drag.kind === 'move') dragMove(w);
    }
    p.x = e.offsetX;
    p.y = e.offsetY;
  });

  /** The selection follows the pointer, snapped: its first item's place lands on the grid. @param {{ x: number, y: number }} w */
  function dragMove(w) {
    const first = state.sel[0];
    if (!first) return;
    const base = /** @type {Level} */ (JSON.parse(drag.from));
    const s = /** @type {SectionData} */ (base.sections[first.s]);
    const item = /** @type {Item | undefined} */ (s?.hazards[first.i]);
    if (!item) return;
    const at = placeOf(item, s);
    const dx = tidyStep(snapTo(at.x + w.x - drag.start.x, state.grid) - at.x);
    const dy = at.y === undefined ? 0 : tidyStep(snapTo(at.y + w.y - drag.start.y, state.grid) - at.y);
    if (dx === drag.last.dx && dy === drag.last.dy) return;
    drag.last = { dx, dy };
    // Always from the level as it was when the drag began: one undo step for the whole drag.
    const refs = drag.refs ?? state.sel;
    drag.refs = refs;
    state.level = base;
    state.sel = refs;
    if (drag.pushed) state.undo.pop();
    moveSelection(dx, dy, { from: drag.from });
    drag.pushed = true;
  }

  /** A drag cut short by a second finger: back to where it began. */
  function travelBack() {
    state.level = JSON.parse(drag.from);
    if (drag.refs) state.sel = drag.refs;
    if (drag.pushed) state.undo.pop();
    drag.pushed = false;
    saveWork();
    refresh();
  }

  const up = (/** @type {PointerEvent} */ e) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size > 0) return;
    if (!p || e.type === 'pointercancel') {
      state.band = null;
      drag.kind = 'none';
      draw();
      return;
    }
    if (drag.kind === 'box' && drag.moved && state.band) {
      selectBox(state.band, drag.shift);
      state.band = null;
      refresh();
    } else if (!drag.moved) {
      const ratio = ratioNow();
      tapAt(toWorld(p.x0 * ratio, p.y0 * ratio), drag);
    }
    drag.kind = 'none';
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const ratio = ratioNow();
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        state.camX += ((e.shiftKey ? e.deltaY : e.deltaX) * ratio) / cellSize();
        followView();
      } else zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.offsetX * ratio);
    },
    { passive: false },
  );

  function spread() {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  /** @param {number} factor @param {number} px device px the zoom keeps in place */
  function zoomBy(factor, px) {
    const at = toWorld(px, 0).x;
    state.zoom = Math.min(4, Math.max(0.35, state.zoom * factor));
    state.camX = at - px / cellSize();
    painted.clear();
    followView();
  }

  /** The section bar follows the section in the middle of the view. */
  function followView() {
    const mid = sectionAt(state.camX + canvas.width / cellSize() / 2);
    if (mid !== state.index) {
      state.index = mid;
      refresh();
    } else draw();
  }

  /** Selects the items whose boxes meet a box on the strip. @param {[number, number, number, number]} band @param {boolean} add */
  function selectBox(band, add) {
    const x0 = Math.min(band[0], band[2]);
    const x1 = Math.max(band[0], band[2]);
    const y0 = Math.min(band[1], band[3]);
    const y1 = Math.max(band[1], band[3]);
    /** @type {Ref[]} */
    const found = [];
    state.level.sections.forEach((s, k) => {
      s.hazards.forEach((_, i) => {
        const b = worldBox({ s: k, i });
        if (b[0] <= x1 && b[2] >= x0 && b[1] <= y1 && b[3] >= y0) found.push({ s: k, i });
      });
    });
    state.sel = add ? [...state.sel, ...found.filter((r) => !isSelected(r))] : found;
  }

  /** @param {{ x: number, y: number }} w @param {typeof drag} how */
  function tapAt(w, how) {
    const total = totalLength();
    if (state.tool === 'select' || state.tool === 'box') {
      if (!how.hit && !how.shift) {
        state.sel = [];
        refresh();
      }
      return;
    }
    if (w.x < 0 || w.x > total) return;
    const k = sectionAt(w.x);
    const o = /** @type {number} */ (offsets()[k]);
    const s = /** @type {SectionData} */ (state.level.sections[k]);
    if (state.tool === 'erase') {
      if (!how.hit) return;
      const hit = how.hit;
      edit((l) => /** @type {SectionData} */ (l.sections[hit.s]).hazards.splice(hit.i, 1));
      state.sel = [];
      refresh();
      return;
    }
    if (how.hit && isSelected(how.hit)) return;
    const item = itemFor(state.tool, state.opt, w.x - o, w.y, s, state.grid);
    if (!item) return;
    edit((l) => /** @type {SectionData} */ (l.sections[k]).hazards.push(item));
    // The new item is selected: turn it, mirror it or scale it straight away.
    state.sel = [{ s: k, i: s.hazards.length }];
    state.index = k;
    refresh();
  }

  // ── Tools and their options ─────────────────────────────────────────────────

  function buildTools() {
    const list = $('ed-tools');
    list.replaceChildren();
    for (const tool of ['select', 'box', 'erase', ...def.tools]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ed-tool';
      b.dataset.tool = tool;
      b.textContent = t(TOOL_KEYS[/** @type {keyof typeof TOOL_KEYS} */ (tool)]);
      b.setAttribute('aria-pressed', String(tool === state.tool));
      b.addEventListener('click', () => {
        state.tool = tool;
        buildTools();
        buildOptions();
      });
      list.append(b);
    }
  }

  function buildOptions() {
    const box = $('ed-options');
    box.replaceChildren();
    for (const o of OPTIONS[state.tool] ?? []) {
      const label = document.createElement('label');
      label.className = 'ed-field';
      label.append(t(o.key));
      const select = document.createElement('select');
      select.dataset.option = o.name;
      for (const c of o.choices) {
        const option = document.createElement('option');
        option.value = String(c);
        option.textContent = typeof c === 'number' ? String(c) : o.name === 'kind' ? t(/** @type {any} */ (`kind_${c}`)) : o.name === 'k' ? t(/** @type {any} */ (`speed_${c}`)) : c;
        select.append(option);
      }
      select.value = String(state.opt[o.name] ?? o.choices[o.name === 'kind' || o.name === 'k' ? 0 : Math.min(1, o.choices.length - 1)]);
      state.opt[o.name] = typeof o.choices[0] === 'number' ? Number(select.value) : select.value;
      select.addEventListener('change', () => (state.opt[o.name] = typeof o.choices[0] === 'number' ? Number(select.value) : select.value));
      label.append(select);
      box.append(label);
    }
    if (def.palette.moving && MOVABLE.has(state.tool)) {
      const label = document.createElement('label');
      label.className = 'ed-field';
      const box2 = document.createElement('input');
      box2.type = 'checkbox';
      box2.dataset.option = 'move';
      box2.checked = state.opt.move === true;
      box2.addEventListener('change', () => (state.opt.move = box2.checked));
      label.append(box2, t('optMove'));
      box.append(label);
    }
  }

  // ── The inspector: the selection's place, turn, mirror and scale ────────────

  function refreshInspector() {
    // Always shown (the board keeps its size); with nothing selected, everything is off.
    const items = state.sel.map(itemOf);
    document.body.dataset.selected = String(items.length);
    for (const el of $('ed-inspector').querySelectorAll('button, input, select')) /** @type {HTMLButtonElement} */ (el).disabled = items.length === 0;
    /** @type {HTMLButtonElement} */ ($('ed-paste')).disabled = state.clip.length === 0;
    /** @type {HTMLSelectElement} */ ($('ed-rot-step')).disabled = false;
    if (!items.length) {
      $('ed-sel-count').textContent = t('nothingSelected');
      for (const id of ['ed-x', 'ed-y', 'ed-rot', 'ed-scale', 'ed-sx', 'ed-sy']) if (document.activeElement !== $(id)) input(id).value = '';
      $('ed-gate-field').hidden = true;
      return;
    }
    const one = items.length === 1 ? /** @type {Item} */ (items[0]) : null;
    $('ed-sel-count').textContent = one ? t(/** @type {any} */ (TOOL_KEYS[/** @type {keyof typeof TOOL_KEYS} */ (toolOf(one))] ?? 'toolSelect')) : t('selectedCount', { count: items.length });
    const cans = items.map(canOf);
    const turn = cans.some((c) => c.turn);
    const flipX = cans.some((c) => c.flipX);
    const flipY = cans.some((c) => c.flipY);
    const scale = cans.some((c) => c.scale && c.scale !== 'y') || items.some((i) => i.type === 'portal' && /** @type {any} */ (i).y !== undefined);
    const perAxis = cans.some((c) => c.scale === 'xy') || items.some((i) => i.type === 'portal');
    /** @type {Record<string, any>} */
    const a = one ?? {};
    const at = one ? placeOf(one, /** @type {SectionData} */ (state.level.sections[/** @type {Ref} */ (state.sel[0]).s])) : null;
    const offs = offsets();
    setField('ed-x', at ? String(Number((at.x + /** @type {number} */ (offs[/** @type {Ref} */ (state.sel[0]).s])).toFixed(3))) : '', !one);
    setField('ed-y', at && at.y !== undefined ? String(Number(at.y.toFixed(3))) : '', !one || !at || at.y === undefined);
    setField('ed-rot', String(a.rot ?? 0), !turn);
    input('ed-rot').step = String(state.turnStep);
    for (const id of ['ed-rot-left', 'ed-rot-right']) /** @type {HTMLButtonElement} */ ($(id)).disabled = !turn;
    /** @type {HTMLButtonElement} */ ($('ed-flip-x')).disabled = !flipX;
    /** @type {HTMLButtonElement} */ ($('ed-flip-y')).disabled = !flipY;
    $('ed-flip-x').setAttribute('aria-pressed', String(a.fx === true));
    $('ed-flip-y').setAttribute('aria-pressed', String(a.fy === true));
    const axes = input('ed-axes').checked;
    $('ed-scale-one').hidden = axes;
    $('ed-scale-xy').hidden = !axes;
    setField('ed-scale', String(a.sx ?? a.sy ?? 1), !scale);
    setField('ed-sx', String(a.sx ?? 1), !scale || !perAxis);
    setField('ed-sy', String(a.sy ?? 1), !scale || !perAxis);
    input('ed-axes').disabled = !perAxis;
    const portals = items.filter((i) => i.type === 'portal');
    $('ed-gate-field').hidden = portals.length === 0;
    input('ed-gate').checked = portals.length > 0 && portals.every((i) => /** @type {any} */ (i).y !== undefined);
  }

  /** @param {Item} item */
  function toolOf(item) {
    if (item.type === 'portal') return item.kind;
    if (item.type === 'halfSpike') return 'spike';
    return item.type;
  }

  /** @param {string} id @param {string} value @param {boolean} off */
  function setField(id, value, off) {
    const el = input(id);
    if (document.activeElement !== el) el.value = value;
    el.disabled = off;
  }

  /** The selection to a typed place (x on the strip). */
  function placeFromFields() {
    const one = state.sel[0];
    if (state.sel.length !== 1 || !one) return;
    const s = /** @type {SectionData} */ (state.level.sections[one.s]);
    const at = placeOf(itemOf(one), s);
    const o = /** @type {number} */ (offsets()[one.s]);
    const x = Number(input('ed-x').value);
    const y = Number(input('ed-y').value);
    const dx = Number.isFinite(x) && input('ed-x').value !== '' ? tidyStep(x - o - at.x) : 0;
    const dy = at.y !== undefined && Number.isFinite(y) && input('ed-y').value !== '' ? tidyStep(Math.min(13.5, Math.max(-1.5, y)) - at.y) : 0;
    if (dx || dy) moveSelection(dx, dy);
  }

  // ── The section's properties ────────────────────────────────────────────────

  function refresh() {
    // A change may have taken selected items away (or moved them: the caller selects again).
    state.sel = state.sel.filter((r) => state.level.sections[r.s]?.hazards[r.i] !== undefined);
    const s = current();
    $('ed-section').textContent = t('section', { n: state.index + 1, count: state.level.sections.length });
    /** @type {HTMLInputElement} */ ($('ed-name')).value = state.level.name;
    const tier = /** @type {HTMLSelectElement} */ ($('ed-tier'));
    tier.value = state.level.tier;
    const mode = /** @type {HTMLSelectElement} */ ($('ed-mode'));
    mode.value = s.mode ?? /** @type {string} */ (def.palette.modes[0]);
    input('ed-mini').checked = s.mini === true;
    if (document.activeElement !== $('ed-length')) input('ed-length').value = String(s.length);
    if (document.activeElement !== $('ed-ceil')) input('ed-ceil').value = s.ceil;
    if (document.activeElement !== $('ed-floor')) input('ed-floor').value = s.floor;
    /** @type {HTMLButtonElement} */ ($('ed-undo')).disabled = state.undo.length === 0;
    /** @type {HTMLButtonElement} */ ($('ed-redo')).disabled = state.redo.length === 0;
    /** @type {HTMLButtonElement} */ ($('ed-prev')).disabled = state.index === 0;
    /** @type {HTMLButtonElement} */ ($('ed-next')).disabled = state.index >= state.level.sections.length - 1;
    /** @type {HTMLButtonElement} */ ($('ed-remove')).disabled = state.level.sections.length < 2;
    $('ed-count').textContent = String(s.hazards.length);
    const verified = state.level.verified === true;
    const badge = $('ed-verified');
    badge.textContent = t(verified ? 'verifiedYes' : 'verifiedNo');
    badge.classList.toggle('is-verified', verified);
    document.body.dataset.section = String(state.index + 1);
    document.body.dataset.items = String(s.hazards.length);
    document.body.dataset.allItems = String(state.level.sections.reduce((n, x) => n + x.hazards.length, 0));
    document.body.dataset.verified = String(verified);
    refreshInspector();
    draw();
  }

  function fillSelects() {
    const tier = /** @type {HTMLSelectElement} */ ($('ed-tier'));
    tier.replaceChildren(...def.palette.tiers.map((k) => Object.assign(document.createElement('option'), { value: k, textContent: k })));
    const mode = /** @type {HTMLSelectElement} */ ($('ed-mode'));
    mode.replaceChildren(...def.palette.modes.map((k) => Object.assign(document.createElement('option'), { value: k, textContent: t(/** @type {any} */ (`mode_${k}`)) })));
    const grid = /** @type {HTMLSelectElement} */ ($('ed-grid'));
    grid.replaceChildren(...GRIDS.map((g) => Object.assign(document.createElement('option'), { value: String(g), textContent: g === 0 ? t('gridFree') : g === 1 ? '1' : g === 0.5 ? '½' : '¼' })));
    grid.value = String(state.grid);
    const turn = /** @type {HTMLSelectElement} */ ($('ed-rot-step'));
    turn.replaceChildren(...TURN_STEPS.map((g) => Object.assign(document.createElement('option'), { value: String(g), textContent: g === 1 ? t('gridFree') : `${g}°` })));
    turn.value = String(state.turnStep);
  }

  /** Puts the view at a section's start. @param {number} k */
  function goToSection(k) {
    state.index = Math.max(0, Math.min(state.level.sections.length - 1, k));
    state.camX = /** @type {number} */ (offsets()[state.index]) - 2;
    refresh();
  }

  // ── Panels ──────────────────────────────────────────────────────────────────

  /** @param {string} id */
  function openPanel(id) {
    for (const p of document.querySelectorAll('.ed-panel')) /** @type {HTMLElement} */ (p).hidden = p.id !== id;
  }
  function closePanels() {
    for (const p of document.querySelectorAll('.ed-panel')) /** @type {HTMLElement} */ (p).hidden = true;
  }

  /** @param {string} text */
  function toast(text) {
    const el = $('ed-toast');
    el.textContent = text;
    el.classList.add('is-on');
    window.setTimeout(() => el.classList.remove('is-on'), 1800);
  }

  function openExport() {
    /** @type {HTMLTextAreaElement} */ ($('ed-export-text')).value = toJson(state.level);
    $('ed-export-verified').textContent = t(state.level.verified ? 'exportVerified' : 'exportUnverified');
    openPanel('ed-export');
  }

  async function copyExport() {
    const area = /** @type {HTMLTextAreaElement} */ ($('ed-export-text'));
    try {
      await navigator.clipboard.writeText(area.value);
      toast(t('copied'));
    } catch {
      area.focus();
      area.select();
      toast(t('copyManual'));
    }
  }

  function downloadExport() {
    const blob = new Blob([toJson(state.level)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const name = state.level.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'level';
    a.download = `${def.palette.id}-${name}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** @param {string} text */
  function importText(text) {
    const { level, problems } = fromJson(text, def.palette);
    const list = $('ed-import-errors');
    list.replaceChildren();
    if (!level) {
      $('ed-import-status').textContent = t('importErrors', { count: problems.length });
      for (const p of problems.slice(0, 30)) {
        const li = document.createElement('li');
        li.textContent = `${p.path ? `${p.path}: ` : ''}${t(/** @type {any} */ (p.key), p.values)}`;
        list.append(li);
      }
      return;
    }
    $('ed-import-status').textContent = t('importOk', { name: level.name });
    // The file says whether it was verified; the level is as the file has it.
    edit((l) => Object.assign(l, level), { keepVerified: true });
    state.sel = [];
    goToSection(0);
    closePanels();
    toast(t('importOk', { name: level.name }));
  }

  // Saves in this browser.
  /** @returns {({ name: string, level: string } | null)[]} */
  function readSlots() {
    const raw = readJson(storage, KEYS.editorSlots);
    const list = Array.isArray(raw) ? raw : [];
    return Array.from({ length: SLOTS }, (_, i) => (list[i] && typeof list[i].level === 'string' ? list[i] : null));
  }
  function openSlots() {
    const list = $('ed-slot-list');
    list.replaceChildren();
    readSlots().forEach((slot, i) => {
      const li = document.createElement('li');
      li.className = 'ed-slot';
      const label = document.createElement('span');
      const parsed = slot ? fromJson(slot.level, def.palette).level : null;
      label.textContent = parsed ? t('slotSaved', { name: parsed.name || t('untitled'), sections: parsed.sections.length }) : t('slotEmpty', { n: i + 1 });
      const save = button(t('saveHere'), () => {
        const all = readSlots();
        all[i] = { name: state.level.name, level: toJson(state.level) };
        writeJson(storage, KEYS.editorSlots, all);
        toast(t('savedToast', { n: i + 1 }));
        openSlots();
      });
      save.dataset.slot = String(i + 1);
      li.append(label, save);
      if (parsed) {
        li.append(
          button(t('loadSlot'), () => {
            edit((l) => Object.assign(l, parsed), { keepVerified: true });
            state.sel = [];
            goToSection(0);
            closePanels();
          }),
          button(t('deleteSlot'), () => {
            const all = readSlots();
            all[i] = null;
            writeJson(storage, KEYS.editorSlots, all);
            openSlots();
          }),
        );
      }
      list.append(li);
    });
    openPanel('ed-slots');
  }

  // Sections from the game.
  function openOfficial() {
    const sector = /** @type {HTMLSelectElement} */ ($('ed-off-sector'));
    sector.replaceChildren(
      ...def.sectors.map((s) => Object.assign(document.createElement('option'), { value: String(s.id), textContent: `${t('sector')} ${s.id}` })),
      ...(def.finale ? [Object.assign(document.createElement('option'), { value: String(def.finale.id), textContent: t('finale') })] : []),
    );
    fillOfficialSections();
    openPanel('ed-official');
  }
  function fillOfficialSections() {
    const id = Number(/** @type {HTMLSelectElement} */ ($('ed-off-sector')).value);
    const list = def.library[id] ?? [];
    const section = /** @type {HTMLSelectElement} */ ($('ed-off-section'));
    section.replaceChildren(...list.map((d, i) => Object.assign(document.createElement('option'), { value: String(i), textContent: `${i + 1} · ${d.id}` })));
  }
  /** @param {boolean} whole @param {boolean} replace */
  function loadOfficial(whole, replace) {
    const id = Number(/** @type {HTMLSelectElement} */ ($('ed-off-sector')).value);
    const list = def.library[id] ?? [];
    const pick = whole ? list : [list[Number(/** @type {HTMLSelectElement} */ ($('ed-off-section')).value)]];
    const sectorDef = [...def.sectors, ...(def.finale ? [def.finale] : [])].find((s) => s.id === id);
    const sections = pick.filter((d) => d !== undefined).map((d) => {
      const { id: _id, deco: _deco, tier: _tier, ...rest } = /** @type {SectionData} */ (d);
      return /** @type {SectionData} */ ({ ...JSON.parse(JSON.stringify(rest)), id: 'x', ...(rest.mode ? {} : { mode: def.palette.modes[0] }) });
    });
    const before = state.level.sections.length;
    edit((l) => {
      if (replace) {
        l.sections = sections;
        if (sectorDef && def.palette.tiers.includes(sectorDef.tier)) l.tier = sectorDef.tier;
      } else l.sections.push(...sections);
    });
    state.sel = [];
    goToSection(replace ? 0 : before);
    closePanels();
  }

  /** The game plays the level: a test (practice) or the verification. @param {'start' | 'here' | 'verify'} how */
  function play(how) {
    const verify = how === 'verify';
    writeJson(session, KEYS.editorPlay, { game: def.palette.id, level: JSON.parse(toJson(state.level)), from: how === 'here' ? state.index + 1 : 1, verify });
    saveWork();
    location.href = `index.html?lang=${lang}&editor=1`;
  }

  /** @param {string} text @param {() => void} onClick */
  function button(text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ed-button';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  // ── Wiring ──────────────────────────────────────────────────────────────────

  $('ed-undo').addEventListener('click', () => travel('undo'));
  $('ed-redo').addEventListener('click', () => travel('redo'));
  $('ed-new').addEventListener('click', () => {
    // No confirm dialog (a game's frame may not allow one): Undo brings the old level back.
    edit((l) => Object.assign(l, emptyLevel(def.palette, t('untitled'))));
    state.sel = [];
    goToSection(0);
    toast(t('confirmNew'));
  });
  $('ed-test').addEventListener('click', () => play('start'));
  $('ed-test-here').addEventListener('click', () => play('here'));
  $('ed-verify').addEventListener('click', () => play('verify'));
  $('ed-export-open').addEventListener('click', openExport);
  $('ed-copy').addEventListener('click', () => void copyExport());
  $('ed-download').addEventListener('click', downloadExport);
  $('ed-import-open').addEventListener('click', () => {
    $('ed-import-errors').replaceChildren();
    $('ed-import-status').textContent = '';
    openPanel('ed-import');
  });
  $('ed-import-do').addEventListener('click', () => importText(/** @type {HTMLTextAreaElement} */ ($('ed-import-text')).value));
  $('ed-import-file').addEventListener('change', async (e) => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    if (!file) return;
    const text = await file.text();
    /** @type {HTMLTextAreaElement} */ ($('ed-import-text')).value = text;
    importText(text);
  });
  $('ed-slots-open').addEventListener('click', openSlots);
  $('ed-official-open').addEventListener('click', openOfficial);
  $('ed-off-sector').addEventListener('change', fillOfficialSections);
  $('ed-off-whole').addEventListener('click', () => loadOfficial(true, true));
  $('ed-off-one').addEventListener('click', () => loadOfficial(false, true));
  $('ed-off-append').addEventListener('click', () => loadOfficial(false, false));
  for (const b of document.querySelectorAll('.ed-close')) b.addEventListener('click', closePanels);
  $('ed-back').addEventListener('click', () => (location.href = `index.html?lang=${lang}`));
  $('ed-prev').addEventListener('click', () => goToSection(state.index - 1));
  $('ed-next').addEventListener('click', () => goToSection(state.index + 1));
  $('ed-add').addEventListener('click', () => {
    const at = state.index + 1;
    edit((l) => l.sections.splice(at, 0, emptySection(def.palette, 0)));
    state.sel = [];
    goToSection(at);
  });
  $('ed-copy-section').addEventListener('click', () => {
    const at = state.index + 1;
    const copy = JSON.parse(JSON.stringify(current()));
    edit((l) => l.sections.splice(at, 0, copy));
    state.sel = [];
    goToSection(at);
  });
  $('ed-remove').addEventListener('click', () => {
    if (state.level.sections.length < 2) return;
    const at = state.index;
    edit((l) => l.sections.splice(at, 1));
    state.sel = [];
    goToSection(Math.min(at, state.level.sections.length - 1));
  });
  $('ed-name').addEventListener('change', () => edit((l) => (l.name = input('ed-name').value.slice(0, 60)), { keepVerified: true }));
  $('ed-tier').addEventListener('change', () => edit((l) => (l.tier = /** @type {HTMLSelectElement} */ ($('ed-tier')).value)));
  $('ed-mode').addEventListener('change', () =>
    edit((l) => (/** @type {SectionData} */ (l.sections[state.index]).mode = /** @type {any} */ (/** @type {HTMLSelectElement} */ ($('ed-mode')).value))),
  );
  $('ed-mini').addEventListener('change', () =>
    edit((l) => {
      const s = /** @type {SectionData} */ (l.sections[state.index]);
      if (input('ed-mini').checked) s.mini = true;
      else delete s.mini;
    }),
  );
  // (A button, not a form: a game's frame may not submit forms.)
  $('ed-apply').addEventListener('click', () => {
    const length = Number(input('ed-length').value);
    const ceil = input('ed-ceil').value.trim();
    const floor = input('ed-floor').value.trim();
    const candidate = { ...current(), length, ceil, floor };
    const { problems } = fromJson(JSON.stringify({ ...JSON.parse(toJson(state.level)), sections: [candidate] }), def.palette);
    const out = $('ed-shape-status');
    if (problems.length) {
      out.textContent = problems.map((p) => t(/** @type {any} */ (p.key), p.values)).join('; ');
      return;
    }
    out.textContent = '';
    edit((l) => Object.assign(/** @type {SectionData} */ (l.sections[state.index]), { length, ceil, floor }));
  });
  /** @type {HTMLSelectElement} */ ($('ed-grid')).addEventListener('change', () => {
    state.grid = Number(/** @type {HTMLSelectElement} */ ($('ed-grid')).value);
    draw();
  });
  /** @type {HTMLSelectElement} */ ($('ed-rot-step')).addEventListener('change', () => {
    state.turnStep = Number(/** @type {HTMLSelectElement} */ ($('ed-rot-step')).value);
    refreshInspector();
  });

  // The inspector.
  $('ed-x').addEventListener('change', placeFromFields);
  $('ed-y').addEventListener('change', placeFromFields);
  $('ed-rot').addEventListener('change', () => {
    const v = Number(input('ed-rot').value);
    if (Number.isFinite(v)) transformSelection({ rot: Math.round(v / state.turnStep) * state.turnStep });
  });
  $('ed-rot-left').addEventListener('click', () => transformSelection({ turnBy: -90 }));
  $('ed-rot-right').addEventListener('click', () => transformSelection({ turnBy: 90 }));
  $('ed-flip-x').addEventListener('click', () => transformSelection({ flipX: true }));
  $('ed-flip-y').addEventListener('click', () => transformSelection({ flipY: true }));
  $('ed-scale').addEventListener('change', () => {
    const v = Number(input('ed-scale').value);
    if (Number.isFinite(v) && v > 0) transformSelection({ sx: v, sy: v });
  });
  $('ed-sx').addEventListener('change', () => {
    const v = Number(input('ed-sx').value);
    if (Number.isFinite(v) && v > 0) transformSelection({ sx: v });
  });
  $('ed-sy').addEventListener('change', () => {
    const v = Number(input('ed-sy').value);
    if (Number.isFinite(v) && v > 0) transformSelection({ sy: v });
  });
  $('ed-axes').addEventListener('change', refreshInspector);
  $('ed-gate').addEventListener('change', () => transformSelection({ gate: input('ed-gate').checked }));
  for (const [id, dx, dy] of /** @type {const} */ ([['ed-left', -1, 0], ['ed-right', 1, 0], ['ed-up', 0, -1], ['ed-down', 0, 1]])) {
    $(id).addEventListener('click', () => moveSelection(dx * nudgeStep(), dy * nudgeStep()));
  }
  $('ed-copy-items').addEventListener('click', copySelection);
  $('ed-paste').addEventListener('click', paste);
  $('ed-duplicate').addEventListener('click', duplicate);
  $('ed-delete').addEventListener('click', deleteSelection);
  $('ed-deselect').addEventListener('click', () => {
    state.sel = [];
    refresh();
  });

  window.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        if (typing) return;
        e.preventDefault();
        travel('undo');
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        if (typing) return;
        e.preventDefault();
        travel('redo');
      } else if (!typing && key === 'c' && state.sel.length) {
        e.preventDefault();
        copySelection();
      } else if (!typing && key === 'v' && state.clip.length) {
        e.preventDefault();
        paste();
      } else if (!typing && key === 'd' && state.sel.length) {
        e.preventDefault();
        duplicate();
      }
      return;
    }
    if (typing) return;
    const arrows = /** @type {Record<string, [number, number]>} */ ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] });
    const arrow = arrows[e.key];
    if (arrow && state.sel.length) {
      e.preventDefault();
      moveSelection(arrow[0] * nudgeStep(), arrow[1] * nudgeStep());
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel.length) {
      e.preventDefault();
      deleteSelection();
    } else if (e.key === 'Escape' && state.sel.length) {
      state.sel = [];
      refresh();
    }
  });
  window.addEventListener('resize', resize);
  // The board's size can change without the window's (bars wrap, fonts load).
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => resize()).observe(canvas);

  fillSelects();
  buildTools();
  buildOptions();
  closePanels();
  refresh();
  resize();
}

/** @param {number} v */
const tidyStep = (v) => Math.round(v * 1e6) / 1e6;

/**
 * A storage that may be missing (private mode, blocked): null then.
 * @param {() => Storage} get
 * @returns {Storage | null}
 */
function safeStorage(get) {
  try {
    const s = get();
    return s.length >= 0 ? s : null;
  } catch {
    return null;
  }
}
