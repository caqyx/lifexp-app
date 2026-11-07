// @ts-check
// Strażnicy Doliny: drawing, in pixel art (docs/v2/PLAN.md 9.1, td-1; pixel art td-2; more
// detail td-3). Two small canvases the size of the art (a 16-pixel tile; layout.js), scaled
// up by the page by a whole number of device pixels with no smoothing: the ground
// (terrain.js, drawn in two frames per size and swapped as the water ripples and the grass
// sways) and the board over it, cleared and drawn every frame — towers and enemies in depth
// order with their shadows, shots, particles, the map's air and light, every position
// rounded to a whole art pixel. Moving things are placed between their last two simulation
// steps (view.alpha). Characters (art.js) are made into canvases once, mirrored for facing
// left, and as white and icy silhouettes for a hit and a slow. Rendering only reads the
// game (js/sim.js).

import { ENEMY_TYPES, TOWERS, TOWER_TYPES } from './config.js';
import { COLS, ROWS } from './maps.js';
import { toScreen } from './layout.js';
import { EVENT_RING } from './sim.js';
import { addFloat, addRing, plusLabel } from './effects.js';
import { PALETTE, createCanvas, drawText, measureText, silhouette } from './pixelart.js';
import { TOWER_H, aimDir, enemyArt, towerArt } from './art.js';
import { GROUND_TO_AIR, boom, corpse, createParticles, emit, renderAmbience, renderBooms, renderCorpses, renderDecals, renderParticles, scorch, setAmbience, updateParticles } from './particles.js';
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
const WATER_FRAME = 0.8;

const pt = { x: 0, y: 0 };
const prev = { x: 0, y: 0 };

// ── Sprites, made once (on first use) ──────────────────────────────────────

/** @param {HTMLCanvasElement} img @returns {Facing} */
function facingPair(img) {
  const left = createCanvas(img.width, img.height);
  left.ctx.translate(img.width, 0);
  left.ctx.scale(-1, 1);
  left.ctx.drawImage(img, 0, 0);
  return {
    right: img,
    left: left.canvas,
    flashRight: silhouette(img, WHITE),
    flashLeft: silhouette(left.canvas, WHITE),
    iceRight: silhouette(img, PALETTE.C),
    iceLeft: silhouette(left.canvas, PALETTE.C),
  };
}

/** @type {Map<string, Facing[]>} */
const enemySheets = new Map();
/** @param {EnemyType} type @returns {Facing[]} */
function enemyFrames(type) {
  let frames = enemySheets.get(type);
  if (!frames) {
    const art = enemyArt(type);
    frames = Array.from({ length: art.frames }, (_, f) => facingPair(art.make(f)));
    enemySheets.set(type, frames);
  }
  return frames;
}

/** Tower pictures by type, level, direction (8) and state (idle, firing; frost and banner by frame). */
const towerSheet = /** @type {Map<number, HTMLCanvasElement>} */ (new Map());
/**
 * @param {TowerType} type @param {number} level @param {number} dir @param {number} state
 */
function towerSprite(type, level, dir, state) {
  const key = ((TOWER_TYPES.indexOf(type) * 3 + level - 1) * 8 + dir) * 4 + state;
  let img = towerSheet.get(key);
  if (!img) {
    const still = type === 'frost' || type === 'banner';
    img = towerArt(type, level, still ? 0 : dir, !still && state === 1, state);
    towerSheet.set(key, img);
  }
  return img;
}

/**
 * Makes every character picture up front (all aims, levels and frames), so a tower turning
 * a new way or a new kind of enemy never builds one in the middle of a wave. Once a page.
 */
function prewarmSprites() {
  if (towerSheet.size > 0) return;
  for (const type of TOWER_TYPES) {
    const still = type === 'frost' || type === 'banner';
    for (const level of [1, 2, 3]) {
      if (still) for (let state = 0; state < 4; state++) towerSprite(type, level, 0, state);
      else for (let dir = 0; dir < 8; dir++) for (const state of [0, 1]) towerSprite(type, level, dir, state);
    }
  }
  for (const type of ENEMY_TYPES) enemyFrames(type);
}

