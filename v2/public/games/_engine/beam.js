// @ts-check
// The validator for vehicles with a vertical speed (docs/v2/PLAN.md 9.1, stages w-2 and
// s-1): Wave Rush's finale ship and every Ship Rush section must be flyable by a human —
// input changes no closer than the tier's minimum interval, at most maxRate a second, and
// every tap (press and release together) may be early or late by the tolerance.
//
// The states are not a grid, so a beam search runs over decisions (N physics steps each),
// hold or release, keeping a spread of states per height and vertical-speed band. Each
// game gives the flight (`step`: its own physics and collisions, exactly as the game runs
// them; null is a crash) and `safe`: the same place with room to spare (a band around the
// vehicle, for the search only). A path found is then replayed through `step` alone,
// nominal and with every tap shifted early and late (a vehicle with momentum does not
// re-join its old path after a shift, so each replay runs to the end): only a replay that
// survives all of them counts as the proof. A vehicle resting on a surface is just
// another state: resting there is a strategy the search may use.
import { changesOf, peakRate, shiftTap } from './limits.js';
import { STEP } from './world.js';

/**
 * @typedef {import('./game.js').Vehicle} Vehicle
 * @typedef {{ minInterval: number, tolerance: number, maxRate: number }} Limits
 * @typedef {{
 *   x0: number, x1: number, speed: number, limits: Limits, start: Vehicle,
 *   step: (v: Vehicle, holding: boolean, dt: number) => Vehicle | null,
 *   safe: (v: Vehicle, band: number) => boolean, band?: number,
 * }} BeamSpec
 * @typedef {{ v: Vehicle, hold: number, cool: number, parent: number }} Node
 *   hold: 1 held, -1 released, for the decision that led here.
 */

/** Physics steps per decision (1/60 s). */
export const N = 4;
/**
 * How finely the beam keeps states: per height band (`bucket` cells) and hold, up to
 * `per` states whose vertical speeds differ by at least `spread`. The default is Wave
 * Rush's finale ship's; a finer beam keeps more alternatives (more paths to try for one
 * that survives every mistimed tap) at a higher cost.
 * @typedef {{ bucket: number, per: number, spread: number }} Grain
 * @type {Grain}
 */
export const GRAIN = { bucket: 0.25, per: 3, spread: 0.8 };

/**
 * One decision's flight with room to spare; the state after it, or null.
 * @param {BeamSpec} spec @param {number} x @param {Node} node @param {number} hold @param {number} band
 */
function fly(spec, x, node, hold, band) {
  /** @type {Vehicle | null} */
  let v = { ...node.v, x };
  for (let k = 0; k < N; k++) {
    v = spec.step(v, hold > 0, STEP);
    if (!v || !spec.safe(v, band)) return null;
  }
  return v;
}

/**
 * Keeps a spread of states: per height band and hold, a few with different speeds. Of
 * two nearly alike, the freer one stays (longer since its last change, so it may change
 * sooner): otherwise fresh changes would crowd out the states that keep their course.
 * @param {Map<string, Node[]>} buckets @param {Node} node @param {Grain} grain
 */
function keep(buckets, node, grain) {
  const key = `${Math.round(node.v.y / grain.bucket)}:${node.hold}`;
  const list = buckets.get(key);
  if (!list) {
    buckets.set(key, [node]);
    return;
  }
  const alike = list.findIndex((n) => Math.abs(n.v.vy - node.v.vy) < grain.spread);
  if (alike >= 0) {
    if (node.cool > /** @type {Node} */ (list[alike]).cool) list[alike] = node;
    return;
  }
  if (list.length < grain.per) list.push(node);
}

/**
 * The beam search: every layer's surviving states, from the start to the end.
 * @param {BeamSpec} spec @param {number} interval minimum decisions between changes @param {number} band @param {Grain} grain
 * @returns {Node[][]}
 */
