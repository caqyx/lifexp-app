// @ts-check
// Strażnicy Doliny: drawing, in pixel art (docs/v2/PLAN.md 9.1, g td-1; pixel art td-2).
// Two small canvases the size of the art (a 16-pixel tile; layout.js), scaled up by the
// page by a whole number of device pixels with no smoothing: the ground (terrain.js, drawn
// once, again only when the water ripples) and the board over it, cleared and drawn every
// frame — towers, enemies, shots and effects, every position rounded to a whole art pixel.
// Moving things are placed between their last two simulation steps (view.alpha). Sprites
// (sprites.js) are made into canvases once, mirrored for facing left, and as white and
// icy silhouettes for a hit and a slow. Rendering only reads the game (js/sim.js).

import { ENEMY_TYPES, TOWERS, TOWER_TYPES } from './config.js';
import { ROWS } from './maps.js';
import { toScreen } from './layout.js';
import { EVENT_RING } from './sim.js';
import { addBurst, addFloat, addRing, plusLabel } from './effects.js';
import { PALETTE, createCanvas, drawText, makeSprite, measureText, silhouette } from './pixelart.js';
import { ENEMY_FPS, ENEMY_FRAMES, TOWER_TOPS } from './sprites.js';
import { createTileset, renderTerrain } from './terrain.js';

/** @typedef {import('./sim.js').Game} Game */
/** @typedef {import('./sim.js').Enemy} Enemy */
/** @typedef {import('./sim.js').Tower} Tower */
/** @typedef {import('./layout.js').Layout} Layout */
/** @typedef {import('./effects.js').Effects} Effects */
/** @typedef {import('./config.js').TowerType} TowerType */
/** @typedef {import('./config.js').EnemyType} EnemyType */
/** @typedef {{ selectedPad: number, previewType: TowerType | null, clock: number, reduced: boolean, alpha: number }} View */
/** @typedef {{ right: HTMLCanvasElement, left: HTMLCanvasElement, flashRight: HTMLCanvasElement, flashLeft: HTMLCanvasElement, iceRight: HTMLCanvasElement, iceLeft: HTMLCanvasElement }} Facing */

/** Colours of sparks and rings by kind (palette letters' colours). */
export const ENEMY_COLORS = /** @type {const} */ ({
  crawler: PALETTE.f,
  runner: PALETTE.y,
  shellback: PALETTE.G,
  moth: PALETTE.P,
  splitter: PALETTE.R,
  shard: PALETTE.O,
  colossus: PALETTE.R,
});

const WHITE = PALETTE.w;
const GOLD = PALETTE.y;
const BLAST = PALETTE.O;
const FROST_RING = PALETTE.C;
const LEAK = PALETTE.R;
const SHADOW = 'rgba(10, 8, 20, 0.35)';
/** How long one frame of the water lasts (the ground is redrawn then). */
const WATER_FRAME = 0.6;

const pt = { x: 0, y: 0 };
const prev = { x: 0, y: 0 };

// ── Sprites, made once ──────────────────────────────────────────────────────

/** @param {readonly string[]} rows @returns {Facing} */
function facingPair(rows) {
  const right = makeSprite(rows);
  const left = makeSprite(rows, { flip: true });
  return {
    right,
    left,
    flashRight: silhouette(right, WHITE),
    flashLeft: silhouette(left, WHITE),
    iceRight: silhouette(right, PALETTE.C),
    iceLeft: silhouette(left, PALETTE.C),
  };
}

/**
 * A tower's foundation by level: a wooden platform, a stone block, a taller stone block
 * with a gold band, battlements and pennants (16 wide).
 * @param {number} level
 */
