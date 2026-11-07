// @ts-check
// Strażnicy Doliny: the ground in pixel art (docs/v2/PLAN.md 9.1, td-2, more detail td-3).
// Each map has its own 16 × 16 tiles, made in code from its palette: Łąka — two tones of
// grass in patches, flowers, bushes, logs and rocks by a dirt road with curbs and wheel
// ruts; Kanion — sand and pebbles, boulders and cacti on packed earth; Mokradła — moss,
// reeds, lily pools (rippling) and dead trees by a plank causeway. Ground next to the road
// is trodden; build pads are bevelled stone slabs; props stand on the ground in a second
// pass (top to bottom, so taller ones overlap the tile above) with a shadow to the lower
// right — the light comes from the top left. The road starts at a cave and ends at the
// gate's turrets; the land round the map is wooded. Drawn twice per size (the two frames of water
// and swaying grass); the renderer swaps between them. Props are finished like the characters
// (art.js: outline and light), so the whole board has one style.

import { COLS, ROWS, roadTiles } from './maps.js';
import { PALETTE, createCanvas } from './pixelart.js';
import { toMapCell } from './layout.js';
import { build, disc, line, px as dot } from './art.js';

/** @typedef {import('./maps.js').MapDef} MapDef */
/** @typedef {import('./layout.js').Layout} Layout */
/** @typedef {import('./pixelart.js').Colour} Colour */

const T = 16;
const SHADOW = 'rgba(10, 8, 20, 0.30)';

/**
 * @typedef {{
 *   ground: [Colour, Colour, Colour], groundAlt: [Colour, Colour, Colour], worn: Colour,
 *   road: Colour, roadDark: Colour, roadLight: Colour, edge: Colour, curb: Colour,
 *   tree: [Colour, Colour, Colour], trunk: Colour, moss: Colour,
 *   props: 'meadow' | 'canyon' | 'marsh', water: boolean, planks: boolean,
 * }} Theme
 */

