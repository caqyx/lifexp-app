// @ts-check
// The wave's looks (docs/v2/PLAN.md 9.1, stage w-1): ten original icons, drawn from
// shapes on the canvas (render/wave.js). All are free from the start except the last,
// which unlocks when the whole Demon sector is finished (stage w-2).

/**
 * @typedef {'dart' | 'arrow' | 'kite' | 'chevron' | 'diamond' | 'fin' | 'blade' | 'comet' | 'twin' | 'crown'} Shape
 * @typedef {{ id: string, shape: Shape, name: { pl: string, en: string },
 *   body: string, edge: string, accent: string, trail: string, unlock?: 'demon' }} Skin
 */

/** @type {readonly Skin[]} */
export const SKINS = [
  { id: 'classic', shape: 'dart', name: { pl: 'Klasyk', en: 'Classic' }, body: '#f2c14e', edge: '#3b2a10', accent: '#fff3c4', trail: '#f2c14e' },
  { id: 'teal', shape: 'arrow', name: { pl: 'Turkus', en: 'Teal' }, body: '#3fb7a6', edge: '#0f3b36', accent: '#c8f3ec', trail: '#5fd0bf' },
  { id: 'coral', shape: 'kite', name: { pl: 'Koral', en: 'Coral' }, body: '#f07a5f', edge: '#4a1c14', accent: '#ffd9cf', trail: '#f39a85' },
  { id: 'lavender', shape: 'chevron', name: { pl: 'Lawenda', en: 'Lavender' }, body: '#a58bf0', edge: '#2d2052', accent: '#e6ddff', trail: '#b9a5f5' },
  { id: 'mint', shape: 'diamond', name: { pl: 'Mięta', en: 'Mint' }, body: '#8fd694', edge: '#1f4a24', accent: '#e3f8e4', trail: '#a9e2ad' },
  { id: 'ocean', shape: 'fin', name: { pl: 'Ocean', en: 'Ocean' }, body: '#4f8fe8', edge: '#11274d', accent: '#d4e4ff', trail: '#75a8f0' },
  { id: 'ruby', shape: 'blade', name: { pl: 'Rubin', en: 'Ruby' }, body: '#d9485f', edge: '#48111c', accent: '#ffd0d8', trail: '#e26c80' },
  { id: 'amber', shape: 'comet', name: { pl: 'Bursztyn', en: 'Amber' }, body: '#e8963a', edge: '#4a2a08', accent: '#ffe2bf', trail: '#f0ad5c' },
  { id: 'graphite', shape: 'twin', name: { pl: 'Grafit', en: 'Graphite' }, body: '#c9cfdb', edge: '#22262e', accent: '#ffffff', trail: '#e0e4ec' },
  {
    id: 'demon-crown',
    shape: 'crown',
    name: { pl: 'Korona Demona', en: 'Demon Crown' },
    body: '#1c1c22',
    edge: '#f4f4f6',
    accent: '#e0313f',
    trail: '#ffffff',
    unlock: 'demon',
  },
];

export const DEFAULT_SKIN = /** @type {Skin} */ (SKINS[0]);

/**
 * Can this skin be worn?
 * @param {Skin} skin @param {{ demonComplete: boolean }} progress
 */
export function isUnlocked(skin, progress) {
  return skin.unlock !== 'demon' || progress.demonComplete;
}

/**
 * The skin to wear for a stored id: the default when it is unknown or still locked.
 * @param {string | null} id @param {{ demonComplete: boolean }} progress
 */
export function resolveSkin(id, progress) {
  const skin = SKINS.find((s) => s.id === id);
  return skin && isUnlocked(skin, progress) ? skin : DEFAULT_SKIN;
}
