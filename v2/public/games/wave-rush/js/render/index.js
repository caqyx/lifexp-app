// @ts-check
// One frame (docs/v2/PLAN.md 9.1, stage w-1), back to front: background (cross-faded at a
// sector change), the visible sections from their painted canvases, solid terrain beyond
// the band on tall screens, spinning hazards, portals, the trail and the wave, shards,
// a portal ring and the crash flash. Painted sections are kept only while near the screen.
import { JOINT, WAVE } from '../config.js';
import { pieceIndexAt } from '../run.js';
import { drawBackground } from './background.js';
import { paintPattern, paintSection, STRIP_BOTTOM, STRIP_TOP } from './section.js';
import { drawOrb, drawPortal, drawSaw, drawTrail, drawWave } from './sprites.js';
import { themeOf } from './themes.js';
import { screenX, screenY } from './view.js';

/**
 * @typedef {import('./view.js').View} View
 * @typedef {import('./themes.js').Theme} Theme
 * @typedef {import('../run.js').Run} Run
 * @typedef {import('../run.js').Piece} Piece
 * @typedef {import('./section.js').Painted} Painted
 * @typedef {{
 *   view: View, run: Run, wave: { x: number, y: number, dir: number, mini: boolean, alive: boolean, flipped: boolean },
 *   trail: { x: number, y: number }[], skin: import('../skins.js').Skin, time: number, reduced: boolean,
 *   pulse: number, particles: import('../effects.js').Particle[], shake: { x: number, y: number },
 *   flash: number, ring: { x: number, color: string, progress: number } | null,
 * }} Scene
 * @typedef {{ painted: Map<Piece, Painted>, key: string, run: Run | null, patterns: Map<string, CanvasPattern | null> }} Renderer
 */

/** Cells the background takes to fade from one sector's theme to the next. */
const FADE = 10;

/** @returns {Renderer} */
export function createRenderer() {
  return { painted: new Map(), key: '', run: null, patterns: new Map() };
}

/**
 * Forgets painted sections when the view or the run changes.
 * @param {Renderer} r @param {Scene} s
 */
function keepCacheFresh(r, s) {
  const key = `${s.view.width}x${s.view.height}@${s.view.cell}`;
  if (key !== r.key || s.run !== r.run) {
    r.painted.clear();
    r.patterns.clear();
    r.key = key;
    r.run = s.run;
  }
}

/**
 * The pieces on screen (with a margin), first to last.
 * @param {Run} run @param {number} camX @param {View} v
 */
function visiblePieces(run, camX, v) {
  const out = [];
  for (let i = pieceIndexAt(run, camX - 1); i < run.pieces.length; i++) {
    const p = /** @type {Piece} */ (run.pieces[i]);
    if (p.x0 > camX + v.cells + 1) break;
    if (p.x1 >= camX - 1) out.push(p);
  }
  return out;
}

/**
 * The background, cross-faded between two sectors near their boundary.
 * @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {number} camX
 */
function drawBackdrop(ctx, s, camX) {
  const centre = camX + s.view.cells / 2;
  const clock = { time: s.time, pulse: s.reduced ? 0 : s.pulse, reduced: s.reduced };
  const i = pieceIndexAt(s.run, centre);
  const here = /** @type {Piece} */ (s.run.pieces[i]);
  drawBackground(ctx, s.view, themeOf(here.theme), camX, clock);
  // Half-way at a change of look (a sector or a Demon tier), fading over FADE cells.
  const before = s.run.pieces[i - 1];
  const after = s.run.pieces[i + 1];
  const neighbour =
    before && before.theme !== here.theme && centre - here.x0 < FADE / 2
      ? { theme: before.theme, d: centre - here.x0 }
      : after && after.theme !== here.theme && after.x0 - centre < FADE / 2
        ? { theme: after.theme, d: after.x0 - centre }
        : null;
  if (neighbour) {
    ctx.globalAlpha = Math.max(0, 0.5 - neighbour.d / FADE);
    drawBackground(ctx, s.view, themeOf(neighbour.theme), camX, clock);
    ctx.globalAlpha = 1;
  }
}

