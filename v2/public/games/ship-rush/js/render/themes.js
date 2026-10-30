// @ts-check
// Each sector's look (docs/v2/PLAN.md 9.1, stage s-1). Owner: sky and space, all
// original art, more detail sector by sector, hazards always readable. Stage s-1: a
// daytime sky of clouds (sector 1), a storm with rain and lightning (2), the high
// atmosphere at night under an aurora (3). Stage s-2: orbit over Earth's curve with
// satellites (4), deep space with galaxies and a ringed planet (5), and the Demon's
// nebulae — blue, violet, crimson with burning asteroids, and the Extreme's black, red and
// white, the richest. The walls are sky platforms and station hulls: riveted plates,
// vents, bolts, eyes, a lit rim, a glowing outline from sector 3 on. Hazards keep one dark
// body, one bright edge and (from sector 3) the same pale halo, so they read first among
// ever denser deco, which stays dimmer than they are.

/**
 * @typedef {'day' | 'storm' | 'night' | 'space'} Backdrop
 * @typedef {{
 *   stars: number, haze: string[], galaxies: number,
 *   earth: boolean, satellites: number,
 *   planet: { x: number, y: number, r: number, body: [string, string], ring: string } | null,
 *   asteroids: number, structures: number, rays: string | null, blackHole?: boolean,
 * }} Space
 *   The far layer of space (painted once per look and size): `stars` in it, nebula `haze`
 *   blobs in these colours, spiral `galaxies`; Earth's curve below, `satellites` passing;
 *   a ringed `planet` (share of the width, world y, radius in cells); burning `asteroids`
 *   streaking past; glowing outlined `structures` far behind; light `rays`; a `blackHole`
 *   with its glowing disc (the finale).
 * @typedef {import('../../../_engine/render/section.js').SurfaceTheme & {
 *   sky: [string, string, string], haze: string, backdrop: Backdrop,
 *   sun: { x: number, y: number, r: number, color: string, glow: string } | null,
 *   clouds: { far: string, mid: string, near: string, shade: string, count: number } | null,
 *   motes: { color: string, count: number } | null,
 *   space?: Space,
 * }} Theme
 *   sky: top, middle and horizon colours; sun: a sun or a moon (share of the width, world
 *   y, radius in cells); clouds: three layers (far, mid, near) and their underside shade;
 *   motes: floating particles (rain is the storm's own); space: the far layer in space.
 */

