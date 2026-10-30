// @ts-check
// Orbs and pads (docs/v2/PLAN.md 9.1, stage f-2), written for this game from the genre's
// behaviour (stage f-2 research), not from anyone's code.
// - An ORB acts on a FRESH press while the body touches it: a press not yet used — made
//   while touching, or made just before and still held (the page also keeps a quick tap
//   alive for INPUT_BUFFER_MS), so holding a new press into an orb fires it; a press that
//   already flipped the ball or snapped the spider does not. An orb takes the press before
//   the ground does, and fires once per pass.
// - A PAD acts on touch, with or without a press, once per pass.
// Both set the vertical speed (config.js RING / PAD); a gravity orb or pad flips gravity
// first. They move the spider exactly as they move the ball — only the spider's own tap
// on the ground teleports it.
import { MINI_BOOST, PAD, PAD_H, RING, RING_REACH } from './config.js';

/**
 * @typedef {import('../../_engine/solids.js').World} World
 * @typedef {import('../../_engine/solids.js').PlacedBooster} PlacedBooster
 * @typedef {import('../../_engine/geometry.js').RingKind} RingKind
 * @typedef {import('../../_engine/geometry.js').PadKind} PadKind
 */

/**
 * Gravity and vertical speed after an orb or a pad of this kind.
 * @param {'ring' | 'pad'} type @param {RingKind | PadKind} kind @param {1 | -1} gravity @param {boolean} mini
 * @returns {{ gravity: 1 | -1, vy: number }}
 */
export function boostOf(type, kind, gravity, mini) {
  const table = /** @type {Record<string, number>} */ (type === 'ring' ? RING : PAD);
  const speed = /** @type {number} */ (table[kind]) * (mini ? MINI_BOOST : 1);
  const flips = kind === 'gravity' || kind === 'gravityJump';
  /** @type {1 | -1} */
  const g = flips ? /** @type {1 | -1} */ (-gravity) : gravity;
  return { gravity: g, vy: speed * g };
}

/**
 * The orb this body touches (centre within reach), if it has not used it yet.
 * @param {World} world @param {number} x @param {number} y @param {boolean} mini @param {string | undefined} spent
 * @param {number} [shrink] cells off the reach (the validator's search: room for a mistimed press)
 * @returns {PlacedBooster | null}
 */
export function ringAt(world, x, y, mini, spent, shrink = 0) {
  const reach = (mini ? RING_REACH.mini : RING_REACH.normal) - shrink;
  for (const b of world.boosters(x)) {
    if (b.type !== 'ring' || b.id === spent) continue;
    if ((b.x - x) ** 2 + (b.y - y) ** 2 <= reach * reach) return b;
  }
  return null;
}

/**
 * The pad this body's box touches (half side `half`), if it has not used it yet.
 * @param {World} world @param {number} x @param {number} y @param {number} half @param {string | undefined} spent
 * @returns {PlacedBooster | null}
 */
export function padAt(world, x, y, half, spent) {
  for (const b of world.boosters(x)) {
    if (b.type !== 'pad' || b.id === spent) continue;
    if (Math.abs(b.x - x) > 0.5 + half) continue;
    // The pad's box: PAD_H deep off its surface, on the corridor's side.
    const top = b.dir === 'up' ? b.y - PAD_H : b.y;
    const bottom = b.dir === 'up' ? b.y : b.y + PAD_H;
    if (y + half >= top - 1e-6 && y - half <= bottom + 1e-6) return b;
  }
  return null;
}
