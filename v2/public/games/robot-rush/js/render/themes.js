// @ts-check
// Each sector's look (docs/v2/PLAN.md 9.1, stage rr-b). Owner: a NEON CITY at night —
// rooftops, cranes, lights, a skyline in layers — in a palette of its own (not Wave Rush's
// waves, Ship Rush's skies or Flip Rush's factory). Original art, richer sector by sector,
// hazards always readable: a dark body and one bright edge, and from sector 3 a pale halo.
// Sector 1 rooftops under a violet dusk; 2 a street of shop signs in pink and cyan; 3
// harbour cranes over the bay at night; 4 the elevated railway's tunnels in orange; 5 a
// storm over the towers (rain, lightning); the Demon in four bands — the grid (an outline
// city in cyan), the signs (a wall of flickering neon, magenta), the blackout (the city
// dark but for red warning lights) and the overload (every light at once, white and
// gold); the finale on the city's highest tower.

/**
 * @typedef {'rooftops' | 'avenue' | 'cranes' | 'tunnels' | 'storm' | 'grid' | 'signs' | 'blackout' | 'overload' | 'summit'} Backdrop
 * @typedef {import('../../../_engine/render/section.js').SurfaceTheme & {
 *   sky: [string, string, string], glow: string, backdrop: Backdrop,
 *   far: string, mid: string, near: string, windows: string[], neon: string[],
 *   motes: { color: string, count: number } | null,
 * }} Theme
 *   sky: top, horizon and bottom of the night sky; glow: the city's light on the haze;
 *   far / mid / near: the skyline's layers; windows: lit windows' colours; neon: signs'
 *   and lights' colours; motes: rain, dust or sparks.
 */

