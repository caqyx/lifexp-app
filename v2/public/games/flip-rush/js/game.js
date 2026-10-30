// @ts-check
// Flip Rush's states (docs/v2/PLAN.md 9.1, stage f-1): the Rush engine's state machine
// (../../_engine/game.js) with this game's levels and vehicles: the ball and the spider
// fall, land, run and flip (physics.js) in the run's world (../../_engine/solids.js).
import * as engine from '../../_engine/game.js';
import { runWorld } from '../../_engine/solids.js';
import { stepBody } from './physics.js';
import { buildFinale, buildRun } from './run.js';

export { START_Y, keepsRecords, restartLocked, resultOf, stepGame } from '../../_engine/game.js';

/**
 * @typedef {import('../../_engine/game.js').Game} Game
 * @typedef {import('../../_engine/game.js').GameEvent} GameEvent
 * @typedef {import('../../_engine/game.js').Result} Result
 */

/** @type {import('../../_engine/game.js').GameRules} */
export const RULES = {
  buildRun: (rng) => buildRun(rng),
  buildFinale,
  step: (body, holding, speed, dt, run) => stepBody(body, holding, speed, dt, runWorld(run)),
  // Every touch is found during the step itself.
  crashed: () => false,
};

/**
 * A new game on its ready screen.
 * @param {Parameters<typeof engine.createGame>[1]} options
 * @returns {Game}
 */
export function createGame(options) {
  return engine.createGame(RULES, options);
}
