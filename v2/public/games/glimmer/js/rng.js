// @ts-check
// Świetlik (Glimmer): a small seeded random (mulberry32). The same seed always gives the
// same numbers, so a run with the same seed and the same moves plays out the same (the
// unit tests rely on it); a new game takes a fresh seed.

/** @param {number} seed */
export function createRng(seed) {
  return { s: seed >>> 0 || 1 };
}

/** @typedef {ReturnType<typeof createRng>} Rng */

/** A number in [0, 1). @param {Rng} rng */
export function next(rng) {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A number in [a, b). @param {Rng} rng @param {number} a @param {number} b */
export function range(rng, a, b) {
  return a + (b - a) * next(rng);
}

/** A whole number in [a, b]. @param {Rng} rng @param {number} a @param {number} b */
export function int(rng, a, b) {
  return a + Math.floor(next(rng) * (b - a + 1));
}

/** One of a list. @template T @param {Rng} rng @param {readonly T[]} list @returns {T} */
export function pick(rng, list) {
  return /** @type {T} */ (list[Math.floor(next(rng) * list.length)]);
}
