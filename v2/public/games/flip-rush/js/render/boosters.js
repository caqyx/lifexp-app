// @ts-check
// Orbs and pads, drawn every frame (docs/v2/PLAN.md 9.1, stage f-2): original rings and
// plates, each kind its own colour AND its own shape (colour is never the only cue):
// - orbs: a glowing ring with a dark centre — jump (yellow, a dot), small (pink, a thinner,
//   smaller ring), gravity (blue, two turning arrows), gravityJump (green, the arrows and a
//   dot), dash (red, four ticks pointing in);
// - pads: a low plate on its surface with a glow rising off it — jump (yellow, a chevron),
//   small (pink, a short chevron), gravity (blue, two opposite chevrons).
// They breathe with the beat (still with reduced motion); a used one dims. A fired one
// flashes: a ring bursting out from it (not with reduced motion).
import { screenX, screenY } from '../../../_engine/render/view.js';
import { RING_R } from '../config.js';
import { BURST_TIME } from '../physics.js';

/** @type {Record<string, string>} */
export const BOOSTER_COLORS = { jump: '#ffd23f', small: '#ff7ac8', gravity: '#3fa9ff', gravityJump: '#4fe08a', dash: '#ff5a3c' };

/** @typedef {import('../../../_engine/render/frame.js').Scene} Scene */

/**
 * Two curved arrows turning round the centre (gravity), radius r.
 * @param {CanvasRenderingContext2D} ctx @param {number} r
 */
function turnArrows(ctx, r) {
  for (const a of [0, Math.PI]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, a + 0.3, a + Math.PI - 0.5);
    ctx.stroke();
    const ex = Math.cos(a + Math.PI - 0.5) * r;
    const ey = Math.sin(a + Math.PI - 0.5) * r;
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * An orb at (x, y) device px, cell px per cell.
 * @param {CanvasRenderingContext2D} ctx @param {string} kind @param {number} x @param {number} y @param {number} cell @param {number} pulse @param {boolean} used
 */
export function drawRing(ctx, kind, x, y, cell, pulse, used) {
  const color = BOOSTER_COLORS[kind] ?? '#ffffff';
  const r = RING_R * cell * (kind === 'small' ? 0.82 : 1) * (1 + 0.06 * pulse);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = used ? 0.4 : 1;
  const glow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = (used ? 0.15 : 0.45) + 0.2 * pulse;
  ctx.fillStyle = glow;
  ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
  ctx.globalAlpha = used ? 0.4 : 1;
  ctx.fillStyle = 'rgba(10, 10, 16, 0.75)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * (kind === 'small' ? 0.2 : 0.3);
  ctx.stroke();
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.02, -2.4, -1.4);
  ctx.stroke();
  ctx.strokeStyle = color;
  if (kind === 'jump' || kind === 'gravityJump') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === 'gravity' || kind === 'gravityJump') {
    ctx.lineWidth = r * 0.12;
    turnArrows(ctx, r * 0.6);
  }
  if (kind === 'dash') {
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
      ctx.lineTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
    }
    ctx.stroke();
  }
  if (kind === 'small') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * A pad on its surface at (x, y) device px, facing up (+1) or down (−1).
 * @param {CanvasRenderingContext2D} ctx @param {string} kind @param {number} x @param {number} y @param {number} face @param {number} cell @param {number} pulse @param {boolean} used
 */
export function drawPad(ctx, kind, x, y, face, cell, pulse, used) {
  const color = BOOSTER_COLORS[kind] ?? '#ffffff';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(cell, face > 0 ? cell : -cell);
  ctx.globalAlpha = used ? 0.45 : 1;
  // Light rising off the plate.
  const rise = ctx.createLinearGradient(0, 0, 0, -1.1);
  rise.addColorStop(0, color);
  rise.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = (used ? 0.15 : 0.55) + 0.15 * pulse;
  ctx.fillStyle = rise;
  ctx.fillRect(-0.45, -1.3, 0.9, 1.3);
  ctx.globalAlpha = used ? 0.45 : 1;
  // The plate: a low dome on a dark base.
  ctx.fillStyle = 'rgba(10, 10, 16, 0.8)';
  ctx.fillRect(-0.5, -0.14, 1, 0.14);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-0.48, -0.12);
  ctx.quadraticCurveTo(0, -0.62, 0.48, -0.12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.04;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(10, 10, 16, 0.85)';
  ctx.lineWidth = 0.07;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const tall = kind === 'small' ? 0.1 : 0.17;
  ctx.moveTo(-0.14, -0.16);
  ctx.lineTo(0, -0.16 - tall);
  ctx.lineTo(0.14, -0.16);
  if (kind === 'gravity') {
    ctx.moveTo(-0.32, -0.2);
    ctx.lineTo(-0.24, -0.12);
    ctx.lineTo(-0.16, -0.2);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The flash of a fired orb or pad: a ring bursting out and fading.
 * @param {CanvasRenderingContext2D} ctx @param {string} kind @param {number} x @param {number} y @param {number} cell @param {number} left seconds of the flash left
 */
export function drawBurst(ctx, kind, x, y, cell, left) {
  const t = 1 - Math.max(0, left) / BURST_TIME;
  if (t >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = BOOSTER_COLORS[kind] ?? '#ffffff';
  ctx.lineWidth = cell * 0.16 * (1 - t) + 1;
  ctx.beginPath();
  ctx.arc(x, y, cell * (RING_R + 1.1 * t), 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, cell * 0.05);
  ctx.beginPath();
  ctx.arc(x, y, cell * (RING_R + 0.6 * t), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Every orb and pad of a visible piece.
 * @param {CanvasRenderingContext2D} ctx @param {Scene} s @param {import('../../../_engine/level.js').Piece} piece @param {number} camX
 */
export function drawPieceBoosters(ctx, s, piece, camX) {
  if (!piece.g.boosters.length) return;
  const k = s.run.pieces.indexOf(piece);
  const v = s.view;
  const pulse = s.reduced ? 0 : s.pulse;
  piece.g.boosters.forEach((b, i) => {
    const id = `${k}:${i}`;
    const x = screenX(v, camX, piece.x0 + b.x);
    if (x < -v.cell * 2 || x > v.width + v.cell * 2) return;
    const y = screenY(v, b.y);
    if (b.type === 'ring') drawRing(ctx, b.kind, x, y, v.cell, pulse, s.wave.spentRing === id);
    else drawPad(ctx, b.kind, x, y, b.dir === 'up' ? 1 : -1, v.cell, pulse, s.wave.spentPad === id);
  });
}
