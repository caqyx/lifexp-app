// @ts-check
// Wave Rush's states (docs/v2/PLAN.md 9.1, stages w-1 and w-2): the shared state machine
// (../../_engine/game.js) with this game's levels and flight. The wave flies at its
// slope; the ship (the finale) never grazes — only the wave flies exactly along 45° slopes.
import * as engine from '../../_engine/game.js';
import { hitRadius, stepWave, waveSlope } from './physics.js';
import { buildFinale, buildRun, runHits } from './run.js';

export { START_Y, keepsRecords, restartLocked, resultOf, stepGame } from '../../_engine/game.js';

/**
 * @typedef {import('../../_engine/game.js').Game} Game
 * @typedef {import('../../_engine/game.js').GameEvent} GameEvent
 * @typedef {import('../../_engine/game.js').Result} Result
 * @typedef {import('../../_engine/game.js').Mode} Mode
 * @typedef {import('../../_engine/game.js').Input} Input
 */

/** @type {import('../../_engine/game.js').GameRules} */
export const RULES = {
  buildRun: (rng) => buildRun(rng),
  buildFinale,
  step: (wave, holding, speed, dt) => ({ vehicle: stepWave(wave, holding, speed, dt), crashed: false }),
  crashed(run, w) {
    if (w.ship) return runHits(run, w.x, w.y, w.y, hitRadius(w), 0, 0);
    return runHits(run, w.x, w.y, w.y, hitRadius(w), w.dir, waveSlope(w.mini));
  },
};

/**
 * A new game on its ready screen.
 * @param {Parameters<typeof engine.createGame>[1]} options
 * @returns {Game}
 */
export function createGame(options) {
  return engine.createGame(RULES, options);
}
