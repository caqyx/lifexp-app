// @ts-check
// The Rush level editor (docs/v2/PLAN.md 9.1, stage r-3), shared by the three games: each
// game's editor.html runs it with its own palette (vehicles, items, tiers, look, its
// validator). A level is a list of sections in the games' own section data; the board
// shows one section at a time, painted as the game paints it. Tap to place the chosen
// item (or remove the nearest with the eraser), drag to move the view, two fingers or the
// wheel to zoom. Undo and redo, "Sprawdź" (the game's own validator, section by section,
// marking where a section fails), "Testuj" (the game itself plays the level, from the
// start or from the chosen section), export (a file and the text) and import (checked,
// with every problem named), and a few saves in this browser.
import { JOINT, VIEW_H } from '../world.js';
import { buildGeometry, movedAt, profileY } from '../geometry.js';
import { paintSection } from '../render/section.js';
import { drawMine, drawOrb, drawPortal, drawSaw } from '../render/sprites.js';
import { emptyLevel, emptySection, fromJson, sectionId, toJson } from './format.js';
import { editorTranslator, pickLang } from './i18n.js';
import { keysFor, readJson, writeJson } from '../records.js';

/**
 * @typedef {import('./format.js').Level} Level
 * @typedef {import('./format.js').Palette} Palette
 * @typedef {import('../geometry.js').SectionData} SectionData
 * @typedef {import('../sectors.js').SectorDef} SectorDef
 * @typedef {import('../render/section.js').SurfaceTheme} Theme
 * @typedef {{
 *   palette: Palette, title: string, prefix: string,
 *   sectors: SectorDef[], finale: SectorDef | null, library: Record<number, SectionData[]>,
 *   themeOf: (id: string) => Theme, tools: string[],
 *   drawItem?: (ctx: CanvasRenderingContext2D, item: SectionData['hazards'][number], x: number, y: number, cell: number) => boolean,
 *   problems: (data: SectionData, tier: string) => string[],
 * }} EditorDef
 *   prefix: the game's storage prefix (its saves); tools: the item tools this game has;
 *   drawItem: the game's own drawing of an item (true when it drew it); problems: the
 *   game's validator for one section at a tier (empty when passable).
 */


const SLOTS = 5;
const HISTORY = 100;

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
  erase: 'toolErase', pan: 'toolPan', spike: 'toolSpike', block: 'toolBlock', pillar: 'toolPillar', saw: 'toolSaw', mine: 'toolMine',
  orb: 'toolOrb', ring: 'toolRing', pad: 'toolPad', flip: 'toolFlip', mini: 'toolMini', big: 'toolBig', speed: 'toolSpeed', dark: 'toolDark', invert: 'toolInvert',
});

/** @param {number} v */
const half = (v) => Math.round(v * 2) / 2;

/**
 * The item a tool places at (x, y), or null.
 * @param {string} tool @param {Record<string, string | number | boolean>} opt @param {number} x @param {number} y @param {SectionData} s
 * @returns {SectionData['hazards'][number] | null}
 */
