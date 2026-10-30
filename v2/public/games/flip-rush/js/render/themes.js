// @ts-check
// Each sector's look (docs/v2/PLAN.md 9.1, stage f-1). Owner: a mechanical factory, all
// original art, richer sector by sector, hazards always readable. Stage f-1: a bright
// hall of conveyor belts (sector 1), a mine with timbered shafts, rails and lanterns (2),
// a foundry over molten metal with pouring ladles and sparks (3). Stage f-2 adds the
// reactor and the Demon's circuits, gears, saws and chains. Hazards keep a dark body and
// one bright edge per sector, and from sector 3 the same pale halo.

/**
 * @typedef {'hall' | 'mine' | 'foundry'} Backdrop
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
};

/** @param {string} id */
export function themeOf(id) {
  return THEMES[id] ?? /** @type {Theme} */ (THEMES.hall);
}