/** Soft pixel shadows by width (an oval of 35 % ink). */
const shadows = /** @type {Map<number, HTMLCanvasElement>} */ (new Map());
/** @param {number} w */
function shadowOf(w) {
  let img = shadows.get(w);
  if (!img) {
    const h = Math.max(3, Math.round(w / 3));
    const c = createCanvas(w, h);
    c.ctx.fillStyle = SHADOW;
    for (let y = 0; y < h; y++) {
      const half = Math.round((w / 2) * Math.sqrt(1 - ((y - (h - 1) / 2) / (h / 2)) ** 2));
      c.ctx.fillRect(Math.round(w / 2 - half), y, half * 2, 1);
    }
    img = c.canvas;
    shadows.set(w, img);
  }
  return img;
}

/**
 * A tower as a small picture (the build sheet's portraits, the upgrade preview).
 * @param {TowerType} type @param {number} [level]
 */
export function towerIcon(type, level = 1) {
  return towerSprite(type, level, 0, 0);
}

const portraits = /** @type {Map<string, HTMLCanvasElement>} */ (new Map());
/**
 * A tower framed like a little painting (the build sheet and the upgrade preview): a stone
 * frame with a lit top-left edge, grass and sky behind, the tower standing with its shadow.
 * @param {TowerType} type @param {number} [level]
 */
export function towerPortrait(type, level = 1) {
  const key = `${type}${level}`;
  let img = portraits.get(key);
  if (img) return img;
  const tower = towerSprite(type, level, 7, 0);
  const crop = portraitTop(level);
  const w = tower.width + 6;
  const h = TOWER_H - crop + 6;
  const { canvas, ctx } = createCanvas(w, h);
  const fill = (/** @type {keyof typeof PALETTE} */ c, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ ww, /** @type {number} */ hh) => {
    ctx.fillStyle = PALETTE[c];
    ctx.fillRect(x, y, ww, hh);
  };
  fill('k', 0, 0, w, h);
  fill('G', 1, 1, w - 2, h - 2);
  fill('K', 2, 2, w - 3, h - 3);
  fill('g', 2, 2, w - 4, h - 4);
  fill('u', 3, 3, w - 6, h - 6);
  fill('U', 3, h - 15, w - 6, 2);
  fill('E', 3, h - 13, w - 6, 10);
  fill('f', 3, h - 13, w - 6, 1);
  fill('e', 3, h - 5, w - 6, 2);
  const sh = shadowOf(16 + level * 2);
  ctx.drawImage(sh, Math.round(w / 2 - sh.width / 2) + 2, h - 6 - Math.ceil(sh.height / 2));
  ctx.drawImage(tower, 0, crop, tower.width, TOWER_H - crop, 3, 3, tower.width, TOWER_H - crop);
  img = canvas;
  portraits.set(key, img);
  return img;
}

/** The highest drawn row of any tower of a level (less 2), so a level's portraits share a height. @param {number} level */
function portraitTop(level) {
  let top = TOWER_H;
  for (const type of TOWER_TYPES) {
    const img = towerSprite(type, level, 7, 0);
    const data = img.getContext('2d')?.getImageData(0, 0, img.width, img.height).data;
    if (!data) return 0;
    for (let y = 0; y < top; y++) {
      let any = false;
      for (let x = 0; x < img.width && !any; x++) any = (data[(y * img.width + x) * 4 + 3] ?? 0) > 0;
      if (any) {
        top = y;
        break;
      }
    }
  }
  return Math.max(0, top - 2);
}