export function itemFor(tool, opt, x, y, s) {
  const g = buildGeometry(s);
  const top = profileY(g.ceil, x, 'ceil');
  const bottom = profileY(g.floor, x, 'floor');
  const on = /** @type {'floor' | 'ceil'} */ (y > (top + bottom) / 2 ? 'floor' : 'ceil');
  const hx = half(x);
  const hy = half(y);
  const move = opt.move ? { move: { dx: 0, dy: 2, every: 8 } } : {};
  switch (tool) {
    case 'spike':
      return { type: 'spike', x: Math.floor(x), on, count: Number(opt.count ?? 2) };
    case 'block': {
      const [w, h] = String(opt.size ?? '1×1').split('×').map(Number);
      return { type: 'block', x: half(x - (w ?? 1) / 2), y: half(y - (h ?? 1) / 2), w: w ?? 1, h: h ?? 1 };
    }
    case 'pillar':
      return { type: 'pillar', x: Math.floor(x), on, h: Number(opt.h ?? 3) };
    case 'saw':
    case 'mine':
    case 'orb':
      return { type: tool, x: hx, y: hy, r: Number(opt.r ?? 0.8), ...move };
    case 'ring':
      return /** @type {SectionData['hazards'][number]} */ ({ type: 'ring', kind: String(opt.kind ?? 'jump'), x: hx, y: hy });
    case 'pad':
      return /** @type {SectionData['hazards'][number]} */ ({ type: 'pad', kind: String(opt.kind ?? 'jump'), x: Math.floor(x), on });
    case 'flip':
    case 'mini':
    case 'big':
      return { type: 'portal', x: hx, kind: tool };
    case 'speed':
      return /** @type {SectionData['hazards'][number]} */ ({ type: 'speed', x: hx, k: String(opt.k ?? 'fast') });
    case 'dark':
    case 'invert':
      return { type: tool, from: hx, to: Math.min(s.length - 2, hx + 8) };
    default:
      return null;
  }
}

/**
 * Where an item is, for picking it (its centre, or its place on its surface).
 * @param {SectionData['hazards'][number]} h @param {SectionData} s
 * @returns {{ x: number, y: number | null, w: number }} y null: anywhere across; w: how far along it reaches
 */
export function anchorOf(h, s) {
  const g = buildGeometry({ ...s, hazards: [] });
  /** @type {Record<string, any>} */
  const a = h;
  if (a.from !== undefined) return { x: (a.from + a.to) / 2, y: null, w: a.to - a.from };
  if (a.type === 'speed' || a.type === 'portal') return { x: a.x, y: null, w: 1 };
  if (a.y !== undefined && a.type !== 'spike') return { x: a.x + (a.w ?? 0) / 2, y: a.y + (a.h ?? 0) / 2, w: Math.max(1, a.w ?? a.r ?? 1) };
  const x = a.x + (a.count ?? a.w ?? 1) / 2;
  const y = a.y ?? (a.on === 'floor' ? profileY(g.floor, x, 'floor') - 0.5 : profileY(g.ceil, x, 'ceil') + 0.5);
  return { x, y, w: Math.max(1, a.count ?? a.w ?? 1) };
}

/**
 * The index of the item nearest (x, y) within reach, or −1.
 * @param {SectionData} s @param {number} x @param {number} y
 */