/** @type {Record<string, Theme>} */
export const THEMES = {
  // Sector 1 "Łatwy": rooftops at dusk — water tanks, antennas, warm windows.
  rooftops: {
    id: 'rooftops',
    sky: ['#1a0f3d', '#5b2a7a', '#e0769a'],
    glow: 'rgba(255, 160, 200, 0.28)',
    backdrop: 'rooftops',
    far: 'rgba(70, 40, 110, 0.75)',
    mid: 'rgba(40, 22, 70, 0.9)',
    near: 'rgba(16, 10, 30, 0.95)',
    windows: ['#ffd27a', '#ffe9b0', '#ff9ec7'],
    neon: ['#ff7ac0', '#7ae0ff'],
    motes: null,
    pattern: 'bricks',
    emblem: 'vent',
    block: { top: '#4a3470', bottom: '#1c1230', tile: 'rgba(255, 220, 255, 0.14)', shade: 'rgba(0, 0, 0, 0.35)', rim: '#ff8ac8', edge: '#ffffff', glow: 'rgba(255, 130, 200, 0.3)', detail: 'rgba(255, 210, 120, 0.85)' },
    hazard: { fill: '#120a1e', inner: '#5a4078', edge: '#ffffff', metal: '#f3e8ff' },
    deco: 'rgba(255, 170, 220, 0.5)',
  },
  // Sector 2 "Normalny": the avenue — shop signs in pink and cyan, a lit street far below.
  avenue: {
    id: 'avenue',
    sky: ['#05030f', '#1a0b2e', '#3a0f3e'],
    glow: 'rgba(255, 60, 170, 0.22)',
    backdrop: 'avenue',
    far: 'rgba(60, 20, 80, 0.8)',
    mid: 'rgba(28, 10, 44, 0.92)',
    near: 'rgba(8, 4, 16, 0.95)',
    windows: ['#ff5fb8', '#5ff0ff', '#ffe36b'],
    neon: ['#ff3fa4', '#29e3ff', '#ffe14a'],
    motes: null,
    pattern: 'panels',
    emblem: 'diamond',
    block: { top: '#2a1440', bottom: '#0c0616', tile: 'rgba(255, 120, 220, 0.16)', shade: 'rgba(0, 0, 0, 0.45)', rim: '#ff3fa4', edge: '#ffe0f4', glow: 'rgba(255, 60, 170, 0.4)', detail: 'rgba(41, 227, 255, 0.85)' },
    hazard: { fill: '#07030c', inner: '#4a1a5e', edge: '#ffffff', metal: '#ffe9f7' },
    deco: 'rgba(255, 120, 210, 0.5)',
    fx: { glow: 0.6, chevrons: false, teeth: false, ground: null, hazardGlow: null },
  },
  // Sector 3 "Trudny": harbour cranes over the bay, red tip lights, the water's shimmer.
  cranes: {
    id: 'cranes',
    sky: ['#020814', '#0a1f3a', '#123a5c'],
    glow: 'rgba(90, 200, 255, 0.2)',
    backdrop: 'cranes',
    far: 'rgba(30, 70, 110, 0.75)',
    mid: 'rgba(12, 32, 56, 0.92)',
    near: 'rgba(4, 12, 22, 0.95)',
    windows: ['#9fe6ff', '#ffffff', '#ffcf6b'],
    neon: ['#ff3b3b', '#3fd6ff'],
    motes: { color: '#9fe6ff', count: 20 },
    pattern: 'plates',
    emblem: 'bolt',
    block: { top: '#1c3550', bottom: '#06101c', tile: 'rgba(160, 230, 255, 0.14)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#3fd6ff', edge: '#e0f8ff', glow: 'rgba(63, 214, 255, 0.4)', detail: 'rgba(255, 90, 90, 0.85)' },
    hazard: { fill: '#02060c', inner: '#1e4060', edge: '#ffffff', metal: '#eaf8ff' },
    deco: 'rgba(140, 220, 255, 0.5)',
    fx: { glow: 0.9, chevrons: false, teeth: false, ground: null, hazardGlow: 'rgba(255, 255, 255, 0.18)' },
  },
  // Sector 4 "Trudniejszy": under the elevated railway — arches, orange lamps, trains passing.
  tunnels: {
    id: 'tunnels',
    sky: ['#0a0402', '#2a1206', '#4a200a'],
    glow: 'rgba(255, 140, 40, 0.24)',
    backdrop: 'tunnels',
    far: 'rgba(90, 40, 16, 0.8)',
    mid: 'rgba(40, 16, 6, 0.92)',
    near: 'rgba(14, 6, 2, 0.96)',
    windows: ['#ffb347', '#ffe0a0', '#ff7a2e'],
    neon: ['#ff8c2e', '#ffd34a'],
    motes: { color: '#ffc27a', count: 24 },
    pattern: 'bricks',
    emblem: 'porthole',
    block: { top: '#4a2410', bottom: '#140803', tile: 'rgba(255, 200, 140, 0.14)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#ff8c2e', edge: '#fff0dc', glow: 'rgba(255, 140, 40, 0.45)', detail: 'rgba(255, 210, 90, 0.85)' },
    hazard: { fill: '#0a0402', inner: '#4a2410', edge: '#ffffff', metal: '#fff2e2' },
    deco: 'rgba(255, 180, 110, 0.5)',
    fx: { glow: 1, chevrons: false, teeth: false, ground: 'rgba(255, 140, 40, 0.3)', hazardGlow: 'rgba(255, 255, 255, 0.2)' },
  },
  // Sector 5 "Insane": a storm over the towers — rain, lightning, green-lit glass.
  storm: {
    id: 'storm',
    sky: ['#010403', '#06140f', '#0e2a20'],
    glow: 'rgba(80, 255, 170, 0.2)',
    backdrop: 'storm',
    far: 'rgba(20, 60, 46, 0.8)',
    mid: 'rgba(6, 26, 20, 0.94)',
    near: 'rgba(2, 8, 6, 0.96)',
    windows: ['#5fffb0', '#c8ffe6', '#3fd6ff'],
    neon: ['#3dff9e', '#c8ffe6'],
    motes: { color: '#bff5e0', count: 70 },
    pattern: 'plates',
    emblem: 'bolt',
    block: { top: '#123a2c', bottom: '#020c08', tile: 'rgba(160, 255, 210, 0.14)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#3dff9e', edge: '#e2fff2', glow: 'rgba(61, 255, 158, 0.45)', detail: 'rgba(160, 255, 210, 0.85)' },
    hazard: { fill: '#010604', inner: '#164a36', edge: '#ffffff', metal: '#eafff6' },
    deco: 'rgba(150, 255, 200, 0.5)',
    fx: { glow: 1.2, chevrons: true, teeth: false, ground: 'rgba(61, 255, 158, 0.32)', hazardGlow: 'rgba(255, 255, 255, 0.22)' },
  },
  // The Demon, Easy: the grid — the city drawn in cyan outlines on black.
  grid: {
    id: 'grid',
    sky: ['#000206', '#001018', '#00202e'],
    glow: 'rgba(40, 230, 255, 0.24)',
    backdrop: 'grid',
    far: 'rgba(40, 230, 255, 0.35)',
    mid: 'rgba(40, 230, 255, 0.6)',
    near: 'rgba(0, 10, 16, 0.95)',
    windows: ['#28e6ff', '#9ff4ff'],
    neon: ['#28e6ff', '#ffffff'],
    motes: { color: '#9ff4ff', count: 40 },
    pattern: 'tiles',
    emblem: 'eye',
    block: { top: '#032836', bottom: '#000a10', tile: 'rgba(40, 230, 255, 0.2)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#28e6ff', edge: '#e0fcff', glow: 'rgba(40, 230, 255, 0.55)', detail: 'rgba(40, 230, 255, 0.85)' },
    hazard: { fill: '#000306', inner: '#0a4a5e', edge: '#ffffff', metal: '#eafcff' },
    deco: 'rgba(40, 230, 255, 0.5)',
    fx: { glow: 1.3, chevrons: true, teeth: true, ground: 'rgba(40, 230, 255, 0.42)', hazardGlow: 'rgba(255, 255, 255, 0.22)' },
  },
  // The Demon, Hard: the signs — a wall of flickering neon in magenta and violet.
  signs: {
    id: 'signs',
    sky: ['#06000a', '#1c0230', '#3a0650'],
    glow: 'rgba(255, 40, 220, 0.26)',
    backdrop: 'signs',
    far: 'rgba(120, 20, 160, 0.6)',
    mid: 'rgba(50, 6, 70, 0.92)',
    near: 'rgba(14, 0, 20, 0.96)',
    windows: ['#ff3fe0', '#b46bff', '#ffffff'],
    neon: ['#ff3fe0', '#b46bff', '#3fffe8'],
    motes: { color: '#ffb8f4', count: 50 },
    pattern: 'panels',
    emblem: 'star',
    block: { top: '#3a0a50', bottom: '#0c0014', tile: 'rgba(255, 140, 250, 0.16)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#ff3fe0', edge: '#ffe8fd', glow: 'rgba(255, 40, 220, 0.55)', detail: 'rgba(180, 107, 255, 0.85)' },
    hazard: { fill: '#060008', inner: '#4a0a5e', edge: '#ffffff', metal: '#fff0fd' },
    deco: 'rgba(255, 120, 240, 0.5)',
    fx: { glow: 1.4, chevrons: true, teeth: true, ground: 'rgba(255, 40, 220, 0.42)', hazardGlow: 'rgba(255, 255, 255, 0.22)' },
  },
  // The Demon, Insane: the blackout — the towers dark, red warning lights blinking.
  blackout: {
    id: 'blackout',
    sky: ['#000000', '#080102', '#180306'],
    glow: 'rgba(255, 30, 40, 0.18)',
    backdrop: 'blackout',
    far: 'rgba(30, 6, 8, 0.85)',
    mid: 'rgba(12, 2, 3, 0.95)',
    near: 'rgba(0, 0, 0, 0.97)',
    windows: ['#3a0a0e'],
    neon: ['#ff2a3a'],
    motes: { color: '#ff8a90', count: 30 },
    pattern: 'plates',
    emblem: 'diamond',
    block: { top: '#2a080c', bottom: '#060102', tile: 'rgba(255, 160, 160, 0.12)', shade: 'rgba(0, 0, 0, 0.55)', rim: '#ff2a3a', edge: '#ffe2e4', glow: 'rgba(255, 40, 50, 0.55)', detail: 'rgba(255, 60, 70, 0.85)' },
    hazard: { fill: '#000000', inner: '#3a0a0e', edge: '#ffffff', metal: '#fff0f0' },
    deco: 'rgba(255, 90, 100, 0.5)',
    fx: { glow: 1.5, chevrons: true, teeth: true, ground: 'rgba(255, 40, 50, 0.45)', hazardGlow: 'rgba(255, 255, 255, 0.24)' },
  },
  // The Demon, Extreme: the overload — every light at once, white and gold on black.
  overload: {
    id: 'overload',
    sky: ['#000000', '#0a0a10', '#1a1608'],
    glow: 'rgba(255, 230, 140, 0.26)',
    backdrop: 'overload',
    far: 'rgba(255, 220, 120, 0.3)',
    mid: 'rgba(24, 22, 14, 0.94)',
    near: 'rgba(0, 0, 0, 0.96)',
    windows: ['#ffffff', '#ffe14a', '#3fffe8', '#ff3fa4'],
    neon: ['#ffffff', '#ffe14a', '#ff3fa4', '#3fffe8'],
    motes: { color: '#ffffff', count: 80 },
    pattern: 'plates',
    emblem: 'eye',
    block: { top: '#1c1a14', bottom: '#000000', tile: 'rgba(255, 255, 255, 0.12)', shade: 'rgba(0, 0, 0, 0.6)', rim: '#ffe14a', edge: '#ffffff', glow: 'rgba(255, 225, 74, 0.6)', detail: 'rgba(255, 255, 255, 0.85)' },
    hazard: { fill: '#000000', inner: '#3a3420', edge: '#ffffff', metal: '#ffffff' },
    deco: 'rgba(255, 240, 180, 0.55)',
    fx: { glow: 1.7, chevrons: true, teeth: true, ground: 'rgba(255, 225, 74, 0.5)', hazardGlow: 'rgba(255, 255, 255, 0.28)' },
  },
  // The finale "Neonowy Szczyt": the top of the highest tower — the whole city below,
  // a beacon sweeping the clouds, gold and cyan.
  summit: {
    id: 'summit',
    sky: ['#02010a', '#120a30', '#2a1450'],
    glow: 'rgba(120, 220, 255, 0.26)',
    backdrop: 'summit',
    far: 'rgba(120, 90, 200, 0.5)',
    mid: 'rgba(30, 18, 60, 0.92)',
    near: 'rgba(6, 4, 14, 0.96)',
    windows: ['#ffcf3f', '#39f6ff', '#ffffff', '#ff6ad5'],
    neon: ['#39f6ff', '#ffcf3f'],
    motes: { color: '#d9f6ff', count: 60 },
    pattern: 'plates',
    emblem: 'star',
    block: { top: '#2a1a50', bottom: '#06040e', tile: 'rgba(220, 220, 255, 0.14)', shade: 'rgba(0, 0, 0, 0.55)', rim: '#ffcf3f', edge: '#ffffff', glow: 'rgba(57, 246, 255, 0.5)', detail: 'rgba(255, 207, 63, 0.85)' },
    hazard: { fill: '#020108', inner: '#30205e', edge: '#ffffff', metal: '#f6f2ff' },
    deco: 'rgba(200, 220, 255, 0.55)',
    fx: { glow: 1.6, chevrons: true, teeth: true, ground: 'rgba(57, 246, 255, 0.45)', hazardGlow: 'rgba(255, 255, 255, 0.26)' },
  },
};

/** @param {string} id */
export function themeOf(id) {
  return THEMES[id] ?? /** @type {Theme} */ (THEMES.rooftops);
}
