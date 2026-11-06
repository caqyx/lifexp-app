// @ts-check
// Strażnicy Doliny in pixel art (docs/v2/PLAN.md 9.1, td-2): the palette, the bitmap
// font and the sprite builder every picture of the game is made with. Sprites are rows of
// letters (one letter = one pixel in a palette colour, "." = clear), written in this repo
// and turned into small canvases once. The font is LifeXP's own: 5 × 7 capitals and
// digits, lower case with descenders, and the Polish letters ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ composed
// from their base letter and an accent. Nothing here is drawn per frame.

/** The game's 32 colours (one letter each; sprites name colours by these letters). */
export const PALETTE = /** @type {const} */ ({
  k: '#1a1423', // ink
  K: '#3b3446', // dark stone
  g: '#6e6a7c', // stone
  G: '#a8a6b8', // light stone
  w: '#f4f1e8', // white
  r: '#8c2a3b', // dark red
  R: '#d6505e', // red
  o: '#e07a3a', // orange
  O: '#ffb35c', // light orange
  y: '#ffd166', // gold
  Y: '#fff1b8', // pale gold
  n: '#5a3a28', // dark wood
  N: '#8a5a35', // wood
  b: '#c9a46a', // tan
  B: '#e6cf98', // light tan
  e: '#24452c', // dark leaf
  E: '#3f8a4a', // leaf
  f: '#6cc75a', // grass
  F: '#b2ec8a', // light grass
  t: '#1f4a4f', // deep water
  T: '#2f7a76', // water
  c: '#4fb3a9', // teal
  C: '#9fe2ff', // ice
  u: '#1e2a5a', // night blue
  U: '#3a4fb0', // blue
  v: '#5f56f2', // violet (LifeXP)
  V: '#a9a3ff', // light violet
  p: '#6e3a8a', // purple
  P: '#e0a8ff', // pink
  s: '#d8b48a', // sand
  S: '#a8834d', // dark sand
  m: '#7c9479', // moss
});

/** @typedef {keyof typeof PALETTE} Colour */

// ── Sprites ─────────────────────────────────────────────────────────────────

/**
 * Whether every row of a sprite is as wide as the first (the unit test checks them all).
 * @param {readonly string[]} rows
 */
export function isRectangular(rows) {
  return rows.length > 0 && rows.every((row) => row.length === (rows[0] ?? '').length);
}

/** @param {number} w @param {number} h */
export function createCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D canvas');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/**
 * Paints letter rows at (x, y); `swap` recolours letters (e.g. gold trim on level 3).
 * @param {CanvasRenderingContext2D} ctx @param {readonly string[]} rows @param {number} x @param {number} y
 * @param {Readonly<Record<string, string>>} [swap]
 */
export function paintRows(ctx, rows, x, y, swap) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j] ?? '';
    for (let i = 0; i < row.length; i++) {
      let ch = row[i] ?? '.';
      if (ch === '.') continue;
      if (swap && swap[ch]) ch = swap[ch] ?? ch;
      const color = PALETTE[/** @type {Colour} */ (ch)];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}

/**
 * A sprite as a canvas, optionally mirrored (facing left).
 * @param {readonly string[]} rows @param {{ flip?: boolean, swap?: Readonly<Record<string, string>> }} [options]
 */
export function makeSprite(rows, options = {}) {
  const w = (rows[0] ?? '').length;
  const { canvas, ctx } = createCanvas(w, rows.length);
  if (options.flip) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  paintRows(ctx, rows, 0, 0, options.swap);
  return canvas;
}

/**
 * The same sprite as a solid silhouette in one colour (a hit's white flash, a shadow).
 * @param {HTMLCanvasElement} sprite @param {string} color
 */
export function silhouette(sprite, color) {
  const { canvas, ctx } = createCanvas(sprite.width, sprite.height);
  ctx.drawImage(sprite, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, sprite.width, sprite.height);
  return canvas;
}

// ── The font ────────────────────────────────────────────────────────────────

/** A glyph box: 2 rows for accents over capitals, 7 for the letter, 2 for descenders. */
export const FONT_HEIGHT = 11;
const TOP = 2;

/** Capitals and digits, 7 rows. */
const UPPER = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  Ł: ['#....', '#....', '#.#..', '##...', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
};

