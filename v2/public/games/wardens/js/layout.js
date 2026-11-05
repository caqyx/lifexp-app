// @ts-check
// Strażnicy Doliny: where the 9 × 15 map sits on the stage. Held upright the map is
// upright; on a wider stage it is turned a quarter (the road then runs left to right),
// so it fills a phone held sideways and a desktop window alike. Pure: the page measures
// the stage, this computes the tile size and the turn, and maps points both ways.

import { COLS, ROWS } from './maps.js';

/** @typedef {{ width: number, height: number, rotated: boolean, tile: number, ox: number, oy: number, mapWidth: number, mapHeight: number }} Layout */

/**
 * The map's placement on a stage of `width` × `height` CSS pixels: turned when the
 * stage is wider than tall, tiles as large as fit, centred.
 * @param {number} width @param {number} height @returns {Layout}
 */
export function computeLayout(width, height) {
  const rotated = width > height;
  const across = rotated ? ROWS : COLS;
  const down = rotated ? COLS : ROWS;
  const tile = Math.max(1, Math.floor(Math.min(width / across, height / down) * 100) / 100);
  const mapWidth = tile * across;
  const mapHeight = tile * down;
  return {
    width,
    height,
    rotated,
    tile,
    ox: Math.round((width - mapWidth) / 2),
    oy: Math.round((height - mapHeight) / 2),
    mapWidth,
    mapHeight,
  };
}

/**
 * A map point (tiles) on the stage (CSS pixels), written into `out`. Turned: the map's
 * top edge (where the road enters) is on the left.
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
 * A stage point back on the map (tiles), written into `out`.
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

/**
 * The canvas transform that draws map units (tiles) on the stage: [a, b, c, d, e, f]
 * as `setTransform` takes them, before the device pixel ratio.
 * @param {Layout} layout @returns {[number, number, number, number, number, number]}
 */
export function mapTransform(layout) {
  const t = layout.tile;
  return layout.rotated ? [0, -t, t, 0, layout.ox, layout.oy + COLS * t] : [t, 0, 0, t, layout.ox, layout.oy];
}
