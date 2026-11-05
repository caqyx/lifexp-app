// @ts-check
// Every vehicle drawn in every Rush game, for the editor's levels (docs/v2/PLAN.md 9.1,
// stage r-5): the game draws its own vehicles as ever; a vehicle from another game is drawn
// by that game's drawing, in the player's skin of this game (its colours — body, edge,
// accent, trail — are the same in all three; what only one game's skins have, a wave's
// shape, a ship's hull and glass, a ball's pattern and eye, a robot's crest, gets that
// game's first skin's).
import { WAVE } from '../wave.js';
import { screenY } from '../render/view.js';
import { drawWave } from '../../wave-rush/js/render/sprites.js';
import { drawShip } from '../../ship-rush/js/render/ship.js';
import { SHIP } from '../../ship-rush/js/config.js';
import { drawBall, drawSpider, drawStreak, rollAngle } from '../../flip-rush/js/render/vehicles.js';
import { STREAK_TIME, bodyOf } from '../../flip-rush/js/config.js';
import { drawRobot } from '../../robot-rush/js/render/robot.js';
import { robotOf } from '../../robot-rush/js/config.js';

/**
 * @typedef {import('../render/frame.js').Look} Look
 * @typedef {import('../render/frame.js').Scene} Scene
 */

/** What only one game's skins have, as its first skin has it. */
const MISSING = { shape: 'dart', hull: 'swift', glass: '#bfe8ff', pattern: 'gear', eye: '#ffffff', crest: 'antenna' };

/** @param {Scene['wave']} w */
const modeOf = (w) => w.mode ?? (w.ship ? 'ship' : 'wave');

/**
 * A game's look that draws any vehicle: its own as ever, the others by their own game's drawing.
 * @param {Look} look @param {readonly string[]} native the game's own vehicles
 * @returns {Look}
 */
export function mixedLook(look, native) {
  return {
    ...look,
    trailWidth(w) {
      const mode = modeOf(/** @type {Scene['wave']} */ (w));
      if (native.includes(mode)) return look.trailWidth(w);
      if (mode === 'wave') return w.mini ? 0.2 : 0.3;
      if (mode === 'ship') return w.mini ? 0.13 : 0.2;
      return 0;
    },
    drawVehicle(ctx, s, x, y) {
      const w = s.wave;
      const mode = modeOf(w);
      if (native.includes(mode)) {
        look.drawVehicle(ctx, s, x, y);
        return;
      }
      const skin = { ...MISSING, ...s.skin };
      const cell = s.view.cell;
      if (mode === 'wave') drawWave(ctx, skin, x, y, (w.mini ? WAVE.miniSize : WAVE.size) * cell, w.angle, w.flipped);
      else if (mode === 'ship') drawShip(ctx, skin, x, y, (w.mini ? SHIP.mini.size : SHIP.normal.size) * cell, w.angle, w.thrust && !s.reduced, w.flipped, s.time);
      else if (mode === 'robot') {
        const kind = robotOf(w.mini);
        const flame = (w.lift ?? 0) > 0 ? Math.min(1, (w.lift ?? 0) / kind.boost + 0.3) : 0;
        drawRobot(ctx, skin, x, y, kind.size * cell, { stride: s.reduced ? 0 : w.x * 0.6, air: w.grounded !== true, flame, flipped: w.flipped });
      } else {
        const kind = bodyOf(w.mini);
        const size = kind.size * cell;
        if (mode === 'spider') {
          const streak = s.reduced ? 0 : (w.streak ?? 0) / STREAK_TIME;
          if (streak > 0 && w.streakFrom !== undefined) drawStreak(ctx, skin, x, screenY(s.view, w.streakFrom), y, size * 0.7, streak);
          drawSpider(ctx, skin, x, y, size, w.x, w.grounded === true, w.flipped);
        } else drawBall(ctx, skin, x, y, size, rollAngle(w.x, kind.half, w.flipped));
      }
    },
  };
}
