// @ts-check
// Szybkie liczenie: the questions (docs/v2/PLAN.md 9.1, stage g-4). Pure: a level and
// a random source in, a fair question out. Fair = an integer answer, no negative result
// below Trudny, division always exact, and never the same question twice in a row.

/** @typedef {'easy' | 'medium' | 'hard'} Level */
/** @typedef {'+' | '-' | '*' | '/'} Op */
/**
 * One question. `parts` are numbers and operators in reading order (for display and
 * for the spoken text); `key` tells two questions apart.
 * @typedef {{ parts: (number | Op)[], answer: number, key: string }} Question
 */

export const LEVELS = /** @type {const} */ (['easy', 'medium', 'hard']);

/** Points for a correct answer, before the combo. */
export const BASE_POINTS = { easy: 10, medium: 15, hard: 25 };

/** Only Trudny can have a result below zero (it has a minus key). */
export const ALLOWS_NEGATIVE = { easy: false, medium: false, hard: true };

// ── Randomness ───────────────────────────────────────────────────────────────

/**
 * A small seeded generator (mulberry32): the same seed, the same questions (?seed=).
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
 * A whole number in [min, max].
 * @param {() => number} rng @param {number} min @param {number} max
 */
export function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * One of the entries, by weight.
 * @template T
 * @param {() => number} rng @param {[T, number][]} weighted
 * @returns {T}
 */
function pickWeighted(rng, weighted) {
  const total = weighted.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [value, weight] of weighted) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return /** @type {[T, number]} */ (weighted[weighted.length - 1])[0];
}

// ── One kind of question each ────────────────────────────────────────────────

/**
 * @param {(number | Op)[]} parts @param {number} answer
 * @returns {Question}
 */
function makeQuestion(parts, answer) {
  return { parts, answer, key: parts.join(' ') };
}

/** a + b with a sum up to `max`. @param {() => number} rng @param {number} max @param {number} min */
export function createAddition(rng, max, min = 1) {
  const a = randomInt(rng, min, max - min);
  const b = randomInt(rng, min, max - a);
  return makeQuestion([a, '+', b], a + b);
}

/**
 * a − b from numbers up to `max`; below zero only when `negative` allows it.
 * @param {() => number} rng @param {number} max @param {boolean} negative @param {number} min
 */
export function createSubtraction(rng, max, negative, min = 1) {
  let a = randomInt(rng, min + 1, max);
  let b = randomInt(rng, min, max);
  // Mostly a result of zero or more even where negatives are allowed: a kid's sum.
  if (!negative || rng() < 0.7) [a, b] = a >= b ? [a, b] : [b, a];
  return makeQuestion([a, '-', b], a - b);
}

/** a × b from the times table up to `max`. @param {() => number} rng @param {number} max */
export function createMultiplication(rng, max) {
  const a = randomInt(rng, 2, max);
  const b = randomInt(rng, 2, max);
  return makeQuestion([a, '*', b], a * b);
}

/** a ÷ b, always exact: built from the product. @param {() => number} rng @param {number} max */
export function createDivision(rng, max) {
  const divisor = randomInt(rng, 2, max);
  const quotient = randomInt(rng, 2, max);
  return makeQuestion([divisor * quotient, '/', divisor], quotient);
}

/**
 * Two steps, multiplication or division first (the usual order of operations):
 * a×b+c, a×b−c, c+a×b, c−a×b, a÷b+c.
 * @param {() => number} rng
 */
export function createTwoStep(rng) {
  const a = randomInt(rng, 2, 9);
  const b = randomInt(rng, 2, 9);
  const c = randomInt(rng, 1, 20);
  const form = randomInt(rng, 0, 4);
  if (form === 0) return makeQuestion([a, '*', b, '+', c], a * b + c);
  if (form === 1) return makeQuestion([a, '*', b, '-', c], a * b - c);
  if (form === 2) return makeQuestion([c, '+', a, '*', b], c + a * b);
  if (form === 3) return makeQuestion([c, '-', a, '*', b], c - a * b);
  return makeQuestion([a * b, '/', b, '+', c], a + c);
}

// ── Levels ───────────────────────────────────────────────────────────────────

/**
 * One question of the level.
 * @param {Level} level @param {() => number} rng
 * @returns {Question}
 */
export function createQuestion(level, rng) {
  if (level === 'easy') {
    return pickWeighted(rng, [['add', 1], ['sub', 1]]) === 'add' ? createAddition(rng, 20) : createSubtraction(rng, 20, false);
  }
  if (level === 'medium') {
    const kind = pickWeighted(rng, [['add', 35], ['sub', 35], ['mul', 30]]);
    if (kind === 'add') return createAddition(rng, 100, 2);
    if (kind === 'sub') return createSubtraction(rng, 100, false, 2);
    return createMultiplication(rng, 10);
  }
  const kind = pickWeighted(rng, [['add', 15], ['sub', 15], ['mul', 20], ['div', 20], ['two', 30]]);
  if (kind === 'add') return createAddition(rng, 198, 10);
  if (kind === 'sub') return createSubtraction(rng, 99, true, 10);
  if (kind === 'mul') return createMultiplication(rng, 12);
  if (kind === 'div') return createDivision(rng, 12);
  return createTwoStep(rng);
}

/**
 * The next question: never the one just asked.
 * @param {Level} level @param {() => number} rng @param {string | null} previousKey
 * @returns {Question}
 */
export function nextQuestion(level, rng, previousKey) {
  let question = createQuestion(level, rng);
  for (let tries = 0; question.key === previousKey && tries < 20; tries++) question = createQuestion(level, rng);
  return question;
}

// ── Display ──────────────────────────────────────────────────────────────────

const SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/**
 * As shown: 7 × 8 − 9 (typographic minus, times and division signs).
 * @param {Question} question
 */
export function formatQuestion(question) {
  return question.parts.map((p) => (typeof p === 'number' ? formatNumber(p) : SYMBOLS[p])).join(' ');
}

/** @param {number} n */
export function formatNumber(n) {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

/**
 * As read aloud by a screen reader, with the words of the language.
 * @param {Question} question @param {Record<Op, string>} words
 */
export function spokenQuestion(question, words) {
  return question.parts.map((p) => (typeof p === 'number' ? String(p) : words[p])).join(' ');
}
