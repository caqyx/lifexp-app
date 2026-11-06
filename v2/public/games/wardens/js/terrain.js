// @ts-check
// Strażnicy Doliny: the ground in pixel art (docs/v2/PLAN.md 9.1, td-2). Each map has its
// own 16 × 16 tiles, made in code from its palette: Łąka — grass, flowers and a dirt road;
// Kanion — sand, stones and cacti on packed earth; Mokradła — moss, reeds and pools of
// water (animated) with a plank causeway. The road is laid tile by tile with edges where
// it meets the ground (worked out on the screen, so a turned board joins up too), the
// build pads are stone slabs, the road starts at a cave and ends at the valley's gate,
// and the space round the map is filled with the same land and trees. Drawn onto the
// ground canvas once, and again only when the water's frame changes.

import { COLS, ROWS, roadTiles } from './maps.js';
import { PALETTE, createCanvas } from './pixelart.js';
import { toMapCell } from './layout.js';

/** @typedef {import('./maps.js').MapDef} MapDef */
/** @typedef {import('./layout.js').Layout} Layout */
/** @typedef {import('./pixelart.js').Colour} Colour */

const T = 16;

/**
 * @typedef {{
 *   ground: [Colour, Colour, Colour], detail: Colour, detailLight: Colour,
 *   road: Colour, roadDark: Colour, roadLight: Colour, edge: Colour,
 *   outside: Colour, outsideDark: Colour, tree: [Colour, Colour, Colour], trunk: Colour,
 *   deco: 'flowers' | 'stones' | 'reeds', water: boolean, planks: boolean,
 * }} Theme
 */

/** @type {Record<MapDef['id'], Theme>} */
export const THEMES = {
  meadow: {
    ground: ['f', 'E', 'F'], detail: 'E', detailLight: 'F',
    road: 'b', roadDark: 'S', roadLight: 'B', edge: 'n',
    outside: 'E', outsideDark: 'e', tree: ['e', 'E', 'f'], trunk: 'n',
    deco: 'flowers', water: false, planks: false,
  },
  canyon: {
    ground: ['s', 'S', 'b'], detail: 'S', detailLight: 'B',
    road: 'B', roadDark: 'b', roadLight: 'Y', edge: 'N',
    outside: 'N', outsideDark: 'n', tree: ['e', 'E', 'f'], trunk: 'n',
    deco: 'stones', water: false, planks: false,
  },
  marsh: {
    ground: ['m', 'T', 'E'], detail: 'e', detailLight: 'F',
    road: 'N', roadDark: 'n', roadLight: 'b', edge: 'k',
    outside: 'T', outsideDark: 't', tree: ['t', 'T', 'm'], trunk: 'n',
    deco: 'reeds', water: true, planks: true,
  },
};

/** A stable number in [0, 1) for a cell and a salt (the ground is the same every visit). */
export function noise(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ salt) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** @param {CanvasRenderingContext2D} ctx @param {Colour} c @param {number} x @param {number} y @param {number} [w] @param {number} [h] */
function px(ctx, c, x, y, w = 1, h = 1) {
  ctx.fillStyle = PALETTE[c];
  ctx.fillRect(x, y, w, h);
}

// ── Tiles ───────────────────────────────────────────────────────────────────

/** Plain ground with blades, grains or moss specks; three variants. @param {Theme} th @param {number} v */
function groundTile(th, v) {
  const { canvas, ctx } = createCanvas(T, T);
  px(ctx, th.ground[0], 0, 0, T, T);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(noise(i, v, 1) * T);
    const y = Math.floor(noise(i, v, 2) * T);
    px(ctx, i % 3 === 0 ? th.ground[2] : th.ground[1], x, y);
    if (th.deco === 'flowers' && i % 2 === 0) px(ctx, th.ground[1], x, Math.min(T - 1, y + 1));
  }
  return canvas;
}

