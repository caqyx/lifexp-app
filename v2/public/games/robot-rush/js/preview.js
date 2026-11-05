// @ts-check
// Robot Rush's vehicle in a box (96 × 64 CSS px): the robot mid-jump over a rooftop's edge,
// in a skin — on the skins screen and on the Rush mode picker (../../rush/).
import { drawRobot } from './render/robot.js';

/** @param {CanvasRenderingContext2D} ctx @param {import('./skins.js').Skin} skin */
export function paintSkin(ctx, skin) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(4, 56, 40, 4);
  ctx.fillRect(60, 56, 32, 4);
  ctx.strokeStyle = skin.trail;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(18, 50);
  ctx.quadraticCurveTo(40, 4, 62, 30);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  drawRobot(ctx, skin, 52, 26, 30, { stride: 0.3, air: true, flame: 0.8, flipped: false });
}
