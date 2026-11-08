// @ts-check
// Strażnicy Doliny: the custom mode's two screens (docs/v2/PLAN.md 9.1, td-5) — the setup
// (a map, the gold, the enemies) and the map editor (paint a road from the top row to the
// bottom one, place build spots, pick a look, name it, save it). Opened from the map list
// once every campaign map has been won. A custom game is an ordinary game with options
// (sim.js createGame: custom waves, infinite gold, difficulty); it earns no stars.

import { COLS, ROWS } from './maps.js';
import { PICKABLE_ENEMIES } from './config.js';
import { PALETTE } from './pixelart.js';
import { createTileset } from './terrain.js';
import {
  MAX_MAPS,
  MAX_PADS,
  canExtend,
  deleteCustomMap,
  mapProblem,
  newMapId,
  readCustomMaps,
  saveCustomMap,
  toMapDef,
} from './mapedit.js';

/** @typedef {import('./maps.js').MapDef} MapDef */
/** @typedef {import('./mapedit.js').CustomMap} CustomMap */
/** @typedef {import('./mapedit.js').Cell} Cell */
/** @typedef {import('./config.js').EnemyType} EnemyType */
/** @typedef {import('./sim.js').GameOptions} GameOptions */
/** @typedef {import('./pixelui.js').TextStyle} TextStyle */

export const GOLD_MIN = 50;
export const GOLD_MAX = 9990;
export const WAVES_MIN = 3;
export const WAVES_MAX = 40;

/**
 * What the setup screen chose.
 * @typedef {{
 *   map: string, gold: 'default' | 'infinite' | 'custom', amount: number,
 *   enemies: 'default' | 'pick', kinds: EnemyType[], waves: number, bosses: boolean, difficulty: number,
 * }} Setup
 */

/** @returns {Setup} */
export function defaultSetup() {
  return { map: 'meadow', gold: 'default', amount: 300, enemies: 'default', kinds: ['crawler', 'runner', 'bat', 'shieldbearer'], waves: 15, bosses: true, difficulty: 1 };
}

/**
 * The game options a setup gives (sim.js createGame), and why it cannot start ('' if it can).
 * @param {Setup} setup @returns {{ options: GameOptions, problem: string }}
 */
export function setupOptions(setup) {
  const picked = setup.enemies === 'pick';
  /** @type {GameOptions} */
  const options = {
    custom: picked ? { types: setup.kinds, waves: setup.waves, bosses: setup.bosses, difficulty: setup.difficulty } : null,
    difficulty: picked ? setup.difficulty : 1,
    infiniteGold: setup.gold === 'infinite',
  };
  if (setup.gold === 'custom') options.gold = Math.min(GOLD_MAX, Math.max(GOLD_MIN, Math.round(setup.amount)));
  return { options, problem: picked && setup.kinds.length === 0 ? 'pickOne' : '' };
}

/**
 * @typedef {{
 *   t: (key: string, values?: Record<string, string | number>) => string,
 *   say: (el: HTMLElement, text: string, style?: TextStyle) => void,
 *   storage: () => Pick<Storage, 'getItem' | 'setItem'> | null,
 *   campaign: readonly MapDef[],
 *   enemyIcon: (type: EnemyType) => HTMLElement,
 *   show: (screen: 'custom' | 'editor' | 'start', focus?: HTMLElement | null) => void,
 *   play: (map: MapDef, options: GameOptions, label: string) => void,
 * }} CustomDeps
 */

/** @param {string} id */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

