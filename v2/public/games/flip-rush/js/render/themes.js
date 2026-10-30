// @ts-check
// Each sector's look (docs/v2/PLAN.md 9.1, stage f-1). Owner: a mechanical factory, all
// original art, richer sector by sector, hazards always readable. Stage f-1: a bright
// hall of conveyor belts (sector 1), a mine with timbered shafts, rails and lanterns (2),
// a foundry over molten metal with pouring ladles and sparks (3). Stage f-2 adds the
// reactor and the Demon's circuits, gears, saws and chains. Hazards keep a dark body and
// one bright edge per sector, and from sector 3 the same pale halo. Stage f-2: a turbine
// hall at the reactor (4), the reactor's deep core (5), and the Demon's machine — glowing
// circuits (Easy, blue), gears (Hard, violet), saws and chains (Insane, red), all of it at
// once in black, red and white (Extreme, the richest); its sections also get the
// engine's ornament (chains, gears, frames), denser tier by tier.

/**
 * @typedef {'hall' | 'mine' | 'foundry' | 'reactor' | 'core' | 'circuits' | 'gears' | 'saws' | 'overdrive' | 'heart'} Backdrop
 * @typedef {import('../../../_engine/render/section.js').SurfaceTheme & {
 *   wall: [string, string, string], haze: string, backdrop: Backdrop,
 *   far: string, mid: string, near: string, light: string,
 *   motes: { color: string, count: number } | null,
 * }} Theme
 *   wall: the back wall's top, middle and bottom colours; far / mid / near: the colours of
 *   the background's layers (girders and windows, machines, close beams); light: lamps,
 *   lanterns, glow; motes: dust or sparks.
 */

