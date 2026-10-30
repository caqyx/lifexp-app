// @ts-check
// The ball's and the spider's looks (docs/v2/PLAN.md 9.1, stage f-1): ten original
// machines, drawn from shapes on the canvas (render/vehicles.js) — one skin dresses both
// vehicles (the ball's shell and pattern, the spider's body and legs). All are free from
// the start except the last, which unlocks when the whole Demon sector is finished
// (stage f-2).
import { isUnlocked, resolveSkin as resolveFrom } from '../../_engine/skins.js';

/**
 * @typedef {'gear' | 'bolt' | 'rivets' | 'split' | 'hazard' | 'core' | 'grid' | 'spiral' | 'cross' | 'crown'} Pattern
 * @typedef {{ id: string, pattern: Pattern, name: { pl: string, en: string },
 *   body: string, edge: string, accent: string, eye: string, trail: string, unlock?: 'demon' }} Skin
 *   body / edge: the shell and its outline; accent: the pattern and the spider's legs; eye:
 *   the eyes and the core's light; trail: the spider's snap streak and the toasts' colour.
 */

/** @type {readonly Skin[]} */
export const SKINS = [
  { id: 'cog', pattern: 'gear', name: { pl: 'Zębatka', en: 'Cog' }, body: '#f2b632', edge: '#3a2806', accent: '#7a4f0a', eye: '#ffffff', trail: '#ffd25e' },
  { id: 'spark', pattern: 'bolt', name: { pl: 'Iskra', en: 'Spark' }, body: '#3f7fe0', edge: '#0e2147', accent: '#ffe066', eye: '#e8f6ff', trail: '#7fb4ff' },
  { id: 'rivet', pattern: 'rivets', name: { pl: 'Nit', en: 'Rivet' }, body: '#9aa6b5', edge: '#252b33', accent: '#4d5866', eye: '#ffcf4a', trail: '#c7d0db' },
  { id: 'piston', pattern: 'split', name: { pl: 'Tłok', en: 'Piston' }, body: '#e45545', edge: '#3d0d08', accent: '#f6eee6', eye: '#fff4d8', trail: '#ff8b7a' },
  { id: 'warden', pattern: 'hazard', name: { pl: 'Strażnik', en: 'Warden' }, body: '#f5d02f', edge: '#1b1b1f', accent: '#1b1b1f', eye: '#ff5a3c', trail: '#ffe270' },
  { id: 'reactor', pattern: 'core', name: { pl: 'Rdzeń', en: 'Core' }, body: '#2b3a3f', edge: '#0b1214', accent: '#3fe0b0', eye: '#b8fff0', trail: '#5ff0c4' },
  { id: 'circuit', pattern: 'grid', name: { pl: 'Obwód', en: 'Circuit' }, body: '#1f6b4a', edge: '#082317', accent: '#9cf28a', eye: '#eaffe0', trail: '#7ee07a' },
  { id: 'drill', pattern: 'spiral', name: { pl: 'Wiertło', en: 'Drill' }, body: '#b07ae8', edge: '#2a1450', accent: '#f3e6ff', eye: '#ffffff', trail: '#cda6f5' },
  { id: 'valve', pattern: 'cross', name: { pl: 'Zawór', en: 'Valve' }, body: '#e9ecf2', edge: '#262a33', accent: '#2d8cff', eye: '#2d8cff', trail: '#dfe7f5' },
  {
    id: 'machine-crown',
    pattern: 'crown',
    name: { pl: 'Korona Maszyn', en: 'Machine Crown' },
    body: '#141418',
    edge: '#f2f2f4',
    accent: '#e8b33c',
    eye: '#ff3b3b',
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
