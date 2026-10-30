// @ts-check
// Each sector's look (docs/v2/PLAN.md 9.1, stage s-1). Owner: sky and space, all
// original art, more detail sector by sector, hazards always readable. Stage s-1: a
// daytime sky of clouds (sector 1), a storm with rain and lightning (2), the high
// atmosphere at night under an aurora (3). Stage s-2 adds orbit, deep space and the
// Demon's nebulae. The walls are sky platforms: riveted hull plates, vents and bolts, a
// lit rim; hazards keep one dark body and one bright edge per sector so they read first.

/**
 * @typedef {'day' | 'storm' | 'night'} Backdrop
 * @typedef {import('../../../_engine/render/section.js').SurfaceTheme & {
 *   sky: [string, string, string], haze: string, backdrop: Backdrop,
 *   sun: { x: number, y: number, r: number, color: string, glow: string } | null,
 *   clouds: { far: string, mid: string, near: string, shade: string, count: number },
 *   motes: { color: string, count: number } | null,
 * }} Theme
 *   sky: top, middle and horizon colours; sun: a sun or a moon (share of the width, world
 *   y, radius in cells); clouds: three layers (far, mid, near) and their underside shade;
 *   motes: floating particles (rain is the storm's own).
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

/** @param {string} id */
export function themeOf(id) {
  return THEMES[id] ?? /** @type {Theme} */ (THEMES.daySky);
}
