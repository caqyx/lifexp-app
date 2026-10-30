// @ts-check
// Skins of a Rush game (docs/v2/PLAN.md 9.1, stages w-1 and s-1): every game lists its own
// looks; all are free from the start except those marked `unlock: 'demon'`, worn only
// once the whole Demon sector is finished.

/** @typedef {{ id: string, unlock?: 'demon' }} SkinBase */

/**
 * Can this skin be worn?
 * @param {SkinBase} skin @param {{ demonComplete: boolean }} progress
 */
export function isUnlocked(skin, progress) {
  return skin.unlock !== 'demon' || progress.demonComplete;
}

/**
 * The skin to wear for a stored id: the first (the default) when it is unknown or still locked.
 * @template {SkinBase} S
 * @param {readonly S[]} skins @param {string | null} id @param {{ demonComplete: boolean }} progress
 * @returns {S}
 */
export function resolveSkin(skins, id, progress) {
  const skin = skins.find((s) => s.id === id);
  return skin && isUnlocked(skin, progress) ? skin : /** @type {S} */ (skins[0]);
}