/**
 * Copies the visible part of each piece's painted canvas.
 * @param {CanvasRenderingContext2D} ctx @param {Renderer} r @param {Scene} s @param {Piece[]} pieces @param {number} camX
 */
function drawPieces(ctx, r, s, pieces, camX) {
  const v = s.view;
  for (const piece of pieces) {
    let painted = r.painted.get(piece);
    if (!painted) {
      painted = paintSection(piece.g, themeOf(piece.theme), v);
      r.painted.set(piece, painted);
    }
    const dx = screenX(v, camX, piece.x0 + painted.left);
    const dy = screenY(v, painted.top);
    const sx = Math.max(0, -dx);
    const sw = Math.min(painted.canvas.width - sx, v.width - Math.max(0, dx));
    if (sw <= 0) continue;
    ctx.drawImage(painted.canvas, sx, 0, sw, painted.canvas.height, Math.max(0, dx), dy, sw, painted.canvas.height);
  }
  for (const piece of r.painted.keys()) if (!pieces.includes(piece)) r.painted.delete(piece);
}

/**
 * A tile of the theme's block pattern, for terrain beyond the painted band.
 * @param {Renderer} r @param {Theme} th @param {number} cell
 */
function patternOf(r, th, cell) {
  if (r.patterns.has(th.id)) return r.patterns.get(th.id) ?? null;
  const size = th.pattern === 'panels' ? 2 : 1;
  const tile = document.createElement('canvas');
  tile.width = Math.max(1, Math.round(size * cell));
  tile.height = tile.width;
  const ctx = /** @type {CanvasRenderingContext2D} */ (tile.getContext('2d'));
  const c = tile.width / size;
  ctx.fillStyle = th.block.bottom;
  ctx.fillRect(0, 0, tile.width, tile.height);
  paintPattern(ctx, th, { X: (x) => x * c, Y: (y) => y * c, c }, 0, 0, size, size);
  const pattern = ctx.createPattern(tile, 'repeat');
  r.patterns.set(th.id, pattern);
  return pattern;
}

/**
 * Tall screens: the terrain continues above and below the painted band.
 * @param {CanvasRenderingContext2D} ctx @param {Renderer} r @param {Scene} s @param {number} camX
 */
function drawBeyondBand(ctx, r, s, camX) {
  const v = s.view;
  const top = screenY(v, STRIP_TOP);
  const bottom = screenY(v, STRIP_BOTTOM);
  if (top <= 0 && bottom >= v.height) return;
  const piece = /** @type {Piece} */ (s.run.pieces[pieceIndexAt(s.run, camX + v.cells / 2)]);
  const th = themeOf(piece.theme);
  const pattern = patternOf(r, th, v.cell);
  ctx.save();
  if (pattern) {
    // Anchored at the world's origin, so the tiles line up with the painted band.
    pattern.setTransform(new DOMMatrix().translate(screenX(v, camX, 0), screenY(v, 0)));
    ctx.fillStyle = pattern;
  } else ctx.fillStyle = th.block.bottom;
  if (top > 0) ctx.fillRect(0, 0, v.width, top + 1);
  if (bottom < v.height) ctx.fillRect(0, bottom - 1, v.width, v.height - bottom + 1);
  // Shade toward the screen's edge, so the band reads as the playfield.
  const fade = (/** @type {number} */ y0, /** @type {number} */ y1) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    return g;
  };
  if (top > 0) {
    ctx.fillStyle = fade(0, top);
    ctx.fillRect(0, 0, v.width, top);
  }
  if (bottom < v.height) {
    ctx.fillStyle = fade(v.height, bottom);
    ctx.fillRect(0, bottom, v.width, v.height - bottom);
  }
  ctx.restore();
}

/**
 * Saws and spike orbs of the visible pieces, spinning (not with reduced motion).
 * @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {Piece[]} pieces @param {number} camX
 */
