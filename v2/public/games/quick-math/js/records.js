// @ts-check
// Szybkie liczenie: the best score of each level, on the device (docs/v2/PLAN.md 9.1,
// stage g-4). Only keys of its own (lifexp-quickmath-*): the game shares localStorage
// with LifeXP and never touches anything else. Practice rounds set no records.

/** @typedef {import('./questions.js').Level} Level */
/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} RecordStorage */

export const RECORD_PREFIX = 'lifexp-quickmath-best-';

/** @param {Level} level */
export function recordKey(level) {
  return `${RECORD_PREFIX}${level}`;
}

/**
 * The best score of a level; 0 when there is none, it is unreadable or storage is blocked.
 * @param {RecordStorage | null} storage @param {Level} level
 */
export function readBest(storage, level) {
  try {
    const value = Number.parseInt(storage?.getItem(recordKey(level)) ?? '', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Keeps a score if it beats the level's best.
 * @param {RecordStorage | null} storage @param {Level} level @param {number} score
 * @returns {{ best: number, isNew: boolean }}
 */
export function saveBest(storage, level, score) {
  const previous = readBest(storage, level);
  if (score <= previous) return { best: previous, isNew: false };
  try {
    storage?.setItem(recordKey(level), String(score));
  } catch {
    // Storage blocked: the record lasts for this visit only.
  }
  return { best: score, isNew: true };
}
