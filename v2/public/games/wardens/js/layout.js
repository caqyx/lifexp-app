// @ts-check
// Strażnicy Doliny: where the 9 × 15 map sits on the stage, in art pixels (pixel art since
// td-2). A tile is 16 art pixels; every art pixel is k × k device pixels, k a whole
// number (crisp, even pixels), the largest that fits. Held upright the map is upright; on
// a wider stage it is turned a quarter (the road then runs left to right) — only the
// tiles' places turn, every sprite stays upright. The art canvas covers the whole stage;
// the map is centred on it and the land round it is drawn too. Pure: the page measures
// the stage, this computes the rest and maps points both ways.

import { COLS, ROWS } from './maps.js';

/** Art pixels per tile. */
export const TILE = 16;

/**
 * @typedef {{
 *   width: number, height: number, rotated: boolean, tile: number, ox: number, oy: number,
 *   mapWidth: number, mapHeight: number, k: number, dpr: number, px: number,
 * }} Layout
 * width/height, ox/oy, mapWidth/mapHeight: art pixels; k: device pixels per art pixel;
 * px: CSS pixels per art pixel.
 */

/**
 * The map's placement on a stage of `width` × `height` CSS pixels at `dpr`.
 * @param {number} width @param {number} height @param {number} [dpr] @returns {Layout}
 */
export function computeLayout(width, height, dpr = 1) {
  const rotated = width > height;
  const mapWidth = (rotated ? ROWS : COLS) * TILE;
  const mapHeight = (rotated ? COLS : ROWS) * TILE;
  const deviceWidth = Math.max(1, Math.round(width * dpr));
  const deviceHeight = Math.max(1, Math.round(height * dpr));
  const k = Math.max(1, Math.floor(Math.min(deviceWidth / mapWidth, deviceHeight / mapHeight)));
  const artWidth = Math.ceil(deviceWidth / k);
  const artHeight = Math.ceil(deviceHeight / k);
  return {
    width: artWidth,
    height: artHeight,
    rotated,
    tile: TILE,
    ox: Math.floor((artWidth - mapWidth) / 2),
    oy: Math.floor((artHeight - mapHeight) / 2),
    mapWidth,
    mapHeight,
    k,
    dpr,
    px: k / dpr,
  };
}

/**
 * A map point (tiles) on the art canvas (art pixels), written into `out`. Turned: the
 * map's top edge (where the road enters) is on the left.
 * @param {Layout} layout @param {number} x @param {number} y @param {{ x: number, y: number }} out
 */
export function toScreen(layout, x, y, out) {
  if (layout.rotated) {
    out.x = layout.ox + y * layout.tile;
    out.y = layout.oy + (COLS - x) * layout.tile;
  } else {
    out.x = layout.ox + x * layout.tile;
    out.y = layout.oy + y * layout.tile;
  }
}

/**
 * An art point back on the map (tiles), written into `out`.
 * @param {Layout} layout @param {number} sx @param {number} sy @param {{ x: number, y: number }} out
 */
export function toMap(layout, sx, sy, out) {
  if (layout.rotated) {
    out.y = (sx - layout.ox) / layout.tile;
    out.x = COLS - (sy - layout.oy) / layout.tile;
  } else {
    out.x = (sx - layout.ox) / layout.tile;
    out.y = (sy - layout.oy) / layout.tile;
  }
}

const cellPoint = { x: 0, y: 0 };

/**
 * The map cell (column, row) under an art point — also outside the map (negative or
 * beyond), where the land round it is drawn.
 * @param {Layout} layout @param {number} sx @param {number} sy @param {{ c: number, r: number }} out
 */
export function toMapCell(layout, sx, sy, out) {
  toMap(layout, sx, sy, cellPoint);
  out.c = Math.floor(cellPoint.x);
  out.r = Math.floor(cellPoint.y);
}

/**
 * The canvas transform that draws map units (tiles) on the art canvas: [a, b, c, d, e, f]
 * as `setTransform` takes them.
 * @param {Layout} layout @returns {[number, number, number, number, number, number]}
 */
export function mapTransform(layout) {
  const t = layout.tile;
  return layout.rotated ? [0, -t, t, 0, layout.ox, layout.oy + COLS * t] : [t, 0, 0, t, layout.ox, layout.oy];
}
