// @ts-check
// What moves, drawn every frame by both Rush games (docs/v2/PLAN.md 9.1, stages w-1 and
// s-1): saws, spike orbs and spiked mines (they spin; their hit circle does not change),
// portals and the trail. The wave's trail is straight diagonal segments only (a point at
// every change of direction); the ship's is a curve of close points.

/** @typedef {import('./section.js').SurfaceTheme} Theme */

/**
 * A saw blade: metal teeth, a dark inner disc, a hub; outlined in the hazard colour.
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r px @param {number} angle @param {Theme} th
 */
export function drawSaw(ctx, x, y, r, angle, th) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const teeth = 14;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.8;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, th.hazard.metal);
  g.addColorStop(1, th.hazard.inner);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = th.hazard.edge;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.lineJoin = 'miter';
  ctx.stroke();
  ctx.fillStyle = th.hazard.fill;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = th.hazard.inner;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = th.hazard.metal;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A spike orb: a dark core with eight spikes, slowly turning.
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r px @param {number} angle @param {Theme} th
 */
export function drawOrb(ctx, x, y, r, angle, th) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  const spikes = 8;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.55;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = th.hazard.fill;
  ctx.fill();
  ctx.strokeStyle = th.hazard.edge;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.lineJoin = 'miter';
  ctx.stroke();
  const g = ctx.createRadialGradient(-r * 0.15, -r * 0.15, 0, 0, 0, r * 0.5);
  g.addColorStop(0, th.hazard.metal);
  g.addColorStop(1, th.hazard.inner);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A spiked mine: a riveted sphere with long thin spikes and a warning light that blinks
 * on the beat (steady with reduced motion: `pulse` 0).
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r px (to the spike tips)
 * @param {number} angle @param {Theme} th @param {number} pulse 0..1
 */
export function drawMine(ctx, x, y, r, angle, th, pulse) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const core = r * 0.58;
  // Spikes: twelve thin cones, alternating long and short.
  ctx.fillStyle = th.hazard.metal;
  ctx.strokeStyle = th.hazard.edge;
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.lineJoin = 'miter';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tip = i % 2 === 0 ? r : r * 0.82;
    const w = 0.16;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - w) * core * 0.9, Math.sin(a - w) * core * 0.9);
    ctx.lineTo(Math.cos(a) * tip, Math.sin(a) * tip);
    ctx.lineTo(Math.cos(a + w) * core * 0.9, Math.sin(a + w) * core * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // The sphere, lit from the top left, with a bright rim.
  const g = ctx.createRadialGradient(-core * 0.35, -core * 0.35, core * 0.1, 0, 0, core);
  g.addColorStop(0, th.hazard.inner);
  g.addColorStop(1, th.hazard.fill);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, core, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.stroke();
  // A belt of rivets.
  ctx.fillStyle = th.hazard.metal;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * core * 0.72, Math.sin(a) * core * 0.72, r * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // The warning light (not rotated: it stays on top).
  const light = core * 0.3;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, light * (2.2 + pulse * 1.2));
  glow.addColorStop(0, 'rgba(255, 70, 70, 0.9)');
  glow.addColorStop(1, 'rgba(255, 70, 70, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - light * 3.5, y - light * 3.5, light * 7, light * 7);
  ctx.fillStyle = '#ff5a5a';
  ctx.beginPath();
  ctx.arc(x, y, light, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(x - light * 0.3, y - light * 0.3, light * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

/** Portal colours: gravity amber/blue, size pink/green. */
export const PORTAL_COLORS = {
  gravityOn: '#f2b84b',
  gravityOff: '#62b6e6',
  miniOn: '#e07ac8',
  miniOff: '#7fcf7a',
  shipOn: '#ff8a5c',
  shipOff: '#7fe0ff',
  ball: '#ffb347',
  spider: '#c77dff',
};

/**
 * A portal's colour.
 * @param {{ kind: 'gravity' | 'mini' | 'ship', on: boolean, mode?: string }} p
 */
export function portalColor(p) {
  if (p.kind === 'ship' && p.mode === 'ball') return PORTAL_COLORS.ball;
  if (p.kind === 'ship' && p.mode === 'spider') return PORTAL_COLORS.spider;
  if (p.kind === 'gravity') return p.on ? PORTAL_COLORS.gravityOn : PORTAL_COLORS.gravityOff;
  if (p.kind === 'mini') return p.on ? PORTAL_COLORS.miniOn : PORTAL_COLORS.miniOff;
  return p.on ? PORTAL_COLORS.shipOn : PORTAL_COLORS.shipOff;
}

/**
 * A portal: a tall ring across the joint's corridor with arrows for the new gravity.
 * @param {CanvasRenderingContext2D} ctx @param {number} x px @param {number} top px @param {number} bottom px
 * @param {number} cell px @param {{ kind: 'gravity' | 'mini' | 'ship', on: boolean }} p @param {number} time @param {boolean} reduced
 */
export function drawPortal(ctx, x, top, bottom, cell, p, time, reduced) {
  const color = portalColor(p);
  const cy = (top + bottom) / 2;
  const ry = (bottom - top) / 2;
  const rx = cell * 0.55;
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = cell * 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = cell * 0.16;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, cell * 0.05);
  ctx.beginPath();
  ctx.ellipse(x, cy, rx * 0.72, ry * 0.94, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Chevrons pointing the way gravity will pull (gravity) or inward/outward (size).
  const dir = p.kind === 'gravity' ? (p.on ? -1 : 1) : p.on ? 1 : -1;
  const drift = reduced ? 0 : ((time * 1.6) % 1) * cell * 0.5 * dir;
  ctx.strokeStyle = color;
  ctx.lineWidth = cell * 0.12;
  ctx.lineCap = 'round';
  for (let k = -1; k <= 1; k++) {
    const y = cy + k * cell * 1.1 + drift;
    ctx.beginPath();
    ctx.moveTo(x - cell * 0.28, y - dir * cell * 0.2);
    ctx.lineTo(x, y + dir * cell * 0.08);
    ctx.lineTo(x + cell * 0.28, y - dir * cell * 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A #rrggbb colour with an alpha.
 * @param {string} hex @param {number} alpha
 */
export function withAlpha(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * The trail: straight segments through the points of direction change, fading toward its tail.
 * @param {CanvasRenderingContext2D} ctx @param {{ x: number, y: number }[]} points px, oldest first
 * @param {number} width px @param {string} color #rrggbb
 */
export function drawTrail(ctx, points, width, color) {
  if (points.length < 2) return;
  const first = /** @type {{ x: number, y: number }} */ (points[0]);
  const last = /** @type {{ x: number, y: number }} */ (points[points.length - 1]);
  const path = new Path2D();
  points.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
  const span = Math.max(1, last.x - first.x);
  /** @param {number} alpha */
  const fade = (alpha) => {
    const g = ctx.createLinearGradient(first.x, 0, last.x, 0);
    g.addColorStop(0, withAlpha(color, 0));
    g.addColorStop(Math.min(0.9, 0.45 + 40 / span), withAlpha(color, alpha));
    g.addColorStop(1, withAlpha(color, alpha));
    return g;
  };
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 3;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = fade(0.22);
  ctx.lineWidth = width * 2.2;
  ctx.stroke(path);
  ctx.strokeStyle = fade(1);
  ctx.lineWidth = width;
  ctx.stroke(path);
  ctx.restore();
}
