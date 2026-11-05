// @ts-check
// Robot Rush's frame (docs/v2/PLAN.md 9.1, stage rr-b): the Rush engine's renderer
// (../../../_engine/render/frame.js) with this game's look — its neon city themes and
// backgrounds, the robot in the player's skin, and the orbs and pads (Flip Rush's, with
// their flash). The robot leaves no trail; its thrusters burn under it while a jump climbs.
import { createRenderer, renderFrame as renderWith } from '../../../_engine/render/frame.js';
import { mixedLook } from '../../../_engine/editor/look.js';
import { screenX, screenY } from '../../../_engine/render/view.js';
import { drawBurst, drawPieceBoosters } from '../../../flip-rush/js/render/boosters.js';
import { robotOf } from '../config.js';
import { drawBackground } from './background.js';
import { drawRobot } from './robot.js';
import { themeOf } from './themes.js';

export { createRenderer };

/**
 * @typedef {import('../../../_engine/render/frame.js').Scene} Scene
 * @typedef {import('../../../_engine/render/frame.js').Renderer} Renderer
 */

/** @type {import('../../../_engine/render/frame.js').Look} */
const OWN_LOOK = {
  themeOf,
  drawBackground: (ctx, v, th, camX, clock) => drawBackground(ctx, v, /** @type {import('./themes.js').Theme} */ (th), camX, clock),
  trailWidth: () => 0,
  drawPieceItems: drawPieceBoosters,
  drawVehicle(ctx, s, x, y) {
    const w = s.wave;
    const camX = w.x - s.view.lead;
    if (!s.reduced && w.burstAt && (w.burst ?? 0) > 0) drawBurst(ctx, w.burstAt.kind, screenX(s.view, camX, w.burstAt.x), screenY(s.view, w.burstAt.y), s.view.cell, w.burst ?? 0);
    const kind = robotOf(w.mini);
    const flame = (w.lift ?? 0) > 0 ? Math.min(1, (w.lift ?? 0) / kind.boost + 0.3) : 0;
    drawRobot(ctx, s.skin, x, y, kind.size * s.view.cell, { stride: s.reduced ? 0 : w.x * 0.6, air: w.grounded !== true, flame, flipped: w.flipped });
  },
};

/** Any vehicle an editor's level brings: the others drawn by their own game. */
export const LOOK = mixedLook(OWN_LOOK, ['robot']);

/**
 * Draws a whole frame.
 * @param {CanvasRenderingContext2D} ctx @param {Renderer} r @param {Scene} s
 */
export function renderFrame(ctx, r, s) {
  renderWith(ctx, r, s, LOOK);
}
