// @ts-check
// Seeded randomness and the query switches. ?seed=<n> (tests only) makes the shuffles
// repeatable; only with it, ?sector=<n>&section=<m> jumps straight to a section and
// ?autopilot=<k> lets the solver fly the next k sections, then lets go; ?finale=<n> starts
// the (unlocked) finale at its section n.

/**
 * A small seeded generator (mulberry32): the same seed gives the same runs.
 * @param {number} seed
 * @returns {() => number} numbers in [0, 1)
 */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A shuffled copy (Fisher–Yates).
 * @template T
 * @param {readonly T[]} items @param {() => number} rng
 * @returns {T[]}
 */
export function shuffle(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = /** @type {T} */ (out[i]);
    out[i] = /** @type {T} */ (out[j]);
    out[j] = a;
  }
  return out;
}

/** @param {string | null} raw @param {number} max */
function smallInt(raw, max) {
  if (raw === null || !/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= max ? n : null;
}

/**
 * The test switches of a query string: `seed` (or null); the jump and the autopilot, only with a seed.
 * @param {string} search
 *   finale: a section of the finale to start at (the finale must be unlocked).
 * @returns {{ seed: number | null, jump: { sector: number, section: number } | null, autopilot: number | null, finale: number | null }}
 */
export function parseSwitches(search) {
  const params = new URLSearchParams(search);
  const raw = params.get('seed');
  const seed = raw !== null && /^\d{1,9}$/.test(raw) ? Number(raw) : null;
  if (seed === null) return { seed: null, jump: null, autopilot: null, finale: null };
  const autopilot = smallInt(params.get('autopilot'), 99);
  const finale = smallInt(params.get('finale'), 99);
  const sector = smallInt(params.get('sector'), 99);
  if (sector === null) return { seed, jump: null, autopilot, finale };
  return { seed, jump: { sector, section: smallInt(params.get('section'), 99) ?? 1 }, autopilot, finale };
}
