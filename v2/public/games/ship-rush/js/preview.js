// @ts-check
// Ship Rush's vehicle in a box (96 × 64 CSS px): the ship's curving trail and the ship, in a skin — on the skins screen
// and on the Rush mode picker (../../rush/, stage rr-a).
import { drawShip } from './render/ship.js';

/** @param {CanvasRenderingContext2D} ctx @param {import('./skins.js').Skin} skin */
export function paintSkin(ctx, skin) {
  ctx.strokeStyle = skin.trail;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(4, 46);
  ctx.bezierCurveTo(20, 50, 28, 22, 44, 26);
  ctx.quadraticCurveTo(52, 28, 56, 32);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawShip(ctx, skin, 70, 33, 40, -0.12, true, false, 0);
}
