// @ts-check
// Strażnicy Doliny: the characters, drawn in code (docs/v2/PLAN.md 9.1, td-3). Enemies and
// towers are built from pixel shapes — discs, rectangles, lines — in the game's palette,
// then finished the same way every time: a one-pixel ink outline, a highlight on the top
// edge and a darker bottom edge (light from the top left), so everything shares one style.
// Enemies have walk cycles (4–6 frames), towers aim in 8 directions with an idle and a
// firing frame, and every frame is made once and kept (canvases), never per frame.

import { PALETTE, createCanvas } from './pixelart.js';

/** @typedef {import('./pixelart.js').Colour} Colour */
/** @typedef {import('./config.js').EnemyType} EnemyType */
/** @typedef {import('./config.js').TowerType} TowerType */
/** @typedef {CanvasRenderingContext2D} Ctx */

/** Each colour's lighter and darker neighbour in the palette (the shading stays on palette). */
const RAMP = /** @type {Record<Colour, [Colour, Colour]>} */ ({
  k: ['K', 'k'], K: ['g', 'k'], g: ['G', 'K'], G: ['w', 'g'], w: ['w', 'G'],
  r: ['R', 'k'], R: ['O', 'r'], o: ['O', 'r'], O: ['Y', 'o'], y: ['Y', 'O'], Y: ['w', 'y'],
  n: ['N', 'k'], N: ['b', 'n'], b: ['B', 'N'], B: ['Y', 'b'],
  e: ['E', 'k'], E: ['f', 'e'], f: ['F', 'E'], F: ['Y', 'f'],
  t: ['T', 'k'], T: ['c', 't'], c: ['C', 'T'], C: ['w', 'c'],
  u: ['U', 'k'], U: ['v', 'u'], v: ['V', 'U'], V: ['w', 'v'], p: ['P', 'k'], P: ['w', 'p'],
  s: ['B', 'S'], S: ['s', 'n'], m: ['F', 'e'],
});

/** Hex colour → [r, g, b]. @param {string} hex @returns {[number, number, number]} */
function rgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The palette by its rgb, for the finishing passes. */
const BY_RGB = new Map(Object.entries(PALETTE).map(([k, hex]) => [rgb(hex).join(','), /** @type {Colour} */ (k)]));

// ── Shapes ──────────────────────────────────────────────────────────────────

/** @param {Ctx} ctx @param {Colour} c @param {number} x @param {number} y @param {number} [w] @param {number} [h] */
export function px(ctx, c, x, y, w = 1, h = 1) {
  ctx.fillStyle = PALETTE[c];
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** A filled ellipse of pixels. @param {Ctx} ctx @param {Colour} c @param {number} cx @param {number} cy @param {number} rx @param {number} ry */
export function disc(ctx, c, cx, cy, rx, ry) {
  ctx.fillStyle = PALETTE[c];
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.01))));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

/** A line of pixels `w` thick (Bresenham). @param {Ctx} ctx @param {Colour} c @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number} [w] */
export function line(ctx, c, x0, y0, x1, y1, w = 1) {
  ctx.fillStyle = PALETTE[c];
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xe = Math.round(x1);
  const ye = Math.round(y1);
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  const o = Math.floor((w - 1) / 2);
  for (let i = 0; i < 200; i++) {
    ctx.fillRect(x - o, y - o, w, w);
    if (x === xe && y === ye) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// ── Finishing: outline and light ───────────────────────────────────────────

/**
 * Light from the top left: a pixel with nothing above it takes the lighter colour of its
 * ramp, one with nothing below it the darker; then a one-pixel ink outline round it all.
 * @param {HTMLCanvasElement} canvas
 */
export function finish(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < w && y < h && (d[(y * w + x) * 4 + 3] ?? 0) > 0;
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!solid(x, y)) continue;
      const key = `${d[i]},${d[i + 1]},${d[i + 2]}`;
      const colour = BY_RGB.get(key);
      if (!colour || colour === 'k') continue;
      const ramp = RAMP[colour];
      let to = null;
      if (!solid(x, y - 1) || !solid(x - 1, y)) to = ramp?.[0];
      else if (!solid(x, y + 1) || !solid(x + 1, y + 1)) to = ramp?.[1];
      if (!to) continue;
      const [r, g, b] = rgb(PALETTE[to]);
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
    }
  }
  const [ir, ig, ib] = rgb(PALETTE.k);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (!(solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) continue;
      const i = (y * w + x) * 4;
      out[i] = ir;
      out[i + 1] = ig;
      out[i + 2] = ib;
      out[i + 3] = 255;
    }
  }
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * A finished sprite, `w` × `h`, drawn by `draw` (leave a pixel round the edge for the outline).
 * @param {number} w @param {number} h @param {(ctx: Ctx) => void} draw
 */
