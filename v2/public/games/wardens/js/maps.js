// @ts-check
// Strażnicy Doliny: the three maps of the campaign and the geometry of their roads.
// A map is a 9 × 15 grid of tiles held upright (a phone held sideways shows it turned,
// js/layout.js); the road is a polyline through tile centres, from above the top edge to
// below the bottom one, and towers stand only on the map's build pads.

export const COLS = 9;
export const ROWS = 15;

/**
 * @typedef {{
 *   id: 'meadow' | 'canyon' | 'marsh',
 *   waves: number,
 *   hpFactor: number,
 *   startGold: number,
 *   theme: { ground: string, groundAlt: string, road: string, roadEdge: string, pad: string, deco: string },
 *   road: readonly (readonly [number, number])[],
 *   pads: readonly (readonly [number, number])[],
 *   endless?: boolean,
 * }} MapDef
 */

/**
 * Road corners as tile columns and rows (their centres); the first one sits above the
 * grid and the last one below it, so enemies walk in and out of view.
 * @type {readonly MapDef[]}
 */
export const MAPS = [
  {
    id: 'meadow',
    waves: 15,
    hpFactor: 0.85,
    startGold: 130,
    theme: { ground: '#2f5d3a', groundAlt: '#356842', road: '#c9a46a', roadEdge: '#a8834d', pad: '#24452c', deco: '#7fbf6a' },
    road: [[4, -1.2], [4, 3], [1, 3], [1, 7], [7, 7], [7, 11], [4, 11], [4, 15.2]],
    pads: [[3, 1], [5, 2], [2, 2], [0, 5], [2, 5], [4, 6], [6, 6], [2, 8], [5, 8], [8, 9], [6, 10], [3, 12], [5, 12], [5, 4]],
  },
  {
    id: 'canyon',
    waves: 18,
    hpFactor: 1.12,
    startGold: 140,
    theme: { ground: '#6e4a2f', groundAlt: '#7a5536', road: '#d8b48a', roadEdge: '#b48e63', pad: '#523621', deco: '#e0a35f' },
    road: [[1, -1.2], [1, 2], [7, 2], [7, 5], [1, 5], [1, 9], [7, 9], [7, 12], [3, 12], [3, 15.2]],
    pads: [[0, 1], [2, 1], [4, 3], [6, 1], [8, 3], [5, 4], [3, 6], [6, 6], [0, 7], [2, 8], [5, 8], [8, 10], [6, 11], [4, 13], [2, 13], [4, 10]],
  },
  {
    id: 'marsh',
    waves: 20,
    hpFactor: 1.3,
    startGold: 150,
    endless: true,
    theme: { ground: '#1f4a4f', groundAlt: '#24555a', road: '#9fb59a', roadEdge: '#7c9479', pad: '#163639', deco: '#6fd1c0' },
    road: [[7, -1.2], [7, 4], [2, 4], [2, 9], [6, 9], [6, 12], [4, 12], [4, 15.2]],
    pads: [[6, 2], [8, 3], [5, 3], [3, 5], [1, 5], [3, 6], [1, 7], [3, 8], [5, 8], [7, 10], [5, 10], [5, 11], [3, 13], [5, 13]],
  },
];

/**
 * The road measured: its corners in tile units (centres), each segment's length and the
 * distance at which it starts.
 * @typedef {{ xs: Float64Array, ys: Float64Array, starts: Float64Array, lengths: Float64Array, total: number }} Path
 */

/** @param {MapDef} map @returns {Path} */
export function createPath(map) {
  const n = map.road.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  map.road.forEach(([c, r], i) => {
    xs[i] = c + 0.5;
    ys[i] = r + 0.5;
  });
  const starts = new Float64Array(n - 1);
  const lengths = new Float64Array(n - 1);
  let total = 0;
  for (let i = 0; i < n - 1; i++) {
    const len = Math.hypot((xs[i + 1] ?? 0) - (xs[i] ?? 0), (ys[i + 1] ?? 0) - (ys[i] ?? 0));
    starts[i] = total;
    lengths[i] = len;
    total += len;
  }
  return { xs, ys, starts, lengths, total };
}

/**
 * Writes the point `dist` tiles along the road into `out` (no allocation: called for
 * every enemy every step).
 * @param {Path} path @param {number} dist @param {{ x: number, y: number }} out
 */
export function pointAt(path, dist, out) {
  const last = path.lengths.length - 1;
  let i = 0;
  while (i < last && dist >= (path.starts[i + 1] ?? Infinity)) i++;
  const len = path.lengths[i] ?? 1;
  const t = Math.min(1, Math.max(0, (dist - (path.starts[i] ?? 0)) / len));
  const x0 = path.xs[i] ?? 0;
  const y0 = path.ys[i] ?? 0;
  out.x = x0 + ((path.xs[i + 1] ?? x0) - x0) * t;
  out.y = y0 + ((path.ys[i + 1] ?? y0) - y0) * t;
}

/**
 * Every tile the road passes through, as "col,row" (pads may never be on one).
 * @param {MapDef} map @returns {Set<string>}
 */
export function roadTiles(map) {
  const tiles = new Set();
  for (let i = 0; i < map.road.length - 1; i++) {
    const [c0, r0] = /** @type {readonly [number, number]} */ (map.road[i]);
    const [c1, r1] = /** @type {readonly [number, number]} */ (map.road[i + 1]);
    const steps = Math.ceil(Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 4);
    for (let s = 0; s <= steps; s++) {
      const c = Math.round(c0 + ((c1 - c0) * s) / steps);
      const r = Math.round(r0 + ((r1 - r0) * s) / steps);
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) tiles.add(`${c},${r}`);
    }
  }
  return tiles;
}

/**
 * The shortest distance from a point to the road, in tiles.
 * @param {Path} path @param {number} x @param {number} y
 */
export function distanceToRoad(path, x, y) {
  let best = Infinity;
  for (let i = 0; i < path.lengths.length; i++) {
    const ax = path.xs[i] ?? 0;
    const ay = path.ys[i] ?? 0;
    const bx = path.xs[i + 1] ?? 0;
    const by = path.ys[i + 1] ?? 0;
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
    best = Math.min(best, Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)));
  }
  return best;
}
