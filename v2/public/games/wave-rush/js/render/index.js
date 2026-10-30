// @ts-check
// Wave Rush's frame (docs/v2/PLAN.md 9.1, stage w-1): the shared renderer
// (../../../_engine/render/frame.js) with this game's look — its sector themes and
// backgrounds, and the wave (or the finale's ship) in the player's skin.
import { createRenderer, renderFrame as renderWith } from '../../../_engine/render/frame.js';
import { SHIP, WAVE } from '../config.js';
import { drawBackground } from './background.js';
import { drawShip, drawWave } from './sprites.js';
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
  trailWidth: (w) => (w.mini ? 0.2 : 0.3),
  drawVehicle(ctx, s, x, y) {
    const w = s.wave;
    const cell = s.view.cell;
    if (w.ship) drawShip(ctx, s.skin, x, y, SHIP.size * cell, w.angle, w.thrust && !s.reduced, w.flipped);
    else drawWave(ctx, s.skin, x, y, (w.mini ? WAVE.miniSize : WAVE.size) * cell, w.angle, w.flipped);
  },
};

/**
 * Draws a whole frame.
 * @param {CanvasRenderingContext2D} ctx @param {Renderer} r @param {Scene} s
 */
export function renderFrame(ctx, r, s) {
  renderWith(ctx, r, s, LOOK);
}