function baseRows(level) {
  if (level === 1) {
    return ['kkkkkkkkkkkkkkkk', 'kNNNNnNNNNnNNNNk', 'knnnnnnnnnnnnnnk', '.kNk........kNk.', '.kkk........kkk.'];
  }
  if (level === 2) {
    return [
      'kk.kk.kkkk.kk.kk',
      'kGkkGkkGGkkGkkGk',
      'kGGGGGGGGGGGGGGk',
      'kgGgggGgggGgggGk',
      'kggggggggggggggk',
      'kgggGgggggGggggk',
      'kKKKKKKKKKKKKKKk',
      'kkkkkkkkkkkkkkkk',
    ];
  }
  return [
    'y..............y',
    'kyk.kk.kkkk.kkyk',
    'kGkkGkkGGkkGkkGk',
    'kGGGGGGGGGGGGGGk',
    'kyyyyyyyyyyyyyyk',
    'kgGgggGgggGgggGk',
    'kggggggggggggggk',
    'kgggGgggggGggggk',
    'kggggggggggggggk',
    'kKKKKKKKKKKKKKKk',
    'kkkkkkkkkkkkkkkk',
  ];
}

/**
 * A whole tower (top on its foundation) by level and frame, facing right.
 * @param {TowerType} type @param {number} level @param {number} frame
 */
function towerRows(type, level, frame) {
  const top = TOWER_TOPS[type][frame] ?? TOWER_TOPS[type][0] ?? [];
  const base = baseRows(level);
  const overlap = 2;
  const rows = [];
  for (const row of top) rows.push(`..${row}..`);
  for (let i = 0; i < base.length; i++) {
    const b = base[i] ?? '';
    if (i < overlap) {
      const above = rows[rows.length - overlap + i] ?? '';
      let merged = '';
      for (let x = 0; x < 16; x++) merged += above[x] !== '.' && above[x] !== undefined ? above[x] : b[x] ?? '.';
      rows[rows.length - overlap + i] = merged;
    } else rows.push(b);
  }
  return rows;
}

function createSprites() {
  /** @type {Record<string, Facing[]>} */
  const enemies = {};
  for (const type of ENEMY_TYPES) enemies[type] = ENEMY_FRAMES[type].map((rows) => facingPair(rows));
  /** @type {Record<string, Facing[][]>} tower type → level − 1 → frame */
  const towers = {};
  for (const type of TOWER_TYPES) {
    towers[type] = [1, 2, 3].map((level) => TOWER_TOPS[type].map((_, frame) => facingPair(towerRows(type, level, frame))));
  }
  const shadow = createCanvas(10, 3);
  shadow.ctx.fillStyle = SHADOW;
  shadow.ctx.fillRect(1, 0, 8, 3);
  shadow.ctx.fillRect(0, 1, 10, 1);
  return { enemies, towers, shadow: shadow.canvas };
}

/** @type {ReturnType<typeof createSprites> | null} */
let sharedSprites = null;
function sprites() {
  if (!sharedSprites) sharedSprites = createSprites();
  return sharedSprites;
}

/**
 * A tower as a small picture (the build sheet's icons).
 * @param {TowerType} type @param {number} [level]
 */
export function towerIcon(type, level = 1) {
  return sprites().towers[type]?.[level - 1]?.[0]?.right ?? createCanvas(16, 16).canvas;
}

/** An enemy as a small picture (the wave preview's icons). @param {EnemyType} type */
export function enemyIcon(type) {
  return sprites().enemies[type]?.[0]?.right ?? createCanvas(12, 12).canvas;
}

// ── The renderer ────────────────────────────────────────────────────────────

/**
 * @param {HTMLCanvasElement} canvas the board (what moves)
 * @param {HTMLCanvasElement} layer the ground under it (still)
 */
export function createRenderer(canvas, layer) {
  const ctx = canvas.getContext('2d');
  const layerCtx = layer.getContext('2d', { alpha: false });
  if (!ctx || !layerCtx) throw new Error('2d canvas missing');
  return {
    canvas,
    ctx,
    layer,
    layerCtx,
    layout: /** @type {Layout | null} */ (null),
    tiles: /** @type {import('./terrain.js').Tileset | null} */ (null),
    mapId: '',
    waterFrame: 0,
    lastSeq: 0,
    /** Which way each enemy (by pool slot) last walked on the screen: 1 right, −1 left. */
    facing: new Int8Array(512).fill(1),
    labels: /** @type {Map<string, HTMLCanvasElement>} */ (new Map()),
    /** What happened since the last frame, for the page (one object, reused). */
    news: { bossKilled: false, leaked: false, cleared: -1, wave: -1, boss: false },
  };
}

