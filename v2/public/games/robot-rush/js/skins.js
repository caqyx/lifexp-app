// @ts-check
// The robot's looks (docs/v2/PLAN.md 9.1, stage rr-b): ten original robots, drawn from
// shapes on the canvas (render/robot.js): a body, a visor, a crest. All are free from the
// start except the last, which unlocks when the whole Demon sector is finished.
import { isUnlocked, resolveSkin as resolveFrom } from '../../_engine/skins.js';

/**
 * @typedef {'antenna' | 'fin' | 'horns' | 'dome' | 'mohawk' | 'ears' | 'visor' | 'spikes' | 'halo' | 'crown'} Crest
 * @typedef {{ id: string, crest: Crest, name: { pl: string, en: string },
 *   body: string, edge: string, accent: string, eye: string, trail: string, unlock?: 'demon' }} Skin
 *   body / edge: the shell and its outline; accent: the limbs, the crest and the chest
 *   light; eye: the visor's glow; trail: the thrusters' flame and the toasts' colour.
 */

/** @type {readonly Skin[]} */
export const SKINS = [
  { id: 'volt', crest: 'antenna', name: { pl: 'Wolt', en: 'Volt' }, body: '#29d3e6', edge: '#06303a', accent: '#ff3fa4', eye: '#ffffff', trail: '#6ff4ff' },
  { id: 'neon', crest: 'fin', name: { pl: 'Neon', en: 'Neon' }, body: '#ff4fb6', edge: '#3b0626', accent: '#ffe14a', eye: '#fff2fb', trail: '#ff8fd2' },
  { id: 'circuit', crest: 'horns', name: { pl: 'Scalak', en: 'Chip' }, body: '#7cf06a', edge: '#0d3a10', accent: '#1d2b20', eye: '#eaffd8', trail: '#a6ff8c' },
  { id: 'pixel', crest: 'dome', name: { pl: 'Piksel', en: 'Pixel' }, body: '#ffb02e', edge: '#3d2300', accent: '#2a63ff', eye: '#ffffff', trail: '#ffd27a' },
  { id: 'chrome', crest: 'mohawk', name: { pl: 'Chrom', en: 'Chrome' }, body: '#c9d2df', edge: '#1d2430', accent: '#ff4a4a', eye: '#7ad8ff', trail: '#e6eef8' },
  { id: 'night', crest: 'ears', name: { pl: 'Nocnik', en: 'Night Owl' }, body: '#2b2f5e', edge: '#0a0b1e', accent: '#ffd23f', eye: '#ffd23f', trail: '#8c93ff' },
  { id: 'laser', crest: 'visor', name: { pl: 'Laser', en: 'Laser' }, body: '#f2f2f6', edge: '#22232b', accent: '#ff2e4d', eye: '#ff2e4d', trail: '#ff7a8e' },
  { id: 'sprocket', crest: 'spikes', name: { pl: 'Kolczak', en: 'Sprocket' }, body: '#9b6bff', edge: '#21104a', accent: '#3ff0d1', eye: '#ffffff', trail: '#c2a4ff' },
  { id: 'patrol', crest: 'halo', name: { pl: 'Patrol', en: 'Patrol' }, body: '#ffe14a', edge: '#2f2a05', accent: '#20242c', eye: '#3fd6ff', trail: '#fff08f' },
  {
    id: 'skyline-crown',
    crest: 'crown',
    name: { pl: 'Korona Miasta', en: 'Skyline Crown' },
    body: '#0e0f16',
    edge: '#f4f4fa',
    accent: '#ffcf3f',
    eye: '#39f6ff',
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