export function build(w, h, draw) {
  const { canvas, ctx } = createCanvas(w, h);
  draw(ctx);
  return finish(canvas);
}

// ── Enemies ─────────────────────────────────────────────────────────────────

/** @param {Ctx} ctx @param {number} x @param {number} y @param {number} [look] */
function eyes(ctx, x, y, look = 1) {
  px(ctx, 'w', x, y, 2, 2);
  px(ctx, 'k', x + (look > 0 ? 1 : 0), y + 1);
  px(ctx, 'w', x + 4, y, 2, 2);
  px(ctx, 'k', x + 4 + (look > 0 ? 1 : 0), y + 1);
}

/** A green slime that heaves along: squash and stretch over 6 frames. 20 × 16 */
function crawler(/** @type {number} */ f) {
  const t = (f / 6) * Math.PI * 2;
  const rx = 7 + Math.sin(t) * 1.2;
  const ry = 5.5 - Math.sin(t) * 1.2;
  return build(20, 16, (ctx) => {
    disc(ctx, 'E', 10, 15 - ry, rx, ry);
    disc(ctx, 'f', 9, 14 - ry, rx - 2, ry - 1.5);
    px(ctx, 'F', 6, 12 - ry * 1.6, 2, 1);
    eyes(ctx, 10, 13 - ry);
    px(ctx, 'e', 6, 14, 8, 1);
  });
}

/** A lean yellow runner with ears and a tail, legs over 6 frames. 20 × 18 */
function runner(/** @type {number} */ f) {
  const t = (f / 6) * Math.PI * 2;
  return build(20, 18, (ctx) => {
    const bob = Math.round(Math.abs(Math.sin(t)) * 1);
    line(ctx, 'O', 2, 7 - bob, 6, 9 - bob, 2);
    disc(ctx, 'y', 9, 9 - bob, 5, 3);
    disc(ctx, 'y', 14, 7 - bob, 3, 3);
    px(ctx, 'y', 13, 3 - bob, 1, 2);
    px(ctx, 'y', 15, 3 - bob, 1, 2);
    px(ctx, 'o', 17, 8 - bob, 2, 1);
    px(ctx, 'Y', 7, 10 - bob, 5, 1);
    px(ctx, 'k', 15, 6 - bob);
    for (let leg = 0; leg < 2; leg++) {
      const s = Math.sin(t + leg * Math.PI) * 3;
      line(ctx, 'O', 7 + leg * 5, 11 - bob, 7 + leg * 5 + s, 16, 1);
    }
  });
}

/** An armoured shell walker: domed plates, small head, slow legs. 24 × 18 */
function shellback(/** @type {number} */ f) {
  const t = (f / 4) * Math.PI * 2;
  return build(24, 18, (ctx) => {
    for (let leg = 0; leg < 3; leg++) {
      const s = Math.sin(t + leg * 2) * 2;
      line(ctx, 'K', 6 + leg * 5, 11, 6 + leg * 5 + s, 16, 2);
    }
    disc(ctx, 'g', 11, 9, 9, 6);
    disc(ctx, 'G', 10, 8, 7, 4);
    for (let i = 0; i < 3; i++) line(ctx, 'g', 6 + i * 4, 4, 5 + i * 4, 11, 1);
    px(ctx, 'K', 3, 12, 17, 2);
    disc(ctx, 'g', 20, 10, 2.5, 2.5);
    px(ctx, 'R', 21, 9);
  });
}

/** A pink moth, wings in 4 beats; it flies over the road. 22 × 18 */
function moth(/** @type {number} */ f) {
  const lift = [0, -3, -5, -3][f % 4] ?? 0;
  return build(22, 18, (ctx) => {
    disc(ctx, 'P', 6, 9 + lift / 2, 5, 4 + lift / 3);
    disc(ctx, 'P', 15, 9 + lift / 2, 5, 4 + lift / 3);
    disc(ctx, 'p', 6, 10 + lift / 2, 2, 2);
    disc(ctx, 'p', 15, 10 + lift / 2, 2, 2);
    disc(ctx, 'p', 11, 11, 2, 4);
    px(ctx, 'w', 12, 9);
    line(ctx, 'p', 11, 7, 9, 4);
    line(ctx, 'p', 12, 7, 14, 4);
  });
}