/** Lower case: 7 rows, or 9 with a descender (g, j, p, q, y). */
const LOWER = {
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##', '.#..', '###.', '.#..', '.#..', '.#..', '.#..'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
  j: ['..#', '...', '.##', '..#', '..#', '..#', '..#', '#.#', '.#.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  ł: ['##.', '.#.', '.##', '##.', '.#.', '.#.', '###'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['....', '....', '#.##', '##..', '#...', '#...', '#...'],
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.'],
  t: ['.#..', '.#..', '###.', '.#..', '.#..', '.#..', '..##'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
};

/** Signs. */
const SIGNS = {
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '.', '.', '.', '#', '#'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  ';': ['.', '.', '#', '.', '.', '#', '#', '#'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '−': ['....', '....', '....', '####', '....', '....', '....'],
  '–': ['....', '....', '....', '####', '....', '....', '....'],
  '—': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '„': ['...', '...', '...', '...', '...', '#.#', '#.#'],
  '”': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '=': ['....', '....', '####', '....', '####', '....', '....'],
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'],
  '∞': ['.......', '.......', '.##.##.', '#..#..#', '.##.##.', '.......', '.......'],
};

/** Accented letters: the base letter and its mark. */
const ACCENTED = {
  ą: ['a', 'ogonek'],
  ć: ['c', 'acute'],
  ę: ['e', 'ogonek'],
  ń: ['n', 'acute'],
  ó: ['o', 'acute'],
  ś: ['s', 'acute'],
  ź: ['z', 'acute'],
  ż: ['z', 'dot'],
  Ą: ['A', 'ogonek'],
  Ć: ['C', 'acute'],
  Ę: ['E', 'ogonek'],
  Ń: ['N', 'acute'],
  Ó: ['O', 'acute'],
  Ś: ['S', 'acute'],
  Ź: ['Z', 'acute'],
  Ż: ['Z', 'dot'],
};

/**
 * A glyph as FONT_HEIGHT rows: the letter at rows 2–8 (descenders 9–10), an accent above
 * the letter's top (over a capital it uses rows 0–1) or an ogonek under its right side.
 * @param {string} ch @returns {string[] | null}
 */
function buildGlyph(ch) {
  const accent = /** @type {Record<string, string[]>} */ (ACCENTED)[ch];
  const base = (accent ? accent[0] : ch) ?? ch;
  const rows = /** @type {Record<string, string[]>} */ ({ ...UPPER, ...LOWER, ...SIGNS })[base];
  if (!rows) return null;
  const w = (rows[0] ?? '').length;
  const box = Array.from({ length: FONT_HEIGHT }, (_, i) => rows[i - TOP] ?? '.'.repeat(w));
  if (!accent) return box;
  const capital = base === base.toUpperCase();
  const top = capital ? 0 : TOP;
  const mid = Math.floor(w / 2);
  /** @param {number} row @param {number} col */
  const set = (row, col) => {
    const line = box[row] ?? '';
    box[row] = line.slice(0, col) + '#' + line.slice(col + 1);
  };
  if (accent[1] === 'acute') {
    set(top, Math.min(w - 1, mid + 1));
    set(top + 1, mid);
  } else if (accent[1] === 'dot') {
    set(top + 1, mid);
  } else {
    set(TOP + 7, w - 2);
    set(TOP + 8, w - 1);
  }
  return box;
}

/** Every glyph the game knows, by character. */
export const GLYPHS = /** @type {Map<string, string[]>} */ (new Map());
for (const ch of [...Object.keys(UPPER), ...Object.keys(LOWER), ...Object.keys(SIGNS), ...Object.keys(ACCENTED)]) {
  const glyph = buildGlyph(ch);
  if (glyph) GLYPHS.set(ch, glyph);
}

/** The glyph for a character (an unknown one shows as "?"). @param {string} ch */
function glyphOf(ch) {
  return GLYPHS.get(ch) ?? GLYPHS.get('?') ?? [];
}

/** Width of a text in font pixels (1 pixel between letters). @param {string} text */
export function measureText(text) {
  let width = 0;
  for (const ch of text) width += (glyphOf(ch)[0] ?? '').length + 1;
  return Math.max(0, width - 1);
}

/**
 * Breaks a text into lines no wider than `maxWidth` font pixels (at spaces).
 * @param {string} text @param {number} maxWidth @returns {string[]}
 */
export function wrapText(text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measureText(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

/**
 * Draws a text at (x, y) — y is the top of the glyph box — in `color`, with a shadow one
 * pixel down and right when `shadow` is given.
 * @param {CanvasRenderingContext2D} ctx @param {string} text @param {number} x @param {number} y
 * @param {string} color @param {string | null} shadow
 */
export function drawText(ctx, text, x, y, color, shadow) {
  if (shadow) drawGlyphs(ctx, text, x + 1, y + 1, shadow);
  drawGlyphs(ctx, text, x, y, color);
}

/** @param {CanvasRenderingContext2D} ctx @param {string} text @param {number} x @param {number} y @param {string} color */
function drawGlyphs(ctx, text, x, y, color) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const glyph = glyphOf(ch);
    for (let j = 0; j < glyph.length; j++) {
      const row = glyph[j] ?? '';
      for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(cx + i, y + j, 1, 1);
    }
    cx += (glyph[0] ?? '').length + 1;
  }
}

/** The line height of the font (the glyph box and one pixel). */
export const LINE_HEIGHT = FONT_HEIGHT + 1;
