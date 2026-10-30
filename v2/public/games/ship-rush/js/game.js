// @ts-check
// Ship Rush's states (docs/v2/PLAN.md 9.1, stages s-1 and s-2): the Rush engine's state
// machine (../../_engine/game.js) with this game's levels and flight. The ship lands,
// bumps or crashes against solids and hazards (physics.js) in the run's world
// (solids.js); in the finale's wave stretches the wave flies as in Wave Rush — every
// touch of its hit circle is a crash, except grazing a 45° slope along its flight.
import * as engine from '../../_engine/game.js';
import { stepWaveOnly, waveRadius, waveSlope } from '../../_engine/wave.js';
import { stepShip } from './physics.js';
import { buildFinale, buildRun, runHits } from './run.js';
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
  step(vehicle, holding, speed, dt, run) {
    if (vehicle.ship) return stepShip(vehicle, holding, speed, dt, runWorld(run));
    return { vehicle: stepWaveOnly(vehicle, holding, speed, dt), crashed: false };
  },
  // The ship's touches are found during its step (a portal never moves it); the wave's here.
  crashed(run, w) {
    if (w.ship) return false;
    return runHits(run, w.x, w.y, w.y, waveRadius(w.mini), w.dir, waveSlope(w.mini));
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