export function nearestItem(s, x, y) {
  let best = -1;
  let bestD = 1.6;
  s.hazards.forEach((h, i) => {
    const a = anchorOf(h, s);
    const dx = Math.max(0, Math.abs(x - a.x) - a.w / 2);
    // Across the whole corridor (a portal, a stretch): a little further than an item hit square on.
    const d = a.y === null ? (dx === 0 ? 0.5 : dx + 0.5) : Math.hypot(dx, y - a.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

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
  // edited (kept while the game plays it) and the level left for the game to play.
  const KEYS = keysFor(def.prefix);

  /** @param {string} id @returns {HTMLElement} */
  const $ = (id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`#${id} missing`);
    return el;
  };
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(/** @type {any} */ (el.getAttribute('data-t')));
  for (const el of document.querySelectorAll('[data-label]')) el.setAttribute('aria-label', t(/** @type {any} */ (el.getAttribute('data-label'))));
  $('ed-game').textContent = def.title;

  const canvas = /** @type {HTMLCanvasElement} */ ($('ed-canvas'));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  canvas.setAttribute('aria-label', t('canvasLabel'));

  const restored = readWork();
  const state = {
    level: restored ?? emptyLevel(def.palette, t('untitled')),
    index: 0,
    tool: def.tools[0] ?? 'spike',
    /** @type {Record<string, string | number | boolean>} */
    opt: {},
    camX: -2,
    zoom: 1,
    /** @type {string[]} */
    undo: [],
    /** @type {string[]} */
    redo: [],
    /** @type {Map<number, { ok: boolean, text: string, x: number | null }>} */
    checks: new Map(),
    checking: false,
  };
  /** @type {Map<string, { canvas: HTMLCanvasElement, left: number, top: number }>} */
  const painted = new Map();

  // ── Level changes, with undo ────────────────────────────────────────────────

  /** @param {(level: Level) => void} change */
  function edit(change) {
    state.undo.push(JSON.stringify(state.level));
    if (state.undo.length > HISTORY) state.undo.shift();
    state.redo = [];
    const next = /** @type {Level} */ (JSON.parse(JSON.stringify(state.level)));
    change(next);
    next.sections.forEach((s, i) => (s.id = sectionId(i + 1)));
    state.level = next;
    state.index = Math.min(state.index, next.sections.length - 1);
    state.checks.clear();
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
    state.checks.clear();
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

  function draw() {
    const s = current();
    const c = cellSize();
    const th = def.themeOf(themeId());
    ctx.fillStyle = '#0b0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    /** @type {import('../geometry.js').Geometry} */
    let g;
    try {
      g = buildGeometry(s);
    } catch {
      return;
    }
    const key = `${JSON.stringify(s)}@${c}@${th.id}`;
    let p = painted.get(key);
    if (!p) {
      painted.clear();
      p = paintSection(g, th, /** @type {any} */ ({ cell: c }));
      painted.set(key, p);
    }
    ctx.drawImage(p.canvas, X(p.left), Y(p.top));
    // The joints: no item may stand there (the next section starts here).
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(X(0), 0, 2.5 * c, canvas.height);
    ctx.fillRect(X(s.length - 2.5), 0, 2.5 * c, canvas.height);
    // The grid: every cell, every fifth brighter, with its x.
    ctx.lineWidth = 1;
    for (let x = 0; x <= s.length; x++) {
      ctx.strokeStyle = x % 5 === 0 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.07)';
      ctx.beginPath();
      ctx.moveTo(X(x), Y(-1));
      ctx.lineTo(X(x), Y(13));
      ctx.stroke();
      if (x % 5 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.font = `${Math.max(10, c * 0.35)}px system-ui, sans-serif`;
        ctx.fillText(String(x), X(x) + 3, Y(-0.8));
      }
    }
    for (let y = 0; y <= 12; y++) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(X(0), Y(y));
      ctx.lineTo(X(s.length), Y(y));
      ctx.stroke();
    }
    // Round hazards (and the path a moving one swings along), portals, the game's items.
    for (const h of g.hazards) {
      if (h.shape !== 'circle') continue;
      if (h.move) {
        const a = movedAt(h, -h.move.every / 4 - (h.move.phase ?? 0) * h.move.every);
        const b = movedAt(h, h.move.every / 4 - (h.move.phase ?? 0) * h.move.every);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.setLineDash([c * 0.2, c * 0.2]);
        ctx.beginPath();
        ctx.moveTo(X(a.x), Y(a.y));
        ctx.lineTo(X(b.x), Y(b.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const draw = h.type === 'saw' ? drawSaw : h.type === 'mine' ? drawMine : drawOrb;
      draw(ctx, X(h.x), Y(h.y), h.r * c, 0, th, 0);
    }
    for (const item of s.hazards) {
      /** @type {Record<string, any>} */
      const a = item;
      if (a.type === 'portal' || a.type === 'speed') {
        const top = profileY(g.ceil, a.x, 'ceil');
        const bottom = profileY(g.floor, a.x, 'floor');
        /** @type {any} */
        const p2 = a.type === 'speed' ? { kind: 'speed', on: false, speed: a.k } : a.kind === 'flip' ? { kind: 'flip', on: true } : { kind: 'mini', on: a.kind === 'mini' };
        drawPortal(ctx, X(a.x), Y(top + 0.25), Y(bottom - 0.25), c, p2, 0, true);
      } else if (a.type === 'dark' || a.type === 'invert') {
        ctx.fillStyle = a.type === 'dark' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 60, 200, 0.18)';
        ctx.fillRect(X(a.from), Y(JOINT.ceil), (a.to - a.from) * c, (JOINT.floor - JOINT.ceil) * c);
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(11, c * 0.4)}px system-ui, sans-serif`;
        ctx.fillText(t(a.type === 'dark' ? 'toolDark' : 'toolInvert'), X(a.from) + 4, Y(JOINT.ceil) + c * 0.6);
      } else if (a.type === 'ring' || a.type === 'pad') {
        const y = a.type === 'pad' ? (a.y ?? (a.on === 'floor' ? profileY(g.floor, a.x + 0.5, 'floor') : profileY(g.ceil, a.x + 0.5, 'ceil'))) : a.y;
        def.drawItem?.(ctx, item, X(a.type === 'pad' ? a.x + 0.5 : a.x), Y(y), c);
      }
    }
    // Where the validator says the section fails.
    const check = state.checks.get(state.index);
    if (check && !check.ok && check.x !== null) {
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = Math.max(2, c * 0.12);
      ctx.setLineDash([c * 0.3, c * 0.2]);
      ctx.beginPath();
      ctx.moveTo(X(check.x), Y(0));
      ctx.lineTo(X(check.x), Y(12));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Pointer: tap to place, drag to pan, pinch to zoom ───────────────────────

  /** @type {Map<number, { x: number, y: number, x0: number, y0: number }>} */
  const pointers = new Map();
  let pinch = 0;
  let moved = false;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY, x0: e.offsetX, y0: e.offsetY });
    moved = pointers.size > 1;
    if (pointers.size === 2) pinch = spread();
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const ratio = canvas.width / canvas.getBoundingClientRect().width;
    if (pointers.size === 1) {
      if (Math.hypot(e.offsetX - p.x0, e.offsetY - p.y0) > 6) moved = true;
      if (moved) {
        state.camX -= ((e.offsetX - p.x) * ratio) / cellSize();
        draw();
      }
    }
    p.x = e.offsetX;
    p.y = e.offsetY;
    if (pointers.size === 2) {
      const now = spread();
      if (pinch > 0) zoomBy(now / pinch, e.offsetX * ratio);
      pinch = now;
    }
  });
  const up = (/** @type {PointerEvent} */ e) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (!p || moved || pointers.size > 0 || e.type === 'pointercancel') {
      if (pointers.size === 0) moved = false;
      return;
    }
    const ratio = canvas.width / canvas.getBoundingClientRect().width;
    tapAt(toWorld(p.x0 * ratio, p.y0 * ratio));
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const ratio = canvas.width / canvas.getBoundingClientRect().width;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        state.camX += ((e.shiftKey ? e.deltaY : e.deltaX) * ratio) / cellSize();
        draw();
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
    state.zoom = Math.min(4, Math.max(0.5, state.zoom * factor));
    state.camX = at - px / cellSize();
    painted.clear();
    draw();
  }

  /** @param {{ x: number, y: number }} p */
  function tapAt(p) {
    const s = current();
    if (state.tool === 'pan' || p.x < 0 || p.x > s.length) return;
    if (state.tool === 'erase') {
      const i = nearestItem(s, p.x, p.y);
      if (i >= 0) edit((level) => /** @type {SectionData} */ (level.sections[state.index]).hazards.splice(i, 1));
      return;
    }
    const item = itemFor(state.tool, state.opt, p.x, p.y, s);
    if (!item) return;
    edit((level) => /** @type {SectionData} */ (level.sections[state.index]).hazards.push(item));
  }

  // ── Tools and their options ─────────────────────────────────────────────────

  function buildTools() {
    const list = $('ed-tools');
    list.replaceChildren();
    for (const tool of ['pan', 'erase', ...def.tools]) {
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

  // ── The section's properties and the list of sections ───────────────────────

  function refresh() {
    const s = current();
    $('ed-section').textContent = t('section', { n: state.index + 1, count: state.level.sections.length });
    /** @type {HTMLInputElement} */ ($('ed-name')).value = state.level.name;
    const tier = /** @type {HTMLSelectElement} */ ($('ed-tier'));
    tier.value = state.level.tier;
    const mode = /** @type {HTMLSelectElement} */ ($('ed-mode'));
    mode.value = s.mode ?? /** @type {string} */ (def.palette.modes[0]);
    /** @type {HTMLInputElement} */ ($('ed-mini')).checked = s.mini === true;
    /** @type {HTMLInputElement} */ ($('ed-length')).value = String(s.length);
    /** @type {HTMLInputElement} */ ($('ed-ceil')).value = s.ceil;
    /** @type {HTMLInputElement} */ ($('ed-floor')).value = s.floor;
    /** @type {HTMLButtonElement} */ ($('ed-undo')).disabled = state.undo.length === 0;
    /** @type {HTMLButtonElement} */ ($('ed-redo')).disabled = state.redo.length === 0;
    /** @type {HTMLButtonElement} */ ($('ed-prev')).disabled = state.index === 0;
    /** @type {HTMLButtonElement} */ ($('ed-next')).disabled = state.index >= state.level.sections.length - 1;
    /** @type {HTMLButtonElement} */ ($('ed-remove')).disabled = state.level.sections.length < 2;
    $('ed-count').textContent = String(current().hazards.length);
    document.body.dataset.section = String(state.index + 1);
    document.body.dataset.items = String(current().hazards.length);
    draw();
  }

  function fillSelects() {
    const tier = /** @type {HTMLSelectElement} */ ($('ed-tier'));
    tier.replaceChildren(...def.palette.tiers.map((k) => Object.assign(document.createElement('option'), { value: k, textContent: k })));
    const mode = /** @type {HTMLSelectElement} */ ($('ed-mode'));
    mode.replaceChildren(...def.palette.modes.map((k) => Object.assign(document.createElement('option'), { value: k, textContent: t(/** @type {any} */ (`mode_${k}`)) })));
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
    const text = toJson(state.level);
    /** @type {HTMLTextAreaElement} */ ($('ed-export-text')).value = text;
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
    edit((l) => Object.assign(l, level));
    state.index = 0;
    refresh();
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
            edit((l) => Object.assign(l, parsed));
            state.index = 0;
            refresh();
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
    edit((l) => {
      if (replace) {
        l.sections = sections;
        if (sectorDef && def.palette.tiers.includes(sectorDef.tier)) l.tier = sectorDef.tier;
      } else l.sections.push(...sections);
    });
    state.index = replace ? 0 : state.level.sections.length - sections.length;
    refresh();
    closePanels();
  }

  // The validator, section by section (with a breath between, so the page stays alive).
  function runCheck() {
    if (state.checking) return;
    state.checking = true;
    state.checks.clear();
    delete $('ed-check').dataset.result;
    const list = $('ed-check-list');
    list.replaceChildren();
    openPanel('ed-check');
    const status = $('ed-check-status');
    const sections = state.level.sections;
    let fails = 0;
    const one = (/** @type {number} */ i) => {
      if (i >= sections.length) {
        status.textContent = fails ? t('checkFail', { count: fails }) : t('checkOk');
        $('ed-check').dataset.result = fails ? 'fail' : 'ok';
        state.checking = false;
        draw();
        return;
      }
      status.textContent = t('checking', { n: i + 1, count: sections.length });
      window.setTimeout(() => {
        const s = /** @type {SectionData} */ (sections[i]);
        const problems = def.problems({ ...s, id: `${s.id}~${Date.now()}` }, state.level.tier);
        const first = problems[0];
        const at = first ? /x≈(-?[\d.]+)/.exec(first) : null;
        const x = at ? Number(at[1]) : null;
        const text = first ? first.replace(/^[^ ]+ /, '').replace(/ \(x≈[^)]*\)/, '') : '';
        state.checks.set(i, { ok: !first, text, x });
        if (first) fails += 1;
        const li = document.createElement('li');
        li.className = first ? 'ed-check-fail' : 'ed-check-ok';
        li.textContent = first ? `${t('checkSectionFail', { n: i + 1, problem: text })}${x !== null ? ` · ${t('checkAt', { x: x.toFixed(1) })}` : ''}` : t('checkSectionOk', { n: i + 1 });
        if (first) {
          li.append(
            button('→', () => {
              state.index = i;
              if (x !== null) state.camX = x - canvas.width / cellSize() / 2;
              refresh();
            }),
          );
        }
        list.append(li);
        one(i + 1);
      }, 20);
    };
    one(0);
  }

  /** @param {boolean} fromHere */
  function testPlay(fromHere) {
    writeJson(session, KEYS.editorPlay, { game: def.palette.id, level: JSON.parse(toJson(state.level)), from: fromHere ? state.index + 1 : 1 });
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
    state.index = 0;
    refresh();
    toast(t('confirmNew'));
  });
  $('ed-check-open').addEventListener('click', runCheck);
  $('ed-test').addEventListener('click', () => testPlay(false));
  $('ed-test-here').addEventListener('click', () => testPlay(true));
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
  $('ed-prev').addEventListener('click', () => {
    state.index = Math.max(0, state.index - 1);
    state.camX = -2;
    refresh();
  });
  $('ed-next').addEventListener('click', () => {
    state.index = Math.min(state.level.sections.length - 1, state.index + 1);
    state.camX = -2;
    refresh();
  });
  $('ed-add').addEventListener('click', () => {
    edit((l) => l.sections.splice(state.index + 1, 0, emptySection(def.palette, 0)));
    state.index += 1;
    refresh();
  });
  $('ed-copy-section').addEventListener('click', () => {
    edit((l) => l.sections.splice(state.index + 1, 0, JSON.parse(JSON.stringify(current()))));
    state.index += 1;
    refresh();
  });
  $('ed-remove').addEventListener('click', () => {
    if (state.level.sections.length < 2) return;
    edit((l) => l.sections.splice(state.index, 1));
  });
  $('ed-name').addEventListener('change', () => edit((l) => (l.name = /** @type {HTMLInputElement} */ ($('ed-name')).value.slice(0, 60))));
  $('ed-tier').addEventListener('change', () => edit((l) => (l.tier = /** @type {HTMLSelectElement} */ ($('ed-tier')).value)));
  $('ed-mode').addEventListener('change', () =>
    edit((l) => (/** @type {SectionData} */ (l.sections[state.index]).mode = /** @type {any} */ (/** @type {HTMLSelectElement} */ ($('ed-mode')).value))),
  );
  $('ed-mini').addEventListener('change', () =>
    edit((l) => {
      const s = /** @type {SectionData} */ (l.sections[state.index]);
      if (/** @type {HTMLInputElement} */ ($('ed-mini')).checked) s.mini = true;
      else delete s.mini;
    }),
  );
  // (A button, not a form: a game's frame may not submit forms.)
  $('ed-apply').addEventListener('click', () => {
    const length = Number(/** @type {HTMLInputElement} */ ($('ed-length')).value);
    const ceil = /** @type {HTMLInputElement} */ ($('ed-ceil')).value.trim();
    const floor = /** @type {HTMLInputElement} */ ($('ed-floor')).value.trim();
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
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      travel('undo');
    } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
      e.preventDefault();
      travel('redo');
    }
  });
  window.addEventListener('resize', resize);

  fillSelects();
  buildTools();
  buildOptions();
  closePanels();
  refresh();
  resize();
}

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