function searchLayers(spec, interval, band, grain) {
  const dx = spec.speed * N * STEP;
  const steps = Math.ceil((spec.x1 - spec.x0) / dx - 1e-9);
  /** @type {Node[][]} */
  const layers = [[{ v: spec.start, hold: 0, cool: interval, parent: -1 }]];
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
        keep(buckets, { v: next, hold, cool: change || i === 0 ? 1 : node.cool + 1, parent: index }, grain);
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
 * Flies holds through the game's own flight; the states after every step, or null on a crash.
 * @param {BeamSpec} spec @param {Int8Array} holds
 * @returns {Vehicle[] | null}
 */
export function traceBeam(spec, holds) {
  if (!spec.safe(spec.start, 0)) return null;
  /** @type {Vehicle | null} */
  let v = spec.start;
  const out = [];
  for (let s = 0; s < holds.length; s++) {
    v = spec.step(v, /** @type {number} */ (holds[s]) > 0, STEP);
    if (!v) return null;
    out.push(v);
  }
  return out;
}

/** Flies holds through the game's own flight; true when it survives. @param {BeamSpec} spec @param {Int8Array} holds */
export function replayBeam(spec, holds) {
  return traceBeam(spec, holds) !== null;
}

/**
 * Checks holds against all the human limits by replaying them.
 * @param {BeamSpec} spec @param {Int8Array} holds
 * @returns {string | null} what failed, or null
 */
export function verifyBeam(spec, holds) {
  if (!replayBeam(spec, holds)) return 'nominal path crashes';
  const changes = changesOf(holds);
  const minGap = Math.ceil(spec.limits.minInterval / STEP - 1e-9);
  for (let k = 1; k < changes.length; k++) {
    if (/** @type {number} */ (changes[k]) - /** @type {number} */ (changes[k - 1]) < minGap) return 'changes too close';
  }
  if (peakRate(changes) > spec.limits.maxRate) return `rate ${peakRate(changes)}/s`;
  const shift = Math.ceil(spec.limits.tolerance / STEP - 1e-9);
  for (let k = 0; k < changes.length; k++) {
    for (const sign of [-1, 1]) {
      if (!replayBeam(spec, shiftTap(holds, changes, k, sign * shift))) return `tap ${k + 1} ${sign < 0 ? 'early' : 'late'} crashes`;
    }
  }
  return null;
}

/**
 * Searches a path that keeps every limit, widening the room to spare and then spacing
 * the taps out if the first tries are not robust.
 * @param {BeamSpec} spec @param {{ verify?: boolean, tries?: number, bands?: [number, 'min' | 'rateSafe'][], grain?: Grain }} [options]
 *   verify: false for the pilot; bands: the tries (room to spare, and the interval used);
 *   grain: how finely the beam keeps states.
 * @returns {{ holds: Int8Array | null, problem: string | null }}
 */
export function solveBeam(spec, options = {}) {
  const verify = options.verify ?? true;
  const decision = N * STEP;
  const rateSafe = Math.max(spec.limits.minInterval, 1 / Math.floor(spec.limits.maxRate) + 0.005);
  const tries = options.bands ?? [[spec.band ?? 0.3, 'min'], [0.5, 'min'], [0.3, 'rateSafe'], [0.15, 'min']];
  let problem = 'no path';
  for (const [band, which] of tries) {
    const interval = which === 'min' ? spec.limits.minInterval : rateSafe;
    const layers = searchLayers(spec, Math.ceil(interval / decision - 1e-9), band, options.grain ?? GRAIN);
    const last = /** @type {Node[]} */ (layers[layers.length - 1]);
    const steps = Math.ceil((spec.x1 - spec.x0) / (spec.speed * decision) - 1e-9);
    if (layers.length - 1 < steps) continue;
    // Try ends nearest the middle of their band first (most room around them).
    const order = last.map((n, i) => ({ i, d: Math.abs(n.v.vy) })).sort((a, b) => a.d - b.d).slice(0, options.tries ?? 60);
    for (const { i } of order) {
      const holds = holdsOf(layers, i);
      if (!verify) return { holds, problem: null };
      const fail = verifyBeam(spec, holds);
      if (!fail) return { holds, problem: null };
      problem = fail;
    }
  }
  return { holds: null, problem };
}