/** A decoration on ground: flowers, stones or reeds. @param {Theme} th @param {number} v */
function decoTile(th, v) {
  const { canvas, ctx } = createCanvas(T, T);
  ctx.drawImage(groundTile(th, v), 0, 0);
  const x = 4 + Math.floor(noise(v, 7, 3) * 6);
  const y = 4 + Math.floor(noise(v, 7, 4) * 6);
  if (th.deco === 'flowers') {
    const petal = /** @type {Colour[]} */ (['y', 'P', 'w', 'R'])[v % 4] ?? 'y';
    for (const [dx, dy] of [[0, 0], [5, 3], [2, 6]]) {
      px(ctx, 'E', x + (dx ?? 0), y + (dy ?? 0) + 1, 1, 2);
      px(ctx, petal, x + (dx ?? 0) - 1, y + (dy ?? 0), 3, 1);
      px(ctx, petal, x + (dx ?? 0), y + (dy ?? 0) - 1, 1, 3);
      px(ctx, 'Y', x + (dx ?? 0), y + (dy ?? 0));
    }
  } else if (th.deco === 'stones') {
    if (v % 3 === 2) {
      // A small cactus.
      px(ctx, 'e', x + 2, y, 3, 8);
      px(ctx, 'E', x + 3, y, 1, 7);
      px(ctx, 'e', x, y + 2, 2, 3);
      px(ctx, 'e', x + 5, y + 3, 2, 3);
      px(ctx, 'S', x + 1, y + 8, 5, 1);
    } else {
      px(ctx, 'n', x, y + 3, 6, 2);
      px(ctx, 'g', x, y + 1, 6, 2);
      px(ctx, 'G', x + 1, y, 4, 1);
      px(ctx, 'g', x + 7, y + 4, 3, 2);
      px(ctx, 'G', x + 7, y + 4, 2, 1);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const rx = x + i * 2;
      const h = 5 + Math.floor(noise(v, i, 5) * 4);
      px(ctx, 'e', rx, y + 8 - h, 1, h);
      px(ctx, 'n', rx, y + 8 - h - 1, 1, 2);
    }
  }
  return canvas;
}

/** A pool of water, two frames of ripples (Mokradła): an uneven puddle, not a square. @param {Theme} th @param {number} frame */
function waterTile(th, frame) {
  const { canvas, ctx } = createCanvas(T, T);
  ctx.drawImage(groundTile(th, 0), 0, 0);
  const rows = [
    '................',
    '................',
    '.....eeeeee.....',
    '...eettttttee...',
    '..ettTTTTTTttte.',
    '.ettTTTTTTTTTTte',
    '.etTTTTTTTTTTTte',
    '.etTTTTTTTTTTte.',
    '..etTTTTTTTTte..',
    '..ettTTTTTTtte..',
    '...eettttttee...',
    '.....eeeeee.....',
    '................',
    '................',
    '................',
    '................',
  ];
  rows.forEach((row, y) => {
    for (let x = 0; x < T; x++) {
      const ch = row[x];
      if (ch && ch !== '.') px(ctx, /** @type {Colour} */ (ch), x, y);
    }
  });
  const shift = frame * 2;
  px(ctx, 'c', 5 + shift, 6, 3, 1);
  px(ctx, 'C', 9 - shift, 8, 2, 1);
  px(ctx, 'c', 4 + shift, 9, 2, 1);
  px(ctx, 'F', 12, 4, 1, 1);
  return canvas;
}

/** A build pad: a stone slab with a bevel and a mark. */
function padTile() {
  const { canvas, ctx } = createCanvas(T, T);
  px(ctx, 'k', 1, 2, 14, 13);
  px(ctx, 'g', 2, 3, 12, 11);
  px(ctx, 'G', 2, 3, 12, 1);
  px(ctx, 'G', 2, 3, 1, 10);
  px(ctx, 'K', 3, 13, 11, 1);
  px(ctx, 'K', 13, 4, 1, 10);
  px(ctx, 'G', 7, 6, 2, 6);
  px(ctx, 'G', 5, 8, 6, 2);
  return canvas;
}

/** A tree for the land round the map: a round, shaded crown on a trunk. @param {Theme} th @param {number} v */
function treeTile(th, v) {
  const { canvas, ctx } = createCanvas(T, T);
  ctx.drawImage(groundTile(th, v), 0, 0);
  const rows = [
    '.....kkkkk......',
    '...kkcccbbkk....',
    '..kcccbbbbbbk...',
    '.kccbbbbbbbbak..',
    '.kcbbbbbbbbbak..',
    'kcbbbbbbbbbbaak.',
    'kbbbbbbbbbbaaak.',
    'kbbbbbbbbbaaaak.',
    '.kbbbbbbbaaaak..',
    '..kkaaaaaaakk...',
    '....kkdddkk.....',
    '......kdk.......',
    '......kdk.......',
    '.....kkdkk......',
    '................',
    '................',
  ];
  /** @type {Record<string, Colour>} */
  const colours = { k: 'k', a: th.tree[0], b: th.tree[1], c: th.tree[2], d: th.trunk };
  rows.forEach((row, y) => {
    for (let x = 0; x < T; x++) {
      const colour = colours[row[x] ?? '.'];
      if (colour) px(ctx, colour, x + (v % 2), y + 1);
    }
  });
  return canvas;
}

