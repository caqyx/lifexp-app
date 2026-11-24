// @ts-check
// Świetlik (Glimmer): the pixel art, drawn in code once into small canvases — the wisp
// (a round lantern-glow with eyes and tiny wings, two wing beats), the shots (spark, drop,
// orb, petal, seeker, the flower that spins petals; since gl-2 also bouncer, mine, comet,
// ember, splitter, snake link), the hearts and a 3 × 5 digit font for
// the score. A one-pixel ink outline is added round every sprite, so everything reads on
// the dark meadow. Original art, this game's own palette.

/** The palette (letters → colours). */
export const PALETTE = /** @type {const} */ ({
  k: '#15111f', // ink
  n: '#1c1730', // night
  N: '#241d3b', // night, lighter
  m: '#3a2f57', // dusk
  M: '#544583', // dusk, lighter
  v: '#6c5fc7', // violet
  V: '#a99bff', // light violet
  y: '#ffd166', // gold
  Y: '#fff1b8', // pale gold
  o: '#ff9f43', // orange
  r: '#ff5d73', // red-pink
  R: '#ffb3bd', // pale pink
  c: '#4fd1e8', // cyan
  C: '#c4f6ff', // pale cyan
  g: '#62d77a', // green
  G: '#c9ffc2', // pale green
  p: '#b67cff', // purple
  P: '#ecd6ff', // pale purple
  w: '#fbf7ff', // white
});

/** @typedef {keyof typeof PALETTE} Colour */

/** @param {number} w @param {number} h */
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d canvas missing');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

/** @param {CanvasRenderingContext2D} ctx @param {Colour} col @param {number} x @param {number} y @param {number} [w] @param {number} [h] */
function px(ctx, col, x, y, w = 1, h = 1) {
  ctx.fillStyle = PALETTE[col];
  ctx.fillRect(x, y, w, h);
}

/** A filled pixel circle. @param {CanvasRenderingContext2D} ctx @param {Colour} col @param {number} cx @param {number} cy @param {number} r */
function disc(ctx, col, cx, cy, r) {
  ctx.fillStyle = PALETTE[col];
  for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

/** A one-pixel ink outline round everything drawn on a canvas. @param {HTMLCanvasElement} c */
function outline(c) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < w && y < h && (d[(y * w + x) * 4 + 3] ?? 0) > 0;
  const marks = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) marks.push(x, y);
    }
  }
  ctx.fillStyle = PALETTE.k;
  for (let i = 0; i < marks.length; i += 2) ctx.fillRect(marks[i] ?? 0, marks[i + 1] ?? 0, 1, 1);
  return c;
}

/**
 * The wisp: a round glow with a pale crown of light, two eyes looking the way it goes,
 * tiny wings (up or down by frame) and a spark on top. 13 × 13, centre (6, 7).
 * @param {number} frame 0 or 1 @param {boolean} [hurt] drawn pale (the blink after a hit)
 */
export function wisp(frame, hurt = false) {
  const { c, ctx } = canvas(13, 13);
  const wing = /** @type {Colour} */ (hurt ? 'w' : 'P');
  const wy = frame === 0 ? 4 : 7;
  px(ctx, wing, 1, wy, 2, 2);
  px(ctx, wing, 10, wy, 2, 2);
  px(ctx, wing, 2, wy + 1, 1, 1);
  disc(ctx, hurt ? 'R' : 'y', 6, 7, 3.6);
  disc(ctx, hurt ? 'w' : 'Y', 5, 6, 1.6);
  px(ctx, 'k', 5, 7);
  px(ctx, 'k', 8, 7);
  px(ctx, hurt ? 'r' : 'o', 6, 2, 1, 1);
  px(ctx, hurt ? 'w' : 'Y', 6, 1, 1, 1);
  return outline(c);
}

