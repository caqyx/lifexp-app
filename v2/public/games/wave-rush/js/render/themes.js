// @ts-check
// Each sector's look (docs/v2/PLAN.md 9.1, stage w-1): its own palette and background,
// richer further on. Owner's rule: not neon — a polished, decorated level: layered
// backgrounds, blocks with inner bevels and outlines, deco that never hurts, a restrained
// glow. Hazards keep one bright, consistent edge colour per sector so they read against
// the deco. Sectors 4–6 (stage w-2) add glowing outlines, patterned fills and particles.

/**
 * @typedef {{
 *   id: string,
 *   sky: [string, string], haze: string,
 *   far: 'grid' | 'sun' | 'moon', farColor: string,
 *   mid: 'hills' | 'mesas' | 'towers', midColor: [string, string],
 *   near: string,
 *   pattern: 'tiles' | 'bricks' | 'panels', emblem: 'porthole' | 'diamond' | 'star',
 *   block: { top: string, bottom: string, tile: string, shade: string, rim: string, edge: string, glow: string, detail: string },
 *   hazard: { fill: string, inner: string, edge: string, metal: string },
 *   deco: string, glow: number,
 * }} Theme
 */

/** @type {Record<string, Theme>} */
export const THEMES = {
  // Sector 1 "Łatwy": a calm lagoon at dusk — teal blocks, soft aqua edges.
  lagoon: {
    id: 'lagoon',
    sky: ['#0f3a55', '#2a8796'],
    haze: 'rgba(150, 235, 225, 0.22)',
    far: 'grid',
    farColor: 'rgba(170, 235, 240, 0.07)',
    mid: 'hills',
    midColor: ['#1a5f72', '#124a5c'],
    near: 'rgba(10, 48, 64, 0.32)',
    pattern: 'tiles',
    emblem: 'porthole',
    block: { top: '#145064', bottom: '#082431', tile: 'rgba(140, 220, 225, 0.17)', shade: 'rgba(0, 12, 20, 0.4)', rim: '#22788c', edge: '#b4f2ea', glow: 'rgba(120, 225, 215, 0.24)', detail: 'rgba(160, 235, 230, 0.32)' },
    hazard: { fill: '#07202b', inner: '#1a5a6c', edge: '#f2fffc', metal: '#cfe7ea' },
    deco: 'rgba(150, 215, 215, 0.55)',
    glow: 0.5,
  },
  // Sector 2 "Normalny": a mesa at sunset — terracotta bricks, a banded sun.
  mesa: {
    id: 'mesa',
    sky: ['#24122f', '#a24a35'],
    haze: 'rgba(255, 170, 110, 0.2)',
    far: 'sun',
    farColor: '#f4b26a',
    mid: 'mesas',
    midColor: ['#6a2c3a', '#4a1d2c'],
    near: 'rgba(60, 20, 34, 0.3)',
    pattern: 'bricks',
    emblem: 'diamond',
    block: { top: '#5a2633', bottom: '#33141f', tile: 'rgba(255, 190, 150, 0.15)', shade: 'rgba(25, 5, 12, 0.4)', rim: '#8c3f47', edge: '#ffd3a1', glow: 'rgba(255, 170, 110, 0.24)', detail: 'rgba(255, 205, 160, 0.3)' },
    hazard: { fill: '#2a0d16', inner: '#74303d', edge: '#fff3e2', metal: '#f1dcc8' },
    deco: 'rgba(255, 205, 160, 0.55)',
    glow: 0.6,
  },
  // Sector 3 "Trudny": a citadel at night — indigo panels with gold trim, moon and towers.
  citadel: {
    id: 'citadel',
    sky: ['#0a0819', '#2b1d50'],
    haze: 'rgba(170, 140, 255, 0.16)',
    far: 'moon',
    farColor: '#efe8ff',
    mid: 'towers',
    midColor: ['#211a46', '#161032'],
    near: 'rgba(14, 10, 32, 0.4)',
    pattern: 'panels',
    emblem: 'star',
    block: { top: '#231d45', bottom: '#120e27', tile: 'rgba(200, 185, 255, 0.13)', shade: 'rgba(0, 0, 10, 0.4)', rim: '#3d3375', edge: '#e8c97e', glow: 'rgba(232, 200, 120, 0.25)', detail: 'rgba(232, 200, 126, 0.42)' },
    hazard: { fill: '#0c0a1d', inner: '#3a3170', edge: '#fff6dc', metal: '#e9e1f5' },
    deco: 'rgba(232, 200, 126, 0.6)',
    glow: 0.7,
  },
};

/** @param {string} id */
export function themeOf(id) {
  return THEMES[id] ?? /** @type {Theme} */ (THEMES.lagoon);
}
