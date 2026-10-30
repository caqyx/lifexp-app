// @ts-check
// The validator for the ship (docs/v2/PLAN.md 9.1, stage w-2): the finale's ship
// stretches must be flyable by a human, under the same rules as the wave's sections —
// input changes no closer than the tier's minimum interval, at most maxRate a second,
// and every tap (press and release together) may be early or late by the tolerance.
//
// The ship has a vertical speed, so its states are not a grid: a beam search runs over
// decisions (n physics steps each), hold or release, keeping a spread of states per
// height and speed band; the touch test uses the hit circle swept over a small vertical
// band for room to spare. A path found is then replayed through the game's own physics
// (physics.js) with the exact hit circle, nominal and with every tap shifted early and
// late (the ship does not re-join its old path after a shift, so each replay runs to the
// end): only a replay that survives all of them counts as the proof.
import { SHIP, STEP } from './config.js';
import { createWave, stepShip } from './physics.js';
import { changesOf, peakRate, shiftTap } from './solver.js';

/**
 * @typedef {import('./solver.js').HitTest} HitTest
 * @typedef {import('./solver.js').Limits} Limits
 * @typedef {{ hits: HitTest, x0: number, x1: number, speed: number, limits: Limits, gravity: 1 | -1, y: number, vy: number, band?: number }} ShipSpec
 * @typedef {{ y: number, vy: number, hold: number, cool: number, parent: number }} Node
 *   hold: 1 held, -1 released, for the decision that led here.
 */

/** Physics steps per decision (1/60 s). */
const N = 4;
/** States kept per height band (and per hold) in a layer, spread over vertical speed. */
const PER_BUCKET = 3;
const BUCKET = 0.25;

/**
 * Does one decision's flight touch nothing? Returns the state after it, or null.
 * @param {ShipSpec} spec @param {number} x @param {Node} node @param {number} hold @param {number} band
 */
function fly(spec, x, node, hold, band) {
  let ship = { ...createWave(x, node.y), ship: true, vy: node.vy, gravity: spec.gravity };
  for (let k = 0; k < N; k++) {
    ship = stepShip(ship, hold > 0, spec.speed, STEP);
    if (spec.hits(ship.x, ship.y - band, ship.y + band, SHIP.radius, 0, 0)) return null;
  }
  return ship;
}

/**
 * Keeps a spread of states: per height band and hold, a few with different speeds.
 * @param {Map<string, Node[]>} buckets @param {Node} node
 */
function keep(buckets, node) {
  const key = `${Math.round(node.y / BUCKET)}:${node.hold}`;
  const list = buckets.get(key);
  if (!list) {
    buckets.set(key, [node]);
    return;
  }
  if (list.length >= PER_BUCKET) return;
  if (list.some((n) => Math.abs(n.vy - node.vy) < 0.8)) return;
  list.push(node);
}

/**
 * The beam search: every layer's surviving states, from the start to the end.
 * @param {ShipSpec} spec @param {number} interval minimum decisions between changes
 * @returns {Node[][]}
 */
function searchLayers(spec, interval) {
  const dx = spec.speed * N * STEP;
  const steps = Math.ceil((spec.x1 - spec.x0) / dx - 1e-9);
  const band = spec.band ?? 0.3;
  /** @type {Node[][]} */
  const layers = [[{ y: spec.y, vy: spec.vy, hold: 0, cool: interval, parent: -1 }]];
  for (let i = 0; i < steps; i++) {
    const x = spec.x0 + i * dx;
    /** @type {Map<string, Node[]>} */
    const buckets = new Map();
    (/** @type {Node[]} */ (layers[i])).forEach((node, index) => {
      for (const hold of [1, -1]) {
        const change = i > 0 && hold !== node.hold;
        if (change && node.cool < interval) continue;
        const next = fly(spec, x, node, hold, band);
        if (!next) continue;
        keep(buckets, { y: next.y, vy: next.vy, hold, cool: change || i === 0 ? 1 : node.cool + 1, parent: index });
      }
    });
    const layer = [...buckets.values()].flat();
    if (!layer.length) return layers;
    layers.push(layer);
  }
  return layers;
}

