// @ts-check
// Each sector's look (docs/v2/PLAN.md 9.1, stage w-1): its own palette and background,
// richer further on. Owner's rule: not neon — a polished, decorated level: layered
// backgrounds, blocks with inner bevels and outlines, deco that never hurts, a restrained
// glow. Hazards keep one bright, consistent edge colour per sector so they read against
// the deco. From sector 4 (stage w-2) the detail grows step by step: glowing outlines,
// patterned (chevron) fills, background geometry, toothed edges, floating particles and
// a glowing ground — the most in the Extreme Demon tier and the finale.

/**
 * @typedef {{
 *   glow: number, chevrons: boolean, teeth: boolean,
 *   ground: string | null, bg: 'none' | 'triangles' | 'diamonds' | 'rays' | 'shards', bgColor: string,
 *   particles: { color: string, count: number } | null, hazardGlow: string | null,
 * }} Fx
 *   glow: outline glow strength (0 = the restrained glow of sectors 1–3); chevrons: arrow
 *   patterns inside the walls; teeth: toothed edges along every wall; ground: a glowing
 *   floor; bg: geometric background pattern; particles: floating motes (capped);
 *   hazardGlow: a halo around hazards so they stay readable among glowing deco.
 * @typedef {{
 *   id: string,
 *   sky: [string, string], haze: string,
 *   far: 'grid' | 'sun' | 'moon' | 'aurora' | 'eclipse' | 'none', farColor: string,
 *   mid: 'hills' | 'mesas' | 'towers' | 'spires' | 'none', midColor: [string, string],
 *   near: string,
 *   pattern: 'tiles' | 'bricks' | 'panels', emblem: 'porthole' | 'diamond' | 'star' | 'eye',
 *   block: { top: string, bottom: string, tile: string, shade: string, rim: string, edge: string, glow: string, detail: string },
 *   hazard: { fill: string, inner: string, edge: string, metal: string },
 *   deco: string, glow: number, fx?: Fx,
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
  // Sector 4 "Trudniejszy": a forge — steel walls, glowing ember edges, first chevrons.
  forge: {
    id: 'forge',
    sky: ['#120d10', '#3a1a12'],
    haze: 'rgba(255, 120, 60, 0.18)',
    far: 'grid',
    farColor: 'rgba(255, 150, 90, 0.07)',
    mid: 'towers',
    midColor: ['#2a1612', '#1c0f0c'],
    near: 'rgba(20, 8, 6, 0.45)',
    pattern: 'panels',
    emblem: 'diamond',
    block: { top: '#2b2a30', bottom: '#151418', tile: 'rgba(255, 180, 120, 0.12)', shade: 'rgba(0, 0, 0, 0.45)', rim: '#4a3a34', edge: '#ffb070', glow: 'rgba(255, 130, 60, 0.32)', detail: 'rgba(255, 170, 110, 0.45)' },
    hazard: { fill: '#120c0c', inner: '#5a2a1c', edge: '#fff1e0', metal: '#e8dcd2' },
    deco: 'rgba(255, 180, 120, 0.6)',
    glow: 0.8,
    fx: { glow: 0.5, chevrons: true, teeth: false, ground: null, bg: 'none', bgColor: '', particles: { color: '#ffb070', count: 14 }, hazardGlow: null },
  },
  // Sector 5 "Insane": an aurora night — dark teal walls, mint glow, diamond lattice.
  aurora: {
    id: 'aurora',
    sky: ['#04121a', '#0c3a3a'],
    haze: 'rgba(110, 255, 200, 0.16)',
    far: 'aurora',
    farColor: 'rgba(120, 255, 200, 0.22)',
    mid: 'spires',
    midColor: ['#0b2a2e', '#071d21'],
    near: 'rgba(2, 14, 16, 0.4)',
    pattern: 'tiles',
    emblem: 'eye',
    block: { top: '#0f3236', bottom: '#06171a', tile: 'rgba(140, 255, 220, 0.12)', shade: 'rgba(0, 0, 0, 0.45)', rim: '#1d5a58', edge: '#9effd8', glow: 'rgba(100, 255, 200, 0.34)', detail: 'rgba(150, 255, 220, 0.45)' },
    hazard: { fill: '#04100f', inner: '#1d4a48', edge: '#f2fffb', metal: '#d9f5ee' },
    deco: 'rgba(150, 255, 220, 0.6)',
    glow: 0.9,
    fx: { glow: 0.75, chevrons: true, teeth: true, ground: null, bg: 'diamonds', bgColor: 'rgba(120, 255, 210, 0.06)', particles: { color: '#9effd8', count: 18 }, hazardGlow: null },
  },
  // Sector 6, Easy Demon: deep navy, faint triangles, cyan-lit chevron walls, an icy glowing ground.
  demonBlue: {
    id: 'demonBlue',
    sky: ['#030a1e', '#0a1f4a'],
    haze: 'rgba(80, 160, 255, 0.2)',
    far: 'none',
    farColor: '',
    mid: 'spires',
    midColor: ['#081a3a', '#05122a'],
    near: 'rgba(2, 8, 20, 0.4)',
    pattern: 'tiles',
    emblem: 'eye',
    block: { top: '#0a1e48', bottom: '#040b1e', tile: 'rgba(120, 190, 255, 0.14)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#1b4590', edge: '#bfe3ff', glow: 'rgba(80, 170, 255, 0.45)', detail: 'rgba(140, 210, 255, 0.55)' },
    hazard: { fill: '#020714', inner: '#1d3f80', edge: '#ffffff', metal: '#d8ecff' },
    deco: 'rgba(150, 210, 255, 0.65)',
    glow: 1,
    fx: { glow: 1, chevrons: true, teeth: true, ground: 'rgba(120, 220, 255, 0.55)', bg: 'triangles', bgColor: 'rgba(110, 170, 255, 0.07)', particles: { color: '#9fd8ff', count: 26 }, hazardGlow: 'rgba(255, 255, 255, 0.18)' },
  },
  // Hard Demon: violet.
  demonPurple: {
    id: 'demonPurple',
    sky: ['#0c031c', '#2a0b4a'],
    haze: 'rgba(190, 110, 255, 0.2)',
    far: 'none',
    farColor: '',
    mid: 'spires',
    midColor: ['#1e0a3a', '#14062a'],
    near: 'rgba(8, 2, 18, 0.4)',
    pattern: 'tiles',
    emblem: 'eye',
    block: { top: '#24104a', bottom: '#0c0420', tile: 'rgba(210, 160, 255, 0.14)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#4a2390', edge: '#ecd2ff', glow: 'rgba(190, 110, 255, 0.48)', detail: 'rgba(220, 170, 255, 0.55)' },
    hazard: { fill: '#07020f', inner: '#4a2380', edge: '#ffffff', metal: '#efe0ff' },
    deco: 'rgba(220, 180, 255, 0.65)',
    glow: 1,
    fx: { glow: 1.1, chevrons: true, teeth: true, ground: 'rgba(200, 140, 255, 0.5)', bg: 'diamonds', bgColor: 'rgba(200, 140, 255, 0.08)', particles: { color: '#e2c2ff', count: 30 }, hazardGlow: 'rgba(255, 255, 255, 0.2)' },
  },
  // Insane Demon: black and deep red.
  demonRed: {
    id: 'demonRed',
    sky: ['#0a0103', '#3a0610'],
    haze: 'rgba(255, 60, 70, 0.22)',
    far: 'none',
    farColor: '',
    mid: 'spires',
    midColor: ['#2a050c', '#1a0307'],
    near: 'rgba(14, 0, 4, 0.45)',
    pattern: 'tiles',
    emblem: 'eye',
    block: { top: '#3a0a14', bottom: '#120206', tile: 'rgba(255, 140, 150, 0.14)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#7a1426', edge: '#ffd0d4', glow: 'rgba(255, 50, 70, 0.5)', detail: 'rgba(255, 150, 160, 0.55)' },
    hazard: { fill: '#0a0103', inner: '#6a1020', edge: '#ffffff', metal: '#ffe4e6' },
    deco: 'rgba(255, 150, 160, 0.65)',
    glow: 1,
    fx: { glow: 1.2, chevrons: true, teeth: true, ground: 'rgba(255, 80, 90, 0.5)', bg: 'rays', bgColor: 'rgba(255, 60, 80, 0.08)', particles: { color: '#ff9aa4', count: 34 }, hazardGlow: 'rgba(255, 255, 255, 0.22)' },
  },
  // Extreme Demon: black, red light and white accents — the richest.
  demonExtreme: {
    id: 'demonExtreme',
    sky: ['#000000', '#1c0206'],
    haze: 'rgba(255, 30, 50, 0.24)',
    far: 'eclipse',
    farColor: '#ffffff',
    mid: 'spires',
    midColor: ['#16020a', '#0a0004'],
    near: 'rgba(0, 0, 0, 0.5)',
    pattern: 'tiles',
    emblem: 'eye',
    block: { top: '#1a0308', bottom: '#030001', tile: 'rgba(255, 255, 255, 0.1)', shade: 'rgba(0, 0, 0, 0.6)', rim: '#a0102a', edge: '#ffffff', glow: 'rgba(255, 30, 60, 0.6)', detail: 'rgba(255, 255, 255, 0.6)' },
    hazard: { fill: '#000000', inner: '#7a0a1e', edge: '#ffffff', metal: '#ffffff' },
    deco: 'rgba(255, 255, 255, 0.7)',
    glow: 1,
    fx: { glow: 1.4, chevrons: true, teeth: true, ground: 'rgba(255, 40, 70, 0.6)', bg: 'shards', bgColor: 'rgba(255, 40, 70, 0.1)', particles: { color: '#ffffff', count: 40 }, hazardGlow: 'rgba(255, 255, 255, 0.26)' },
  },
  // The finale "Ostatnia Fala": an eclipse — black and gold with white light.
  eclipse: {
    id: 'eclipse',
    sky: ['#000000', '#16100a'],
    haze: 'rgba(255, 200, 110, 0.2)',
    far: 'eclipse',
    farColor: '#fff4d6',
    mid: 'spires',
    midColor: ['#120c06', '#080502'],
    near: 'rgba(0, 0, 0, 0.5)',
    pattern: 'tiles',
    emblem: 'eye',
    block: { top: '#1c140a', bottom: '#040302', tile: 'rgba(255, 230, 180, 0.12)', shade: 'rgba(0, 0, 0, 0.6)', rim: '#8a6420', edge: '#fff4d6', glow: 'rgba(255, 190, 80, 0.55)', detail: 'rgba(255, 220, 150, 0.6)' },
    hazard: { fill: '#000000', inner: '#6a4a14', edge: '#ffffff', metal: '#fff6e0' },
    deco: 'rgba(255, 225, 160, 0.7)',
    glow: 1,
    fx: { glow: 1.4, chevrons: true, teeth: true, ground: 'rgba(255, 190, 80, 0.55)', bg: 'rays', bgColor: 'rgba(255, 200, 110, 0.08)', particles: { color: '#ffe6a8', count: 44 }, hazardGlow: 'rgba(255, 255, 255, 0.26)' },
  },
};

/** @param {string} id */
export function themeOf(id) {
  return THEMES[id] ?? /** @type {Theme} */ (THEMES.lagoon);
}