/** @type {Record<string, Theme>} */
export const THEMES = {
  // Sector 1 "Łatwy": a bright day among the clouds — steel-blue platforms with gold rivets.
  daySky: {
    id: 'daySky',
    sky: ['#2f86d6', '#6fb8ee', '#d7efff'],
    haze: 'rgba(255, 255, 255, 0.35)',
    backdrop: 'day',
    sun: { x: 0.78, y: 1.6, r: 1.5, color: '#fff6d8', glow: 'rgba(255, 240, 190, 0.55)' },
    clouds: { far: 'rgba(255, 255, 255, 0.55)', mid: 'rgba(255, 255, 255, 0.85)', near: 'rgba(255, 255, 255, 0.95)', shade: 'rgba(120, 160, 205, 0.45)', count: 7 },
    motes: null,
    pattern: 'plates',
    emblem: 'vent',
    block: { top: '#4f7fb8', bottom: '#1f3c63', tile: 'rgba(255, 255, 255, 0.2)', shade: 'rgba(8, 20, 40, 0.38)', rim: '#86b6ea', edge: '#ffffff', glow: 'rgba(255, 255, 255, 0.32)', detail: 'rgba(255, 222, 140, 0.75)' },
    hazard: { fill: '#18202e', inner: '#4b5d7e', edge: '#ffffff', metal: '#e2eaf6' },
    deco: 'rgba(255, 255, 255, 0.7)',
  },
  // Sector 2 "Normalny": a storm — dark clouds, rain, lightning; slate plates with yellow bolts.
  storm: {
    id: 'storm',
    sky: ['#0d121c', '#253042', '#4a5872'],
    haze: 'rgba(170, 190, 230, 0.16)',
    backdrop: 'storm',
    sun: null,
    clouds: { far: 'rgba(60, 72, 96, 0.85)', mid: 'rgba(42, 52, 72, 0.92)', near: 'rgba(28, 34, 48, 0.95)', shade: 'rgba(8, 10, 18, 0.5)', count: 9 },
    motes: null,
    pattern: 'plates',
    emblem: 'bolt',
    block: { top: '#3c4657', bottom: '#171c25', tile: 'rgba(220, 230, 255, 0.14)', shade: 'rgba(0, 0, 0, 0.42)', rim: '#5d6a80', edge: '#ffd84a', glow: 'rgba(255, 216, 74, 0.28)', detail: 'rgba(255, 216, 74, 0.7)' },
    hazard: { fill: '#0b0e14', inner: '#3b4352', edge: '#f6f8ff', metal: '#d9dee8' },
    deco: 'rgba(255, 216, 74, 0.6)',
    fx: { glow: 0.35, chevrons: false, teeth: false, ground: null, hazardGlow: null },
  },
  // Sector 3 "Trudny": the high atmosphere at night — stars, an aurora, the glow of the
  // horizon far below; dark ice walls with teal light.
  aurora: {
    id: 'aurora',
    sky: ['#01030c', '#051a2c', '#0d3f52'],
    haze: 'rgba(90, 255, 210, 0.12)',
    backdrop: 'night',
    sun: { x: 0.22, y: 1.2, r: 0.9, color: '#f1f6ff', glow: 'rgba(200, 225, 255, 0.35)' },
    clouds: { far: 'rgba(30, 70, 90, 0.35)', mid: 'rgba(20, 50, 70, 0.5)', near: 'rgba(10, 30, 45, 0.6)', shade: 'rgba(0, 0, 0, 0.4)', count: 5 },
    motes: { color: '#b8fff0', count: 22 },
    pattern: 'tiles',
    emblem: 'star',
    block: { top: '#123744', bottom: '#04121a', tile: 'rgba(160, 255, 230, 0.13)', shade: 'rgba(0, 0, 0, 0.45)', rim: '#1f6068', edge: '#a8ffe4', glow: 'rgba(90, 255, 210, 0.36)', detail: 'rgba(170, 255, 230, 0.55)' },
    hazard: { fill: '#030d10', inner: '#1e4c50', edge: '#ffffff', metal: '#dcf7f1' },
    deco: 'rgba(170, 255, 230, 0.6)',
    fx: { glow: 0.8, chevrons: true, teeth: false, ground: 'rgba(120, 255, 220, 0.4)', hazardGlow: 'rgba(255, 255, 255, 0.16)' },
  },
};

/** @param {Theme} th @returns {Theme} */
function withBlackHole(th) {
  return { ...th, space: { .../** @type {Space} */ (th.space), blackHole: true } };
}

/**
 * The Demon's looks share their structure; only colours and the far layer change.
 * @param {{ id: string, sky: [string, string, string], haze: string, stars: number, blobs: string[], galaxies: number, asteroids: number,
 *   structures: number, rays: string | null, wall: [string, string, string], edge: string, glow: string, detail: string, inner: string,
 *   motes: string, glowStrength: number, ground: string }} d
 * @returns {Theme}
 */
function demon(d) {
  return {
    id: d.id,
    sky: d.sky,
    haze: d.haze,
    backdrop: 'space',
    sun: null,
    clouds: null,
    motes: { color: d.motes, count: 34 },
    space: { stars: d.stars, haze: d.blobs, galaxies: d.galaxies, earth: false, satellites: 0, planet: null, asteroids: d.asteroids, structures: d.structures, rays: d.rays },
    pattern: 'tiles',
    emblem: 'eye',
    block: { top: d.wall[0], bottom: d.wall[1], tile: 'rgba(255, 255, 255, 0.11)', shade: 'rgba(0, 0, 0, 0.55)', rim: d.wall[2], edge: d.edge, glow: d.glow, detail: d.detail },
    hazard: { fill: '#000000', inner: d.inner, edge: '#ffffff', metal: '#f4f4f8' },
    deco: d.detail,
    fx: { glow: d.glowStrength, chevrons: true, teeth: true, ground: d.ground, hazardGlow: 'rgba(255, 255, 255, 0.3)' },
  };
}