/** Two red blobs stuck together, wobbling out of step. 24 × 16 */
function splitter(/** @type {number} */ f) {
  const t = (f / 4) * Math.PI * 2;
  return build(24, 16, (ctx) => {
    disc(ctx, 'R', 7, 10 + Math.sin(t), 6, 5 - Math.sin(t) * 0.8);
    disc(ctx, 'R', 16, 10 - Math.sin(t), 6, 5 + Math.sin(t) * 0.8);
    disc(ctx, 'O', 6, 8 + Math.sin(t), 2, 1);
    disc(ctx, 'O', 15, 8 - Math.sin(t), 2, 1);
    line(ctx, 'r', 12, 6, 12, 14);
    eyes(ctx, 15, 9 - Math.sin(t));
  });
}

/** A shard of red crystal, tumbling. 14 × 14 */
function shard(/** @type {number} */ f) {
  const a = (f / 4) * Math.PI;
  return build(14, 14, (ctx) => {
    const pts = [0, 1, 2, 3].map((i) => [7 + Math.cos(a + (i * Math.PI) / 2) * (i % 2 ? 3 : 5), 7 + Math.sin(a + (i * Math.PI) / 2) * (i % 2 ? 3 : 5)]);
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = pts[i] ?? [7, 7];
      const [x1, y1] = pts[(i + 1) % 4] ?? [7, 7];
      line(ctx, 'R', x0 ?? 7, y0 ?? 7, x1 ?? 7, y1 ?? 7, 2);
    }
    disc(ctx, 'R', 7, 7, 2.5, 2.5);
    px(ctx, 'O', 6, 6, 2, 1);
  });
}

/** The Colossus: a horned stone giant, ~40 px, stomping heavily over 6 frames. 40 × 42 */
function colossus(/** @type {number} */ f) {
  const t = (f / 6) * Math.PI * 2;
  const stomp = Math.round(Math.abs(Math.sin(t)) * 2);
  return build(40, 42, (ctx) => {
    const y = 4 + stomp;
    for (let leg = 0; leg < 2; leg++) {
      const s = Math.sin(t + leg * Math.PI) * 3;
      px(ctx, 'r', 12 + leg * 10 + s, 30 + stomp, 6, 9 - stomp);
      px(ctx, 'K', 11 + leg * 10 + s, 38, 8, 3);
    }
    disc(ctx, 'R', 20, y + 18, 13, 12);
    disc(ctx, 'r', 20, y + 22, 10, 7);
    for (let arm = 0; arm < 2; arm++) {
      const s = Math.sin(t + arm * Math.PI) * 3;
      const ax = arm ? 33 : 7;
      line(ctx, 'R', ax, y + 14, ax + (arm ? 2 : -2), y + 26 + s, 5);
      disc(ctx, 'r', ax + (arm ? 2 : -2), y + 27 + s, 3, 3);
    }
    disc(ctx, 'R', 20, y + 6, 7, 6);
    line(ctx, 'y', 14, y + 2, 9, y - 3, 2);
    line(ctx, 'y', 26, y + 2, 31, y - 3, 2);
    px(ctx, 'Y', 9, y - 3);
    px(ctx, 'Y', 31, y - 3);
    px(ctx, 'w', 16, y + 5, 3, 2);
    px(ctx, 'w', 22, y + 5, 3, 2);
    px(ctx, 'k', 17, y + 6, 2, 1);
    px(ctx, 'k', 23, y + 6, 2, 1);
    px(ctx, 'k', 17, y + 10, 7, 1);
    for (let i = 0; i < 4; i++) px(ctx, 'O', 13 + i * 4, y + 15 + (i % 2) * 3, 2, 2);
  });
}

/** Frames per kind and how fast they go round (frames a second). */
const ENEMY_ART = /** @type {Record<EnemyType, { make: (f: number) => HTMLCanvasElement, frames: number, fps: number }>} */ ({
  crawler: { make: crawler, frames: 6, fps: 8 },
  runner: { make: runner, frames: 6, fps: 14 },
  shellback: { make: shellback, frames: 4, fps: 5 },
  moth: { make: moth, frames: 4, fps: 12 },
  splitter: { make: splitter, frames: 4, fps: 6 },
  shard: { make: shard, frames: 4, fps: 8 },
  colossus: { make: colossus, frames: 6, fps: 4 },
});

/** @param {EnemyType} type */
export function enemyArt(type) {
  return ENEMY_ART[type];
}

// ── Towers ──────────────────────────────────────────────────────────────────

