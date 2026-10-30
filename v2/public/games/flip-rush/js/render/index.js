// @ts-check
// Flip Rush's frame (docs/v2/PLAN.md 9.1, stage f-1): the Rush engine's renderer
// (../../../_engine/render/frame.js) with this game's look — its factory themes and
// backgrounds, and the ball or the spider in the player's skin. Neither leaves a trail;
// the spider's snap leaves a short streak instead.
import { createRenderer, renderFrame as renderWith } from '../../../_engine/render/frame.js';
import { screenY } from '../../../_engine/render/view.js';
import { STREAK_TIME, bodyOf } from '../config.js';
import { drawBackground } from './background.js';
import { drawBall, drawSpider, drawStreak, rollAngle } from './vehicles.js';
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
  trailWidth: () => 0,
  drawVehicle(ctx, s, x, y) {
    const w = s.wave;
    const kind = bodyOf(w.mini);
    const size = kind.size * s.view.cell;
    if (w.mode === 'spider') {
      const streak = s.reduced ? 0 : (w.streak ?? 0) / STREAK_TIME;
      if (streak > 0 && w.streakFrom !== undefined) drawStreak(ctx, s.skin, x, screenY(s.view, w.streakFrom), y, size * 0.7, streak);
      drawSpider(ctx, s.skin, x, y, size, w.x, w.grounded === true, w.flipped);
      return;
    }
    drawBall(ctx, s.skin, x, y, size, rollAngle(w.x, kind.half, w.flipped));
  },
};

/**
 * Draws a whole frame.
 * @param {CanvasRenderingContext2D} ctx @param {Renderer} r @param {Scene} s
 */
export function renderFrame(ctx, r, s) {
  renderWith(ctx, r, s, LOOK);
}
