// @ts-check
// Świetlik (Glimmer): the director — the endless run's pacing. A new pattern every few
// seconds (sooner as time goes on), chosen by weight among those unlocked by then, never
// the same twice in a row; a short breather every half minute; later, sometimes two
// patterns at once. `level` grows smoothly with time and sets the patterns' sizes. All of
// it from the game's seeded generator, so a seed and the same moves replay the same run.

import { DIRECTOR } from './config.js';
import { next } from './rng.js';
import { PATTERNS, PATTERN_IDS, runPattern } from './patterns.js';

/** @typedef {import('./sim.js').Game} Game */
/** @typedef {import('./patterns.js').PatternId} PatternId */

/** @param {number} start the run's clock at its start */
export function createDirector(start) {
  return { nextAt: start + DIRECTOR.firstAt, last: /** @type {PatternId | ''} */ ('') };
}

/** How hard it is now (0 at the start, about +1 every 40 s). @param {number} time */
export function levelAt(time) {
  return time / 40;
}

/** Seconds from one pattern to the next at this time. @param {number} time */
export function gapAt(time) {
  return Math.max(DIRECTOR.minGap, DIRECTOR.gap - time * DIRECTOR.gapShrink);
}

/** Whether `time` falls in a breather (no new pattern starts). @param {number} time */
export function inBreather(time) {
  if (time < DIRECTOR.breatherEvery) return false;
  return time % DIRECTOR.breatherEvery < DIRECTOR.breather;
}

/**
 * A pattern chosen by weight among those unlocked at `time`, not `last` (when another can come).
 * @param {Game} game @param {number} time @param {PatternId | ''} last @returns {PatternId}
 */
export function choosePattern(game, time, last) {
  const open = PATTERN_IDS.filter((id) => PATTERNS[id].from <= time && id !== last);
  const pool = open.length > 0 ? open : PATTERN_IDS.filter((id) => PATTERNS[id].from <= time);
  const total = pool.reduce((sum, id) => sum + PATTERNS[id].weight, 0);
  let roll = next(game.rng) * total;
  for (const id of pool) {
    roll -= PATTERNS[id].weight;
    if (roll < 0) return id;
  }
  return /** @type {PatternId} */ (pool[pool.length - 1]);
}

/** @param {Game} game */
export function updateDirector(game) {
  const d = game.director;
  if (game.time < d.nextAt) return;
  if (inBreather(game.time)) {
    // Wait out the breather; the next pattern comes right after it.
    d.nextAt = game.time - (game.time % DIRECTOR.breatherEvery) + DIRECTOR.breather;
    return;
  }
  const level = levelAt(game.time);
  const id = choosePattern(game, game.time, d.last);
  runPattern(game, id, level);
  d.last = id;
  let gap = gapAt(game.time);
  if (game.time >= DIRECTOR.comboFrom && next(game.rng) < DIRECTOR.comboChance) {
    // A combo: a second, different pattern at once (the gap after it is a little longer).
    const second = choosePattern(game, game.time, id);
    runPattern(game, second, level * 0.8);
    d.last = second;
    gap *= 1.35;
  }
  d.nextAt = game.time + gap;
}