/** Width of every tower picture; the foot is at the bottom centre. */
export const TOWER_W = 24;
export const TOWER_H = 40;
const CX = TOWER_W / 2;

/**
 * The foundation by level: a wooden palisade platform, a stone tower with an arrow slit,
 * a taller stone tower with a gold band, battlements and two pennants. Returns its top y.
 * @param {Ctx} ctx @param {number} level
 */
function foundation(ctx, level) {
  const bottom = TOWER_H - 1;
  const l = CX - 8;
  const r = CX + 8;
  if (level === 1) {
    const top = bottom - 8;
    for (let x = l + 1; x < r; x += 3) px(ctx, x % 2 ? 'N' : 'n', x, top + 2, 3, 7);
    px(ctx, 'b', l, top, 16, 3);
    px(ctx, 'n', l, top + 3, 16, 1);
    for (let x = l + 2; x < r; x += 4) px(ctx, 'B', x, top + 1);
    return top;
  }
  const wide = level === 3 ? 1 : 0;
  const top = bottom - (level === 2 ? 13 : 18);
  px(ctx, 'g', l + 1 - wide, top + 3, 14 + wide * 2, bottom - top - 2);
  for (let y = top + 5; y < bottom; y += 3) {
    const shift = ((y - top) / 3) % 2 ? 0 : 2;
    for (let x = l + 1 + shift; x < r; x += 4) px(ctx, 'K', x, y, 1, 3);
    px(ctx, 'K', l + 1 - wide, y, 14 + wide * 2, 1);
  }
  px(ctx, 'k', CX - 1, top + 7, 2, 4);
  for (let x = l - wide; x < r + wide; x += 4) px(ctx, 'G', x, top, 3, 3);
  px(ctx, 'G', l - wide, top + 2, 16 + wide * 2, 2);
  if (level === 3) {
    px(ctx, 'y', l, top + 9, 16, 2);
    line(ctx, 'N', l - 1, top, l - 1, top - 7);
    line(ctx, 'N', r, top, r, top - 7);
    px(ctx, 'R', l, top - 7, 3, 2);
    px(ctx, 'R', r - 3 + 1, top - 7, 3, 2);
  }
  return top;
}

/**
 * The tower's picture by type, level, aim (8 directions on the screen, 0 = right, going
 * clockwise) and whether it has just fired.
 * @param {TowerType} type @param {number} level @param {number} dir @param {boolean} firing @param {number} [frame]
 */
export function towerArt(type, level, dir, firing, frame = 0) {
  const a = (dir / 8) * Math.PI * 2;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  return build(TOWER_W, TOWER_H, (ctx) => {
    const top = foundation(ctx, level);
    if (type === 'archer') archerTop(ctx, top, level, ux, uy, firing);
    else if (type === 'mortar') mortarTop(ctx, top, level, ux, uy, firing);
    else if (type === 'ballista') ballistaTop(ctx, top, level, ux, uy, firing);
    else if (type === 'frost') frostTop(ctx, top, level, frame, firing);
    else bannerTop(ctx, top, level, frame);
  });
}

/** An archer on the tower: hood by level (green, blue, gold-trimmed), the bow toward the aim. @param {Ctx} ctx @param {number} top @param {number} level @param {number} ux @param {number} uy @param {boolean} firing */
function archerTop(ctx, top, level, ux, uy, firing) {
  const face = ux < 0 ? -1 : 1;
  const hood = /** @type {Colour} */ (level === 1 ? 'E' : level === 2 ? 'U' : 'p');
  const y = top - 10;
  px(ctx, hood, CX - 3, y + 4, 7, 7);
  disc(ctx, hood, CX, y + 3, 3, 3);
  px(ctx, 'B', CX + (face > 0 ? 0 : -2), y + 2, 3, 3);
  px(ctx, 'k', CX + (face > 0 ? 2 : -2), y + 3);
  if (level === 3) px(ctx, 'y', CX - 3, y + 8, 7, 1);
  const hx = CX + ux * 4;
  const hy = y + 6 + uy * 3;
  line(ctx, 'B', CX, y + 6, hx, hy);
  const bx = hx + ux * 2;
  const by = hy + uy * 2;
  line(ctx, 'N', bx - uy * 5, by + ux * 5, bx + uy * 5, by - ux * 5);
  const pull = firing ? 0 : 2;
  line(ctx, 'G', bx - uy * 5, by + ux * 5, hx - ux * pull, hy - uy * pull);
  line(ctx, 'G', hx - ux * pull, hy - uy * pull, bx + uy * 5, by - ux * 5);
  if (!firing) line(ctx, 'w', hx - ux * pull, hy - uy * pull, bx + ux * 3, by + uy * 3);
}

