// @ts-check
// Strażnicy Doliny: progress (stars per map, the endless best) and settings (the speed),
// on the device. Only keys of its own (lifexp-wardens-*): the game shares localStorage
// with LifeXP and never touches anything else. A game in progress is not saved.

/** @typedef {import('./maps.js').MapDef} MapDef */
/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} RecordStorage */
/** @typedef {{ stars: Record<string, number>, endlessBest: number }} Progress */
/** @typedef {{ speed: 1 | 2 }} Settings */

export const PROGRESS_KEY = 'lifexp-wardens-progress';
export const SETTINGS_KEY = 'lifexp-wardens-settings';

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

/** @param {unknown} value */
function wholeNumber(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * The saved progress, cleaned: anything unreadable counts as nothing.
 * @param {RecordStorage | null} storage @returns {Progress}
 */
export function readProgress(storage) {
  const raw = /** @type {{ stars?: unknown, endlessBest?: unknown } | null} */ (readJson(storage, PROGRESS_KEY));
  /** @type {Record<string, number>} */
  const stars = {};
  if (raw && typeof raw.stars === 'object' && raw.stars !== null) {
    for (const [id, n] of Object.entries(raw.stars)) stars[id] = Math.min(3, wholeNumber(n));
  }
  return { stars, endlessBest: wholeNumber(raw?.endlessBest) };
}

/**
 * Keeps a win's stars if they beat the map's best; returns whether they did.
 * @param {RecordStorage | null} storage @param {Progress} progress @param {MapDef['id']} id @param {number} stars
 */
export function saveWin(storage, progress, id, stars) {
  if (stars <= (progress.stars[id] ?? 0)) return false;
  progress.stars[id] = Math.min(3, stars);
  writeJson(storage, PROGRESS_KEY, progress);
  return true;
}

/**
 * Keeps an endless run's waves held if they beat the best; returns whether they did.
 * @param {RecordStorage | null} storage @param {Progress} progress @param {number} waves
 */
export function saveEndless(storage, progress, waves) {
  if (waves <= progress.endlessBest) return false;
  progress.endlessBest = waves;
  writeJson(storage, PROGRESS_KEY, progress);
  return true;
}

/**
 * A map is open when it is the first or the one before it has been won; endless play
 * opens with the last map.
 * @param {Progress} progress @param {readonly MapDef[]} maps @param {number} index
 */
export function isUnlocked(progress, maps, index) {
  if (index <= 0) return true;
  const before = maps[index - 1];
  return before !== undefined && (progress.stars[before.id] ?? 0) > 0;
}

/**
 * The custom mode opens when every campaign map has been won (any stars); old saves that
 * already did so open it at once.
 * @param {Progress} progress @param {readonly MapDef[]} maps
 */
export function isCustomUnlocked(progress, maps) {
  return maps.every((map) => (progress.stars[map.id] ?? 0) > 0);
}

/** @param {RecordStorage | null} storage @returns {Settings} */
export function readSettings(storage) {
  const raw = /** @type {{ speed?: unknown } | null} */ (readJson(storage, SETTINGS_KEY));
  return { speed: raw?.speed === 2 ? 2 : 1 };
}

/** @param {RecordStorage | null} storage @param {Settings} settings */
export function saveSettings(storage, settings) {
  writeJson(storage, SETTINGS_KEY, settings);
}