/** The valley's gate where the road leaves the map: a stone turret. */
function turretTile() {
  const { canvas, ctx } = createCanvas(T, T);
  px(ctx, 'k', 2, 1, 12, 15);
  px(ctx, 'g', 3, 4, 10, 11);
  px(ctx, 'G', 3, 4, 10, 1);
  for (let x = 3; x < 13; x += 3) px(ctx, 'g', x, 2, 2, 2);
  px(ctx, 'K', 3, 9, 10, 1);
  px(ctx, 'k', 7, 6, 2, 3);
  px(ctx, 'R', 6, 0, 1, 1);
  return canvas;
}

/** The cave the road comes out of. */
function caveTile() {
  const { canvas, ctx } = createCanvas(T, T);
  px(ctx, 'K', 0, 0, T, T);
  px(ctx, 'g', 0, 0, T, 3);
  px(ctx, 'k', 3, 4, 10, 12);
  px(ctx, 'k', 4, 3, 8, 1);
  px(ctx, 'G', 1, 1, 3, 1);
  px(ctx, 'G', 10, 2, 4, 1);
  return canvas;
}

/** @param {MapDef} map */
export function createTileset(map) {
  const th = THEMES[map.id];
  return {
    theme: th,
    ground: [0, 1, 2].map((v) => groundTile(th, v)),
    deco: [0, 1, 2, 3, 4, 5].map((v) => decoTile(th, v)),
    water: [0, 1].map((f) => waterTile(th, f)),
    pad: padTile(),
    trees: [0, 1].map((v) => treeTile(th, v)),
    turret: turretTile(),
    cave: caveTile(),
  };
}

/** @typedef {ReturnType<typeof createTileset>} Tileset */

// ── The road ────────────────────────────────────────────────────────────────

/**
 * Every road cell, the map's road plus its lead-in above the top and its way out below
 * the bottom (they run on to the canvas's edge), as "col,row".
 * @param {MapDef} map
 */
export function roadCells(map) {
  const cells = roadTiles(map);
  const first = map.road[0];
  const last = map.road[map.road.length - 1];
  for (let k = 1; k <= 40; k++) {
    if (first) cells.add(`${Math.round(first[0])},${-k}`);
    if (last) cells.add(`${Math.round(last[0])},${ROWS - 1 + k}`);
  }
  return cells;
}

/**
 * A road tile at screen tile (sx, sy) with an edge on each screen side that has no road.
 * @param {CanvasRenderingContext2D} ctx @param {Theme} th @param {number} x @param {number} y
 * @param {{ n: boolean, e: boolean, s: boolean, w: boolean }} open sides that continue as road
 * @param {number} seed
 */
function drawRoad(ctx, th, x, y, open, seed) {
  px(ctx, th.road, x, y, T, T);
  if (th.planks) {
    for (let i = 0; i < T; i += 4) px(ctx, th.roadDark, x, y + i, T, 1);
    for (let i = 0; i < T; i += 4) px(ctx, th.roadDark, x + ((i * 5 + seed) % T), y + i, 1, 4);
  } else {
    for (let i = 0; i < 6; i++) {
      px(ctx, i % 2 ? th.roadDark : th.roadLight, x + Math.floor(noise(seed, i, 8) * 14) + 1, y + Math.floor(noise(seed, i, 9) * 14) + 1);
    }
  }
  if (!open.n) {
    px(ctx, th.edge, x, y, T, 1);
    px(ctx, th.roadDark, x, y + 1, T, 1);
  }
  if (!open.s) {
    px(ctx, th.roadDark, x, y + T - 2, T, 1);
    px(ctx, th.edge, x, y + T - 1, T, 1);
  }
  if (!open.w) {
    px(ctx, th.edge, x, y, 1, T);
    px(ctx, th.roadDark, x + 1, y, 1, T);
  }
  if (!open.e) {
    px(ctx, th.roadDark, x + T - 2, y, 1, T);
    px(ctx, th.edge, x + T - 1, y, 1, T);
  }
}

// ── The whole ground ────────────────────────────────────────────────────────

/**
 * Draws the ground of a map onto an art-sized canvas for a layout (upright or turned).
 * @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {MapDef} map
 * @param {Tileset} tiles @param {number} frame the water's frame
 */
