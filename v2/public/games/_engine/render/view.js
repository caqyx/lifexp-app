// @ts-check
// World → screen (docs/v2/PLAN.md 9.1, stage w-1). The band VIEW_TOP..VIEW_TOP+VIEW_H
// always fits the height (sideways and on a desktop); a narrow portrait screen keeps at
// least MIN_VIEW_W cells across, so the band is letterboxed and the terrain fills the
// rest. The wave sits a share of the width in from the left.
import { CAMERA_LEAD, MIN_VIEW_W, VIEW_H, VIEW_TOP } from '../world.js';

/**
 * @typedef {{ width: number, height: number, cell: number, top: number, cells: number, lead: number, ratio: number }} View
 *   width/height: the canvas in device pixels; cell: device pixels per cell; top: device y
 *   of VIEW_TOP; cells: how many cells across; lead: the wave's distance from the left edge.
 */

/**
 * @param {number} cssWidth @param {number} cssHeight @param {number} ratio device pixels per CSS pixel
 * @returns {View}
 */
export function computeView(cssWidth, cssHeight, ratio) {
  const width = Math.max(1, Math.round(cssWidth * ratio));
  const height = Math.max(1, Math.round(cssHeight * ratio));
  const cell = Math.min(height / VIEW_H, width / MIN_VIEW_W);
  const top = (height - VIEW_H * cell) / 2;
  const cells = width / cell;
  const lead = Math.min(cells * CAMERA_LEAD.share, CAMERA_LEAD.max);
  return { width, height, cell, top, cells, lead, ratio };
}

/** Device x of a world x for a camera at camX (the screen's left edge). @param {View} v @param {number} camX @param {number} x */
export const screenX = (v, camX, x) => (x - camX) * v.cell;
/** Device y of a world y. @param {View} v @param {number} y */
export const screenY = (v, y) => v.top + (y - VIEW_TOP) * v.cell;
/** The world y at the top and bottom of the canvas. @param {View} v */
export const worldYRange = (v) => ({ top: VIEW_TOP - v.top / v.cell, bottom: VIEW_TOP + (v.height - v.top) / v.cell });