/** @type {Record<MapDef['id'], Theme>} */
export const THEMES = {
  meadow: {
    ground: ['f', 'E', 'F'], groundAlt: ['f', 'E', 'e'], worn: 'b',
    road: 'b', roadDark: 'S', roadLight: 'B', edge: 'n', curb: 'G',
    tree: ['e', 'E', 'f'], trunk: 'n', moss: 'E',
    props: 'meadow', water: false, planks: false,
  },
  canyon: {
    ground: ['s', 'S', 'B'], groundAlt: ['s', 'b', 'S'], worn: 'B',
    road: 'B', roadDark: 'b', roadLight: 'Y', edge: 'N', curb: 'S',
    tree: ['n', 'N', 'S'], trunk: 'n', moss: 'S',
    props: 'canyon', water: false, planks: false,
  },
  marsh: {
    ground: ['m', 'T', 'E'], groundAlt: ['m', 'E', 'T'], worn: 'n',
    road: 'N', roadDark: 'n', roadLight: 'b', edge: 'k', curb: 'n',
    tree: ['t', 'T', 'm'], trunk: 'n', moss: 'E',
    props: 'marsh', water: true, planks: true,
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

// ── Ground tiles ────────────────────────────────────────────────────────────

/**
 * Plain ground: blades, grains or moss specks in a tone (the map's two tones make patches).
 * In the second frame some blades lean the other way (the grass sways in the wind).
 * @param {[Colour, Colour, Colour]} tone @param {Theme} th @param {number} v @param {number} [frame]
 */
function groundTile(tone, th, v, frame = 0) {
  const { canvas, ctx } = createCanvas(T, T);
  px(ctx, tone[0], 0, 0, T, T);
  const blades = v >= 5 ? 34 : 18;
  for (let i = 0; i < blades; i++) {
    const x = Math.floor(noise(i, v, 1) * T);
    const y = Math.floor(noise(i, v, 2) * T);
    const c = i % 4 === 0 ? tone[2] : tone[1];
    if (th.props === 'meadow') {
      const lean = i % 3 === 0 ? (frame ? 1 : -1) : 0;
      px(ctx, c, x, y + 1, 1, 1);
      px(ctx, i % 4 === 0 ? tone[2] : c, x + lean, y);
    } else if (th.props === 'canyon') px(ctx, c, x, y, i % 5 === 0 ? 2 : 1, 1);
    else px(ctx, c, x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
  }
  if (th.props === 'meadow' && v < 5) {
    // A few flowers in the grass.
    for (let i = 0; i < 2 + (v % 2) * 2; i++) {
      const x = 2 + Math.floor(noise(i, v, 6) * 12);
      const y = 2 + Math.floor(noise(i, v, 7) * 12);
      px(ctx, i % 3 === 0 ? 'y' : i % 3 === 1 ? 'P' : 'w', x, y);
    }
  }
  return canvas;
}

/** A pool of water, two frames of ripples, with a lily pad (Mokradła). @param {Theme} th @param {number} frame */
function waterTile(th, frame) {
  const { canvas, ctx } = createCanvas(T, T);
  ctx.drawImage(groundTile(th.ground, th, 0, frame), 0, 0);
  disc(ctx, 'e', 8, 8, 7.5, 5.5);
  disc(ctx, 't', 8, 8, 6.5, 4.5);
  disc(ctx, 'T', 8, 7, 5.5, 3.5);
  const shift = frame * 2;
  px(ctx, 'c', 4 + shift, 6, 3, 1);
  px(ctx, 'C', 9 - shift, 9, 2, 1);
  disc(ctx, 'E', 11, 9, 2, 1.2);
  px(ctx, 'f', 10, 8, 2, 1);
  px(ctx, 'P', 11, 8);
  return canvas;
}

/** A build pad: a bevelled stone slab with a carved mark, a crack and a little moss. @param {Theme} th */
function padTile(th) {
  const { canvas, ctx } = createCanvas(T, T);
  ctx.fillStyle = SHADOW;
  ctx.fillRect(3, 4, 13, 12);
  px(ctx, 'k', 1, 1, 14, 14);
  px(ctx, 'g', 2, 2, 12, 12);
  px(ctx, 'G', 2, 2, 12, 1);
  px(ctx, 'G', 2, 2, 1, 11);
  px(ctx, 'K', 3, 13, 11, 1);
  px(ctx, 'K', 13, 3, 1, 11);
  px(ctx, 'K', 5, 5, 6, 1);
  px(ctx, 'K', 5, 5, 1, 6);
  px(ctx, 'G', 6, 10, 5, 1);
  px(ctx, 'G', 10, 6, 1, 5);
  px(ctx, 'K', 4, 9, 1, 2);
  px(ctx, 'K', 5, 11, 1, 1);
  px(ctx, th.moss, 12, 11, 1, 2);
  px(ctx, th.moss, 3, 12, 2, 1);
  for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) px(ctx, 'G', x ?? 0, y ?? 0);
  return canvas;
}

/** The valley's gate where the road leaves the map: a stone turret with a banner. */
function turretTile() {
  return build(T, T, (ctx) => {
    dot(ctx, 'g', 2, 4, 12, 11);
    for (let x = 2; x < 14; x += 4) dot(ctx, 'g', x, 1, 3, 3);
    for (let y = 6; y < 15; y += 3) dot(ctx, 'K', 2, y, 12, 1);
    dot(ctx, 'k', 7, 7, 2, 3);
    dot(ctx, 'R', 9, 9, 3, 4);
    dot(ctx, 'y', 10, 10);
  });
}

/** The cave the road comes out of: a dark arch in rock. */
function caveTile() {
  return build(T, T, (ctx) => {
    dot(ctx, 'g', 0, 0, T, T);
    dot(ctx, 'K', 0, 0, T, 3);
    disc(ctx, 'k', 8, 12, 6, 8);
    dot(ctx, 'G', 2, 2, 3, 1);
    dot(ctx, 'G', 11, 3, 3, 1);
  });
}

// ── Props ───────────────────────────────────────────────────────────────────

/**
 * Props for a map, finished with outline and light: a list of pictures to stand on tiles.
 * @param {Theme} th
 */
function createProps(th) {
  /** @type {HTMLCanvasElement[]} */
  const list = [];
  if (th.props === 'meadow') {
    // A dark leafy bush with white blossom (darker than any slime, so they never mix up).
    list.push(build(14, 11, (ctx) => {
      disc(ctx, 'e', 7, 6, 6, 4);
      disc(ctx, 'E', 6, 5, 4, 2.5);
      dot(ctx, 'e', 4, 5);
      dot(ctx, 'e', 8, 6);
      dot(ctx, 'w', 4, 4);
      dot(ctx, 'w', 9, 5);
      dot(ctx, 'y', 7, 8);
    }));
    // A fallen log.
    list.push(build(15, 7, (ctx) => {
      dot(ctx, 'N', 1, 2, 12, 4);
      dot(ctx, 'n', 1, 5, 12, 1);
      disc(ctx, 'b', 12, 3.5, 1.5, 2);
      dot(ctx, 'N', 12, 3);
      dot(ctx, 'E', 5, 1, 2, 1);
    }));
    // A mossy rock.
    list.push(build(12, 9, (ctx) => {
      disc(ctx, 'g', 6, 5, 5, 3.5);
      dot(ctx, 'E', 3, 2, 3, 1);
      dot(ctx, 'K', 4, 6, 5, 1);
    }));
    // A bit of fence.
    list.push(build(16, 10, (ctx) => {
      dot(ctx, 'N', 2, 1, 2, 9);
      dot(ctx, 'N', 12, 1, 2, 9);
      dot(ctx, 'b', 1, 3, 14, 2);
      dot(ctx, 'b', 1, 6, 14, 2);
    }));
  } else if (th.props === 'canyon') {
    // A boulder.
    list.push(build(15, 11, (ctx) => {
      disc(ctx, 'N', 7, 6, 6, 4);
      disc(ctx, 'S', 6, 5, 4, 3);
      dot(ctx, 'n', 5, 8, 6, 1);
      dot(ctx, 'n', 8, 3, 1, 3);
    }));
    // A tall cactus.
    list.push(build(11, 16, (ctx) => {
      dot(ctx, 'E', 4, 1, 3, 14);
      dot(ctx, 'E', 1, 5, 2, 4);
      dot(ctx, 'E', 8, 4, 2, 5);
      dot(ctx, 'E', 1, 8, 3, 1);
      dot(ctx, 'E', 7, 8, 2, 1);
      dot(ctx, 'f', 5, 2, 1, 11);
      dot(ctx, 'P', 5, 0);
    }));
    // Pebbles.
    list.push(build(12, 7, (ctx) => {
      disc(ctx, 'g', 3, 3, 2, 1.5);
      disc(ctx, 'S', 8, 4, 2.5, 1.8);
      disc(ctx, 'G', 6, 2, 1, 1);
    }));
    // A dry bush.
    list.push(build(13, 9, (ctx) => {
      for (let i = 0; i < 5; i++) line(ctx, 'N', 6, 8, 2 + i * 2, 1 + (i % 2) * 2);
      dot(ctx, 'S', 2, 7, 9, 1);
    }));
    // An old skull.
    list.push(build(10, 8, (ctx) => {
      disc(ctx, 'w', 5, 3.5, 3.5, 3);
      dot(ctx, 'k', 3, 3, 2, 2);
      dot(ctx, 'k', 6, 3, 2, 2);
      dot(ctx, 'G', 3, 6, 5, 1);
    }));
  } else {
    // A dead tree.
    list.push(build(14, 18, (ctx) => {
      line(ctx, 'n', 7, 17, 7, 4, 2);
      line(ctx, 'n', 7, 9, 2, 4);
      line(ctx, 'n', 7, 7, 12, 2);
      line(ctx, 'n', 7, 12, 11, 9);
      dot(ctx, 'E', 3, 5, 2, 1);
    }));
    // Reeds.
    list.push(build(12, 13, (ctx) => {
      for (let i = 0; i < 5; i++) {
        line(ctx, 'e', 2 + i * 2, 12, 2 + i * 2 + (i % 2), 3 + (i % 3));
        dot(ctx, 'n', 2 + i * 2 + (i % 2), 2 + (i % 3), 1, 2);
      }
    }));
    // A stump with moss.
    list.push(build(12, 9, (ctx) => {
      dot(ctx, 'N', 2, 2, 8, 6);
      disc(ctx, 'b', 6, 2, 4, 1.5);
      dot(ctx, 'n', 5, 2, 2, 1);
      dot(ctx, 'E', 2, 6, 3, 2);
    }));
    // A mossy stone.
    list.push(build(12, 8, (ctx) => {
      disc(ctx, 'g', 6, 4, 5, 3);
      dot(ctx, 'E', 3, 1, 5, 2);
    }));
  }
  return list;
}

/** A tree for the land round the map: a big round crown on a trunk. @param {Theme} th @param {number} v */
function treeProp(th, v) {
  return build(20, 24, (ctx) => {
    dot(ctx, th.trunk, 8, 15, 4, 8);
    disc(ctx, th.tree[0], 10, 10, 9, 8);
    disc(ctx, th.tree[1], 9, 9, 7, 6);
    disc(ctx, th.tree[2], 7 + (v % 2), 6, 3, 2);
  });
}

/** @param {MapDef} map */
export function createTileset(map) {
  const th = THEMES[map.id];
  return {
    theme: th,
    ground: [0, 1].map((f) => [0, 1, 2].map((v) => groundTile(th.ground, th, v, f))),
    groundAlt: [0, 1].map((f) => [0, 1, 2].map((v) => groundTile(th.groundAlt, th, v + 5, f))),
    water: [0, 1].map((f) => waterTile(th, f)),
    pad: padTile(th),
    props: createProps(th),
    trees: [0, 1].map((v) => treeProp(th, v)),
    turret: turretTile(),
    cave: caveTile(),
    shadows: new Map(),
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
 * A road tile at (x, y) on the art: packed earth (or planks) with wheel ruts along its way,
 * and on each side with no road a curb — an edge line, a row of curb stones and a worn
 * line inside; corners where two curbs meet are rounded.
 * @param {CanvasRenderingContext2D} ctx @param {Theme} th @param {number} x @param {number} y
 * @param {{ n: boolean, e: boolean, s: boolean, w: boolean }} open sides that continue as road
 * @param {number} seed
 */
function drawRoad(ctx, th, x, y, open, seed) {
  px(ctx, th.road, x, y, T, T);
  if (th.planks) {
    const along = open.n || open.s;
    for (let i = 0; i < T; i += 4) {
      if (along) px(ctx, th.roadDark, x, y + i, T, 1);
      else px(ctx, th.roadDark, x + i, y, 1, T);
    }
    for (let i = 2; i < T; i += 4) {
      if (along) {
        px(ctx, 'k', x + 2, y + i, 1, 1);
        px(ctx, 'k', x + T - 3, y + i, 1, 1);
      } else {
        px(ctx, 'k', x + i, y + 2, 1, 1);
        px(ctx, 'k', x + i, y + T - 3, 1, 1);
      }
    }
  } else {
    for (let i = 0; i < 10; i++) {
      px(ctx, i % 3 ? th.roadDark : th.roadLight, x + Math.floor(noise(seed, i, 8) * 14) + 1, y + Math.floor(noise(seed, i, 9) * 14) + 1);
    }
    // Wheel ruts along the road's way.
    if (open.n || open.s) {
      px(ctx, th.roadDark, x + 4, y + (open.n ? 0 : 4), 1, open.n && open.s ? T : T - 4);
      px(ctx, th.roadDark, x + 11, y + (open.n ? 0 : 4), 1, open.n && open.s ? T : T - 4);
    }
    if (open.w || open.e) {
      px(ctx, th.roadDark, x + (open.w ? 0 : 4), y + 4, open.w && open.e ? T : T - 4, 1);
      px(ctx, th.roadDark, x + (open.w ? 0 : 4), y + 11, open.w && open.e ? T : T - 4, 1);
    }
  }
  if (!open.n) curb(ctx, th, x, y, T, 1, 0, 1, seed);
  if (!open.s) curb(ctx, th, x, y + T - 1, T, 1, 0, -1, seed + 3);
  if (!open.w) curb(ctx, th, x, y, 1, T, 1, 0, seed + 5);
  if (!open.e) curb(ctx, th, x + T - 1, y, 1, T, -1, 0, seed + 7);
  // Rounded outer corners: where two curbs meet, the corner pixel is ground-dark.
  if (!open.n && !open.w) px(ctx, th.edge, x + 1, y + 1);
  if (!open.n && !open.e) px(ctx, th.edge, x + T - 2, y + 1);
  if (!open.s && !open.w) px(ctx, th.edge, x + 1, y + T - 2);
  if (!open.s && !open.e) px(ctx, th.edge, x + T - 2, y + T - 2);
}

/**
 * One curb: the edge line, curb stones every few pixels a step in, and a worn line.
 * @param {CanvasRenderingContext2D} ctx @param {Theme} th @param {number} x @param {number} y
 * @param {number} w @param {number} h @param {number} ix @param {number} iy @param {number} seed
 */
function curb(ctx, th, x, y, w, h, ix, iy, seed) {
  px(ctx, th.edge, x, y, w, h);
  const len = Math.max(w, h);
  for (let i = 0; i < len; i += 3) {
    if (noise(seed, i, 4) < 0.25) continue;
    const cx = w > 1 ? x + i : x + ix;
    const cy = h > 1 ? y + i : y + iy;
    px(ctx, th.curb, cx, cy, w > 1 ? 2 : 1, h > 1 ? 2 : 1);
  }
  px(ctx, th.roadDark, x + ix * 2, y + iy * 2, w, h);
}

// ── The whole ground ────────────────────────────────────────────────────────

/**
 * Draws the ground of a map onto an art-sized canvas for a layout (upright or turned):
 * tiles first, then props top to bottom with their shadows, then the gate and the cave,
 * then the land round the map shaded.
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
  /** @type {{ x: number, y: number, img: HTMLCanvasElement }[]} */
  const standing = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = sx0 + i * T;
      const y = sy0 + j * T;
      toMapCell(layout, x + T / 2, y + T / 2, cell);
      const { c, r } = cell;
      const key = `${c},${r}`;
      const inside = c >= 0 && c < COLS && r >= 0 && r < ROWS;
      if (road.has(key)) {
        drawRoad(ctx, th, x, y, { n: isRoadAt(x, y - T), s: isRoadAt(x, y + T), w: isRoadAt(x - T, y), e: isRoadAt(x + T, y) }, i * 7 + j * 13);
        continue;
      }
      const patch = noise(Math.floor(c / 2), Math.floor(r / 2), 21) > 0.55;
      const set = (patch ? tiles.groundAlt : tiles.ground)[frame % 2] ?? [];
      const base = set[Math.floor(noise(c, r, 12) * 3)] ?? tiles.pad;
      ctx.drawImage(base, x, y);
      trodden(ctx, th, x, y, { n: isRoadAt(x, y - T), s: isRoadAt(x, y + T), w: isRoadAt(x - T, y), e: isRoadAt(x + T, y) }, c * 31 + r);
      const n = noise(c, r, 11);
      if (!inside) {
        if (n > 0.45) standing.push({ x: x - 2, y: y - 9, img: tiles.trees[n > 0.75 ? 1 : 0] ?? tiles.pad });
        continue;
      }
      if (pads.has(key)) ctx.drawImage(tiles.pad, x, y);
      else if (th.water && n > 0.84) ctx.drawImage(tiles.water[frame % 2] ?? tiles.pad, x, y);
      else if (n > 0.76 && !besideRoad(road, c, r)) {
        const img = tiles.props[Math.floor(noise(c, r, 13) * tiles.props.length)] ?? tiles.pad;
        standing.push({ x: x + Math.round((T - img.width) / 2) + Math.round((noise(c, r, 14) - 0.5) * 3), y: y + T - 2 - img.height, img });
      }
    }
  }
  standing.sort((a, b) => a.y + a.img.height - (b.y + b.img.height));
  for (const s of standing) {
    drawShadow(ctx, tiles, s.x + 2, s.y + s.img.height - 2, s.img.width);
    ctx.drawImage(s.img, s.x, s.y);
  }
  renderGateAndCave(ctx, layout, map, tiles);
  renderMapShade(ctx, layout);
}

/**
 * Whether a cell touches the road (props keep off it, so nothing on the verge looks like an
 * enemy walking by). @param {Set<string>} road @param {number} c @param {number} r
 */
function besideRoad(road, c, r) {
  return road.has(`${c - 1},${r}`) || road.has(`${c + 1},${r}`) || road.has(`${c},${r - 1}`) || road.has(`${c},${r + 1}`);
}

/**
 * Ground beside the road is trodden: a darker band and specks of road on the road's side.
 * @param {CanvasRenderingContext2D} ctx @param {Theme} th @param {number} x @param {number} y
 * @param {{ n: boolean, e: boolean, s: boolean, w: boolean }} road @param {number} seed
 */
function trodden(ctx, th, x, y, road, seed) {
  for (let i = 0; i < T; i++) {
    const a = noise(seed, i, 2) < 0.5;
    const b = noise(seed, i, 3) < 0.3;
    if (road.n) {
      if (a) px(ctx, th.worn, x + i, y);
      if (b) px(ctx, th.worn, x + i, y + 1);
    }
    if (road.s) {
      if (a) px(ctx, th.worn, x + i, y + T - 1);
      if (b) px(ctx, th.worn, x + i, y + T - 2);
    }
    if (road.w) {
      if (a) px(ctx, th.worn, x, y + i);
      if (b) px(ctx, th.worn, x + 1, y + i);
    }
    if (road.e) {
      if (a) px(ctx, th.worn, x + T - 1, y + i);
      if (b) px(ctx, th.worn, x + T - 2, y + i);
    }
  }
}

/**
 * A soft oval shadow to the lower right of something standing (light from the top left).
 * @param {CanvasRenderingContext2D} ctx @param {Tileset} tiles @param {number} x @param {number} foot @param {number} w
 */
function drawShadow(ctx, tiles, x, foot, w) {
  let img = tiles.shadows.get(w);
  if (!img) {
    const h = Math.max(3, Math.round(w / 3));
    const c = createCanvas(w, h);
    c.ctx.fillStyle = SHADOW;
    for (let yy = 0; yy < h; yy++) {
      const half = Math.round((w / 2) * Math.sqrt(1 - ((yy - (h - 1) / 2) / (h / 2)) ** 2));
      c.ctx.fillRect(Math.round(w / 2 - half), yy, half * 2, 1);
    }
    img = c.canvas;
    tiles.shadows.set(w, img);
  }
  ctx.drawImage(img, x, foot - Math.floor(img.height / 2));
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
    drawShadow(ctx, tiles, at.x + 3, at.y + T - 1, 14);
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