/** An enemy as a small picture (the wave preview's icons). @param {EnemyType} type */
export function enemyIcon(type) {
  return enemyFrames(type)[0]?.right ?? createCanvas(12, 12).canvas;
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
    /** The ground in its two frames (water and grass), drawn once per size; swapped by the clock. */
    groundFrames: /** @type {HTMLCanvasElement[]} */ ([]),
    lastSeq: 0,
    /** Which way each enemy (by pool slot) last walked on the screen: 1 right, −1 left. */
    facing: new Int8Array(512).fill(1),
    labels: /** @type {Map<string, HTMLCanvasElement>} */ (new Map()),
    /** Pixel particles, scorch marks, falling enemies and the map's air (particles.js). */
    parts: createParticles(),
    /** The clock of the last frame (particles move by the difference). */
    lastClock: 0,
    /** The light over the board, made once per size: a dithered vignette and the map's tint. */
    shade: /** @type {HTMLCanvasElement | null} */ (null),
    /** Pads in drawing order (top to bottom on the screen) and the enemies to draw, sorted. */
    padOrder: /** @type {number[]} */ ([]),
    order: new Int16Array(512),
    orderY: new Float32Array(512),
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
  prewarmSprites();
  if (r.mapId !== game.map.id || !r.tiles) {
    r.tiles = createTileset(game.map);
    r.mapId = game.map.id;
  }
  const tiles = r.tiles;
  r.groundFrames = [0, 1].map((f) => {
    const g = createCanvas(layout.width, layout.height);
    renderTerrain(g.ctx, layout, game.map, tiles, f);
    return g.canvas;
  });
  const first = r.groundFrames[r.waterFrame];
  if (first) r.layerCtx.drawImage(first, 0, 0);
  r.shade = createShade(layout, game.map.id);
  setAmbience(r.parts, game.map.id, layout.width, layout.height);
  r.padOrder = game.pads.map((_, i) => i);
  const at = { x: 0, y: 0 };
  const yOf = (/** @type {number} */ i) => {
    const pad = game.pads[i];
    if (pad) toScreen(layout, pad.x, pad.y, at);
    return at.y;
  };
  r.padOrder.sort((a, b) => yOf(a) - yOf(b));
}

/**
 * The light over the board, drawn once: a vignette in three dithered steps (pixel style,
 * no smooth gradient) and the map's time of day — Łąka plain day, Kanion a warm sunset,
 * Mokradła a blue dusk.
 * @param {Layout} layout @param {string} mapId
 */