/** @typedef {ReturnType<typeof createRenderer>} Renderer */

/**
 * Sizes both canvases to the art and draws the ground for this map.
 * @param {Renderer} r @param {Layout} layout @param {Game} game
 */
export function resizeRenderer(r, layout, game) {
  r.layout = layout;
  for (const c of [r.canvas, r.layer]) {
    c.width = layout.width;
    c.height = layout.height;
  }
  r.ctx.imageSmoothingEnabled = false;
  r.layerCtx.imageSmoothingEnabled = false;
  if (r.mapId !== game.map.id || !r.tiles) {
    r.tiles = createTileset(game.map);
    r.mapId = game.map.id;
  }
  renderTerrain(r.layerCtx, layout, game.map, r.tiles, r.waterFrame);
}

/** The renderer forgets past events (a new game starts its own count). @param {Renderer} r @param {Game} game */
export function resetRenderer(r, game) {
  r.lastSeq = game.eventSeq;
  r.facing.fill(1);
}

/**
 * The water ripples: the ground is redrawn when its frame changes (Mokradła only; a still
 * frame with reduced motion).
 * @param {Renderer} r @param {Game} game @param {View} view
 */
function updateTerrain(r, game, view) {
  if (!r.tiles?.theme.water || !r.layout || view.reduced) return;
  const frame = Math.floor(view.clock / WATER_FRAME) % 2;
  if (frame === r.waterFrame) return;
  r.waterFrame = frame;
  renderTerrain(r.layerCtx, r.layout, game.map, r.tiles, frame);
}

// ── Every frame ─────────────────────────────────────────────────────────────

/**
 * Draws one frame of the board.
 * @param {Renderer} r @param {Game} game @param {Effects} fx @param {View} view
 */
export function renderFrame(r, game, fx, view) {
  const layout = r.layout;
  if (!layout) return;
  updateTerrain(r, game, view);
  const ctx = r.ctx;
  ctx.clearRect(0, 0, layout.width, layout.height);
  renderSelection(ctx, layout, game, view);
  renderTowers(ctx, layout, game, view);
  renderEnemies(r, ctx, layout, game, view, false);
  renderProjectiles(ctx, layout, game, view.alpha);
  renderEnemies(r, ctx, layout, game, view, true);
  renderEffects(r, ctx, layout, fx);
}

/**
 * A circle of pixels (midpoint algorithm), dashed when `dash` is set.
 * @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} radius @param {boolean} dash
 */
function pixelCircle(ctx, cx, cy, radius, dash) {
  let x = Math.round(radius);
  let y = 0;
  let err = 1 - x;
  let i = 0;
  while (x >= y) {
    if (!dash || i % 4 < 2) {
      ctx.fillRect(cx + x, cy + y, 1, 1);
      ctx.fillRect(cx + y, cy + x, 1, 1);
      ctx.fillRect(cx - y, cy + x, 1, 1);
      ctx.fillRect(cx - x, cy + y, 1, 1);
      ctx.fillRect(cx - x, cy - y, 1, 1);
      ctx.fillRect(cx - y, cy - x, 1, 1);
      ctx.fillRect(cx + y, cy - x, 1, 1);
      ctx.fillRect(cx + x, cy - y, 1, 1);
    }
    y += 1;
    i += 1;
    if (err < 0) err += 2 * y + 1;
    else {
      x -= 1;
      err += 2 * (y - x) + 1;
    }
  }
}

