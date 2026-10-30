// @ts-check
// Wave Rush's icons, drawn every frame (docs/v2/PLAN.md 9.1, stages w-1 and w-2): the
// wave in its skin's shape and the finale's ship. Saws, spike orbs, portals and the trail
// are the shared engine's (../../../_engine/render/sprites.js).
export { PORTAL_COLORS, drawOrb, drawPortal, drawSaw, drawTrail, portalColor, withAlpha } from '../../../_engine/render/sprites.js';

/** @typedef {import('../skins.js').Skin} Skin */

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
 * The ship (the finale): a sleek hull in the skin's colours with a canopy, tilted with
 * its climb, and a short flame while thrusting.
 * @param {CanvasRenderingContext2D} ctx @param {Skin} skin @param {number} x @param {number} y @param {number} size
 * @param {number} tilt radians @param {boolean} thrust @param {boolean} [flipped]
 */
export function drawShip(ctx, skin, x, y, size, tilt, thrust, flipped = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(size, flipped ? -size : size);
  ctx.lineJoin = 'round';
  if (thrust) {
    ctx.fillStyle = 'rgba(255, 170, 80, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-0.55, -0.12);
    ctx.lineTo(-0.92, 0.04);
    ctx.lineTo(-0.55, 0.18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0.62, 0.06);
  ctx.quadraticCurveTo(0.3, -0.16, -0.2, -0.2);
  ctx.lineTo(-0.58, -0.3);
  ctx.lineTo(-0.5, 0.0);
  ctx.lineTo(-0.58, 0.24);
  ctx.lineTo(0.3, 0.24);
  ctx.closePath();
  ctx.fillStyle = skin.body;
  ctx.fill();
  ctx.strokeStyle = skin.edge;
  ctx.lineWidth = 0.08;
  ctx.stroke();
  ctx.fillStyle = skin.accent;
  ctx.beginPath();
  ctx.ellipse(0.05, -0.12, 0.2, 0.12, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