export function renderTerrain(ctx, layout, map, tiles, frame) {
  const th = tiles.theme;
  const road = roadCells(map);
  const pads = new Set(map.pads.map(([c, r]) => `${c},${r}`));
  const cell = { c: 0, r: 0 };
  const cols = Math.ceil(layout.width / T) + 2;
  const rows = Math.ceil(layout.height / T) + 2;
  const sx0 = ((layout.ox % T) + T) % T - T;
  const sy0 = ((layout.oy % T) + T) % T - T;
  /** @param {number} sx @param {number} sy */
  const isRoadAt = (sx, sy) => {
    toMapCell(layout, sx + T / 2, sy + T / 2, cell);
    return road.has(`${cell.c},${cell.r}`);
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = sx0 + i * T;
      const y = sy0 + j * T;
      toMapCell(layout, x + T / 2, y + T / 2, cell);
      const key = `${cell.c},${cell.r}`;
      const inside = cell.c >= 0 && cell.c < COLS && cell.r >= 0 && cell.r < ROWS;
      if (road.has(key)) {
        drawRoad(ctx, th, x, y, { n: isRoadAt(x, y - T), s: isRoadAt(x, y + T), w: isRoadAt(x - T, y), e: isRoadAt(x + T, y) }, i * 7 + j * 13);
        continue;
      }
      const n = noise(cell.c, cell.r, 11);
      const base = tiles.ground[Math.floor(noise(cell.c, cell.r, 12) * 3)] ?? tiles.ground[0];
      if (!inside) {
        ctx.drawImage((n > 0.55 ? tiles.trees[n > 0.8 ? 1 : 0] : base) ?? tiles.pad, x, y);
        continue;
      }
      if (pads.has(key)) {
        if (base) ctx.drawImage(base, x, y);
        ctx.drawImage(tiles.pad, x, y);
      } else if (th.water && n > 0.86) ctx.drawImage(tiles.water[frame % 2] ?? tiles.water[0] ?? tiles.pad, x, y);
      else if (n > 0.6) ctx.drawImage(tiles.deco[Math.floor(n * 97) % tiles.deco.length] ?? tiles.pad, x, y);
      else if (base) ctx.drawImage(base, x, y);
    }
  }
  renderGateAndCave(ctx, layout, map, tiles);
  renderMapShade(ctx, layout);
}

/**
 * The cave where the road comes in and a turret each side of where it leaves (beside it
 * on the screen: left and right upright, above and below on a turned board).
 * @param {CanvasRenderingContext2D} ctx @param {Layout} layout @param {MapDef} map @param {Tileset} tiles
 */
function renderGateAndCave(ctx, layout, map, tiles) {
  const first = map.road[0];
  const last = map.road[map.road.length - 1];
  if (!first || !last) return;
  const at = { x: 0, y: 0 };
  tileOrigin(layout, Math.round(first[0]), -1, at);
  ctx.drawImage(tiles.cave, at.x, at.y);
  const exit = Math.round(last[0]);
  for (const side of [-1, 1]) {
    tileOrigin(layout, exit + side, ROWS - 1, at);
    ctx.drawImage(tiles.turret, at.x, at.y);
  }
}

/**
 * The art position of a map cell's top-left corner on the screen.
 * @param {Layout} layout @param {number} c @param {number} r @param {{ x: number, y: number }} out
 */
export function tileOrigin(layout, c, r, out) {
  if (layout.rotated) {
    out.x = layout.ox + r * T;
    out.y = layout.oy + (COLS - 1 - c) * T;
  } else {
    out.x = layout.ox + c * T;
    out.y = layout.oy + r * T;
  }
}

/** The land round the map a shade darker, so the playing field stands out. @param {CanvasRenderingContext2D} ctx @param {Layout} layout */
function renderMapShade(ctx, layout) {
  ctx.fillStyle = 'rgba(10, 8, 20, 0.35)';
  ctx.fillRect(0, 0, layout.width, layout.oy);
  ctx.fillRect(0, layout.oy + layout.mapHeight, layout.width, layout.height - layout.oy - layout.mapHeight);
  ctx.fillRect(0, layout.oy, layout.ox, layout.mapHeight);
  ctx.fillRect(layout.ox + layout.mapWidth, layout.oy, layout.width - layout.ox - layout.mapWidth, layout.mapHeight);
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(layout.ox - 1, layout.oy - 1, layout.mapWidth + 2, 1);
  ctx.fillRect(layout.ox - 1, layout.oy + layout.mapHeight, layout.mapWidth + 2, 1);
  ctx.fillRect(layout.ox - 1, layout.oy, 1, layout.mapHeight);
  ctx.fillRect(layout.ox + layout.mapWidth, layout.oy, 1, layout.mapHeight);
}
