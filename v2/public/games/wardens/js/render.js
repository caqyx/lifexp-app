// @ts-check
// Strażnicy Doliny: drawing. The ground, the road and the build pads go onto a canvas of
// their own under the board (drawn once per size and map, never per frame); every frame
// clears the board and draws towers, enemies, shots and effects, each moving thing
// placed between its last two steps (interpolation, view.alpha). Previously: onto a layer
// drawn once per size and map; every frame copies it and draws towers, enemies, shots
// and effects on top. Rendering only reads the game (js/sim.js); the effects it starts
// from the game's events live in js/effects.js. All art is drawn here — no image files.
// Nothing here allocates per frame: colours are constants, points go through `pt`.

import { ENEMIES, ENEMY_TYPES, TOWERS, TOWER_TYPES } from './config.js';
import { COLS, ROWS, pointAt, roadTiles } from './maps.js';
import { mapTransform, toScreen } from './layout.js';
import { EVENT_RING } from './sim.js';
import { addBurst, addFloat, addRing, plusLabel } from './effects.js';

/** @typedef {import('./sim.js').Game} Game */
/** @typedef {import('./sim.js').Enemy} Enemy */
/** @typedef {import('./sim.js').Tower} Tower */
/** @typedef {import('./layout.js').Layout} Layout */
/** @typedef {import('./effects.js').Effects} Effects */
/** @typedef {import('./config.js').TowerType} TowerType */
/** @typedef {import('./config.js').EnemyType} EnemyType */
/** @typedef {{ selectedPad: number, previewType: TowerType | null, clock: number, reduced: boolean, alpha: number }} View */

export const TOWER_COLORS = /** @type {const} */ ({
  archer: '#6fd08c',
  mortar: '#ff9a52',
  frost: '#9fe2ff',
  ballista: '#e0a86a',
  banner: '#b9a2ff',
});

export const ENEMY_COLORS = /** @type {const} */ ({
  crawler: '#a5cf5f',
  runner: '#f4c84f',
  shellback: '#8f9dbb',
  moth: '#e0a8ff',
  splitter: '#ff8c6b',
  shard: '#ffb59c',
  colossus: '#d6505e',
});

const INK = '#14161c';
const WHITE = '#ffffff';
const STONE = '#767b88';
const STONE_RIM = '#a3a8b6';
const SILVER = '#d8dde8';
const GOLD = '#ffd166';
const SHADOW = 'rgba(0, 0, 0, 0.28)';
const HP_BACK = 'rgba(0, 0, 0, 0.55)';
const HP_HIGH = '#4ecca3';
const HP_MID = '#ffd166';
const HP_LOW = '#ff6b6b';
const SLOW_RING = 'rgba(159, 226, 255, 0.9)';
const RANGE_FILL = 'rgba(255, 255, 255, 0.08)';
const RANGE_STROKE = 'rgba(255, 255, 255, 0.55)';
const PAD_SELECTED = 'rgba(255, 209, 102, 0.95)';
const ARROW = '#f4e3b5';
const BOLT = '#ffcf8a';
const SHELL = '#2b2f38';
const LEAK = '#ff6b6b';
const FROST_RING = '#9fe2ff';
const BLAST = '#ffb35c';
const GOLD_TEXT = '#ffe08a';

const pt = { x: 0, y: 0 };
const SIDES = /** @type {const} */ ([-1, 1]);
const ahead = { x: 0, y: 0 };

/**
 * @param {HTMLCanvasElement} canvas the board (what moves)
 * @param {HTMLCanvasElement} layer the ground under it (still)
 */
export function createRenderer(canvas, layer) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas missing');
  const layerCtx = layer.getContext('2d', { alpha: false });
  if (!layerCtx) throw new Error('2d canvas missing');
  return {
    canvas,
    ctx,
    layer,
    layerCtx,
    dpr: 1,
    layout: /** @type {Layout | null} */ (null),
    lastSeq: 0,
    /** The floating numbers' font, sized with the tiles (set on resize, not per frame). */
    font: '700 12px system-ui, sans-serif',
    /**
     * Pre-drawn sprites, made on first use for this size and density: drawing a small
     * picture is far cheaper for a phone than the paths it is made of (see spriteFor).
     */
    enemySprites: /** @type {(HTMLCanvasElement | null)[]} */ ([]),
    towerSprites: /** @type {(HTMLCanvasElement | null)[]} */ ([]),
    labels: /** @type {Map<string, HTMLCanvasElement>} */ (new Map()),
    /** What happened since the last frame, for the page (one object, reused). */
    news: { bossKilled: false, leaked: false, cleared: -1, wave: -1, boss: false },
  };
}

/** @typedef {ReturnType<typeof createRenderer>} Renderer */

