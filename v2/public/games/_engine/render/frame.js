// @ts-check
// One frame of a Rush game (docs/v2/PLAN.md 9.1, stages w-1 and s-1), back to front:
// background (cross-faded at a change of look), the visible sections from their painted
// canvases, solid terrain beyond the band on tall screens, spinning hazards, portals, the
// trail and the vehicle, shards, a portal ring and the crash flash. Painted sections are
// kept only while near the screen. Each game brings its `Look`: its themes, its
// background and how its vehicle is drawn.
import { JOINT } from '../world.js';
import { keepsNormalCheckpoint } from '../sectors.js';
import { pieceAt, pieceIndexAt } from '../level.js';
import { movedAt, profileY } from '../geometry.js';
import { paintPattern, paintSection, STRIP_BOTTOM, STRIP_TOP } from './section.js';
import { drawMine, drawOrb, drawPortal, drawSaw, drawTrail } from './sprites.js';
import { screenX, screenY } from './view.js';

/**
 * @typedef {import('./view.js').View} View
 * @typedef {import('./section.js').SurfaceTheme} Theme
 * @typedef {import('../level.js').Run} Run
 * @typedef {import('../level.js').Piece} Piece
 * @typedef {import('./section.js').Painted} Painted
 * @typedef {{ x: number, y: number, dir: number, mini: boolean, alive: boolean, flipped: boolean, ship: boolean, angle: number, thrust: boolean,
 *   mode?: import('../geometry.js').VehicleMode, grounded?: boolean, streak?: number, streakFrom?: number,
 *   spentRing?: string, spentPad?: string, burst?: number, burstAt?: { x: number, y: number, type: 'ring' | 'pad', kind: string } }} Pose
 *   mode, grounded, streak, streakFrom: Flip Rush's ball and spider (the spider's snap is drawn as a streak);
 *   spentRing, spentPad, burst, burstAt: its orbs and pads (a used one dims, a fired one flashes).
 * @typedef {{ trail: string }} SkinBase
 * @typedef {{
 *   view: View, run: Run, wave: Pose,
 *   trail: { x: number, y: number }[], skin: any, time: number, reduced: boolean,
 *   pulse: number, particles: import('../effects.js').Particle[], shake: { x: number, y: number },
 *   flash: number, ring: { x: number, color: string, progress: number } | null,
 * }} Scene
 *   skin: the game's own skin type (its look draws it; the trail colour is `skin.trail`).
 * @typedef {{ time: number, pulse: number, reduced: boolean }} Clock
 * @typedef {{
 *   themeOf(id: string): Theme,
 *   drawBackground(ctx: CanvasRenderingContext2D, v: View, th: Theme, camX: number, clock: Clock): void,
 *   drawVehicle(ctx: CanvasRenderingContext2D, s: Scene, x: number, y: number): void,
 *   trailWidth(pose: Pose): number,
 *   drawPieceItems?(ctx: CanvasRenderingContext2D, s: Scene, piece: Piece, camX: number): void,
 * }} Look
 *   drawVehicle: at (x, y) device px; trailWidth: in cells; drawPieceItems: what a game
 *   draws per frame in each visible piece over its painting (Flip Rush: orbs and pads).
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
 * @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {number} camX @param {Look} look
 */
function drawBackdrop(ctx, s, camX, look) {
  const centre = camX + s.view.cells / 2;
  const clock = { time: s.time, pulse: s.reduced ? 0 : s.pulse, reduced: s.reduced };
  const i = pieceIndexAt(s.run, centre);
  const here = /** @type {Piece} */ (s.run.pieces[i]);
  look.drawBackground(ctx, s.view, look.themeOf(here.theme), camX, clock);
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
    look.drawBackground(ctx, s.view, look.themeOf(neighbour.theme), camX, clock);
    ctx.globalAlpha = 1;
  }
}

/**
 * Copies the visible part of each piece's painted canvas.
 * @param {CanvasRenderingContext2D} ctx @param {Renderer} r @param {Scene} s @param {Piece[]} pieces @param {number} camX @param {Look} look
 */