/**
 * The holds (1 held, -1 released) for every physics step of a path ending in `index`.
 * @param {Node[][]} layers @param {number} index
 */
function holdsOf(layers, index) {
  const decisions = [];
  for (let i = layers.length - 1, k = index; i > 0; i--) {
    const node = /** @type {Node} */ ((/** @type {Node[]} */ (layers[i]))[k]);
    decisions.push(node.hold);
    k = node.parent;
  }
  decisions.reverse();
  const holds = new Int8Array(decisions.length * N);
  decisions.forEach((h, i) => holds.fill(h, i * N, (i + 1) * N));
  return holds;
}

/**
 * Flies holds through the game's ship physics; true when it survives.
 * @param {ShipSpec} spec @param {Int8Array} holds
 */
export function replayShip(spec, holds) {
  let ship = { ...createWave(spec.x0, spec.y), ship: true, vy: spec.vy, gravity: spec.gravity };
  if (spec.hits(ship.x, ship.y, ship.y, SHIP.radius, 0, 0)) return false;
  for (let s = 0; s < holds.length; s++) {
    ship = stepShip(ship, /** @type {number} */ (holds[s]) > 0, spec.speed, STEP);
    if (spec.hits(ship.x, ship.y, ship.y, SHIP.radius, 0, 0)) return false;
  }
  return true;
}

/**
 * Checks holds against all the human limits by replaying them.
 * @param {ShipSpec} spec @param {Int8Array} holds
 * @returns {string | null} what failed, or null
 */
export function verifyShip(spec, holds) {
  if (!replayShip(spec, holds)) return 'nominal path crashes';
  const changes = changesOf(holds);
  const minGap = Math.ceil(spec.limits.minInterval / STEP - 1e-9);
  for (let k = 1; k < changes.length; k++) {
    if (/** @type {number} */ (changes[k]) - /** @type {number} */ (changes[k - 1]) < minGap) return 'changes too close';
  }
  if (peakRate(changes) > spec.limits.maxRate) return `rate ${peakRate(changes)}/s`;
  const shift = Math.ceil(spec.limits.tolerance / STEP - 1e-9);
  for (let k = 0; k < changes.length; k++) {
    for (const sign of [-1, 1]) {
      if (!replayShip(spec, shiftTap(holds, changes, k, sign * shift))) return `tap ${k + 1} ${sign < 0 ? 'early' : 'late'} crashes`;
    }
  }
  return null;
}

/**
 * Searches a path that keeps every limit, widening the room to spare and then spacing
 * the taps out if the first tries are not robust.
 * @param {ShipSpec} spec @param {{ verify?: boolean, tries?: number }} [options] verify: false for the pilot
 * @returns {{ holds: Int8Array | null, problem: string | null }}
 */
export function solveShip(spec, options = {}) {
  const verify = options.verify ?? true;
  const decision = N * STEP;
  const rateSafe = Math.max(spec.limits.minInterval, 1 / Math.floor(spec.limits.maxRate) + 0.005);
  let problem = 'no path';
  for (const [band, interval] of /** @type {[number, number][]} */ ([[spec.band ?? 0.3, spec.limits.minInterval], [0.5, spec.limits.minInterval], [0.3, rateSafe], [0.15, spec.limits.minInterval]])) {
    const layers = searchLayers({ ...spec, band }, Math.ceil(interval / decision - 1e-9));
    const last = /** @type {Node[]} */ (layers[layers.length - 1]);
    const steps = Math.ceil((spec.x1 - spec.x0) / (spec.speed * decision) - 1e-9);
    if (layers.length - 1 < steps) continue;
    // Try ends nearest the middle of their band first (most room around them).
    const order = last.map((n, i) => ({ i, d: Math.abs(n.vy) })).sort((a, b) => a.d - b.d).slice(0, options.tries ?? 60);
    for (const { i } of order) {
      const holds = holdsOf(layers, i);
      if (!verify) return { holds, problem: null };
      const fail = verifyShip(spec, holds);
      if (!fail) return { holds, problem: null };
      problem = fail;
    }
  }
  return { holds: null, problem };
}