/** A filled disc of pixels, one row at a time. @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} radius */
function pixelDisc(ctx, cx, cy, radius) {
  const r = Math.round(radius);
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

/** The chosen pad (a blinking gold frame), the range and a ghost of the tower being picked. @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view */
function renderSelection(ctx, layout, game, view) {
  const pad = game.pads[view.selectedPad];
  if (!pad) return;
  const T = layout.tile;
  toScreen(layout, pad.x, pad.y, pt);
  const cx = Math.round(pt.x);
  const cy = Math.round(pt.y);
  const tower = game.towers[view.selectedPad];
  const type = tower ? tower.type : view.previewType;
  if (type) {
    const range = (TOWERS[type].range[(tower?.level ?? 1) - 1] ?? 0) * T;
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = WHITE;
    pixelDisc(ctx, cx, cy, range);
    ctx.globalAlpha = 0.85;
    pixelCircle(ctx, cx, cy, range, true);
    ctx.globalAlpha = 1;
  }
  const on = view.reduced || Math.floor(view.clock * 3) % 2 === 0;
  ctx.fillStyle = on ? GOLD : PALETTE.O;
  const x = cx - T / 2;
  const y = cy - T / 2;
  ctx.fillRect(x, y, T, 1);
  ctx.fillRect(x, y + T - 1, T, 1);
  ctx.fillRect(x, y, 1, T);
  ctx.fillRect(x + T - 1, y, 1, T);
  if (!tower && view.previewType) {
    ctx.globalAlpha = 0.6;
    drawTowerAt(ctx, view.previewType, 1, 0, 1, cx, cy + T / 2 - 1);
    ctx.globalAlpha = 1;
  }
}

/**
 * A tower's picture with its foot at (x, y) — the bottom of its pad.
 * @param {CanvasRenderingContext2D} ctx @param {TowerType} type @param {number} level @param {number} frame @param {number} facing @param {number} x @param {number} y
 */
function drawTowerAt(ctx, type, level, frame, facing, x, y) {
  const pair = sprites().towers[type]?.[level - 1]?.[frame];
  if (!pair) return;
  const img = facing < 0 ? pair.left : pair.right;
  ctx.drawImage(img, x - 8, y - img.height);
}

/** @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view */
function renderTowers(ctx, layout, game, view) {
  for (const tower of game.towers) {
    if (!tower) continue;
    toScreen(layout, tower.x, tower.y, pt);
    const frame = towerFrame(tower, view);
    const dx = layout.rotated ? Math.sin(tower.aim) : Math.cos(tower.aim);
    const facing = tower.type === 'frost' || tower.type === 'banner' ? 1 : dx < 0 ? -1 : 1;
    drawTowerAt(ctx, tower.type, tower.level, frame, facing, Math.round(pt.x), Math.round(pt.y) + layout.tile / 2 - 1);
  }
}

/**
 * The tower's frame: firing for a moment after a shot; the banner waves.
 * @param {Tower} tower @param {View} view
 */
function towerFrame(tower, view) {
  if (tower.type === 'banner') return view.reduced ? 0 : Math.floor(view.clock * 3 + tower.pad) % 2;
  return tower.fired > 0.04 ? 1 : 0;
}

/**
 * Enemies on the ground first, fliers after the shots (they are above them). Each walks
 * through its frames and faces the way it goes on the screen.
 * @param {Renderer} r @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view @param {boolean} fliers
 */
function renderEnemies(r, ctx, layout, game, view, fliers) {
  const sheet = sprites();
  const a = view.alpha;
  for (let i = 0; i < game.enemies.length; i++) {
    const enemy = /** @type {Enemy} */ (game.enemies[i]);
    if (!enemy.alive || enemy.flying !== fliers) continue;
    toScreen(layout, enemy.px + (enemy.x - enemy.px) * a, enemy.py + (enemy.y - enemy.py) * a, pt);
    toScreen(layout, enemy.px, enemy.py, prev);
    const dx = pt.x - prev.x;
    if (Math.abs(dx) > 0.001 && i < r.facing.length) r.facing[i] = dx < 0 ? -1 : 1;
    const frames = sheet.enemies[enemy.type];
    if (!frames) continue;
    const step = view.reduced ? 0 : Math.floor(view.clock * ENEMY_FPS[enemy.type] + enemy.id) % frames.length;
    const pair = frames[step] ?? frames[0];
    if (!pair) continue;
    const left = (r.facing[i] ?? 1) < 0;
    const img = enemy.flash > 0 ? (left ? pair.flashLeft : pair.flashRight) : left ? pair.left : pair.right;
    const x = Math.round(pt.x) - Math.floor(img.width / 2);
    const lift = enemy.flying ? 9 : 0;
    const foot = Math.round(pt.y) + 4;
    const y = foot - img.height - lift;
    ctx.drawImage(sheet.shadow, Math.round(pt.x) - 5, foot - 2);
    ctx.drawImage(img, x, y);
    if (enemy.slowLeft > 0 && enemy.flash <= 0) {
      ctx.globalAlpha = 0.45;
      ctx.drawImage(left ? pair.iceLeft : pair.iceRight, x, y);
      ctx.globalAlpha = 1;
    }
    if (enemy.hp < enemy.maxHp) drawHealth(ctx, enemy, Math.round(pt.x), y - 3);
  }
}

/** A two-pixel bar: green, then gold, then red. @param {CanvasRenderingContext2D} ctx @param {Enemy} enemy @param {number} cx @param {number} y */
function drawHealth(ctx, enemy, cx, y) {
  const w = enemy.boss ? 20 : 10;
  const share = Math.max(0, enemy.hp / enemy.maxHp);
  const x = cx - w / 2;
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = share > 0.6 ? PALETTE.f : share > 0.3 ? PALETTE.y : PALETTE.R;
  ctx.fillRect(x, y, Math.max(1, Math.round(w * share)), 2);
}

/**
 * Arrows and bolts as short pixel lines along their flight, shells as balls on an arc
 * over their shadow.
 * @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {number} a
 */
function renderProjectiles(ctx, layout, game, a) {
  for (const p of game.projectiles) {
    if (!p.alive) continue;
    toScreen(layout, p.px + (p.x - p.px) * a, p.py + (p.y - p.py) * a, pt);
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    if (p.kind === 'shell') {
      const k = Math.min(1, p.t / p.flight);
      const height = Math.round(Math.sin(Math.PI * k) * 14);
      ctx.fillStyle = SHADOW;
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillStyle = PALETTE.k;
      ctx.fillRect(x - 1, y - height - 1, 3, 3);
      ctx.fillStyle = PALETTE.g;
      ctx.fillRect(x - 1, y - height - 1, 1, 1);
      continue;
    }
    toScreen(layout, p.tx, p.ty, prev);
    const dx = prev.x - pt.x;
    const dy = prev.y - pt.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const bolt = p.kind === 'bolt';
    const tail = bolt ? 6 : 4;
    ctx.fillStyle = bolt ? PALETTE.N : PALETTE.B;
    for (let s = 1; s <= tail; s++) ctx.fillRect(Math.round(x - ux * s), Math.round(y - uy * s), bolt ? 2 : 1, bolt ? 2 : 1);
    ctx.fillStyle = bolt ? PALETTE.y : PALETTE.G;
    ctx.fillRect(x, y, bolt ? 2 : 1, bolt ? 2 : 1);
  }
}

/** Sparks as single pixels, rings as pixel circles, gold as pixel numbers rising. @param {Renderer} r @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Effects} fx */
function renderEffects(r, ctx, layout, fx) {
  const T = layout.tile;
  for (const ring of fx.rings) {
    if (!ring.alive) continue;
    const k = 1 - ring.life / ring.max;
    const eased = 1 - (1 - k) * (1 - k);
    toScreen(layout, ring.x, ring.y, pt);
    ctx.globalAlpha = k > 0.6 ? 0.5 : 1;
    ctx.fillStyle = ring.color;
    pixelCircle(ctx, Math.round(pt.x), Math.round(pt.y), (ring.from + (ring.to - ring.from) * eased) * T, false);
  }
  ctx.globalAlpha = 1;
  for (const s of fx.sparks) {
    if (!s.alive) continue;
    toScreen(layout, s.x, s.y, pt);
    ctx.fillStyle = s.color;
    const size = s.life / s.max > 0.5 && s.size > 0.075 ? 2 : 1;
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y), size, size);
  }
  for (const f of fx.floats) {
    if (!f.alive) continue;
    const k = 1 - f.life / f.max;
    toScreen(layout, f.x, f.y, pt);
    const label = labelSprite(r, f.text, f.color);
    ctx.globalAlpha = k > 0.7 ? 0.5 : 1;
    ctx.drawImage(label, Math.round(pt.x - label.width / 2), Math.round(pt.y - 10 - k * 8));
  }
  ctx.globalAlpha = 1;
}