function drawPieces(ctx, r, s, pieces, camX, look) {
  const v = s.view;
  for (const piece of pieces) {
    let painted = r.painted.get(piece);
    if (!painted) {
      painted = paintSection(piece.g, look.themeOf(piece.theme), v);
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
  const size = th.pattern === 'panels' || th.pattern === 'plates' ? 2 : 1;
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
 * @param {CanvasRenderingContext2D} ctx @param {Renderer} r @param {Scene} s @param {number} camX @param {Look} look
 */
function drawBeyondBand(ctx, r, s, camX, look) {
  const v = s.view;
  const top = screenY(v, STRIP_TOP);
  const bottom = screenY(v, STRIP_BOTTOM);
  if (top <= 0 && bottom >= v.height) return;
  const piece = /** @type {Piece} */ (s.run.pieces[pieceIndexAt(s.run, camX + v.cells / 2)]);
  const th = look.themeOf(piece.theme);
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
 * Saws, spike orbs and mines of the visible pieces, spinning (not with reduced motion).
 * @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {Piece[]} pieces @param {number} camX @param {Look} look
 */
function drawSpinners(ctx, s, pieces, camX, look) {
  const v = s.view;
  for (const piece of pieces) {
    const th = look.themeOf(piece.theme);
    for (const h of piece.g.hazards) {
      if (h.shape !== 'circle') continue;
      // A moving one is where the vehicle's place puts it (geometry.js movedAt).
      const at = h.move ? movedAt(h, s.wave.x - piece.x0) : h;
      const x = screenX(v, camX, piece.x0 + at.x);
      const y = screenY(v, at.y);
      const spin = s.reduced ? 0 : s.time * (h.type === 'saw' ? -5 : h.type === 'mine' ? 0.8 : 1.4);
      if (th.fx?.hazardGlow) {
        const halo = ctx.createRadialGradient(x, y, h.r * v.cell * 0.5, x, y, h.r * v.cell * 1.6);
        halo.addColorStop(0, th.fx.hazardGlow);
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(x - h.r * v.cell * 1.6, y - h.r * v.cell * 1.6, h.r * v.cell * 3.2, h.r * v.cell * 3.2);
      }
      if (h.type === 'saw') drawSaw(ctx, x, y, h.r * v.cell, spin, th);
      else if (h.type === 'mine') drawMine(ctx, x, y, h.r * v.cell, spin, th, s.reduced ? 0 : s.pulse);
      else drawOrb(ctx, x, y, h.r * v.cell, spin, th);
    }
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {number} camX */
function drawPortals(ctx, s, camX) {
  const v = s.view;
  for (const p of s.run.portals) {
    if (p.x < camX - 2 || p.x > camX + v.cells + 2) continue;
    // Spanning the corridor where it stands (a section's own portal may be in a tunnel).
    const piece = pieceAt(s.run, p.x);
    const local = p.x - piece.x0;
    const top = profileY(piece.g.ceil, local, 'ceil');
    const bottom = profileY(piece.g.floor, local, 'floor');
    drawPortal(ctx, screenX(v, camX, p.x), screenY(v, top + 0.25), screenY(v, bottom - 0.25), v.cell, p, s.time, s.reduced);
  }
}

/**
 * A section's dark stretches (stage r-2): the view closes in round the vehicle, fading in
 * and out over two cells; an inverted-controls stretch tints the screen and frames it.
 * @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {number} camX
 */
function drawStretchEffects(ctx, s, camX) {
  const v = s.view;
  const piece = pieceAt(s.run, s.wave.x);
  const local = s.wave.x - piece.x0;
  let dark = 0;
  for (const r of piece.g.dark) dark = Math.max(dark, Math.min(1, (local - r.from) / 2 + 1, (r.to - local) / 2 + 1));
  if (dark > 0) {
    const x = screenX(v, camX, s.wave.x);
    const y = screenY(v, s.wave.y);
    const g = ctx.createRadialGradient(x, y, v.cell * 2.2, x, y, v.cell * 5.5);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, `rgba(0, 0, 0, ${0.94 * dark})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.width, v.height);
  }
  if (piece.g.invert.some((r) => local >= r.from && local < r.to)) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 60, 200, 0.1)';
    ctx.fillRect(0, 0, v.width, v.height);
    ctx.strokeStyle = 'rgba(255, 90, 210, 0.85)';
    ctx.lineWidth = v.cell * 0.18;
    ctx.strokeRect(v.cell * 0.1, v.cell * 0.1, v.width - v.cell * 0.2, v.height - v.cell * 0.2);
    ctx.restore();
  }
  // Where an inverted stretch begins and ends: a magenta band across the corridor.
  for (const p of [piece, s.run.pieces[s.run.pieces.indexOf(piece) + 1]]) {
    if (!p) continue;
    for (const r of p.g.invert) {
      for (const edge of [r.from, r.to]) {
        const ex = screenX(v, camX, p.x0 + edge);
        if (ex < -v.cell || ex > v.width + v.cell) continue;
        ctx.fillStyle = 'rgba(255, 90, 210, 0.5)';
        ctx.fillRect(ex - v.cell * 0.12, screenY(v, profileY(p.g.ceil, edge, 'ceil')), v.cell * 0.24, (profileY(p.g.floor, edge, 'floor') - profileY(p.g.ceil, edge, 'ceil')) * v.cell);
      }
    }
  }
}

/**
 * Normal play's checkpoints: at the start of every sector that keeps one, a post on the
 * floor with a flag and a faint line across the corridor (sectors.js keepsNormalCheckpoint).
 * @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {number} camX
 */
function drawCheckpoints(ctx, s, camX) {
  if (s.run.kind !== 'run') return;
  const v = s.view;
  const c = v.cell;
  s.run.sectors.forEach((placed, i) => {
    if (i === 0 || !keepsNormalCheckpoint(placed.def)) return;
    // Just before the joint (a vehicle portal may stand just after it).
    const x = screenX(v, camX, placed.x0 - 1.4);
    if (x < -c * 2 || x > v.width + c * 2) return;
    const floor = screenY(v, JOINT.floor);
    const top = screenY(v, JOINT.floor - 2.4);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, c * 0.06);
    ctx.setLineDash([c * 0.3, c * 0.3]);
    ctx.beginPath();
    ctx.moveTo(x, screenY(v, JOINT.ceil));
    ctx.lineTo(x, floor);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // The post and its flag: green with a white outline, a check mark on it.
    ctx.fillStyle = '#e8edf5';
    ctx.fillRect(x - c * 0.06, top, c * 0.12, floor - top);
    ctx.fillStyle = '#3ddc84';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, c * 0.05);
    ctx.beginPath();
    ctx.moveTo(x + c * 0.06, top);
    ctx.lineTo(x + c * 1.1, top + c * 0.35);
    ctx.lineTo(x + c * 0.06, top + c * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#0b3d22';
    ctx.lineWidth = Math.max(1, c * 0.07);
    ctx.beginPath();
    ctx.moveTo(x + c * 0.25, top + c * 0.36);
    ctx.lineTo(x + c * 0.4, top + c * 0.5);
    ctx.lineTo(x + c * 0.68, top + c * 0.2);
    ctx.stroke();
    ctx.restore();
  });
}

/** @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {number} camX @param {Look} look */
function drawPlayer(ctx, s, camX, look) {
  const v = s.view;
  const w = s.wave;
  const points = s.trail.filter((p) => p.x > camX - 2).map((p) => ({ x: screenX(v, camX, p.x), y: screenY(v, p.y) }));
  const before = s.trail.filter((p) => p.x <= camX - 2).pop();
  if (before) points.unshift({ x: screenX(v, camX, before.x), y: screenY(v, before.y) });
  points.push({ x: screenX(v, camX, w.x), y: screenY(v, w.y) });
  const width = look.trailWidth(w);
  if (width > 0) drawTrail(ctx, points, v.cell * width, s.skin.trail);
  if (!w.alive) return;
  look.drawVehicle(ctx, s, screenX(v, camX, w.x), screenY(v, w.y));
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
 * @param {CanvasRenderingContext2D} ctx @param {Renderer} r @param {Scene} s @param {Look} look
 */
export function renderFrame(ctx, r, s, look) {
  keepCacheFresh(r, s);
  const v = s.view;
  const camX = s.wave.x - v.lead;
  ctx.save();
  ctx.translate(s.shake.x * v.cell, s.shake.y * v.cell);
  const pieces = visiblePieces(s.run, camX, v);
  drawBackdrop(ctx, s, camX, look);
  drawPieces(ctx, r, s, pieces, camX, look);
  drawBeyondBand(ctx, r, s, camX, look);
  drawSpinners(ctx, s, pieces, camX, look);
  if (look.drawPieceItems) for (const piece of pieces) look.drawPieceItems(ctx, s, piece, camX);
  drawPortals(ctx, s, camX);
  drawCheckpoints(ctx, s, camX);
  drawPlayer(ctx, s, camX, look);
  drawStretchEffects(ctx, s, camX);
  drawEffects(ctx, s, camX);
  ctx.restore();
}
