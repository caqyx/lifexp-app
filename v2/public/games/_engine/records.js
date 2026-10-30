// @ts-check
// What a Rush game keeps on the device (docs/v2/PLAN.md 9.1, stages w-1 and s-1): only
// keys of its own, under the prefix its records.js gives (Wave Rush's,
// Ship Rush's). The game shares localStorage with LifeXP and never touches anything
// else. Blocked or broken storage reads as empty and is never fatal.

/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} GameStorage */
/** @typedef {import('./game.js').Result} Result */
/**
 * @typedef {{ best: string, attempts: string, skin: string, progress: string, finaleBest: string, checkpoint: string }} Keys
 *   progress: achievements { demonComplete, finaleComplete } (the first unlocks the last
 *   skin and the finale).
 */

/** A game's keys under its own prefix. @param {string} prefix @returns {Keys} */
export function keysFor(prefix) {
  return {
    best: `${prefix}best`,
    attempts: `${prefix}attempts`,
    skin: `${prefix}skin`,
    progress: `${prefix}progress`,
    finaleBest: `${prefix}finale-best`,
    checkpoint: `${prefix}checkpoint`,
  };
}

/**
 * @param {GameStorage | null} storage @param {string} key
 * @returns {unknown}
 */
function readJson(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** @param {GameStorage | null} storage @param {string} key @param {unknown} value */
function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: kept for this visit only.
  }
}

/** @param {unknown} value @returns {value is Result} */
function isResult(value) {
  if (!value || typeof value !== 'object') return false;
  const v = /** @type {Record<string, unknown>} */ (value);
  return [v.sector, v.section, v.percent].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
}

/**
 * @typedef {{ demonComplete: boolean, finaleComplete: boolean }} Progress
 *   demonComplete: the whole run (Demon included) was finished — the Demon achievement,
 *   the last skin and the finale; finaleComplete: the finale's achievement.
 */

/**
 * A game's records, all under its own keys.
 * @param {string} prefix the game's own, e.g. Wave Rush's (its records.js)
 */
export function createRecords(prefix) {
  const KEYS = keysFor(prefix);

  /**
   * The best normal run (or the finale's, with `key`), or null.
   * @param {GameStorage | null} storage @param {string} [key] @returns {Result | null}
   */
  function readBest(storage, key = KEYS.best) {
    const value = readJson(storage, key);
    return isResult(value) ? value : null;
  }

  /**
   * Keeps a result if it got further than the best (a crash before 1% is no record).
   * @param {GameStorage | null} storage @param {Result} result @param {string} [key] the finale's own record
   * @returns {{ best: Result | null, isNew: boolean }}
   */
  function saveBest(storage, result, key = KEYS.best) {
    const previous = readBest(storage, key);
    if (result.percent < 1 || (previous && previous.percent >= result.percent)) return { best: previous, isNew: false };
    writeJson(storage, key, result);
    return { best: result, isNew: true };
  }

  /** @param {GameStorage | null} storage */
  function readAttempts(storage) {
    const value = readJson(storage, KEYS.attempts);
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
  }

  /** One more attempt, all time. @param {GameStorage | null} storage */
  function countAttempt(storage) {
    const next = readAttempts(storage) + 1;
    writeJson(storage, KEYS.attempts, next);
    return next;
  }

  /** @param {GameStorage | null} storage @returns {string | null} */
  function readSkin(storage) {
    const value = readJson(storage, KEYS.skin);
    return typeof value === 'string' ? value : null;
  }

  /** @param {GameStorage | null} storage @param {string} id */
  function saveSkin(storage, id) {
    writeJson(storage, KEYS.skin, id);
  }

  /** @param {GameStorage | null} storage @returns {Progress} */
  function readProgress(storage) {
    const value = readJson(storage, KEYS.progress);
    const v = value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : {};
    return { demonComplete: v.demonComplete === true, finaleComplete: v.finaleComplete === true };
  }

  /**
   * Records an achievement; says whether it is new.
   * @param {GameStorage | null} storage @param {'demonComplete' | 'finaleComplete'} which
   */
  function unlock(storage, which) {
    const progress = readProgress(storage);
    if (progress[which]) return false;
    writeJson(storage, KEYS.progress, { ...progress, [which]: true });
    return true;
  }

  /** @param {GameStorage | null} storage @returns {'sector' | 'section'} */
  function readCheckpointBy(storage) {
    return readJson(storage, KEYS.checkpoint) === 'section' ? 'section' : 'sector';
  }

  /** @param {GameStorage | null} storage @param {'sector' | 'section'} by */
  function saveCheckpointBy(storage, by) {
    writeJson(storage, KEYS.checkpoint, by);
  }

  return { KEYS, readBest, saveBest, readAttempts, countAttempt, readSkin, saveSkin, readProgress, unlock, readCheckpointBy, saveCheckpointBy };
}

/** @typedef {ReturnType<typeof createRecords>} Records */