/**
 * Sizes the canvas to the stage and redraws the ground layer for this map.
 * @param {Renderer} r @param {Layout} layout @param {number} dpr @param {Game} game
 */
export function resizeRenderer(r, layout, dpr, game) {
  r.layout = layout;
  r.dpr = dpr;
  for (const c of [r.canvas, r.layer]) {
    c.width = Math.max(1, Math.round(layout.width * dpr));
    c.height = Math.max(1, Math.round(layout.height * dpr));
  }
  r.font = `700 ${Math.max(12, Math.round(0.34 * layout.tile))}px system-ui, sans-serif`;
  r.enemySprites = new Array(ENEMY_TYPES.length * HEADINGS * FRAMES).fill(null);
  r.towerSprites = new Array(TOWER_TYPES.length * 3 * AIMS * 2).fill(null);
  r.labels = new Map();
  renderGround(r.layerCtx, layout, dpr, game);
}

/** The renderer forgets past events (a new game starts its own count). @param {Renderer} r @param {Game} game */
export function resetRenderer(r, game) {
  r.lastSeq = game.eventSeq;
}

// ── The ground layer ────────────────────────────────────────────────────────

/** A stable pseudo-random number in [0, 1) for a tile (decorations repeat every visit). */
function tileNoise(/** @type {number} */ c, /** @type {number} */ r, /** @type {number} */ salt) {
  const n = Math.sin(c * 127.1 + r * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {number} dpr @param {Game} game */
function renderGround(ctx, layout, dpr, game) {
  const theme = game.map.theme;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const [a, b, c, d, e, f] = mapTransform(layout);
  ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
  renderTiles(ctx, theme);
  renderDecorations(ctx, game, layout.rotated);
  renderRoad(ctx, game);
  renderPads(ctx, game);
  renderGate(ctx, game);
  renderVignette(ctx, layout, dpr);
}

/**
 * Soft light on the board: brighter in the middle, darker toward the edges (drawn once
 * with the ground, so it costs nothing per frame).
 * @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {number} dpr
 */
function renderVignette(ctx, layout, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = layout.ox + layout.mapWidth / 2;
  const cy = layout.oy + layout.mapHeight / 2;
  const radius = Math.hypot(layout.mapWidth, layout.mapHeight) / 2;
  const light = ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius);
  light.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
  light.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
  light.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
  ctx.fillStyle = light;
  ctx.fillRect(layout.ox, layout.oy, layout.mapWidth, layout.mapHeight);
}

/** @param {CanvasRenderingContext2D} ctx @param {Game['map']['theme']} theme */
function renderTiles(ctx, theme) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? theme.ground : theme.groundAlt;
      ctx.fillRect(c, r, 1.01, 1.01);
    }
  }
}

/**
 * Tufts, stones and reeds on tiles off the road and the pads, standing up on the screen
 * (turned, the screen's "up" is the map's +x).
 * @param {CanvasRenderingContext2D} ctx @param {Game} game @param {boolean} rotated
 */