/** @param {CustomDeps} deps */
export function createCustomMode(deps) {
  const { t, say } = deps;
  const setup = defaultSetup();
  let maps = readCustomMaps(deps.storage());
  const dom = {
    back: byId('custom-back'),
    maps: byId('custom-maps'),
    newMap: /** @type {HTMLButtonElement} */ (byId('custom-new')),
    edit: /** @type {HTMLButtonElement} */ (byId('custom-edit')),
    remove: /** @type {HTMLButtonElement} */ (byId('custom-delete')),
    gold: byId('custom-gold'),
    amount: byId('custom-amount'),
    amountValue: byId('custom-amount-value'),
    enemiesMode: byId('custom-enemies-mode'),
    pick: byId('custom-pick'),
    kinds: byId('custom-kinds'),
    wavesValue: byId('custom-waves-value'),
    bosses: byId('custom-bosses'),
    difficulty: byId('custom-difficulty'),
    problem: byId('custom-problem'),
    play: /** @type {HTMLButtonElement} */ (byId('custom-play')),
  };

  /** All maps to pick from: the campaign's, then the player's own. */
  function choices() {
    return [
      ...deps.campaign.map((m) => ({ id: m.id, name: t(`map.${m.id}`), def: m, own: false })),
      ...maps.map((m) => ({ id: m.id, name: m.name, def: toMapDef(m), own: true })),
    ];
  }

  function renderMaps() {
    const list = choices();
    if (!list.some((c) => c.id === setup.map)) setup.map = 'meadow';
    dom.maps.replaceChildren(
      ...list.map((choice) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'choice';
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', String(choice.id === setup.map));
        button.dataset.map = choice.id;
        say(button, choice.name, { color: choice.own ? 'Y' : 'w' });
        button.addEventListener('click', () => {
          setup.map = choice.id;
          render();
        });
        return button;
      }),
    );
    const own = maps.some((m) => m.id === setup.map);
    dom.edit.hidden = !own;
    dom.remove.hidden = !own;
    dom.newMap.disabled = maps.length >= MAX_MAPS;
  }

  function renderKinds() {
    dom.kinds.replaceChildren(
      ...PICKABLE_ENEMIES.map((type) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'kind';
        button.setAttribute('role', 'checkbox');
        button.setAttribute('aria-checked', String(setup.kinds.includes(type)));
        button.dataset.kind = type;
        const label = document.createElement('span');
        label.className = 'kind__name';
        say(label, t(`enemy.${type}`), { color: 'w', size: 0 });
        button.append(deps.enemyIcon(type), label);
        button.addEventListener('click', () => {
          setup.kinds = setup.kinds.includes(type) ? setup.kinds.filter((k) => k !== type) : [...setup.kinds, type];
          render();
        });
        item.append(button);
        return item;
      }),
    );
  }

  /** @param {HTMLElement} group @param {string} attr @param {string} value */
  function check(group, attr, value) {
    for (const el of group.querySelectorAll(`[${attr}]`)) el.setAttribute('aria-checked', String(el.getAttribute(attr) === value));
  }

  /**
   * The kind cards are at least as wide as their widest name (the pixel words do not wrap
   * and must not be cut): the grid's column minimum follows the drawn names.
   */
  function fitKinds() {
    let widest = 0;
    for (const el of dom.kinds.querySelectorAll('.kind__name .pt-canvas')) widest = Math.max(widest, el.getBoundingClientRect().width);
    if (widest > 0) dom.kinds.style.setProperty('--kind-min', `${Math.ceil(widest) + 16}px`);
  }

  function render() {
    renderMaps();
    check(dom.gold, 'data-gold', setup.gold);
    dom.amount.hidden = setup.gold !== 'custom';
    say(dom.amountValue, String(setup.amount), { color: 'y' });
    check(dom.enemiesMode, 'data-enemies', setup.enemies);
    dom.pick.hidden = setup.enemies !== 'pick';
    if (!dom.pick.hidden) fitKinds();
    for (const el of dom.kinds.querySelectorAll('[data-kind]')) el.setAttribute('aria-checked', String(setup.kinds.includes(/** @type {EnemyType} */ (el.getAttribute('data-kind')))));
    say(dom.wavesValue, String(setup.waves), { color: 'y' });
    dom.bosses.setAttribute('aria-pressed', String(setup.bosses));
    check(dom.difficulty, 'data-difficulty', String(setup.difficulty));
    const { problem } = setupOptions(setup);
    say(dom.problem, problem ? t(problem) : '', { color: 'R', wrap: true });
    dom.play.disabled = problem !== '';
  }

  function play() {
    const { options, problem } = setupOptions(setup);
    if (problem) return;
    const choice = choices().find((c) => c.id === setup.map);
    if (!choice) return;
    deps.play(choice.def, options, `${t('customGame')} · ${choice.name}`);
  }

  // ── The editor ──
  const ed = {
    canvas: /** @type {HTMLCanvasElement} */ (byId('editor-grid')),
    name: /** @type {HTMLInputElement} */ (byId('editor-name')),
    tool: byId('editor-tool'),
    look: byId('editor-look'),
    status: byId('editor-status'),
    undo: /** @type {HTMLButtonElement} */ (byId('editor-undo')),
    clear: byId('editor-clear'),
    save: /** @type {HTMLButtonElement} */ (byId('editor-save')),
    back: byId('editor-back'),
  };
  /** @type {CustomMap} */
  let draft = { id: '', name: '', look: 'meadow', path: [], pads: [] };
  /** @type {{ path: Cell[], pads: Cell[] }[]} */
  let history = [];
  let tool = /** @type {'road' | 'pads'} */ ('road');
  let painting = false;
  /** @type {ReturnType<typeof createTileset> | null} */
  let tiles = null;
  let tilesLook = '';

  /** @param {CustomMap | null} map */
  function openEditor(map) {
    draft = map
      ? { ...map, path: [...map.path], pads: [...map.pads] }
      : { id: newMapId(maps), name: t('newMapName', { n: maps.length + 1 }), look: 'meadow', path: [], pads: [] };
    history = [];
    tool = 'road';
    ed.name.value = draft.name;
    renderEditor();
    deps.show('editor', ed.name);
    sizeGrid();
  }

  function snapshot() {
    history.push({ path: [...draft.path], pads: [...draft.pads] });
    if (history.length > 200) history.shift();
  }

  /** @param {Cell} cell @param {boolean} first whether a new stroke starts here */
  function paint(cell, first) {
    if (tool === 'road') {
      const at = draft.path.findIndex((c) => c[0] === cell[0] && c[1] === cell[1]);
      if (at >= 0) {
        // Tapping a road cell (not the last) cuts the road back to it.
        if (first && at < draft.path.length - 1) {
          snapshot();
          draft.path = draft.path.slice(0, at + 1);
        }
        return;
      }
      if (draft.pads.some((p) => p[0] === cell[0] && p[1] === cell[1])) return;
      if (!canExtend(draft.path, cell)) return;
      if (first) snapshot();
      draft.path = [...draft.path, cell];
    } else {
      if (!first) return;
      if (draft.path.some((c) => c[0] === cell[0] && c[1] === cell[1])) return;
      const at = draft.pads.findIndex((p) => p[0] === cell[0] && p[1] === cell[1]);
      if (at < 0 && draft.pads.length >= MAX_PADS) return;
      snapshot();
      draft.pads = at >= 0 ? draft.pads.filter((_, i) => i !== at) : [...draft.pads, cell];
    }
    renderEditor();
  }

  /** The cell under a pointer, or null. @param {PointerEvent} event @returns {Cell | null} */
  function cellAt(event) {
    const box = ed.canvas.getBoundingClientRect();
    const c = Math.floor(((event.clientX - box.left) / box.width) * COLS);
    const r = Math.floor(((event.clientY - box.top) / box.height) * ROWS);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS ? [c, r] : null;
  }

  /** The grid canvas scaled by whole device pixels to fit its box (crisp). */
  function sizeGrid() {
    const wrap = /** @type {HTMLElement} */ (ed.canvas.parentElement);
    const dpr = window.devicePixelRatio || 1;
    // Upright: as wide as the column and up to ~60% of the height; sideways: the full height
    // beside the controls (up to half the width).
    const sideways = window.innerWidth > window.innerHeight;
    const roomH = sideways ? window.innerHeight - 40 : Math.max(240, window.innerHeight * 0.62);
    const roomW = sideways ? window.innerWidth * 0.5 : wrap.clientWidth;
    const k = Math.max(1, Math.floor(Math.min((roomW * dpr) / (COLS * 16), (roomH * dpr) / (ROWS * 16))));
    ed.canvas.style.width = `${(COLS * 16 * k) / dpr}px`;
    ed.canvas.style.height = `${(ROWS * 16 * k) / dpr}px`;
  }

  function renderEditor() {
    check(ed.tool, 'data-tool', tool);
    check(ed.look, 'data-look', draft.look);
    if (!tiles || tilesLook !== draft.look) {
      tiles = createTileset(toMapDef({ ...draft, path: [[0, 0], [0, 1]], pads: [] }));
      tilesLook = draft.look;
    }
    drawGrid(ed.canvas, draft, tiles);
    const problem = mapProblem(draft);
    const full = maps.length >= MAX_MAPS && !maps.some((m) => m.id === draft.id);
    say(ed.status, full ? t('problem.full') : problem ? t(`problem.${problem}`) : t('ready'), { color: problem || full ? 'G' : 'f', wrap: true });
    ed.save.disabled = problem !== '' || full;
    ed.undo.disabled = history.length === 0;
  }

  function save() {
    draft.name = ed.name.value.trim().slice(0, 16) || t('newMapName', { n: maps.length + 1 });
    const next = saveCustomMap(deps.storage(), maps, draft);
    if (!next) return;
    maps = next;
    setup.map = draft.id;
    render();
    deps.show('custom', dom.play);
  }

  function bind() {
    dom.back.addEventListener('click', () => deps.show('start'));
    dom.newMap.addEventListener('click', () => openEditor(null));
    dom.edit.addEventListener('click', () => openEditor(maps.find((m) => m.id === setup.map) ?? null));
    dom.remove.addEventListener('click', () => {
      maps = deleteCustomMap(deps.storage(), maps, setup.map);
      setup.map = 'meadow';
      render();
    });
    for (const el of dom.gold.querySelectorAll('[data-gold]')) el.addEventListener('click', () => {
      setup.gold = /** @type {Setup['gold']} */ (el.getAttribute('data-gold'));
      render();
    });
    for (const el of dom.amount.querySelectorAll('[data-step]')) {
      say(/** @type {HTMLElement} */ (el), el.textContent ?? '', { color: 'w', size: 0 });
      el.addEventListener('click', () => {
        setup.amount = Math.min(GOLD_MAX, Math.max(GOLD_MIN, setup.amount + Number(el.getAttribute('data-step'))));
        render();
      });
    }
    for (const el of dom.enemiesMode.querySelectorAll('[data-enemies]')) el.addEventListener('click', () => {
      setup.enemies = /** @type {Setup['enemies']} */ (el.getAttribute('data-enemies'));
      render();
    });
    for (const el of document.querySelectorAll('#custom-pick [data-waves]')) {
      say(/** @type {HTMLElement} */ (el), el.textContent ?? '', { color: 'w', size: 0 });
      el.addEventListener('click', () => {
        setup.waves = Math.min(WAVES_MAX, Math.max(WAVES_MIN, setup.waves + Number(el.getAttribute('data-waves'))));
        render();
      });
    }
    dom.bosses.addEventListener('click', () => {
      setup.bosses = !setup.bosses;
      render();
    });
    for (const el of dom.difficulty.querySelectorAll('[data-difficulty]')) el.addEventListener('click', () => {
      setup.difficulty = Number(el.getAttribute('data-difficulty'));
      render();
    });
    dom.play.addEventListener('click', play);

    ed.back.addEventListener('click', () => deps.show('custom', dom.newMap));
    for (const el of ed.tool.querySelectorAll('[data-tool]')) el.addEventListener('click', () => {
      tool = /** @type {'road' | 'pads'} */ (el.getAttribute('data-tool'));
      renderEditor();
    });
    for (const el of ed.look.querySelectorAll('[data-look]')) el.addEventListener('click', () => {
      const look = el.getAttribute('data-look');
      if (look === 'meadow' || look === 'canyon' || look === 'marsh') draft.look = look;
      renderEditor();
    });
    ed.undo.addEventListener('click', () => {
      const last = history.pop();
      if (!last) return;
      draft.path = last.path;
      draft.pads = last.pads;
      renderEditor();
    });
    ed.clear.addEventListener('click', () => {
      if (draft.path.length === 0 && draft.pads.length === 0) return;
      snapshot();
      draft.path = [];
      draft.pads = [];
      renderEditor();
    });
    ed.save.addEventListener('click', save);
    ed.name.addEventListener('input', () => {
      draft.name = ed.name.value;
    });
    ed.canvas.addEventListener('pointerdown', (event) => {
      const cell = cellAt(event);
      if (!cell) return;
      event.preventDefault();
      painting = true;
      ed.canvas.setPointerCapture?.(event.pointerId);
      paint(cell, true);
    });
    ed.canvas.addEventListener('pointermove', (event) => {
      if (!painting || tool !== 'road') return;
      const cell = cellAt(event);
      if (cell) paint(cell, false);
    });
    const stop = () => {
      painting = false;
    };
    ed.canvas.addEventListener('pointerup', stop);
    ed.canvas.addEventListener('pointercancel', stop);
    addEventListener('resize', () => {
      const screen = document.getElementById('app')?.dataset.screen;
      if (screen === 'editor') sizeGrid();
      if (screen === 'custom') fitKinds();
    });
  }

  bind();
  renderKinds();
  render();
  return {
    /** Opens the setup screen. */
    open() {
      maps = readCustomMaps(deps.storage());
      deps.show('custom', dom.play);
      render();
    },
    render,
    setup,
    get maps() {
      return maps;
    },
  };
}