function drawSpinners(ctx, s, pieces, camX) {
  const v = s.view;
  for (const piece of pieces) {
    const th = themeOf(piece.theme);
    for (const h of piece.g.hazards) {
      if (h.shape !== 'circle') continue;
      const x = screenX(v, camX, piece.x0 + h.x);
      const y = screenY(v, h.y);
      const spin = s.reduced ? 0 : s.time * (h.type === 'saw' ? -5 : 1.4);
      if (th.fx?.hazardGlow) {
        const halo = ctx.createRadialGradient(x, y, h.r * v.cell * 0.5, x, y, h.r * v.cell * 1.6);
        halo.addColorStop(0, th.fx.hazardGlow);
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(x - h.r * v.cell * 1.6, y - h.r * v.cell * 1.6, h.r * v.cell * 3.2, h.r * v.cell * 3.2);
      }
      if (h.type === 'saw') drawSaw(ctx, x, y, h.r * v.cell, spin, th);
      else drawOrb(ctx, x, y, h.r * v.cell, spin, th);
    }
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {number} camX */
function drawPortals(ctx, s, camX) {
  const v = s.view;
  for (const p of s.run.portals) {
    if (p.x < camX - 2 || p.x > camX + v.cells + 2) continue;
    drawPortal(ctx, screenX(v, camX, p.x), screenY(v, JOINT.ceil + 0.25), screenY(v, JOINT.floor - 0.25), v.cell, p, s.time, s.reduced);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {number} camX */
function drawPlayer(ctx, s, camX) {
  const v = s.view;
  const w = s.wave;
  const points = s.trail.filter((p) => p.x > camX - 2).map((p) => ({ x: screenX(v, camX, p.x), y: screenY(v, p.y) }));
  const before = s.trail.filter((p) => p.x <= camX - 2).pop();
  if (before) points.unshift({ x: screenX(v, camX, before.x), y: screenY(v, before.y) });
  points.push({ x: screenX(v, camX, w.x), y: screenY(v, w.y) });
  drawTrail(ctx, points, v.cell * (w.mini ? 0.2 : 0.3), s.skin.trail);
  if (!w.alive) return;
  const slope = w.mini ? WAVE.miniSlope : WAVE.slope;
  const size = (w.mini ? WAVE.miniSize : WAVE.size) * v.cell;
  drawWave(ctx, s.skin, screenX(v, camX, w.x), screenY(v, w.y), size, Math.atan2(w.dir * slope, 1), w.flipped);
}

/** @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {number} camX */
function drawEffects(ctx, s, camX) {
  const v = s.view;
  for (const p of s.particles) {
    if (!p.alive) continue;
    ctx.globalAlpha = 1 - p.age / p.life;
    ctx.fillStyle = p.color;
    const size = p.size * v.cell;
    ctx.fillRect(screenX(v, camX, p.x) - size / 2, screenY(v, p.y) - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
  if (s.ring) {
    ctx.globalAlpha = 1 - s.ring.progress;
    ctx.strokeStyle = s.ring.color;
    ctx.lineWidth = v.cell * 0.2;
    ctx.beginPath();
    const cy = screenY(v, (JOINT.ceil + JOINT.floor) / 2);
    ctx.ellipse(screenX(v, camX, s.ring.x), cy, v.cell * (0.6 + s.ring.progress * 1.6), v.cell * (3.8 + s.ring.progress * 1.5), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${s.flash})`;
    ctx.fillRect(0, 0, v.width, v.height);
  }
}

/**
 * Draws a whole frame.
 * @param {CanvasRenderingContext2D} ctx @param {Renderer} r @param {Scene} s
 */
export function renderFrame(ctx, r, s) {
  keepCacheFresh(r, s);
  const v = s.view;
  const camX = s.wave.x - v.lead;
  ctx.save();
  ctx.translate(s.shake.x * v.cell, s.shake.y * v.cell);
  const pieces = visiblePieces(s.run, camX, v);
  drawBackdrop(ctx, s, camX);
  drawPieces(ctx, r, s, pieces, camX);
  drawBeyondBand(ctx, r, s, camX);
  drawSpinners(ctx, s, pieces, camX);
  drawPortals(ctx, s, camX);
  drawPlayer(ctx, s, camX);
  drawEffects(ctx, s, camX);
  ctx.restore();
}