function createShade(layout, mapId) {
  const { canvas, ctx } = createCanvas(layout.width, layout.height);
  if (mapId === 'canyon') {
    ctx.fillStyle = 'rgba(224, 122, 58, 0.10)';
    ctx.fillRect(0, 0, layout.width, layout.height);
  } else if (mapId === 'marsh') {
    ctx.fillStyle = 'rgba(30, 42, 90, 0.18)';
    ctx.fillRect(0, 0, layout.width, layout.height);
  }
  ctx.fillStyle = PALETTE.k;
  const cx = layout.ox + layout.mapWidth / 2;
  const cy = layout.oy + layout.mapHeight / 2;
  const rx = layout.mapWidth / 2;
  const ry = layout.mapHeight / 2;
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const step = d > 1.3 ? 3 : d > 1.05 ? 2 : d > 0.85 ? 1 : 0;
      if (step === 0) continue;
      // Ordered dithering: 1/4, 2/4 or 3/4 of the pixels get a light ink.
      const bayer = ((x & 1) * 2 + (y & 1) * 3) % 4;
      if (bayer < step) {
        ctx.globalAlpha = 0.12;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
}

/** The renderer forgets past events (a new game starts its own count). @param {Renderer} r @param {Game} game */
export function resetRenderer(r, game) {
  r.lastSeq = game.eventSeq;
  r.facing.fill(1);
  for (const b of r.parts.bits) b.alive = false;
  for (const d of r.parts.decals) d.alive = false;
  for (const c of r.parts.corpses) c.alive = false;
  for (const b of r.parts.booms) b.alive = false;
}

/**
 * The water ripples and the grass sways: the ground's two frames swap (a still frame with
 * reduced motion).
 * @param {Renderer} r @param {Game} _game @param {View} view
 */
function updateTerrain(r, _game, view) {
  if (view.reduced) return;
  const frame = Math.floor(view.clock / WATER_FRAME) % 2;
  if (frame === r.waterFrame) return;
  const img = r.groundFrames[frame];
  if (!img) return;
  r.waterFrame = frame;
  r.layerCtx.drawImage(img, 0, 0);
}

// ── Every frame ─────────────────────────────────────────────────────────────

/**
 * Draws one frame of the board: scorch marks, towers and walking enemies by depth (top of
 * the screen first, so nearer things overlap farther ones), shots, fliers, particles, the
 * map's air, torches at the gate and the light.
 * @param {Renderer} r @param {Game} game @param {Effects} fx @param {View} view
 */
export function renderFrame(r, game, fx, view) {
  const layout = r.layout;
  if (!layout) return;
  updateTerrain(r, game, view);
  const dt = Math.max(0, Math.min(0.1, view.clock - r.lastClock));
  r.lastClock = view.clock;
  updateParticles(r.parts, dt, layout.width, layout.height, view.reduced);
  const ctx = r.ctx;
  ctx.clearRect(0, 0, layout.width, layout.height);
  renderDecals(ctx, r.parts);
  renderSelection(ctx, layout, game, view);
  renderDepth(r, ctx, layout, game, view);
  renderCorpses(ctx, r.parts);
  renderProjectiles(r, ctx, layout, game, view);
  renderFliers(r, ctx, layout, game, view);
  renderBooms(ctx, r.parts);
  renderParticles(ctx, r.parts);
  renderEffects(r, ctx, layout, fx);
  renderAmbience(ctx, r.parts, view.reduced ? 0 : view.clock);
  if (game.map.id === 'marsh') renderFog(ctx, layout, view);
  renderTorches(ctx, layout, game, view);
  if (r.shade) ctx.drawImage(r.shade, 0, 0);
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
  for (const [dx, dy, w, h] of CORNERS) ctx.fillRect(x + dx, y + dy, w, h);
  if (!tower && view.previewType) {
    ctx.globalAlpha = 0.6;
    const img = towerSprite(view.previewType, 1, 0, 0);
    ctx.drawImage(img, cx - img.width / 2, cy + T / 2 - img.height);
    ctx.globalAlpha = 1;
  }
}

/** The selection frame: four corner brackets round the tile. */
const CORNERS = /** @type {const} */ ([
  [0, 0, 5, 1], [0, 0, 1, 5], [11, 0, 5, 1], [15, 0, 1, 5],
  [0, 15, 5, 1], [0, 11, 1, 5], [11, 15, 5, 1], [15, 11, 1, 5],
]);

/**
 * Towers and ground enemies in depth order: the pads are sorted once; the enemies each
 * frame (a small insertion sort, no allocation); the two lists are merged as they are drawn.
 * @param {Renderer} r @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view
 */
function renderDepth(r, ctx, layout, game, view) {
  const n = collectEnemies(r, layout, game, view, false);
  let e = 0;
  for (const padIndex of r.padOrder) {
    const tower = game.towers[padIndex];
    if (!tower) continue;
    toScreen(layout, tower.x, tower.y, pt);
    const footY = Math.round(pt.y) + layout.tile / 2 - 1;
    while (e < n && (r.orderY[e] ?? 0) < footY) drawEnemy(r, ctx, layout, game, view, r.order[e++] ?? 0);
    drawTower(ctx, layout, tower, view, Math.round(pt.x), footY);
  }
  while (e < n) drawEnemy(r, ctx, layout, game, view, r.order[e++] ?? 0);
}

/**
 * Fills r.order with the slots of the enemies to draw (ground or fliers), sorted by their
 * foot on the screen. Returns how many.
 * @param {Renderer} r @param {Layout} layout @param {Game} game @param {View} view @param {boolean} fliers
 */
function collectEnemies(r, layout, game, view, fliers) {
  let n = 0;
  const a = view.alpha;
  for (let i = 0; i < game.enemies.length && n < r.order.length; i++) {
    const enemy = /** @type {Enemy} */ (game.enemies[i]);
    if (!enemy.alive || enemy.flying !== fliers) continue;
    toScreen(layout, enemy.px + (enemy.x - enemy.px) * a, enemy.py + (enemy.y - enemy.py) * a, pt);
    let j = n;
    while (j > 0 && (r.orderY[j - 1] ?? 0) > pt.y) {
      r.order[j] = r.order[j - 1] ?? 0;
      r.orderY[j] = r.orderY[j - 1] ?? 0;
      j -= 1;
    }
    r.order[j] = i;
    r.orderY[j] = pt.y;
    n += 1;
  }
  return n;
}

/**
 * A tower with its shadow: aimed at its target (8 directions on the screen), firing for a
 * moment after a shot; the frost crystals sparkle and the banner waves.
 * @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Tower} tower @param {View} view @param {number} x @param {number} footY
 */
function drawTower(ctx, layout, tower, view, x, footY) {
  const screenAim = layout.rotated ? tower.aim - Math.PI / 2 : tower.aim;
  const still = tower.type === 'frost' || tower.type === 'banner';
  const frame = view.reduced ? 0 : Math.floor(view.clock * 4 + tower.pad) % 4;
  const state = still ? frame : tower.fired > 0.04 ? 1 : 0;
  const img = towerSprite(tower.type, tower.level, still ? 0 : aimDir(screenAim), state);
  const sh = shadowOf(18 + tower.level * 2);
  ctx.drawImage(sh, x - sh.width / 2 + 2, footY - Math.ceil(sh.height / 2));
  ctx.drawImage(img, x - img.width / 2, footY - TOWER_H + 1);
}

/**
 * One enemy: its walk frame, facing the way it goes, its shadow, a white flash when hit,
 * an icy tint when slowed, and its health.
 * @param {Renderer} r @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view @param {number} i
 */
function drawEnemy(r, ctx, layout, game, view, i) {
  const enemy = /** @type {Enemy} */ (game.enemies[i]);
  const a = view.alpha;
  toScreen(layout, enemy.px + (enemy.x - enemy.px) * a, enemy.py + (enemy.y - enemy.py) * a, pt);
  toScreen(layout, enemy.px, enemy.py, prev);
  const dx = pt.x - prev.x;
  if (Math.abs(dx) > 0.001 && i < r.facing.length) r.facing[i] = dx < 0 ? -1 : 1;
  const frames = enemyFrames(enemy.type);
  const art = enemyArt(enemy.type);
  const step = view.reduced ? 0 : Math.floor(view.clock * art.fps + enemy.id) % frames.length;
  const pair = frames[step] ?? frames[0];
  if (!pair) return;
  const left = (r.facing[i] ?? 1) < 0;
  const img = enemy.flash > 0 ? (left ? pair.flashLeft : pair.flashRight) : left ? pair.left : pair.right;
  const cx = Math.round(pt.x);
  const foot = Math.round(pt.y) + 5;
  const lift = enemy.flying ? GROUND_TO_AIR + Math.round(Math.sin(view.clock * 3 + enemy.id) * (view.reduced ? 0 : 1.5)) : 0;
  const x = cx - Math.floor(img.width / 2);
  const y = foot - img.height - lift;
  const sh = shadowOf(enemy.boss ? 30 : Math.max(10, img.width - 6));
  ctx.drawImage(sh, cx - sh.width / 2, foot - Math.ceil(sh.height / 2) - 1);
  ctx.drawImage(img, x, y);
  if (enemy.slowLeft > 0 && enemy.flash <= 0) {
    ctx.globalAlpha = 0.45;
    ctx.drawImage(left ? pair.iceLeft : pair.iceRight, x, y);
    ctx.globalAlpha = 1;
  }
  if (enemy.hp < enemy.maxHp) drawHealth(ctx, enemy, cx, y - 3);
}

/** The fliers, after the shots (they are above them), sorted the same way. @param {Renderer} r @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view */
function renderFliers(r, ctx, layout, game, view) {
  const n = collectEnemies(r, layout, game, view, true);
  for (let e = 0; e < n; e++) drawEnemy(r, ctx, layout, game, view, r.order[e] ?? 0);
}

/** A two-pixel bar: green, then gold, then red. @param {CanvasRenderingContext2D} ctx @param {Enemy} enemy @param {number} cx @param {number} y */
function drawHealth(ctx, enemy, cx, y) {
  const w = enemy.boss ? 24 : 12;
  const share = Math.max(0, enemy.hp / enemy.maxHp);
  const x = cx - w / 2;
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = share > 0.6 ? PALETTE.f : share > 0.3 ? PALETTE.y : PALETTE.R;
  ctx.fillRect(x, y, Math.max(1, Math.round(w * share)), 2);
}

/**
 * Arrows and bolts as short pixel lines with a fading trail, shells as balls on an arc
 * over their shadow.
 * @param {Renderer} r @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view
 */
function renderProjectiles(r, ctx, layout, game, view) {
  const a = view.alpha;
  for (const p of game.projectiles) {
    if (!p.alive) continue;
    toScreen(layout, p.px + (p.x - p.px) * a, p.py + (p.y - p.py) * a, pt);
    const x = Math.round(pt.x);
    const y = Math.round(pt.y) - 6;
    if (p.kind === 'shell') {
      const k = Math.min(1, p.t / p.flight);
      const height = Math.round(Math.sin(Math.PI * k) * 18);
      ctx.fillStyle = SHADOW;
      ctx.fillRect(x - 1, y + 6, 4, 2);
      ctx.fillStyle = PALETTE.k;
      ctx.fillRect(x - 1, y - height - 1, 4, 4);
      ctx.fillStyle = PALETTE.g;
      ctx.fillRect(x, y - height, 2, 2);
      ctx.fillStyle = PALETTE.O;
      ctx.fillRect(x + 2, y - height - 2, 1, 1);
      if (!view.reduced && Math.floor(view.clock * 30) % 3 === 0) emit(r.parts, 'smoke', x, y - height, 1, PALETTE.G, 2);
      continue;
    }
    toScreen(layout, p.tx, p.ty, prev);
    const dx = prev.x - pt.x;
    const dy = prev.y - 6 - (pt.y - 6);
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const bolt = p.kind === 'bolt';
    const tail = bolt ? 7 : 5;
    ctx.fillStyle = bolt ? PALETTE.N : PALETTE.b;
    for (let s = 1; s <= tail; s++) ctx.fillRect(Math.round(x - ux * s), Math.round(y - uy * s), bolt ? 2 : 1, bolt ? 2 : 1);
    ctx.fillStyle = bolt ? PALETTE.y : PALETTE.G;
    ctx.fillRect(x, y, bolt ? 2 : 1, bolt ? 2 : 1);
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(Math.round(x - ux * tail), Math.round(y - uy * tail), 1, 1);
    if (!view.reduced) emit(r.parts, 'trail', x - ux * tail, y - uy * tail, 1, bolt ? PALETTE.Y : PALETTE.w, 0);
  }
}

/** Fog drifting over the marsh: a few wide, faint bands. @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {View} view */
function renderFog(ctx, layout, view) {
  ctx.fillStyle = PALETTE.C;
  for (let i = 0; i < 4; i++) {
    const y = Math.round(((i * 67 + (view.reduced ? 0 : view.clock * 3)) % (layout.height + 40)) - 20);
    const x = Math.round(Math.sin(view.clock * 0.3 + i) * 12);
    ctx.globalAlpha = 0.06;
    ctx.fillRect(x - 10, y, layout.width + 20, 6);
    ctx.fillRect(x + 8, y - 2, layout.width - 30, 2);
    ctx.fillRect(x - 4, y + 6, layout.width - 10, 2);
  }
  ctx.globalAlpha = 1;
}

/** Torches beside the gate: a flickering flame and its glow. @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view */
function renderTorches(ctx, layout, game, view) {
  const last = game.map.road[game.map.road.length - 1];
  if (!last) return;
  const exit = Math.round(last[0]);
  for (const side of SIDES) {
    tileTop(layout, exit + side * 2, ROWS - 1, pt);
    const x = Math.round(pt.x) + 8;
    const y = Math.round(pt.y) + 4;
    const flick = view.reduced ? 0 : Math.floor(view.clock * 10 + side) % 3;
    ctx.globalAlpha = 0.18 + flick * 0.04;
    ctx.fillStyle = PALETTE.O;
    pixelDisc(ctx, x, y - 2, 6 + (flick === 1 ? 1 : 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.n;
    ctx.fillRect(x, y, 1, 6);
    ctx.fillStyle = PALETTE.R;
    ctx.fillRect(x - 1, y - 3 - (flick === 2 ? 1 : 0), 3, 3);
    ctx.fillStyle = PALETTE.y;
    ctx.fillRect(x, y - 2 - flick % 2, 1, 2);
  }
}

const SIDES = /** @type {const} */ ([-1, 1]);

/** The art position of a map cell's top-left corner. @param {Layout} layout @param {number} c @param {number} r @param {{ x: number, y: number }} out */
function tileTop(layout, c, r, out) {
  if (layout.rotated) {
    out.x = layout.ox + r * layout.tile;
    out.y = layout.oy + (COLS - 1 - c) * layout.tile;
  } else {
    out.x = layout.ox + c * layout.tile;
    out.y = layout.oy + r * layout.tile;
  }
}

/** Rings as pixel circles, gold as pixel numbers rising. @param {Renderer} r @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Effects} fx */
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
  for (const f of fx.floats) {
    if (!f.alive) continue;
    const k = 1 - f.life / f.max;
    toScreen(layout, f.x, f.y, pt);
    const label = labelSprite(r, f.text, f.color);
    ctx.globalAlpha = k > 0.7 ? 0.5 : 1;
    ctx.drawImage(label, Math.round(pt.x - label.width / 2), Math.round(pt.y - 18 - k * 8));
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
    if (reduced || !r.layout) continue;
    startEffects(r, fx, e);
  }
  r.lastSeq = game.eventSeq;
  return news;
}

/**
 * The pixels an event throws up: sparks on a hit; on a kill the enemy falling apart with
 * debris, a puff and its gold; a shell's blast with debris, smoke and a scorch mark; frost
 * snow round a pulse; dust when a tower goes up; a puff from a mortar's barrel.
 * @param {Renderer} r @param {Effects} fx @param {import('./sim.js').GameEvent} e
 */
function startEffects(r, fx, e) {
  const layout = /** @type {Layout} */ (r.layout);
  const parts = r.parts;
  toScreen(layout, e.x, e.y, pt);
  const x = pt.x;
  const y = pt.y;
  const T = layout.tile;
  if (e.type === 'hit') emit(parts, 'spark', x, y - 6, 2, PALETTE.Y, 30);
  else if (e.type === 'kill') {
    const type = /** @type {EnemyType} */ (e.kind);
    const boss = type === 'colossus';
    const frames = enemyFrames(type);
    const pair = frames[0];
    if (pair) corpse(parts, x, y + 5, pair.right, pair.flashRight);
    const color = ENEMY_COLORS[type] ?? WHITE;
    emit(parts, 'debris', x, y - 4, boss ? 30 : 8, color, boss ? 70 : 45);
    emit(parts, 'smoke', x, y - 2, boss ? 10 : 3, PALETTE.G, 6);
    if (boss) emit(parts, 'spark', x, y - 10, 16, PALETTE.y, 70);
    addRing(fx, e.x, e.y, 0.1, boss ? 1.6 : 0.6, boss ? 0.6 : 0.3, color);
    addFloat(fx, e.x, e.y, plusLabel(e.value), GOLD);
  } else if (e.type === 'blast') {
    addRing(fx, e.x, e.y, 0.15, e.value, 0.35, BLAST);
    boom(parts, x, y - 2, Math.max(4, Math.round(e.value * T * 0.4)));
    emit(parts, 'spark', x, y - 2, 10, PALETTE.O, 60);
    emit(parts, 'debris', x, y - 2, 8, PALETTE.N, 50);
    emit(parts, 'smoke', x, y - 2, 6, PALETTE.g, 8);
    scorch(parts, x, y + 2, Math.max(3, Math.round(e.value * T * 0.45)));
  } else if (e.type === 'pulse') {
    addRing(fx, e.x, e.y, 0.3, e.value, 0.5, FROST_RING);
    emit(parts, 'snow', x, y - 6, 10, PALETTE.w, 22);
  } else if (e.type === 'build' || e.type === 'upgrade') {
    addRing(fx, e.x, e.y, 0.2, 0.75, 0.45, GOLD);
    emit(parts, 'smoke', x, y + 4, 8, PALETTE.B, 10);
    emit(parts, 'spark', x, y - 8, 8, PALETTE.y, 40);
  } else if (e.type === 'leak') addRing(fx, e.x, Math.min(e.y, ROWS - 0.3), 0.2, 1, 0.5, LEAK);
  else if (e.type === 'sell') {
    addFloat(fx, e.x, e.y, plusLabel(e.value), GOLD);
    emit(parts, 'smoke', x, y + 2, 8, PALETTE.G, 10);
  } else if (e.type === 'shot' && e.kind === 'mortar') emit(parts, 'smoke', x, y - 14, 3, PALETTE.G, 6);
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

