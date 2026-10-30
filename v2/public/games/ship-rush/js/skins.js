// @ts-check
// The ship's looks (docs/v2/PLAN.md 9.1, stage s-1): ten original hulls, drawn from
// shapes on the canvas (render/ship.js), each with its own colours and trail. All are
// free from the start except the last, which unlocks when the whole Demon sector is
// finished (stage s-2).
import { isUnlocked, resolveSkin as resolveFrom } from '../../_engine/skins.js';

/**
 * @typedef {'swift' | 'falcon' | 'manta' | 'rocket' | 'glider' | 'saucer' | 'hornet' | 'twin' | 'comet' | 'crown'} Hull
 * @typedef {{ id: string, hull: Hull, name: { pl: string, en: string },
 *   body: string, edge: string, accent: string, glass: string, trail: string, unlock?: 'demon' }} Skin
 */

/** @type {readonly Skin[]} */
export const SKINS = [
  { id: 'swift', hull: 'swift', name: { pl: 'Jaskółka', en: 'Swift' }, body: '#f4c542', edge: '#3d2c08', accent: '#e8553d', glass: '#bfe8ff', trail: '#ffd866' },
  { id: 'falcon', hull: 'falcon', name: { pl: 'Sokół', en: 'Falcon' }, body: '#4f8fe8', edge: '#10264a', accent: '#f2f5fb', glass: '#d8f1ff', trail: '#7fb2f5' },
  { id: 'manta', hull: 'manta', name: { pl: 'Manta', en: 'Manta' }, body: '#3fb7a6', edge: '#0d3833', accent: '#f6e27a', glass: '#e2fff8', trail: '#64d6c4' },
  { id: 'rocket', hull: 'rocket', name: { pl: 'Rakieta', en: 'Rocket' }, body: '#eef1f6', edge: '#2a2f3a', accent: '#e04a4a', glass: '#9fd6ff', trail: '#ff8a6b' },
  { id: 'glider', hull: 'glider', name: { pl: 'Szybowiec', en: 'Glider' }, body: '#8fd694', edge: '#1d4521', accent: '#2f6f3a', glass: '#e8fff0', trail: '#b3eab6' },
  { id: 'saucer', hull: 'saucer', name: { pl: 'Spodek', en: 'Saucer' }, body: '#a58bf0', edge: '#2a1e50', accent: '#ffd36b', glass: '#e9e2ff', trail: '#c2b0f7' },
  { id: 'hornet', hull: 'hornet', name: { pl: 'Szerszeń', en: 'Hornet' }, body: '#f08a3a', edge: '#3d1c04', accent: '#1e1e24', glass: '#ffe9c7', trail: '#f6a868' },
  { id: 'twin', hull: 'twin', name: { pl: 'Bliźniak', en: 'Twin' }, body: '#d9485f', edge: '#45101b', accent: '#f4d3da', glass: '#ffe0e6', trail: '#e8768a' },
  { id: 'comet', hull: 'comet', name: { pl: 'Kometa', en: 'Comet' }, body: '#c9cfdb', edge: '#20242c', accent: '#5fd0ff', glass: '#e6fbff', trail: '#dfe6f2' },
  {
    id: 'void-crown',
    hull: 'crown',
    name: { pl: 'Korona Pustki', en: 'Void Crown' },
    body: '#15151b',
    edge: '#f4f4f6',
    accent: '#e0313f',
    glass: '#ff9aa4',
    trail: '#ffffff',
    unlock: 'demon',
  },
];

export const DEFAULT_SKIN = /** @type {Skin} */ (SKINS[0]);

export { isUnlocked };

/**
 * The skin to wear for a stored id: the default when it is unknown or still locked.
 * @param {string | null} id @param {{ demonComplete: boolean }} progress
 */
export function resolveSkin(id, progress) {
  return resolveFrom(SKINS, id, progress);
}
