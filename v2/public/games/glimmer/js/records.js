// @ts-check
// Świetlik (Glimmer): the best run and the settings, on the device, under keys of its own
// (lifexp-glimmer-*): the game shares localStorage with LifeXP and touches nothing else.

/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} RecordStorage */
/** @typedef {{ score: number, time: number }} Best */
/** @typedef {{ calm: boolean }} Settings */

export const BEST_KEY = 'lifexp-glimmer-best';
export const SETTINGS_KEY = 'lifexp-glimmer-settings';

/** @param {RecordStorage | null} storage @param {string} key @returns {unknown} */
export function readJson(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** @param {RecordStorage | null} storage @param {string} key @param {unknown} value */
export function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: it lasts for this visit only.
  }
}

/** @param {unknown} v */
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** The best run, cleaned (anything unreadable counts as none). @param {RecordStorage | null} storage @returns {Best} */
export function readBest(storage) {
  const raw = /** @type {{ score?: unknown, time?: unknown } | null} */ (readJson(storage, BEST_KEY));
  return { score: whole(raw?.score), time: whole(raw?.time) };
}

/**
 * Keeps a run if it beats the best; returns whether it did.
 * @param {RecordStorage | null} storage @param {Best} best @param {number} score @param {number} time
 */
export function saveBest(storage, best, score, time) {
  if (score <= best.score) return false;
  best.score = Math.floor(score);
  best.time = Math.floor(time);
  writeJson(storage, BEST_KEY, best);
  return true;
}

/** @param {RecordStorage | null} storage @returns {Settings} */
export function readSettings(storage) {
  const raw = /** @type {{ calm?: unknown } | null} */ (readJson(storage, SETTINGS_KEY));
  return { calm: raw?.calm === true };
}

/** @param {RecordStorage | null} storage @param {Settings} settings */
export function saveSettings(storage, settings) {
  writeJson(storage, SETTINGS_KEY, settings);
}