/** @type {Record<string, Theme>} */
export const THEMES = {
  // Sector 1 "Łatwy": a bright hall — big windows, girders, conveyor belts with crates;
  // steel floors with yellow and black edges.
  hall: {
    id: 'hall',
    wall: ['#9fb6cf', '#c9d6e3', '#e6edf3'],
    haze: 'rgba(255, 255, 255, 0.35)',
    backdrop: 'hall',
    far: 'rgba(90, 110, 140, 0.35)',
    mid: 'rgba(70, 86, 110, 0.55)',
    near: 'rgba(40, 52, 70, 0.32)',
    light: 'rgba(255, 248, 220, 0.75)',
    motes: null,
    pattern: 'plates',
    emblem: 'vent',
    block: { top: '#5d6f86', bottom: '#2a3546', tile: 'rgba(255, 255, 255, 0.18)', shade: 'rgba(0, 0, 0, 0.35)', rim: '#f2c14e', edge: '#ffffff', glow: 'rgba(255, 210, 90, 0.3)', detail: 'rgba(242, 193, 78, 0.85)' },
    hazard: { fill: '#1b1f27', inner: '#566173', edge: '#ffffff', metal: '#e6ebf2' },
    deco: 'rgba(60, 70, 90, 0.6)',
  },
  // Sector 2 "Normalny": a mine — rock, timber props, rails with carts, lanterns; stone
  // walls with gems.
  mine: {
    id: 'mine',
    wall: ['#0f0b09', '#2a1e16', '#3e2c20'],
    haze: 'rgba(255, 190, 110, 0.14)',
    backdrop: 'mine',
    far: 'rgba(120, 88, 62, 0.55)',
    mid: 'rgba(120, 84, 50, 0.9)',
    near: 'rgba(30, 20, 14, 0.7)',
    light: 'rgba(255, 196, 110, 0.9)',
    motes: { color: '#d8b98c', count: 18 },
    pattern: 'bricks',
    emblem: 'diamond',
    block: { top: '#5a4636', bottom: '#241912', tile: 'rgba(255, 220, 180, 0.13)', shade: 'rgba(0, 0, 0, 0.45)', rim: '#8a6a4c', edge: '#ffd9a0', glow: 'rgba(255, 190, 110, 0.3)', detail: 'rgba(120, 220, 255, 0.75)' },
    hazard: { fill: '#120c08', inner: '#5a4636', edge: '#fff1dc', metal: '#efe2cf' },
    deco: 'rgba(255, 210, 150, 0.5)',
    fx: { glow: 0.35, chevrons: false, teeth: false, ground: null, hazardGlow: null },
  },
  // Sector 3 "Trudny": a foundry — molten metal below, ladles pouring, chains and sparks;
  // iron plates with a glowing edge and a burning floor.
  foundry: {
    id: 'foundry',
    wall: ['#070405', '#1e0d08', '#4a1a0a'],
    haze: 'rgba(255, 110, 40, 0.22)',
    backdrop: 'foundry',
    far: 'rgba(60, 26, 18, 0.85)',
    mid: 'rgba(36, 18, 14, 0.95)',
    near: 'rgba(14, 8, 6, 0.8)',
    light: 'rgba(255, 140, 50, 0.95)',
    motes: { color: '#ffb35c', count: 30 },
    pattern: 'plates',
    emblem: 'bolt',
    block: { top: '#3a2a26', bottom: '#120a08', tile: 'rgba(255, 200, 160, 0.12)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#7a3a1e', edge: '#ffd0a0', glow: 'rgba(255, 110, 40, 0.42)', detail: 'rgba(255, 150, 70, 0.7)' },
    hazard: { fill: '#0a0605', inner: '#5a3020', edge: '#ffffff', metal: '#f4e6dc' },
    deco: 'rgba(255, 170, 110, 0.55)',
    fx: { glow: 0.8, chevrons: true, teeth: false, ground: 'rgba(255, 120, 40, 0.5)', hazardGlow: 'rgba(255, 255, 255, 0.18)' },
  },
  // Sector 4 "Trudniejszy": the turbine hall by the reactor — turbines, pipes with valves,
  // blinking warning lights; teal steel with a green glow.
  reactor: {
    id: 'reactor',
    wall: ['#04100f', '#0b2423', '#123a36'],
    haze: 'rgba(80, 255, 200, 0.14)',
    backdrop: 'reactor',
    far: 'rgba(40, 90, 84, 0.7)',
    mid: 'rgba(28, 64, 60, 0.92)',
    near: 'rgba(10, 26, 24, 0.85)',
    light: 'rgba(110, 255, 200, 0.85)',
    motes: { color: '#8cffd8', count: 34 },
    pattern: 'panels',
    emblem: 'porthole',
    block: { top: '#1f4a45', bottom: '#081816', tile: 'rgba(180, 255, 230, 0.12)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#2f7a6e', edge: '#b8ffe8', glow: 'rgba(80, 255, 200, 0.4)', detail: 'rgba(110, 255, 200, 0.7)' },
    hazard: { fill: '#030a09', inner: '#24504a', edge: '#ffffff', metal: '#e4fff6' },
    deco: 'rgba(130, 255, 210, 0.5)',
    fx: { glow: 1, chevrons: true, teeth: false, ground: 'rgba(80, 255, 200, 0.35)', hazardGlow: 'rgba(255, 255, 255, 0.18)' },
  },
  // Sector 5 "Insane": the reactor's core — fuel rods in blue light, containment rings, the
  // core pulsing far below.
  core: {
    id: 'core',
    wall: ['#01030c', '#06123a', '#0c2a6e'],
    haze: 'rgba(80, 160, 255, 0.22)',
    backdrop: 'core',
    far: 'rgba(40, 80, 170, 0.6)',
    mid: 'rgba(20, 40, 100, 0.9)',
    near: 'rgba(4, 10, 30, 0.85)',
    light: 'rgba(120, 200, 255, 0.95)',
    motes: { color: '#9fd4ff', count: 44 },
    pattern: 'panels',
    emblem: 'eye',
    block: { top: '#1c2a5a', bottom: '#060a1e', tile: 'rgba(170, 210, 255, 0.12)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#2e4a9a', edge: '#cfe6ff', glow: 'rgba(90, 170, 255, 0.5)', detail: 'rgba(130, 200, 255, 0.75)' },
    hazard: { fill: '#02040c', inner: '#24346a', edge: '#ffffff', metal: '#e6f0ff' },
    deco: 'rgba(150, 210, 255, 0.5)',
    fx: { glow: 1.2, chevrons: true, teeth: true, ground: 'rgba(90, 170, 255, 0.4)', hazardGlow: 'rgba(255, 255, 255, 0.2)' },
  },
  // The Demon, Easy: glowing circuits — traces with pulses running along them (blue).
  circuits: {
    id: 'circuits',
    wall: ['#010512', '#041232', '#082456'],
    haze: 'rgba(60, 140, 255, 0.2)',
    backdrop: 'circuits',
    far: 'rgba(50, 120, 255, 0.45)',
    mid: 'rgba(30, 70, 160, 0.9)',
    near: 'rgba(6, 14, 40, 0.85)',
    light: 'rgba(110, 190, 255, 0.95)',
    motes: { color: '#7fc0ff', count: 50 },
    pattern: 'plates',
    emblem: 'bolt',
    block: { top: '#132a5c', bottom: '#040a1c', tile: 'rgba(140, 200, 255, 0.14)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#2a56b8', edge: '#d6ecff', glow: 'rgba(70, 150, 255, 0.55)', detail: 'rgba(110, 190, 255, 0.8)' },
    hazard: { fill: '#01030a', inner: '#203c80', edge: '#ffffff', metal: '#eaf4ff' },
    deco: 'rgba(120, 190, 255, 0.5)',
    fx: { glow: 1.3, chevrons: true, teeth: true, ground: 'rgba(70, 150, 255, 0.4)', hazardGlow: 'rgba(255, 255, 255, 0.22)' },
  },
  // The Demon, Hard: gears turning behind circuits (violet).
  gears: {
    id: 'gears',
    wall: ['#07020f', '#1a0a33', '#2e1260'],
    haze: 'rgba(170, 100, 255, 0.22)',
    backdrop: 'gears',
    far: 'rgba(130, 80, 230, 0.45)',
    mid: 'rgba(80, 40, 150, 0.9)',
    near: 'rgba(18, 8, 36, 0.85)',
    light: 'rgba(200, 150, 255, 0.95)',
    motes: { color: '#cfa8ff', count: 56 },
    pattern: 'plates',
    emblem: 'star',
    block: { top: '#2c1658', bottom: '#0a0418', tile: 'rgba(210, 180, 255, 0.14)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#6a3ac0', edge: '#f0e2ff', glow: 'rgba(170, 100, 255, 0.55)', detail: 'rgba(200, 150, 255, 0.8)' },
    hazard: { fill: '#04020a', inner: '#3e2478', edge: '#ffffff', metal: '#f4ecff' },
    deco: 'rgba(200, 160, 255, 0.5)',
    fx: { glow: 1.4, chevrons: true, teeth: true, ground: 'rgba(170, 100, 255, 0.42)', hazardGlow: 'rgba(255, 255, 255, 0.22)' },
  },
  // The Demon, Insane: saws spinning on arms and chains swinging, over gears (red).
  saws: {
    id: 'saws',
    wall: ['#0d0102', '#2e0408', '#580a10'],
    haze: 'rgba(255, 60, 60, 0.22)',
    backdrop: 'saws',
    far: 'rgba(220, 60, 60, 0.4)',
    mid: 'rgba(120, 20, 26, 0.9)',
    near: 'rgba(30, 4, 6, 0.85)',
    light: 'rgba(255, 120, 110, 0.95)',
    motes: { color: '#ff9a8a', count: 64 },
    pattern: 'plates',
    emblem: 'diamond',
    block: { top: '#4a0e14', bottom: '#120204', tile: 'rgba(255, 190, 180, 0.14)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#a8202c', edge: '#ffe2de', glow: 'rgba(255, 70, 70, 0.55)', detail: 'rgba(255, 130, 120, 0.8)' },
    hazard: { fill: '#060102', inner: '#5a141c', edge: '#ffffff', metal: '#fff0ee' },
    deco: 'rgba(255, 150, 140, 0.5)',
    fx: { glow: 1.5, chevrons: true, teeth: true, ground: 'rgba(255, 70, 70, 0.45)', hazardGlow: 'rgba(255, 255, 255, 0.24)' },
  },
  // The Demon, Extreme: the whole machine at once — red circuits, gears, saws and chains on
  // black, white sparks; the richest.
  overdrive: {
    id: 'overdrive',
    wall: ['#000000', '#120204', '#2a0306'],
    haze: 'rgba(255, 30, 40, 0.24)',
    backdrop: 'overdrive',
    far: 'rgba(230, 40, 50, 0.45)',
    mid: 'rgba(90, 10, 14, 0.95)',
    near: 'rgba(0, 0, 0, 0.9)',
    light: 'rgba(255, 255, 255, 0.95)',
    motes: { color: '#ffffff', count: 80 },
    pattern: 'plates',
    emblem: 'eye',
    block: { top: '#1a1a1e', bottom: '#000000', tile: 'rgba(255, 255, 255, 0.12)', shade: 'rgba(0, 0, 0, 0.6)', rim: '#d0202e', edge: '#ffffff', glow: 'rgba(255, 40, 50, 0.6)', detail: 'rgba(255, 60, 70, 0.85)' },
    hazard: { fill: '#000000', inner: '#3a0a0e', edge: '#ffffff', metal: '#ffffff' },
    deco: 'rgba(255, 90, 100, 0.55)',
    fx: { glow: 1.7, chevrons: true, teeth: true, ground: 'rgba(255, 40, 50, 0.5)', hazardGlow: 'rgba(255, 255, 255, 0.28)' },
  },
  // The finale "Serce Fabryki": the machine's heart — a great flywheel, pistons pumping to
  // the beat, gold light on black and crimson.
  heart: {
    id: 'heart',
    wall: ['#050203', '#1c0608', '#3a0c0a'],
    haze: 'rgba(255, 190, 80, 0.24)',
    backdrop: 'heart',
    far: 'rgba(255, 190, 90, 0.35)',
    mid: 'rgba(110, 30, 24, 0.92)',
    near: 'rgba(14, 4, 4, 0.9)',
    light: 'rgba(255, 210, 120, 0.95)',
    motes: { color: '#ffd27a', count: 70 },
    pattern: 'plates',
    emblem: 'star',
    block: { top: '#2a1410', bottom: '#080202', tile: 'rgba(255, 220, 160, 0.14)', shade: 'rgba(0, 0, 0, 0.55)', rim: '#c8902a', edge: '#fff2d0', glow: 'rgba(255, 190, 80, 0.55)', detail: 'rgba(255, 200, 100, 0.85)' },
    hazard: { fill: '#040101', inner: '#4a1a12', edge: '#ffffff', metal: '#fff6e6' },
    deco: 'rgba(255, 210, 130, 0.55)',
    fx: { glow: 1.6, chevrons: true, teeth: true, ground: 'rgba(255, 190, 80, 0.45)', hazardGlow: 'rgba(255, 255, 255, 0.26)' },
  },
};

/** @param {string} id */
export function themeOf(id) {
  return THEMES[id] ?? /** @type {Theme} */ (THEMES.hall);
}