/** A "+4" in the pixel font with its shadow, made once per text and colour. @param {Renderer} r @param {string} text @param {string} color */
function labelSprite(r, text, color) {
  const key = text + color;
  const cached = r.labels.get(key);
  if (cached) return cached;
  const { canvas, ctx } = createCanvas(measureText(text) + 2, 12);
  drawText(ctx, text, 0, 0, color, PALETTE.k);
  r.labels.set(key, canvas);
  return canvas;
}

// ── Events → effects ────────────────────────────────────────────────────────

/**
 * Starts the effects for the game's events since the last frame (none with reduced
 * motion, which only drops them) and says what the page should react to.
 * @param {Renderer} r @param {Game} game @param {Effects} fx @param {boolean} reduced
 */
export function consumeEvents(r, game, fx, reduced) {
  const from = Math.max(r.lastSeq, game.eventSeq - EVENT_RING);
  const news = r.news;
  news.bossKilled = false;
  news.leaked = false;
  news.cleared = -1;
  news.wave = -1;
  news.boss = false;
  for (let seq = from; seq < game.eventSeq; seq++) {
    const e = game.events[seq % EVENT_RING];
    if (!e) continue;
    noteNews(news, e);
    if (reduced) continue;
    if (e.type === 'hit') addBurst(fx, e.x, e.y, 1, WHITE, 1.2);
    else if (e.type === 'kill') {
      const color = ENEMY_COLORS[/** @type {EnemyType} */ (e.kind)] ?? WHITE;
      const boss = e.kind === 'colossus';
      addBurst(fx, e.x, e.y, boss ? 40 : 9, color, boss ? 4 : 2.4);
      addRing(fx, e.x, e.y, 0.1, boss ? 1.6 : 0.6, boss ? 0.6 : 0.3, color);
      addFloat(fx, e.x, e.y, plusLabel(e.value), GOLD);
    } else if (e.type === 'blast') {
      addRing(fx, e.x, e.y, 0.15, e.value, 0.35, BLAST);
      addBurst(fx, e.x, e.y, 6, BLAST, 2);
    } else if (e.type === 'pulse') addRing(fx, e.x, e.y, 0.3, e.value, 0.5, FROST_RING);
    else if (e.type === 'build' || e.type === 'upgrade') {
      addRing(fx, e.x, e.y, 0.2, 0.75, 0.45, GOLD);
      addBurst(fx, e.x, e.y, 8, GOLD, 1.6);
    } else if (e.type === 'leak') addRing(fx, e.x, Math.min(e.y, ROWS - 0.3), 0.2, 1, 0.5, LEAK);
    else if (e.type === 'sell') addFloat(fx, e.x, e.y, plusLabel(e.value), GOLD);
    else if (e.type === 'shot') addBurst(fx, e.x, e.y - 0.4, 1, WHITE, 0.6);
  }
  r.lastSeq = game.eventSeq;
  return news;
}