/** The shots' pictures by kind (and their size: drawn centred on the shot). */
export function shotSprites() {
  const spark = canvas(7, 7);
  spark.ctx.fillStyle = PALETTE.r;
  spark.ctx.fillRect(3, 1, 1, 5);
  spark.ctx.fillRect(1, 3, 5, 1);
  spark.ctx.fillRect(2, 2, 3, 3);
  px(spark.ctx, 'R', 3, 3);
  px(spark.ctx, 'w', 3, 2);

  const drop = canvas(5, 8);
  px(drop.ctx, 'c', 2, 1, 1, 2);
  px(drop.ctx, 'c', 1, 3, 3, 3);
  px(drop.ctx, 'C', 1, 3, 1, 2);
  px(drop.ctx, 'w', 2, 4);

  const orb = canvas(8, 8);
  disc(orb.ctx, 'p', 3.5, 3.5, 2.6);
  disc(orb.ctx, 'P', 3.5, 3.5, 1.4);
  px(orb.ctx, 'w', 3, 3);

  const petal = canvas(7, 7);
  disc(petal.ctx, 'g', 3, 3, 2.2);
  px(petal.ctx, 'G', 2, 2, 2, 1);
  px(petal.ctx, 'w', 2, 2);

  const seeker = canvas(11, 11);
  disc(seeker.ctx, 'm', 5, 5, 3.6);
  disc(seeker.ctx, 'M', 4, 4, 1.8);
  px(seeker.ctx, 'r', 5, 5, 2, 1);
  px(seeker.ctx, 'R', 5, 5);
  for (const [x, y] of [[5, 0], [0, 5], [10, 5], [5, 10]]) px(seeker.ctx, 'v', x ?? 0, y ?? 0);

  const node = canvas(15, 15);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    disc(node.ctx, 'g', 7 + Math.cos(a) * 4, 7 + Math.sin(a) * 4, 1.8);
  }
  disc(node.ctx, 'y', 7, 7, 2.4);
  px(node.ctx, 'Y', 6, 6);

  // gl-2: a bouncer (a ringed cyan orb), a mine (dark shell, red heart, studs), a comet's
  // head (white-gold), an ember (orange), a splitter (a big cracked violet orb), a snake's
  // link (gold-green bead).
  const bouncer = canvas(9, 9);
  disc(bouncer.ctx, 'c', 4, 4, 3.4);
  disc(bouncer.ctx, 'n', 4, 4, 1.6);
  px(bouncer.ctx, 'C', 2, 2, 2, 1);
  px(bouncer.ctx, 'w', 4, 4);

  const mine = canvas(11, 11);
  disc(mine.ctx, 'm', 5, 5, 3.4);
  disc(mine.ctx, 'r', 5, 5, 1.5);
  px(mine.ctx, 'R', 5, 5);
  for (const [x, y] of [[5, 0], [0, 5], [10, 5], [5, 10], [2, 2], [8, 2], [2, 8], [8, 8]]) px(mine.ctx, 'M', x ?? 0, y ?? 0);

  const cometHead = canvas(9, 9);
  disc(cometHead.ctx, 'o', 4, 4, 3.4);
  disc(cometHead.ctx, 'y', 4, 4, 2.2);
  disc(cometHead.ctx, 'w', 4, 4, 1);

  const ember = canvas(5, 5);
  px(ember.ctx, 'o', 1, 1, 3, 3);
  px(ember.ctx, 'y', 2, 1);
  px(ember.ctx, 'r', 1, 3, 3, 1);

  const splitter = canvas(11, 11);
  disc(splitter.ctx, 'v', 5, 5, 4.4);
  disc(splitter.ctx, 'V', 4, 4, 2);
  px(splitter.ctx, 'P', 3, 3);
  px(splitter.ctx, 'm', 6, 3, 1, 3);
  px(splitter.ctx, 'm', 7, 6, 2, 1);
  px(splitter.ctx, 'm', 3, 7, 2, 1);

  const link = canvas(7, 7);
  disc(link.ctx, 'g', 3, 3, 2.4);
  px(link.ctx, 'y', 2, 2, 2, 2);
  px(link.ctx, 'Y', 2, 2);

  return {
    bouncer: outline(bouncer.c),
    mine: outline(mine.c),
    comet: outline(cometHead.c),
    ember: outline(ember.c),
    splitter: outline(splitter.c),
    link: outline(link.c),
    spark: outline(spark.c),
    drop: outline(drop.c),
    orb: outline(orb.c),
    petal: outline(petal.c),
    seeker: outline(seeker.c),
    node: outline(node.c),
  };
}

/** A heart, full or empty. 9 × 8. @param {boolean} full */
export function heart(full) {
  const { c, ctx } = canvas(9, 8);
  const col = /** @type {Colour} */ (full ? 'r' : 'm');
  px(ctx, col, 1, 1, 3, 3);
  px(ctx, col, 5, 1, 3, 3);
  px(ctx, col, 1, 3, 7, 1);
  px(ctx, col, 2, 4, 5, 1);
  px(ctx, col, 3, 5, 3, 1);
  px(ctx, col, 4, 6, 1, 1);
  if (full) px(ctx, 'R', 2, 2);
  return outline(c);
}

/** A 3 × 5 font for the score and the clock: digits, ':' and ' '. */
const DIGITS = /** @type {Record<string, string[]>} */ ({
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
  ':': ['.', '#', '.', '#', '.'],
  ' ': ['..', '..', '..', '..', '..'],
});

/** The width of a text in the digit font (1 pixel between characters). @param {string} text */
export function digitsWidth(text) {
  let w = 0;
  for (const ch of text) w += (DIGITS[ch]?.[0]?.length ?? 0) + 1;
  return Math.max(0, w - 1);
}

/**
 * Draws digits at (x, y) in a colour with an ink shadow, `scale` art pixels a font pixel.
 * @param {CanvasRenderingContext2D} ctx @param {string} text @param {number} x @param {number} y @param {string} color @param {number} [scale]
 */
export function drawDigits(ctx, text, x, y, color, scale = 1) {
  for (const pass of [0, 1]) {
    ctx.fillStyle = pass === 0 ? PALETTE.k : color;
    let cx = x;
    for (const ch of text) {
      const rows = DIGITS[ch];
      if (!rows) continue;
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] === '#') ctx.fillRect(cx + rx * scale + (pass === 0 ? 1 : 0), y + ry * scale + (pass === 0 ? 1 : 0), scale, scale);
        }
      });
      cx += ((rows[0]?.length ?? 0) + 1) * scale;
    }
  }
}
