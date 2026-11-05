// @ts-check
// Flip Rush's vehicle in a box (96 × 64 CSS px): the ball and the spider, in a skin — on the skins screen
// and on the Rush mode picker (../../rush/, stage rr-a).
import { drawBall, drawSpider } from './render/vehicles.js';

/** @param {CanvasRenderingContext2D} ctx @param {import('./skins.js').Skin} skin */
export function paintSkin(ctx, skin) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(4, 59, 88, 3);
  ctx.fillRect(4, 2, 88, 3);
  drawBall(ctx, skin, 28, 42, 34, 0.5);
  drawSpider(ctx, skin, 68, 22, 34, 0.3, true, true);
}
