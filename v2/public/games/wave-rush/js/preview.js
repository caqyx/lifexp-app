// @ts-check
// Wave Rush's vehicle in a box (96 × 64 CSS px): the wave's zig-zag trail and the icon, in a skin — on the skins screen
// and on the Rush mode picker (../../rush/, stage rr-a).
import { drawWave } from './render/sprites.js';

/** @param {CanvasRenderingContext2D} ctx @param {import('./skins.js').Skin} skin */
export function paintSkin(ctx, skin) {
  ctx.strokeStyle = skin.trail;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'miter';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(4, 44);
  ctx.lineTo(24, 24);
  ctx.lineTo(44, 44);
  ctx.lineTo(62, 26);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawWave(ctx, skin, 66, 22, 30, -Math.PI / 4);
}