/**
 * The editor's grid: the look's ground, the road painted so far (with its entrance and
 * gate marked), the build spots as slabs, the grid lines faint. 16 art pixels a cell.
 * @param {HTMLCanvasElement} canvas @param {CustomMap} draft @param {ReturnType<typeof createTileset>} tiles
 */
function drawGrid(canvas, draft, tiles) {
  canvas.width = COLS * 16;
  canvas.height = ROWS * 16;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const ground = tiles.ground[0] ?? [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = ground[(c * 7 + r * 3) % 3];
      if (tile) ctx.drawImage(tile, c * 16, r * 16);
    }
  }
  const th = tiles.theme;
  draft.path.forEach(([c, r], i) => {
    ctx.fillStyle = PALETTE[th.road];
    ctx.fillRect(c * 16 + 1, r * 16 + 1, 14, 14);
    ctx.fillStyle = PALETTE[th.edge];
    ctx.fillRect(c * 16 + 1, r * 16 + 1, 14, 1);
    ctx.fillRect(c * 16 + 1, r * 16 + 14, 14, 1);
    ctx.fillRect(c * 16 + 1, r * 16 + 1, 1, 14);
    ctx.fillRect(c * 16 + 14, r * 16 + 1, 1, 14);
    // Joined to the cell before: no wall between them.
    const prev = draft.path[i - 1];
    if (prev) {
      ctx.fillStyle = PALETTE[th.road];
      const x = Math.min(c, prev[0]) * 16 + (prev[0] !== c ? 14 : 2);
      const y = Math.min(r, prev[1]) * 16 + (prev[1] !== r ? 14 : 2);
      ctx.fillRect(x, y, prev[0] !== c ? 4 : 12, prev[1] !== r ? 4 : 12);
    }
  });
  const first = draft.path[0];
  const last = draft.path[draft.path.length - 1];
  if (first) mark(ctx, first, PALETTE.f);
  if (last && last !== first) mark(ctx, last, last[1] === ROWS - 1 ? PALETTE.y : PALETTE.O);
  for (const [c, r] of draft.pads) ctx.drawImage(tiles.pad, c * 16, r * 16);
  ctx.fillStyle = 'rgba(26, 20, 35, 0.25)';
  for (let c = 1; c < COLS; c++) ctx.fillRect(c * 16, 0, 1, ROWS * 16);
  for (let r = 1; r < ROWS; r++) ctx.fillRect(0, r * 16, COLS * 16, 1);
}

/** A small square in a cell's middle: the road's start, its head, its end at the gate. @param {CanvasRenderingContext2D} ctx @param {Cell} cell @param {string} color */
function mark(ctx, cell, color) {
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(cell[0] * 16 + 5, cell[1] * 16 + 5, 6, 6);
  ctx.fillStyle = color;
  ctx.fillRect(cell[0] * 16 + 6, cell[1] * 16 + 6, 4, 4);
}

