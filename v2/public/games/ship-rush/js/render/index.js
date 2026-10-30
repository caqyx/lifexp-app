// @ts-check
// Ship Rush's frame (docs/v2/PLAN.md 9.1, stage s-1): the Rush engine's renderer
// (../../../_engine/render/frame.js) with this game's look — its sky themes and
// backgrounds, and the ship (or, in the finale's wave stretches, the wave) in the
// player's skin.
import { createRenderer, renderFrame as renderWith } from '../../../_engine/render/frame.js';
import { WAVE } from '../../../_engine/wave.js';
import { SHIP } from '../config.js';
import { drawBackground } from './background.js';
import { drawShip, drawWaveIcon } from './ship.js';
import { themeOf } from './themes.js';

export { createRenderer };

/**
 * @typedef {import('../../../_engine/render/frame.js').Scene} Scene
 * @typedef {import('../../../_engine/render/frame.js').Renderer} Renderer
 */

/** @type {import('../../../_engine/render/frame.js').Look} */
export const LOOK = {
  themeOf,
  drawBackground: (ctx, v, th, camX, clock) => drawBackground(ctx, v, /** @type {import('./themes.js').Theme} */ (th), camX, clock),
  trailWidth: (w) => (w.ship ? (w.mini ? 0.13 : 0.2) : w.mini ? 0.2 : 0.3),
  drawVehicle(ctx, s, x, y) {
    const w = s.wave;
    if (!w.ship) {
      drawWaveIcon(ctx, s.skin, x, y, (w.mini ? WAVE.miniSize : WAVE.size) * s.view.cell, w.angle, w.flipped);
      return;
    }
    const size = (w.mini ? SHIP.mini.size : SHIP.normal.size) * s.view.cell;
    drawShip(ctx, s.skin, x, y, size, w.angle, w.thrust && !s.reduced, w.flipped, s.time);
  },
};

/**
 * Draws a whole frame.
 * @param {CanvasRenderingContext2D} ctx @param {Renderer} r @param {Scene} s
 */
export function renderFrame(ctx, r, s) {
  renderWith(ctx, r, s, LOOK);
}
