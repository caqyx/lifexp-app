// @ts-check
// Flappy Bird's pixel art (docs/v2/PLAN.md 9.1, q-own): our own sprites, written here as
// rows of letters (one letter = one pixel, "." = clear) and turned into small canvases
// once per palette. No image files and nothing copied: the bird, the pipes, the skyline
// and the digits are drawn for LifeXP. Four palettes (dawn, day, dusk, night) give each
// run its own time of day; every one has the same few roles, so the art stays one style.

/** World units per art pixel: the 640-tall world is 256 pixels tall. */
export const PIXEL = 2.5;
export const ART_HEIGHT = 256;

/**
 * @typedef {{
 *   name: 'dawn' | 'day' | 'dusk' | 'night',
 *   sky: readonly string[],
 *   far: string, farLight: string,
 *   cloud: string, cloudShade: string,
 *   near: string, nearLight: string,
 *   pipe: readonly [string, string, string, string],
 *   grass: string, grassLight: string, grassDark: string,
 *   dirt: string, dirtStripe: string,
 *   stars: boolean,
 *   text: string, textShade: string,
 * }} Palette
 */

/** @type {readonly Palette[]} */
export const PALETTES = [
  {
    name: 'dawn',
    sky: ['#3b3a78', '#5d4f9c', '#9a6fb5', '#e08fa8', '#ffb59a', '#ffd3a6'],
    far: '#7c5c9e', farLight: '#9b7bbb',
    cloud: '#ffe3d1', cloudShade: '#f2b8b0',
    near: '#4a6b6e', nearLight: '#5f8a83',
    pipe: ['#1f3f3a', '#2f7a68', '#4fb39a', '#9be3c9'],
    grass: '#5fbf7a', grassLight: '#a6e8a4', grassDark: '#3a8a5c',
    dirt: '#6b4a5e', dirtStripe: '#7f5a6e',
    stars: false,
    text: '#ffffff', textShade: '#2a1a2e',
  },
  {
    name: 'day',
    sky: ['#3f8fd6', '#55a3e0', '#6db6e8', '#8ac8ee', '#a8d8f2', '#c9e8f6'],
    far: '#8ab4c9', farLight: '#a6c8d8',
    cloud: '#ffffff', cloudShade: '#d6ecf7',
    near: '#3f8a5a', nearLight: '#5aa86c',
    pipe: ['#1e2a5a', '#3a4fb0', '#5f74e8', '#a9b6ff'],
    grass: '#6cc75a', grassLight: '#b2ec8a', grassDark: '#3f9a46',
    dirt: '#b98a56', dirtStripe: '#cf9f66',
    stars: false,
    text: '#ffffff', textShade: '#1e2a5a',
  },
  {
    name: 'dusk',
    sky: ['#2a2350', '#4a2f6a', '#7a3f74', '#b5546e', '#e0725e', '#f4a259'],
    far: '#5a2f5e', farLight: '#7a4278',
    cloud: '#f7b48a', cloudShade: '#d9836e',
    near: '#33264a', nearLight: '#4a3560',
    pipe: ['#3a1424', '#8a2f3f', '#d0545a', '#ffa08a'],
    grass: '#c98a4a', grassLight: '#f2c27a', grassDark: '#8f5a34',
    dirt: '#4a2f3a', dirtStripe: '#5c3a47',
    stars: true,
    text: '#fff1d6', textShade: '#2a1424',
  },
  {
    name: 'night',
    sky: ['#0b0c1a', '#11132a', '#171a3a', '#1f1f4d', '#29265f', '#352f72'],
    far: '#1d1c44', farLight: '#2b2960',
    cloud: '#3a3680', cloudShade: '#2b2866',
    near: '#141530', nearLight: '#1f2046',
    pipe: ['#1a1550', '#3b33b5', '#5f56f2', '#a9a3ff'],
    grass: '#3fb08c', grassLight: '#7fe0bd', grassDark: '#2a7a64',
    dirt: '#1b1d27', dirtStripe: '#242733',
    stars: true,
    text: '#ffffff', textShade: '#0b0c1a',
  },
];