function renderDecorations(ctx, game, rotated) {
  const ux = rotated ? 1 : 0;
  const uy = rotated ? 0 : -1;
  const road = roadTiles(game.map);
  const pads = new Set(game.map.pads.map(([c, r]) => `${c},${r}`));
  ctx.fillStyle = game.map.theme.deco;
  ctx.strokeStyle = game.map.theme.deco;
  ctx.lineWidth = 0.05;
  ctx.lineCap = 'round';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${c},${r}`;
      if (road.has(key) || pads.has(key) || tileNoise(c, r, 1) > 0.55) continue;
      const x = c + 0.2 + tileNoise(c, r, 2) * 0.6;
      const y = r + 0.25 + tileNoise(c, r, 3) * 0.5;
      ctx.globalAlpha = 0.55;
      if (game.map.id === 'canyon') renderStone(ctx, x, y, 0.08 + tileNoise(c, r, 4) * 0.08);
      else if (game.map.id === 'marsh') renderReeds(ctx, x, y, ux, uy);
      else renderTuft(ctx, x, y, ux, uy);
    }
  }
  ctx.globalAlpha = 1;
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} ux @param {number} uy */
function renderTuft(ctx, x, y, ux, uy) {
  const sx = -uy;
  const sy = ux;
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    ctx.moveTo(x - ux * 0.1 + sx * i * 0.06, y - uy * 0.1 + sy * i * 0.06);
    ctx.lineTo(x + ux * 0.08 + sx * i * 0.11, y + uy * 0.08 + sy * i * 0.11);
  }
  ctx.stroke();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} size */
function renderStone(ctx, x, y, size) {
  ctx.beginPath();
  ctx.ellipse(x, y, size * 1.4, size, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} ux @param {number} uy */
function renderReeds(ctx, x, y, ux, uy) {
  const sx = -uy;
  const sy = ux;
  ctx.beginPath();
  ctx.ellipse(x - ux * 0.12, y - uy * 0.12, ux ? 0.07 : 0.2, ux ? 0.2 : 0.07, 0, 0, Math.PI * 2);
  ctx.globalAlpha = 0.25;
  ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(x - ux * 0.1 - sx * 0.05, y - uy * 0.1 - sy * 0.05);
  ctx.lineTo(x + ux * 0.18 - sx * 0.08, y + uy * 0.18 - sy * 0.08);
  ctx.moveTo(x - ux * 0.1 + sx * 0.04, y - uy * 0.1 + sy * 0.04);
  ctx.lineTo(x + ux * 0.12 + sx * 0.07, y + uy * 0.12 + sy * 0.07);
  ctx.stroke();
}

/** @param {CanvasRenderingContext2D} ctx @param {Game} game */
function renderRoad(ctx, game) {
  const { xs, ys } = game.path;
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(xs[0] ?? 0, ys[0] ?? 0);
    for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i] ?? 0, ys[i] ?? 0);
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.strokeStyle = game.map.theme.roadEdge;
  ctx.lineWidth = 0.9;
  trace();
  ctx.stroke();
  ctx.strokeStyle = game.map.theme.road;
  ctx.lineWidth = 0.74;
  trace();
  ctx.stroke();
  ctx.setLineDash([0.18, 0.32]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 0.05;
  trace();
  ctx.stroke();
  ctx.setLineDash([]);
}

/** The build pads: light stone squares, so they read as "you can build here". @param {CanvasRenderingContext2D} ctx @param {Game} game */
function renderPads(ctx, game) {
  for (const pad of game.pads) {
    ctx.fillStyle = SHADOW;
    roundRect(ctx, pad.x - 0.4, pad.y - 0.36, 0.8, 0.8, 0.14);
    ctx.fill();
    ctx.fillStyle = game.map.theme.pad;
    roundRect(ctx, pad.x - 0.4, pad.y - 0.4, 0.8, 0.8, 0.14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 0.04;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.moveTo(pad.x - 0.12, pad.y);
    ctx.lineTo(pad.x + 0.12, pad.y);
    ctx.moveTo(pad.x, pad.y - 0.12);
    ctx.lineTo(pad.x, pad.y + 0.12);
    ctx.stroke();
  }
}

/** The valley's gate where the road leaves the map: what the lives stand for. @param {CanvasRenderingContext2D} ctx @param {Game} game */
function renderGate(ctx, game) {
  const last = game.path.xs.length - 1;
  const x = game.path.xs[last] ?? 0;
  const y = ROWS - 0.45;
  ctx.fillStyle = '#5b5f6b';
  ctx.fillRect(x - 0.75, y - 0.3, 0.32, 0.6);
  ctx.fillRect(x + 0.43, y - 0.3, 0.32, 0.6);
  ctx.fillStyle = '#868b98';
  for (const bx of [x - 0.75, x + 0.43]) {
    ctx.fillRect(bx, y - 0.4, 0.09, 0.12);
    ctx.fillRect(bx + 0.115, y - 0.4, 0.09, 0.12);
    ctx.fillRect(bx + 0.23, y - 0.4, 0.09, 0.12);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── Sprites ─────────────────────────────────────────────────────────────────

/** Directions an enemy faces (every 45°) and animation frames per cycle. */
const HEADINGS = 8;
const FRAMES = 4;
/** Directions a tower aims (every 22.5°). */
const AIMS = 16;
const TAU = Math.PI * 2;
/** Each enemy type's animation cycle (seconds of drawEnemy's clock); 0 = still. */
const ENEMY_CYCLE = /** @type {const} */ ({
  crawler: TAU / 9,
  runner: 0,
  shellback: 0,
  moth: Math.PI / 12,
  splitter: 0,
  shard: 0,
  colossus: TAU / 9 / 0.6,
});

/** @param {number} angle @param {number} steps */
function stepOf(angle, steps) {
  return ((Math.round((angle / TAU) * steps) % steps) + steps) % steps;
}

/** @param {number} clock @param {number} cycle */
function frameOf(clock, cycle) {
  if (cycle === 0) return 0;
  const t = clock % cycle;
  return Math.floor(((t < 0 ? t + cycle : t) / cycle) * FRAMES) % FRAMES;
}

/**
 * A small canvas, `size` CSS pixels square at the renderer's density, with `draw`
 * painting at its centre.
 * @param {Renderer} r @param {number} size @param {(ctx: CanvasRenderingContext2D, c: number) => void} draw
 */
function makeSprite(r, size, draw) {
  const canvas = document.createElement('canvas');
  const px = Math.max(1, Math.ceil(size * r.dpr));
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    draw(ctx, px / r.dpr / 2);
  }
  return canvas;
}

/**
 * The picture of an enemy facing `heading` at `clock`, drawn once and kept.
 * @param {Renderer} r @param {EnemyType} type @param {number} heading @param {number} clock
 */
function enemySprite(r, type, heading, clock) {
  const t = ENEMY_TYPES.indexOf(type);
  const h = stepOf(heading, HEADINGS);
  const cycle = ENEMY_CYCLE[type];
  const f = frameOf(clock, cycle);
  const index = (t * HEADINGS + h) * FRAMES + f;
  const cached = r.enemySprites[index];
  if (cached) return cached;
  const T = r.layout?.tile ?? 40;
  const sprite = makeSprite(r, T * 1.4, (ctx, c) => drawEnemy(ctx, type, c, c, T, (h / HEADINGS) * TAU, ((f + 0.5) / FRAMES) * cycle, 0, false));
  r.enemySprites[index] = sprite;
  return sprite;
}

/**
 * The picture of a tower: by level, aim (every 22.5°) and whether it has just fired;
 * the banner by its flag's frame.
 * @param {Renderer} r @param {TowerType} type @param {number} level @param {number} aim @param {number} fired @param {number} clock
 */
function towerSprite(r, type, level, aim, fired, clock) {
  const t = TOWER_TYPES.indexOf(type);
  const still = type === 'frost' || type === 'banner';
  const a = type === 'banner' ? frameOf(clock, TAU / 4) : still ? 0 : stepOf(aim, AIMS);
  const kick = fired > 0 ? 1 : 0;
  const index = ((t * 3 + level - 1) * AIMS + a) * 2 + kick;
  const cached = r.towerSprites[index];
  if (cached) return cached;
  const T = r.layout?.tile ?? 40;
  const angle = (a / AIMS) * TAU;
  const bannerClock = ((a + 0.5) / FRAMES) * (TAU / 4);
  const sprite = makeSprite(r, T * 1.3, (ctx, c) => drawTower(ctx, type, level, c, c, T, angle, kick ? 0.12 : 0, type === 'banner' ? bannerClock : 0, 1));
  r.towerSprites[index] = sprite;
  return sprite;
}

/** Draws a sprite centred on (x, y) in CSS pixels. @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} sprite @param {number} x @param {number} y @param {number} dpr */
function blitSprite(ctx, sprite, x, y, dpr) {
  const w = sprite.width / dpr;
  ctx.drawImage(sprite, x - w / 2, y - w / 2, w, w);
}

/**
 * What changes too often to pre-draw: the white flash of a hit and the frost ring.
 * @param {CanvasRenderingContext2D} ctx @param {Enemy} enemy @param {number} cx @param {number} cy @param {number} T
 */
function drawEnemyState(ctx, enemy, cx, cy, T) {
  const r = enemy.radius * T;
  const y = cy - (enemy.flying ? 0.28 * T : 0);
  if (enemy.flash > 0) {
    ctx.globalAlpha = Math.min(1, enemy.flash / 0.12) * 0.8;
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (enemy.slowLeft > 0) {
    ctx.strokeStyle = SLOW_RING;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, y, r + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── Every frame ─────────────────────────────────────────────────────────────

/**
 * Draws one frame: the ground layer, then what moves.
 * @param {Renderer} r @param {Game} game @param {Effects} fx @param {View} view
 */
export function renderFrame(r, game, fx, view) {
  const layout = r.layout;
  if (!layout) return;
  const ctx = r.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, r.canvas.width, r.canvas.height);
  ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
  renderSelection(ctx, layout, game, view);
  renderTowers(r, ctx, layout, game, view);
  renderEnemies(r, ctx, layout, game, view, false);
  renderProjectiles(ctx, layout, game, view.alpha);
  renderEnemies(r, ctx, layout, game, view, true);
  renderEffects(r, ctx, layout, fx, r.font);
}

/** The chosen pad and the range of its tower (or of the tower being picked). @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view */
function renderSelection(ctx, layout, game, view) {
  const pad = game.pads[view.selectedPad];
  if (!pad) return;
  const T = layout.tile;
  toScreen(layout, pad.x, pad.y, pt);
  const tower = game.towers[view.selectedPad];
  const type = tower ? tower.type : view.previewType;
  if (type) {
    const range = TOWERS[type].range[(tower?.level ?? 1) - 1] ?? 0;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, range * T, 0, Math.PI * 2);
    ctx.fillStyle = RANGE_FILL;
    ctx.fill();
    ctx.strokeStyle = RANGE_STROKE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = PAD_SELECTED;
  ctx.lineWidth = 3;
  roundRect(ctx, pt.x - 0.44 * T, pt.y - 0.44 * T, 0.88 * T, 0.88 * T, 0.16 * T);
  ctx.stroke();
  if (!tower && view.previewType) drawTower(ctx, view.previewType, 1, pt.x, pt.y, T, -Math.PI / 2, 0, view.clock, 0.55);
}

/** @param {Renderer} r @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view */
function renderTowers(r, ctx, layout, game, view) {
  for (const tower of game.towers) {
    if (!tower) continue;
    toScreen(layout, tower.x, tower.y, pt);
    const aim = layout.rotated ? tower.aim - Math.PI / 2 : tower.aim;
    blitSprite(ctx, towerSprite(r, tower.type, tower.level, aim, tower.fired, view.reduced ? 0 : view.clock), pt.x, pt.y, r.dpr);
    if (tower.fired > 0.09 && (tower.type === 'archer' || tower.type === 'ballista' || tower.type === 'mortar')) {
      drawMuzzle(ctx, pt.x, pt.y, layout.tile, aim, tower.type);
    }
  }
}

/**
 * A shot's flash at the tower's tip for a few frames: white core, the tower's colour round it.
 * @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} T @param {number} aim @param {TowerType} type
 */
function drawMuzzle(ctx, cx, cy, T, aim, type) {
  const reach = (type === 'ballista' ? 0.36 : type === 'mortar' ? 0.12 : 0.26) * T;
  const x = cx + Math.cos(aim) * reach;
  const y = cy + Math.sin(aim) * reach;
  ctx.fillStyle = TOWER_COLORS[type];
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(x, y, 0.14 * T, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(x, y, 0.06 * T, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * One tower at a screen point; also draws the icons of the build menu.
 * Level 2 gets a silver rim and level 3 a gold one with a gem; pips show the level.
 * @param {CanvasRenderingContext2D} ctx @param {TowerType} type @param {number} level
 * @param {number} cx @param {number} cy @param {number} T @param {number} aim
 * @param {number} fired @param {number} clock @param {number} alpha
 */
export function drawTower(ctx, type, level, cx, cy, T, aim, fired, clock, alpha) {
  const s = T * (1 + (level - 1) * 0.07);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.08 * s, 0.4 * s, 0.34 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = STONE;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.36 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 0.05 * s);
  ctx.strokeStyle = level >= 3 ? GOLD : level === 2 ? SILVER : STONE_RIM;
  ctx.stroke();
  if (type === 'archer') drawArcher(ctx, cx, cy, s, aim, fired);
  else if (type === 'mortar') drawMortar(ctx, cx, cy, s, aim, fired);
  else if (type === 'frost') drawFrost(ctx, cx, cy, s, fired);
  else if (type === 'ballista') drawBallista(ctx, cx, cy, s, aim, fired);
  else drawBanner(ctx, cx, cy, s, clock);
  drawLevelPips(ctx, cx, cy, s, level);
  ctx.globalAlpha = 1;
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} s @param {number} aim @param {number} fired */
function drawArcher(ctx, cx, cy, s, aim, fired) {
  ctx.fillStyle = '#8a5a35';
  ctx.beginPath();
  ctx.arc(cx, cy, 0.24 * s, 0, Math.PI * 2);
  ctx.fill();
  const pull = fired > 0 ? 0.04 * s : 0;
  ctx.strokeStyle = TOWER_COLORS.archer;
  ctx.lineWidth = Math.max(2, 0.07 * s);
  ctx.beginPath();
  ctx.arc(cx + Math.cos(aim) * 0.02 * s, cy + Math.sin(aim) * 0.02 * s, 0.22 * s, aim - 1.1, aim + 1.1);
  ctx.stroke();
  ctx.strokeStyle = ARROW;
  ctx.lineWidth = Math.max(1, 0.025 * s);
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(aim - 1.1) * 0.22 * s, cy + Math.sin(aim - 1.1) * 0.22 * s);
  ctx.lineTo(cx - Math.cos(aim) * pull, cy - Math.sin(aim) * pull);
  ctx.lineTo(cx + Math.cos(aim + 1.1) * 0.22 * s, cy + Math.sin(aim + 1.1) * 0.22 * s);
  ctx.stroke();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} s @param {number} aim @param {number} fired */
function drawMortar(ctx, cx, cy, s, aim, fired) {
  const kick = fired > 0 ? 0.05 * s : 0;
  const mx = cx + Math.cos(aim) * (0.08 * s - kick);
  const my = cy + Math.sin(aim) * (0.08 * s - kick);
  ctx.fillStyle = '#3b3f48';
  ctx.beginPath();
  ctx.arc(mx, my, 0.22 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TOWER_COLORS.mortar;
  ctx.lineWidth = Math.max(2, 0.06 * s);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(mx, my, 0.11 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} s @param {number} fired */
function drawFrost(ctx, cx, cy, s, fired) {
  const glow = fired > 0 ? 0.08 * s : 0;
  ctx.fillStyle = 'rgba(159, 226, 255, 0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, 0.27 * s + glow, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TOWER_COLORS.frost;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 0.26 * s);
  ctx.lineTo(cx + 0.15 * s, cy);
  ctx.lineTo(cx, cy + 0.26 * s);
  ctx.lineTo(cx - 0.15 * s, cy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 0.16 * s);
  ctx.lineTo(cx + 0.05 * s, cy);
  ctx.lineTo(cx, cy + 0.04 * s);
  ctx.lineTo(cx - 0.05 * s, cy);
  ctx.closePath();
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} s @param {number} aim @param {number} fired */
function drawBallista(ctx, cx, cy, s, aim, fired) {
  const kick = fired > 0 ? 0.06 * s : 0;
  const ux = Math.cos(aim);
  const uy = Math.sin(aim);
  ctx.strokeStyle = '#6e4326';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, 0.12 * s);
  ctx.beginPath();
  ctx.moveTo(cx - ux * (0.24 * s + kick), cy - uy * (0.24 * s + kick));
  ctx.lineTo(cx + ux * (0.3 * s - kick), cy + uy * (0.3 * s - kick));
  ctx.stroke();
  ctx.strokeStyle = TOWER_COLORS.ballista;
  ctx.lineWidth = Math.max(2, 0.07 * s);
  ctx.beginPath();
  ctx.moveTo(cx + ux * 0.1 * s - uy * 0.27 * s, cy + uy * 0.1 * s + ux * 0.27 * s);
  ctx.quadraticCurveTo(cx + ux * 0.22 * s, cy + uy * 0.22 * s, cx + ux * 0.1 * s + uy * 0.27 * s, cy + uy * 0.1 * s - ux * 0.27 * s);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} s @param {number} clock */
function drawBanner(ctx, cx, cy, s, clock) {
  const wave = Math.sin(clock * 4) * 0.04 * s;
  ctx.strokeStyle = '#d9d4c7';
  ctx.lineWidth = Math.max(2, 0.05 * s);
  ctx.beginPath();
  ctx.moveTo(cx - 0.1 * s, cy + 0.22 * s);
  ctx.lineTo(cx - 0.1 * s, cy - 0.3 * s);
  ctx.stroke();
  ctx.fillStyle = TOWER_COLORS.banner;
  ctx.beginPath();
  ctx.moveTo(cx - 0.1 * s, cy - 0.3 * s);
  ctx.quadraticCurveTo(cx + 0.08 * s, cy - 0.26 * s + wave, cx + 0.26 * s, cy - 0.2 * s);
  ctx.lineTo(cx - 0.1 * s, cy - 0.04 * s);
  ctx.closePath();
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} s @param {number} level */
function drawLevelPips(ctx, cx, cy, s, level) {
  const color = level >= 3 ? GOLD : level === 2 ? SILVER : STONE_RIM;
  for (let i = 0; i < level; i++) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx + (i - (level - 1) / 2) * 0.14 * s, cy + 0.36 * s, 0.065 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx + (i - (level - 1) / 2) * 0.14 * s, cy + 0.36 * s, 0.045 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Enemies on the ground first, fliers after the shots (they are above them).
 * @param {Renderer} r @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {View} view @param {boolean} fliers
 */
function renderEnemies(r, ctx, layout, game, view, fliers) {
  const T = layout.tile;
  for (const enemy of game.enemies) {
    if (!enemy.alive || enemy.flying !== fliers) continue;
    const a = view.alpha;
    toScreen(layout, enemy.px + (enemy.x - enemy.px) * a, enemy.py + (enemy.y - enemy.py) * a, pt);
    pointAt(game.path, enemy.dist + 0.1, ahead);
    toScreen(layout, ahead.x, ahead.y, ahead);
    const heading = Math.atan2(ahead.y - pt.y, ahead.x - pt.x);
    blitSprite(ctx, enemySprite(r, enemy.type, heading, view.reduced ? 0 : view.clock + enemy.id), pt.x, pt.y, r.dpr);
    if (enemy.flash > 0 || enemy.slowLeft > 0) drawEnemyState(ctx, enemy, pt.x, pt.y, T);
    if (enemy.hp < enemy.maxHp) drawHealth(ctx, enemy, pt.x, pt.y, T);
  }
}

/**
 * One enemy at a screen point; also draws the icons of the wave preview.
 * @param {CanvasRenderingContext2D} ctx @param {EnemyType} type @param {number} cx @param {number} cy
 * @param {number} T @param {number} heading @param {number} clock @param {number} flash @param {boolean} slowed
 */
export function drawEnemy(ctx, type, cx, cy, T, heading, clock, flash, slowed) {
  const def = ENEMIES[type];
  const r = def.radius * T;
  const lift = def.flying ? 0.28 * T : 0;
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.5, r * (def.flying ? 0.7 : 1), r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  const y = cy - lift;
  ctx.fillStyle = ENEMY_COLORS[type];
  if (type === 'moth') drawMoth(ctx, cx, y, r, heading, clock);
  else if (type === 'shellback') drawPolygon(ctx, cx, y, r, 6, heading);
  else if (type === 'runner') drawRunner(ctx, cx, y, r, heading);
  else if (type === 'shard') drawPolygon(ctx, cx, y, r, 4, heading);
  else if (type === 'splitter') drawSplitter(ctx, cx, y, r, heading);
  else if (type === 'colossus') drawColossus(ctx, cx, y, r, clock);
  else drawBlob(ctx, cx, y, r, clock);
  if (type !== 'moth') drawEyes(ctx, cx, y, r, heading);
  if (flash > 0) {
    ctx.globalAlpha = Math.min(1, flash / 0.12) * 0.8;
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (slowed) {
    ctx.strokeStyle = SLOW_RING;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, y, r + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} r @param {number} clock */
function drawBlob(ctx, cx, cy, r, clock) {
  const squash = 1 + Math.sin(clock * 9) * 0.06;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * squash, r / squash, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} r @param {number} heading */
function drawRunner(ctx, cx, cy, r, heading) {
  const ux = Math.cos(heading);
  const uy = Math.sin(heading);
  ctx.beginPath();
  ctx.moveTo(cx + ux * r * 1.4, cy + uy * r * 1.4);
  ctx.lineTo(cx - uy * r - ux * r * 0.6, cy + ux * r - uy * r * 0.6);
  ctx.lineTo(cx + uy * r - ux * r * 0.6, cy - ux * r - uy * r * 0.6);
  ctx.closePath();
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} r @param {number} sides @param {number} turn */
function drawPolygon(ctx, cx, cy, r, sides, turn) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = turn + (i / sides) * Math.PI * 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  if (sides === 6) {
    ctx.strokeStyle = '#5d6880';
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} r @param {number} heading */
function drawSplitter(ctx, cx, cy, r, heading) {
  const ox = Math.sin(heading) * r * 0.45;
  const oy = -Math.cos(heading) * r * 0.45;
  ctx.beginPath();
  ctx.arc(cx + ox, cy + oy, r * 0.7, 0, Math.PI * 2);
  ctx.arc(cx - ox, cy - oy, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} r @param {number} heading @param {number} clock */
function drawMoth(ctx, cx, cy, r, heading, clock) {
  const flap = 0.55 + Math.abs(Math.sin(clock * 12)) * 0.45;
  const side = heading + Math.PI / 2;
  for (const dir of SIDES) {
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(side) * r * 0.55 * dir, cy + Math.sin(side) * r * 0.55 * dir, r * 0.75 * flap, r * 0.5, side, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#5a3a6e';
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.5, r * 0.22, heading, 0, Math.PI * 2);
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} r @param {number} clock */
function drawColossus(ctx, cx, cy, r, clock) {
  const spikes = 9;
  const turn = clock * 0.6;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = turn + (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r * 1.12 : r * 0.86;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a2633';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.35, cy - r * 0.55);
  ctx.lineTo(cx - r * 0.2, cy - r * 0.85);
  ctx.lineTo(cx, cy - r * 0.6);
  ctx.lineTo(cx + r * 0.2, cy - r * 0.85);
  ctx.lineTo(cx + r * 0.35, cy - r * 0.55);
  ctx.closePath();
  ctx.fill();
}

/** @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} cy @param {number} r @param {number} heading */
function drawEyes(ctx, cx, cy, r, heading) {
  const ux = Math.cos(heading);
  const uy = Math.sin(heading);
  for (const dir of SIDES) {
    const ex = cx + ux * r * 0.35 - uy * r * 0.3 * dir;
    const ey = cy + uy * r * 0.35 + ux * r * 0.3 * dir;
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(ex, ey, Math.max(1.5, r * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + ux * r * 0.07, ey + uy * r * 0.07, Math.max(0.8, r * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Enemy} enemy @param {number} cx @param {number} cy @param {number} T */
function drawHealth(ctx, enemy, cx, cy, T) {
  const w = (enemy.boss ? 1.1 : 0.62) * T;
  const h = Math.max(3, 0.08 * T);
  const y = cy - enemy.radius * T - (enemy.flying ? 0.28 * T : 0) - h - 4;
  const share = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = HP_BACK;
  ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = share > 0.6 ? HP_HIGH : share > 0.3 ? HP_MID : HP_LOW;
  ctx.fillRect(cx - w / 2, y, w * share, h);
}

/** @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Game} game @param {number} a */
function renderProjectiles(ctx, layout, game, a) {
  const T = layout.tile;
  ctx.lineCap = 'round';
  for (const p of game.projectiles) {
    if (!p.alive) continue;
    toScreen(layout, p.px + (p.x - p.px) * a, p.py + (p.y - p.py) * a, pt);
    if (p.kind === 'shell') {
      const k = Math.min(1, p.t / p.flight);
      const height = Math.sin(Math.PI * k) * 0.7 * T;
      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y, 0.1 * T, 0.05 * T, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = SHELL;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - height, 0.11 * T, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = BLAST;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      continue;
    }
    toScreen(layout, p.tx, p.ty, ahead);
    const dx = ahead.x - pt.x;
    const dy = ahead.y - pt.y;
    const len = Math.hypot(dx, dy) || 1;
    const tail = (p.kind === 'bolt' ? 0.42 : 0.26) * T;
    ctx.strokeStyle = p.kind === 'bolt' ? BOLT : ARROW;
    ctx.lineWidth = p.kind === 'bolt' ? Math.max(3, 0.08 * T) : Math.max(2, 0.04 * T);
    ctx.beginPath();
    ctx.moveTo(pt.x - (dx / len) * tail, pt.y - (dy / len) * tail);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** @param {Renderer} r @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {Effects} fx @param {string} font */
function renderEffects(r, ctx, layout, fx, font) {
  const T = layout.tile;
  for (const ring of fx.rings) {
    if (!ring.alive) continue;
    const k = 1 - ring.life / ring.max;
    const eased = 1 - (1 - k) * (1 - k);
    toScreen(layout, ring.x, ring.y, pt);
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = Math.max(2, 0.08 * T * (1 - k));
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, (ring.from + (ring.to - ring.from) * eased) * T, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const s of fx.sparks) {
    if (!s.alive) continue;
    toScreen(layout, s.x, s.y, pt);
    ctx.globalAlpha = s.life / s.max;
    ctx.fillStyle = s.color;
    const size = s.size * T;
    ctx.fillRect(pt.x - size / 2, pt.y - size / 2, size, size);
  }
  for (const f of fx.floats) {
    if (!f.alive) continue;
    const k = 1 - f.life / f.max;
    toScreen(layout, f.x, f.y, pt);
    ctx.globalAlpha = 1 - k * k;
    const label = labelSprite(r, f.text, f.color, font);
    ctx.drawImage(label, pt.x - label.width / r.dpr / 2, pt.y - k * 0.6 * T - 0.3 * T - label.height / r.dpr / 2, label.width / r.dpr, label.height / r.dpr);
  }
  ctx.globalAlpha = 1;
}

/**
 * A floating label ("+4") pre-drawn with its shadow: text is slow to draw on a phone, and
 * the same few labels come again and again.
 * @param {Renderer} r @param {string} text @param {string} color @param {string} font
 */
function labelSprite(r, text, color, font) {
  const cached = r.labels.get(text);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  const size = Math.max(12, Math.round(0.34 * (r.layout?.tile ?? 40)));
  canvas.width = Math.ceil(size * 3 * r.dpr);
  canvas.height = Math.ceil(size * 1.6 * r.dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = canvas.width / r.dpr / 2;
    const cy = canvas.height / r.dpr / 2;
    ctx.fillStyle = INK;
    ctx.fillText(text, cx + 1, cy + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy);
  }
  r.labels.set(text, canvas);
  return canvas;
}

// ── Events → effects ────────────────────────────────────────────────────────

/**
 * Starts the effects for the game's events since the last frame (none with reduced
 * motion, which only drops them).
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
      addFloat(fx, e.x, e.y, plusLabel(e.value), GOLD_TEXT);
    } else if (e.type === 'blast') {
      addRing(fx, e.x, e.y, 0.15, e.value, 0.35, BLAST);
      addBurst(fx, e.x, e.y, 6, BLAST, 2);
    } else if (e.type === 'pulse') addRing(fx, e.x, e.y, 0.3, e.value, 0.5, FROST_RING);
    else if (e.type === 'build' || e.type === 'upgrade') {
      addRing(fx, e.x, e.y, 0.2, 0.75, 0.45, GOLD);
      addBurst(fx, e.x, e.y, 8, GOLD, 1.6);
    } else if (e.type === 'leak') addRing(fx, e.x, Math.min(e.y, ROWS - 0.3), 0.2, 1, 0.5, LEAK);
    else if (e.type === 'sell') addFloat(fx, e.x, e.y, plusLabel(e.value), GOLD_TEXT);
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