/**
 * What the page reacts to beyond the board: a Colossus down (a shake), a leak (a red
 * edge), a wave started or cleared (a banner).
 * @param {Renderer['news']} news @param {import('./sim.js').GameEvent} e
 */
function noteNews(news, e) {
  if (e.type === 'kill' && e.kind === 'colossus') news.bossKilled = true;
  else if (e.type === 'leak') news.leaked = true;
  else if (e.type === 'cleared') news.cleared = e.value;
  else if (e.type === 'wave') {
    news.wave = e.value;
    news.boss = e.kind === 'boss';
  }
}

/**
 * A small map preview for the map list: the ground of a map, upright, 1 art pixel per
 * 4 (a tile is 4 pixels).
 * @param {import('./maps.js').MapDef} map
 */
export function mapThumbnail(map) {
  const layout = {
    width: 9 * 16, height: 15 * 16, rotated: false, tile: 16, ox: 0, oy: 0,
    mapWidth: 9 * 16, mapHeight: 15 * 16, k: 1, dpr: 1, px: 1,
  };
  const full = createCanvas(layout.width, layout.height);
  renderTerrain(full.ctx, layout, map, createTileset(map), 0);
  const small = createCanvas(36, 60);
  small.ctx.drawImage(full.canvas, 0, 0, 36, 60);
  return small.canvas;
}

