// @ts-check
// Every vehicle in every Rush game, for the editor's levels (docs/v2/PLAN.md 9.1, stage
// r-5): a level made in Wave Rush may switch to the ship, the ball or the spider and back.
// The game flies its own vehicles as it always does (its own rules); a vehicle from another
// game flies by that game's physics, in the same world:
// - the wave: the engine's wave (wave.js), every touch of its hit circle a crash except
//   grazing a 45° slope along its flight (as in Wave Rush and Ship Rush's finale);
// - the ship: Ship Rush's ship (blocks and pillars are solids to land on);
// - the ball and the spider: Flip Rush's (they fall, land, run and flip).
// The game's own sections and runs never meet a vehicle that is not the game's own.
import { stepWaveOnly, waveRadius, waveSlope } from '../wave.js';
import { runHits } from '../level.js';
import { runWorld } from '../solids.js';
import { stepShip } from '../../ship-rush/js/physics.js';
import { stepBody } from '../../flip-rush/js/physics.js';

/**
 * @typedef {import('../game.js').GameRules} GameRules
 * @typedef {import('../game.js').Vehicle} Vehicle
 * @typedef {import('../geometry.js').VehicleMode} VehicleMode
 */

/** Every vehicle the shared engine has. */
export const ALL_VEHICLES = /** @type {VehicleMode[]} */ (['wave', 'ship', 'ball', 'spider']);

/** The vehicle flying now. @param {Vehicle} v @returns {VehicleMode} */
export const modeOf = (v) => v.mode ?? (v.ship ? 'ship' : 'wave');

/**
 * A game's rules that fly any vehicle: its own by its own rules, the others by theirs.
 * @param {GameRules} rules @param {readonly string[]} native the game's own vehicles
 * @returns {GameRules}
 */
export function mixedRules(rules, native) {
  /** @param {Vehicle} v */
  const own = (v) => native.includes(modeOf(v));
  return {
    ...rules,
    step(v, holding, speed, dt, run) {
      if (own(v)) return rules.step(v, holding, speed, dt, run);
      const mode = modeOf(v);
      if (mode === 'wave') return { vehicle: stepWaveOnly(v, holding, speed, dt), crashed: false };
      if (mode === 'ship') return stepShip(v, holding, speed, dt, runWorld(run));
      return stepBody(v, holding, speed, dt, runWorld(run));
    },
    crashed(run, v) {
      if (own(v)) return rules.crashed(run, v);
      return modeOf(v) === 'wave' && runHits(run, v.x, v.y, v.y, waveRadius(v.mini), v.dir, waveSlope(v.mini));
    },
  };
}