/** The bird is the same in every palette: warm, readable on any sky. */
const BIRD_COLORS = {
  o: '#2a1a2e',
  y: '#ffc94a',
  l: '#fff1b8',
  c: '#ff9e7a',
  w: '#fff6dc',
  W: '#e9a23b',
  e: '#ffffff',
  p: '#2a1a2e',
  b: '#ff6b3d',
  B: '#c9441c',
};

/** 17 × 12, facing right, without its wing. */
const BIRD_BODY = [
  '.....oooooo......',
  '...ooyyyyyleoo...',
  '..oyyyyyyleeeeo..',
  '.oyyyyyyyleeepeo.',
  '.oyyyyyyyleeepeo.',
  'oyyyyyyyyyleeeo..',
  'oyyyyyyyyyyoooooo',
  'oyyyyyyyyyobbbbbo',
  '.occcyyyyyoBBBBo.',
  '..oyllllllyooooo.',
  '...ooyyyyyyo.....',
  '.....oooooo......',
];

/** The wing, drawn over the body at (1, 4): up, level, down. */
const WINGS = [
  ['ooooo..', 'oWwwwo.', '.oWwwwo', '..oooo.', '.......'],
  ['.ooooo.', 'oWwwwwo', 'oWwwwwo', '.oWWWo.', '..ooo..'],
  ['.......', '.oooo..', 'oWwwwo.', 'oWwwwwo', '.ooooo.'],
];

/** 5 × 7 digits for the score. */
const DIGITS = [
  ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
];

/**
 * Checks that a sprite's rows are all as wide as the first (for the unit test).
 * @param {readonly string[]} rows
 */
export function isRectangular(rows) {
  return rows.every((row) => row.length === (rows[0] ?? '').length);
}

export const SPRITES = { BIRD_BODY, WINGS, DIGITS };

/** @param {number} w @param {number} h */
function createCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D canvas');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/**
 * Paints letter rows onto a context at (x, y), each letter's colour from `colors`.
 * @param {CanvasRenderingContext2D} ctx @param {readonly string[]} rows
 * @param {Record<string, string>} colors @param {number} x @param {number} y
 */
function paintRows(ctx, rows, colors, x, y) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const color = colors[row[i] ?? '.'];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  });
}

/**
 * The bird's frames: three wing positions alive, and one dead (crossed eye, wing up).
 * @returns {HTMLCanvasElement[]}
 */
function createBirdFrames() {
  const frames = WINGS.map((wing) => {
    const { canvas, ctx } = createCanvas(17, 12);
    paintRows(ctx, BIRD_BODY, BIRD_COLORS, 0, 0);
    paintRows(ctx, wing, BIRD_COLORS, 1, 4);
    return canvas;
  });
  const { canvas, ctx } = createCanvas(17, 12);
  paintRows(ctx, BIRD_BODY, BIRD_COLORS, 0, 0);
  paintRows(ctx, WINGS[0] ?? [], BIRD_COLORS, 1, 4);
  ctx.fillStyle = BIRD_COLORS.e;
  ctx.fillRect(11, 2, 3, 3);
  ctx.fillStyle = BIRD_COLORS.p;
  for (const [x, y] of [[11, 2], [13, 2], [12, 3], [11, 4], [13, 4]]) ctx.fillRect(x ?? 0, y ?? 0, 1, 1);
  frames.push(canvas);
  return frames;
}

/**
 * A pipe's body (one row, 26 wide, stretched down when drawn) and its cap (30 × 10).
 * @param {Palette} palette
 */