Object.assign(THEMES, {
  // Sector 4 "Trudniejszy": in orbit — black sky, Earth's curve below, satellites with
  // solar panels; white station hulls with portholes and amber trim.
  orbit: {
    id: 'orbit',
    sky: ['#000308', '#030b1c', '#0b2a55'],
    haze: 'rgba(90, 160, 255, 0.12)',
    backdrop: 'space',
    sun: { x: 0.86, y: 0.6, r: 0.7, color: '#ffffff', glow: 'rgba(255, 250, 230, 0.5)' },
    clouds: null,
    motes: null,
    space: { stars: 140, haze: [], galaxies: 0, earth: true, satellites: 3, planet: null, asteroids: 0, structures: 0, rays: null },
    pattern: 'panels',
    emblem: 'porthole',
    block: { top: '#4a5a70', bottom: '#151d29', tile: 'rgba(230, 240, 255, 0.16)', shade: 'rgba(0, 0, 0, 0.42)', rim: '#8ea4c2', edge: '#eef5ff', glow: 'rgba(150, 200, 255, 0.4)', detail: 'rgba(255, 190, 90, 0.75)' },
    hazard: { fill: '#0b0f16', inner: '#47546a', edge: '#ffffff', metal: '#e6eef8' },
    deco: 'rgba(255, 200, 120, 0.5)',
    fx: { glow: 0.9, chevrons: false, teeth: false, ground: null, hazardGlow: 'rgba(255, 255, 255, 0.2)' },
  },
  // Sector 5 "Insane": deep space — galaxies, a ringed planet, violet hulls with teeth.
  deepSpace: {
    id: 'deepSpace',
    sky: ['#020108', '#0a0620', '#1a0f3a'],
    haze: 'rgba(160, 120, 255, 0.12)',
    backdrop: 'space',
    sun: null,
    clouds: null,
    motes: { color: '#d8c8ff', count: 26 },
    space: {
      stars: 220,
      haze: ['rgba(120, 80, 220, 0.18)', 'rgba(60, 120, 220, 0.14)'],
      galaxies: 3,
      earth: false,
      satellites: 0,
      planet: { x: 0.74, y: 3.4, r: 2.4, body: ['#e6b86a', '#7a3d1e'], ring: 'rgba(255, 225, 170, 0.75)' },
      asteroids: 0,
      structures: 0,
      rays: null,
    },
    pattern: 'plates',
    emblem: 'star',
    block: { top: '#2c2150', bottom: '#09061a', tile: 'rgba(210, 190, 255, 0.13)', shade: 'rgba(0, 0, 0, 0.5)', rim: '#5d4ba0', edge: '#e2d4ff', glow: 'rgba(170, 130, 255, 0.42)', detail: 'rgba(205, 180, 255, 0.6)' },
    hazard: { fill: '#05030c', inner: '#463a78', edge: '#ffffff', metal: '#efe8ff' },
    deco: 'rgba(205, 180, 255, 0.5)',
    fx: { glow: 1, chevrons: true, teeth: true, ground: 'rgba(170, 130, 255, 0.4)', hazardGlow: 'rgba(255, 255, 255, 0.24)' },
  },
  // Demon, Easy: a blue nebula.
  nebulaBlue: demon({
    id: 'nebulaBlue', sky: ['#00030c', '#021034', '#06215e'], haze: 'rgba(60, 140, 255, 0.18)', stars: 260,
    blobs: ['rgba(40, 120, 255, 0.26)', 'rgba(80, 200, 255, 0.18)', 'rgba(30, 60, 200, 0.22)'], galaxies: 1, asteroids: 0, structures: 3, rays: null,
    wall: ['#0b2350', '#020818', '#1f4fa0'], edge: '#cfe8ff', glow: 'rgba(80, 170, 255, 0.5)', detail: 'rgba(150, 210, 255, 0.55)', inner: '#1d3f80',
    motes: '#9fd8ff', glowStrength: 1.1, ground: 'rgba(120, 210, 255, 0.5)',
  }),
  // Demon, Hard: a violet nebula.
  nebulaViolet: demon({
    id: 'nebulaViolet', sky: ['#05010e', '#16063a', '#2e0b5e'], haze: 'rgba(190, 100, 255, 0.18)', stars: 280,
    blobs: ['rgba(170, 70, 255, 0.28)', 'rgba(255, 110, 220, 0.16)', 'rgba(90, 40, 200, 0.24)'], galaxies: 1, asteroids: 0, structures: 4, rays: null,
    wall: ['#26104e', '#080214', '#5126a0'], edge: '#efd8ff', glow: 'rgba(190, 110, 255, 0.52)', detail: 'rgba(220, 170, 255, 0.55)', inner: '#4a2380',
    motes: '#e6c8ff', glowStrength: 1.2, ground: 'rgba(200, 140, 255, 0.5)',
  }),
  // Demon, Insane: crimson, with burning asteroids.
  nebulaCrimson: demon({
    id: 'nebulaCrimson', sky: ['#070002', '#2a0410', '#4a0a18'], haze: 'rgba(255, 60, 60, 0.2)', stars: 280,
    blobs: ['rgba(255, 40, 60, 0.26)', 'rgba(255, 120, 40, 0.16)', 'rgba(160, 10, 40, 0.28)'], galaxies: 0, asteroids: 5, structures: 4, rays: null,
    wall: ['#3c0a16', '#0e0104', '#86182c'], edge: '#ffd6d9', glow: 'rgba(255, 60, 80, 0.55)', detail: 'rgba(255, 160, 165, 0.55)', inner: '#6a1020',
    motes: '#ffb08a', glowStrength: 1.3, ground: 'rgba(255, 90, 90, 0.5)',
  }),
  // Demon, Extreme: black, red and white — the richest.
  nebulaExtreme: demon({
    id: 'nebulaExtreme', sky: ['#000000', '#080004', '#1c0208'], haze: 'rgba(255, 30, 50, 0.22)', stars: 340,
    blobs: ['rgba(255, 20, 40, 0.24)', 'rgba(255, 255, 255, 0.08)', 'rgba(120, 0, 20, 0.3)'], galaxies: 0, asteroids: 3, structures: 7, rays: 'rgba(255, 40, 70, 0.07)',
    wall: ['#1a0308', '#010000', '#a0102a'], edge: '#ffffff', glow: 'rgba(255, 30, 60, 0.62)', detail: 'rgba(255, 255, 255, 0.55)', inner: '#7a0a1e',
    motes: '#ffffff', glowStrength: 1.5, ground: 'rgba(255, 40, 70, 0.6)',
  }),
  // The finale "Horyzont Zdarzeń": a black hole and its burning disc, gold and white on black.
  eventHorizon: withBlackHole(
    demon({
      id: 'eventHorizon', sky: ['#000000', '#07040a', '#160a06'], haze: 'rgba(255, 170, 80, 0.16)', stars: 320,
      blobs: ['rgba(255, 140, 40, 0.16)', 'rgba(255, 255, 255, 0.06)', 'rgba(120, 60, 200, 0.14)'], galaxies: 1, asteroids: 0, structures: 5, rays: null,
      wall: ['#1e1408', '#020100', '#9a6a20'], edge: '#fff4d6', glow: 'rgba(255, 180, 70, 0.6)', detail: 'rgba(255, 225, 160, 0.55)', inner: '#6a4a14',
      motes: '#ffe6a8', glowStrength: 1.5, ground: 'rgba(255, 190, 80, 0.55)',
    }),
  ),
});

/** @param {string} id */
export function themeOf(id) {
  return THEMES[id] ?? /** @type {Theme} */ (THEMES.daySky);
}
