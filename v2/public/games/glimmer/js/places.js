// @ts-check
// Świetlik (Glimmer): where patterns put things — a point just outside the arena that is
// not beside the wisp, a point inside it far from the wisp. Shared by js/patterns.js and
// js/obstacles.js; randomness only from the game's generator.

import { SAFE_RADIUS } from './config.js';
import { int, range } from './rng.js';

/** @typedef {import('./sim.js').Game} Game */

/**
 * A point just outside the arena, on a random side (shots aimed inward from it).
 * @param {Game} game @returns {{ x: number, y: number, side: number }}
 */
export function edgePoint(game) {
  const w = game.width;
  const h = game.height;
  const p = game.player;
  // A few tries for a point not beside the wisp (it may be hugging an edge).
  for (let tries = 0; tries < 12; tries++) {
    const side = int(game.rng, 0, 3);
    const along = range(game.rng, 0, side % 2 === 0 ? w : h);
    const point =
      side === 0 ? { x: along, y: -8, side } : side === 1 ? { x: w + 8, y: along, side } : side === 2 ? { x: along, y: h + 8, side } : { x: -8, y: along, side };
    if (Math.hypot(point.x - p.x, point.y - p.y) >= SAFE_RADIUS) return point;
  }
  // None far enough (the wisp in a corner, bad luck): the opposite corner, outside.
  return { x: p.x < w / 2 ? w + 8 : -8, y: p.y < h / 2 ? h + 8 : -8, side: p.x < w / 2 ? 1 : 3 };
}

/**
 * A point inside the arena at least `away` from the wisp (from the corners inward if the
 * wisp is in the middle of a small arena), for emitters and ring centres.
 * @param {Game} game @param {number} away
 */
export function farPoint(game, away) {
  const p = game.player;
  for (let tries = 0; tries < 24; tries++) {
    const x = range(game.rng, 20, game.width - 20);
    const y = range(game.rng, 20, game.height - 20);
    if (Math.hypot(x - p.x, y - p.y) >= away) return { x, y };
  }
  // The corner farthest from the wisp.
  return { x: p.x < game.width / 2 ? game.width - 16 : 16, y: p.y < game.height / 2 ? game.height - 16 : 16 };
}
