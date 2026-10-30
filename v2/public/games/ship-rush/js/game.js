// @ts-check
// Ship Rush's states (docs/v2/PLAN.md 9.1, stage s-1): the Rush engine's state machine
// (../../_engine/game.js) with this game's levels and the ship's flight: a step lands,
// bumps or crashes against solids and hazards (physics.js) in the run's world (solids.js).
import * as engine from '../../_engine/game.js';
import { stepShip } from './physics.js';
import { buildFinale, buildRun } from './run.js';
import { runWorld } from './solids.js';

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
  step: (ship, holding, speed, dt, run) => stepShip(ship, holding, speed, dt, runWorld(run)),
  // Every touch is found during the step itself (a portal never moves the ship).
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
