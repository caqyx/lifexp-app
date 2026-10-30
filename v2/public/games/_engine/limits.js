// @ts-check
// The human limits of an input, shared by every Rush validator (docs/v2/PLAN.md 9.1,
// stages w-1 and s-1): an input is a hold (or a direction) per physics step; these find
// its changes, count them per second and move one tap early or late, the way a player's
// timing slips.
import { STEP } from './world.js';

/** Step indices where the direction changes (not the first). @param {Int8Array} dirs */
export function changesOf(dirs) {
  const out = [];
  for (let s = 1; s < dirs.length; s++) if (dirs[s] !== dirs[s - 1]) out.push(s);
  return out;
}

/**
 * The same input with one tap moved by `shift` steps: the change at `changes[k]` and
 * the next one (the tap keeps its length); the last change moves alone.
 * @param {Int8Array} dirs @param {number[]} changes @param {number} k @param {number} shift
 */
export function shiftTap(dirs, changes, k, shift) {
  const out = Int8Array.from(dirs);
  const moved = [/** @type {number} */ (changes[k])];
  if (k + 1 < changes.length) moved.push(/** @type {number} */ (changes[k + 1]));
  for (const at of moved) {
    const before = /** @type {number} */ (dirs[at - 1]);
    const after = /** @type {number} */ (dirs[at]);
    if (shift > 0) out.fill(before, at, Math.min(dirs.length, at + shift));
    else out.fill(after, Math.max(0, at + shift), at);
  }
  return out;
}

/**
 * Most changes inside any one second.
 * @param {number[]} changes step indices
 */
export function peakRate(changes) {
  const window = Math.round(1 / STEP);
  let best = 0;
  let start = 0;
  for (let end = 0; end < changes.length; end++) {
    while (/** @type {number} */ (changes[end]) - /** @type {number} */ (changes[start]) >= window) start += 1;
    best = Math.max(best, end - start + 1);
  }
  return best;
}

/** The tolerance in whole physics steps (rounded up: never tested more leniently). @param {number} tolerance */
export function toleranceSteps(tolerance) {
  return Math.ceil(tolerance / STEP - 1e-9);
}