/** A bronze mortar on a wooden stand, the barrel toward the aim; firing, it kicks back. @param {Ctx} ctx @param {number} top @param {number} level @param {number} ux @param {number} uy @param {boolean} firing */
function mortarTop(ctx, top, level, ux, uy, firing) {
  const y = top - 4;
  px(ctx, 'n', CX - 6, y + 1, 12, 4);
  px(ctx, 'N', CX - 5, y, 10, 2);
  const kick = firing ? -2 : 0;
  const ex = CX + ux * (6 + kick);
  const ey = y - 4 + uy * 3 - 2;
  line(ctx, level === 3 ? 'y' : 'K', CX, y - 1, ex, ey, level === 1 ? 4 : 5);
  disc(ctx, 'k', ex, ey, 1.5, 1.5);
  disc(ctx, level === 3 ? 'y' : 'g', CX, y - 1, 3, 3);
  if (level >= 2) px(ctx, 'O', CX - 1, y - 2, 2, 1);
}

/** A ballista: a beam toward the aim with bow arms across it and a bolt. @param {Ctx} ctx @param {number} top @param {number} level @param {number} ux @param {number} uy @param {boolean} firing */
function ballistaTop(ctx, top, level, ux, uy, firing) {
  const cy = top - 5;
  px(ctx, 'n', CX - 2, cy, 4, 5);
  line(ctx, 'N', CX - ux * 8, cy - uy * 5, CX + ux * 8, cy + uy * 5, 3);
  const ax = CX + ux * 4;
  const ay = cy + uy * 2.5;
  const arm = 7 + level;
  const back = firing ? 0 : 3;
  line(ctx, level === 3 ? 'y' : 'b', ax - uy * arm - ux * back, ay + ux * arm * 0.7 - uy * back, ax, ay, 2);
  line(ctx, level === 3 ? 'y' : 'b', ax + uy * arm - ux * back, ay - ux * arm * 0.7 - uy * back, ax, ay, 2);
  if (!firing) line(ctx, 'G', CX - ux * 6, cy - uy * 4, CX + ux * 11, cy + uy * 7);
}

/** A cluster of ice crystals floating over the tower; sparkles turn (4 frames), firing glows. @param {Ctx} ctx @param {number} top @param {number} level @param {number} frame @param {boolean} firing */
function frostTop(ctx, top, level, frame, firing) {
  const y = top - 8 - (frame % 2);
  const ice = /** @type {Colour} */ (firing ? 'w' : 'C');
  line(ctx, ice, CX, y - 6 - level, CX, y + 6, 4);
  line(ctx, 'c', CX - 4, y - 1, CX - 4, y + 5, 3);
  line(ctx, 'c', CX + 4, y - 2, CX + 4, y + 5, 3);
  if (level >= 2) line(ctx, 'T', CX - 7, y + 2, CX - 7, y + 6, 2);
  if (level === 3) line(ctx, 'T', CX + 7, y + 1, CX + 7, y + 6, 2);
  const sparkles = [[-6, -5], [6, -6], [-8, 2], [8, 0]];
  const s = sparkles[frame % 4] ?? [0, 0];
  px(ctx, 'w', CX + (s[0] ?? 0), y + (s[1] ?? 0));
}

/** A violet banner on a gilded pole, the flag waving (4 frames), larger by level. @param {Ctx} ctx @param {number} top @param {number} level @param {number} frame */
function bannerTop(ctx, top, level, frame) {
  const h = 16 + level * 2;
  line(ctx, 'G', CX - 4, top, CX - 4, top - h, 2);
  disc(ctx, 'y', CX - 4, top - h - 1, 1.5, 1.5);
  const w = 9 + level;
  for (let x = 0; x < w; x++) {
    const wave = Math.round(Math.sin((x / w) * Math.PI + (frame / 4) * Math.PI * 2) * 1.5);
    px(ctx, 'v', CX - 2 + x, top - h + 1 + wave, 1, 7 - Math.floor(x / 4));
    if (x > 1 && x < w - 2) px(ctx, 'V', CX - 2 + x, top - h + 3 + wave, 1, 1);
  }
  if (level === 3) px(ctx, 'y', CX - 1, top - h + 5, 3, 1);
}

/** Directions on the screen for an aim (radians, screen space): 0 right, clockwise. @param {number} angle */
export function aimDir(angle) {
  return ((Math.round((angle / (Math.PI * 2)) * 8) % 8) + 8) % 8;
}
