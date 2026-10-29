// @ts-check
// What moves, drawn every frame (docs/v2/PLAN.md 9.1, stage w-1): saws and spike orbs
// (they spin; their hit circle does not change), portals, the wave and its trail. The
// trail is straight diagonal segments only: a point at every change of direction.

/**
 * @typedef {import('./themes.js').Theme} Theme
 * @typedef {import('../skins.js').Skin} Skin
 */

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

/** Portal colours: gravity amber/blue, size pink/green. */
export const PORTAL_COLORS = {
  gravityOn: '#f2b84b',
  gravityOff: '#62b6e6',
  miniOn: '#e07ac8',
  miniOff: '#7fcf7a',
};

/**
 * A portal: a tall ring across the joint's corridor with arrows for the new gravity.
 * @param {CanvasRenderingContext2D} ctx @param {number} x px @param {number} top px @param {number} bottom px
 * @param {number} cell px @param {{ kind: 'gravity' | 'mini', on: boolean }} p @param {number} time @param {boolean} reduced
 */
export function drawPortal(ctx, x, top, bottom, cell, p, time, reduced) {
  const color = p.kind === 'gravity' ? (p.on ? PORTAL_COLORS.gravityOn : PORTAL_COLORS.gravityOff) : p.on ? PORTAL_COLORS.miniOn : PORTAL_COLORS.miniOff;
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
 * The wave's outline in unit coordinates (pointing to +x, about 1 long).
 * @param {CanvasRenderingContext2D} ctx @param {import('../skins.js').Shape} shape
 */
function shapePath(ctx, shape) {
  ctx.beginPath();
  switch (shape) {
    case 'arrow':
      ctx.moveTo(0.55, 0);
      ctx.lineTo(-0.45, -0.45);
      ctx.lineTo(-0.2, 0);
      ctx.lineTo(-0.45, 0.45);
      break;
    case 'kite':
      ctx.moveTo(0.6, 0);
      ctx.lineTo(0, -0.34);
      ctx.lineTo(-0.5, 0);
      ctx.lineTo(0, 0.34);
      break;
    case 'chevron':
      ctx.moveTo(0.55, 0);
      ctx.lineTo(-0.15, -0.45);
      ctx.lineTo(-0.5, -0.45);
      ctx.lineTo(0.05, 0);
      ctx.lineTo(-0.5, 0.45);
      ctx.lineTo(-0.15, 0.45);
      break;
    case 'diamond':
      ctx.moveTo(0.55, 0);
      ctx.lineTo(0, -0.42);
      ctx.lineTo(-0.55, 0);
      ctx.lineTo(0, 0.42);
      break;
    case 'fin':
      ctx.moveTo(0.58, 0);
      ctx.quadraticCurveTo(0, -0.12, -0.5, -0.46);
      ctx.quadraticCurveTo(-0.3, 0, -0.5, 0.36);
      ctx.quadraticCurveTo(0, 0.12, 0.58, 0);
      break;
    case 'blade':
      ctx.moveTo(0.62, 0);
      ctx.lineTo(-0.3, -0.24);
      ctx.lineTo(-0.3, -0.42);
      ctx.lineTo(-0.5, -0.42);
      ctx.lineTo(-0.5, 0.42);
      ctx.lineTo(-0.3, 0.42);
      ctx.lineTo(-0.3, 0.24);
      break;
    case 'comet':
      ctx.arc(0.18, 0, 0.32, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-0.55, 0.1);
      ctx.lineTo(-0.4, 0);
      ctx.lineTo(-0.55, -0.1);
      break;
    case 'twin':
      ctx.moveTo(0.58, -0.08);
      ctx.lineTo(-0.1, -0.46);
      ctx.lineTo(-0.1, -0.08);
      ctx.moveTo(0.58, 0.08);
      ctx.lineTo(-0.1, 0.08);
      ctx.lineTo(-0.1, 0.46);
      ctx.moveTo(0.1, 0);
      ctx.lineTo(-0.55, -0.3);
      ctx.lineTo(-0.55, 0.3);
      break;
    case 'crown':
      ctx.moveTo(0.6, 0);
      ctx.lineTo(-0.2, -0.32);
      ctx.lineTo(-0.3, -0.52);
      ctx.lineTo(-0.38, -0.34);
      ctx.lineTo(-0.5, -0.5);
      ctx.lineTo(-0.5, 0.42);
      break;
    default:
      ctx.moveTo(0.55, 0);
      ctx.lineTo(-0.5, -0.42);
      ctx.lineTo(-0.5, 0.42);
  }
  ctx.closePath();
}

/**
 * The skin's inner accent (a second colour inside the body).
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin
 */
function accentPath(ctx, skin) {
  ctx.beginPath();
  if (skin.shape === 'comet') ctx.arc(0.2, 0, 0.14, 0, Math.PI * 2);
  else if (skin.shape === 'crown') {
    ctx.moveTo(0.05, -0.07);
    ctx.lineTo(0.2, 0);
    ctx.lineTo(0.05, 0.07);
    ctx.lineTo(-0.1, 0);
  } else if (skin.shape === 'twin') {
    ctx.moveTo(0.3, 0);
    ctx.lineTo(-0.2, -0.12);
    ctx.lineTo(-0.2, 0.12);
  } else {
    ctx.moveTo(0.22, 0);
    ctx.lineTo(-0.22, -0.16);
    ctx.lineTo(-0.12, 0);
    ctx.lineTo(-0.22, 0.16);
  }
  ctx.closePath();
}

/**
 * The wave icon at (x, y) px, `size` px long, turned to `angle`; upside down when gravity is.
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin @param {number} x @param {number} y @param {number} size @param {number} angle
 * @param {boolean} [flipped]
 */
export function drawWave(ctx, skin, x, y, size, angle, flipped = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, flipped ? -size : size);
  ctx.lineJoin = 'round';
  shapePath(ctx, skin.shape);
  ctx.fillStyle = skin.body;
  ctx.fill('evenodd');
  ctx.strokeStyle = skin.edge;
  ctx.lineWidth = 0.09;
  ctx.stroke();
  accentPath(ctx, skin);
  ctx.fillStyle = skin.accent;
  ctx.fill();
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