function createPipeParts(palette) {
  const [outline, dark, mid, light] = palette.pipe;
  const columns = [outline, dark, dark, mid, mid, mid, light, light, light, mid, mid, mid, mid, mid, mid, mid, mid, mid, dark, mid, dark, dark, dark, dark, dark, outline];
  const body = createCanvas(columns.length, 1);
  columns.forEach((color, i) => {
    body.ctx.fillStyle = color;
    body.ctx.fillRect(i, 0, 1, 1);
  });
  const cap = createCanvas(30, 10);
  cap.ctx.fillStyle = outline;
  cap.ctx.fillRect(0, 0, 30, 10);
  const inner = [dark, mid, light, light, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, mid, dark, mid, dark, dark, dark, dark, dark, dark];
  inner.forEach((color, i) => {
    cap.ctx.fillStyle = color;
    cap.ctx.fillRect(1 + i, 1, 1, 8);
  });
  cap.ctx.fillStyle = light;
  cap.ctx.fillRect(1, 1, 28, 1);
  cap.ctx.fillStyle = dark;
  cap.ctx.fillRect(1, 8, 28, 1);
  return { body: body.canvas, cap: cap.canvas };
}

/**
 * A stable pseudo-random number in [0, 1) for an integer (art repeats every visit).
 * @param {number} n
 */
function noise(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * A strip `width` wide that tiles sideways: far towers and hills (the valley's town),
 * clouds, and near bushes — each moves at its own speed (parallax).
 * @param {Palette} palette @param {'far' | 'cloud' | 'near'} kind @param {number} width @param {number} height
 */
function createStrip(palette, kind, width, height) {
  const { canvas, ctx } = createCanvas(width, height);
  if (kind === 'far') {
    for (let x = 0; x < width; ) {
      const w = 6 + Math.floor(noise(x) * 10);
      const h = 10 + Math.floor(noise(x + 50) * (height - 12));
      ctx.fillStyle = palette.far;
      ctx.fillRect(x, height - h, Math.min(w, width - x), h);
      ctx.fillStyle = palette.farLight;
      ctx.fillRect(x, height - h, Math.min(w, width - x), 1);
      // Lit windows, a few per tower.
      for (let wy = height - h + 3; wy < height - 2; wy += 4) {
        for (let wx = x + 2; wx < x + w - 1 && wx < width; wx += 3) {
          if (noise(wx * 7 + wy) > 0.72) ctx.fillRect(wx, wy, 1, 1);
        }
      }
      x += w + (noise(x + 9) > 0.6 ? 2 : 0);
    }
  } else if (kind === 'cloud') {
    for (let i = 0; i < 4; i++) {
      const cx = Math.floor((i + noise(i)) * (width / 4));
      const cy = 4 + Math.floor(noise(i + 20) * (height - 14));
      const w = 18 + Math.floor(noise(i + 40) * 16);
      ctx.fillStyle = palette.cloudShade;
      ctx.fillRect(cx, cy + 4, w, 4);
      ctx.fillStyle = palette.cloud;
      ctx.fillRect(cx + 2, cy + 2, w - 4, 4);
      ctx.fillRect(cx + 5, cy, Math.floor(w / 2), 3);
      ctx.fillRect(cx + Math.floor(w / 2), cy + 1, Math.floor(w / 3), 2);
    }
  } else {
    let y = height - 6;
    for (let x = 0; x < width; x++) {
      if (x % 3 === 0) y = Math.max(2, Math.min(height - 3, y + Math.round((noise(x) - 0.5) * 3)));
      ctx.fillStyle = palette.near;
      ctx.fillRect(x, y, 1, height - y);
      ctx.fillStyle = palette.nearLight;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

/**
 * The sky in bands, with a checkered step between two bands (ordered dithering), the
 * size of the whole art canvas.
 * @param {Palette} palette @param {number} width @param {number} height
 */
function createSky(palette, width, height) {
  const { canvas, ctx } = createCanvas(width, height);
  const bands = palette.sky.length;
  for (let y = 0; y < height; y++) {
    const t = (y / height) * bands;
    const band = Math.min(bands - 1, Math.floor(t));
    const next = Math.min(bands - 1, band + 1);
    const edge = t - band > 0.82;
    ctx.fillStyle = palette.sky[band] ?? '#000';
    ctx.fillRect(0, y, width, 1);
    if (!edge) continue;
    ctx.fillStyle = palette.sky[next] ?? '#000';
    for (let x = y % 2; x < width; x += 2) ctx.fillRect(x, y, 1, 1);
  }
  return canvas;
}

/**
 * The ground: a grass edge and dirt with slanted stripes, 8 wide (it tiles), `height` tall.
 * @param {Palette} palette @param {number} height
 */
function createGround(palette, height) {
  const { canvas, ctx } = createCanvas(8, height);
  ctx.fillStyle = palette.dirt;
  ctx.fillRect(0, 0, 8, height);
  ctx.fillStyle = palette.dirtStripe;
  for (let y = 5; y < height; y++) {
    for (let x = 0; x < 8; x++) if ((x + y) % 8 < 3) ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = palette.grassLight;
  ctx.fillRect(0, 0, 8, 1);
  ctx.fillStyle = palette.grass;
  ctx.fillRect(0, 1, 8, 2);
  ctx.fillRect(1, 3, 2, 1);
  ctx.fillRect(5, 3, 1, 1);
  ctx.fillStyle = palette.grassDark;
  ctx.fillRect(0, 3, 1, 1);
  ctx.fillRect(3, 3, 2, 1);
  ctx.fillRect(6, 3, 2, 1);
  ctx.fillRect(0, 4, 8, 1);
  return canvas;
}

/**
 * The digits in the palette's text colour with a 1-pixel shadow outline (7 × 9 each).
 * @param {Palette} palette
 */
function createDigits(palette) {
  return DIGITS.map((rows) => {
    const { canvas, ctx } = createCanvas(7, 9);
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [2, 2], [1, 3]]) paintRows(ctx, rows, { '#': palette.textShade }, dx ?? 0, dy ?? 0);
    paintRows(ctx, rows, { '#': palette.text }, 1, 1);
    return canvas;
  });
}

/**
 * Everything drawn from one palette, made once per palette and canvas size.
 * @param {Palette} palette @param {number} width @param {number} height @param {number} groundHeight
 */
export function createArt(palette, width, height, groundHeight) {
  return {
    palette,
    bird: createBirdFrames(),
    pipe: createPipeParts(palette),
    sky: createSky(palette, width, height),
    far: createStrip(palette, 'far', 128, 44),
    cloud: createStrip(palette, 'cloud', 160, 40),
    near: createStrip(palette, 'near', 96, 18),
    ground: createGround(palette, groundHeight),
    digits: createDigits(palette),
  };
}

/** @typedef {ReturnType<typeof createArt>} Art */

/**
 * Which palette a run uses: they take turns, so every new run is a new time of day.
 * @param {number} run
 */
export function paletteFor(run) {
  return /** @type {Palette} */ (PALETTES[((run % PALETTES.length) + PALETTES.length) % PALETTES.length]);
}

/**
 * The integer scale and the art canvas's size for a stage of `cssWidth` × `cssHeight`
 * CSS pixels at `dpr`: every art pixel becomes k × k device pixels (crisp, even), and
 * the canvas covers the stage (rows beyond the 256 of the world show more sky and ground).
 * @param {number} cssWidth @param {number} cssHeight @param {number} dpr
 */
export function pixelGrid(cssWidth, cssHeight, dpr) {
  const deviceWidth = Math.max(1, Math.round(cssWidth * dpr));
  const deviceHeight = Math.max(1, Math.round(cssHeight * dpr));
  const k = Math.max(1, Math.floor(deviceHeight / ART_HEIGHT));
  const width = Math.ceil(deviceWidth / k);
  const height = Math.ceil(deviceHeight / k);
  return { k, width, height, cssWidth: (width * k) / dpr, cssHeight: (height * k) / dpr, top: Math.floor((height - ART_HEIGHT) / 2) };
}
