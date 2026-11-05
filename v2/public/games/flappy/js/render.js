// @ts-check
// Drawing (docs/v2/PLAN.md 9.1, g-3; pixel art since q-own). The game is drawn on a
// small canvas — the 640-tall world is 256 art pixels — and the page scales that canvas
// up by a whole number with nearest-neighbour (image-rendering: pixelated), so every art
// pixel is an even, crisp square. Positions are rounded to whole art pixels before
// drawing (no shimmer). Layers back to front: sky, stars, clouds, far town, bushes,
// pipes, ground, bird, sparks, score, flash. The art itself is in pixel.js; nothing
// here allocates per frame.
import { GROUND_Y, PIPE, birdTilt } from './logic.js';
import { PIXEL, createArt } from './pixel.js';

/** @typedef {import('./pixel.js').Art} Art */
/** @typedef {import('./pixel.js').Palette} Palette */
/** @typedef {import('./effects.js').Particle} Particle */
/**
 * @typedef {{
 *   width: number,
 *   distance: number,
 *   time: number,
 *   pipes: import('./logic.js').Pipe[],
 *   pipeLag: number,
 *   bird: { x: number, y: number, vy: number, flapSince: number, time: number, alive: boolean, tiltOverride: number | null },
 *   particles: Particle[],
 *   shake: { x: number, y: number },
 *   flash: number,
 *   reduced: boolean,
 *   score: number,
 *   showScore: boolean,
 *   scoreSince: number,
 * }} Scene
 */

const GROUND_ROW = Math.round(GROUND_Y / PIXEL);
const PIPE_WIDTH = Math.round(PIPE.width / PIXEL);
const CAP_HEIGHT = 10;
/** The bird turns in 45° steps: level and straight down are pixel-exact turns. */
const TILT_STEP = Math.PI / 4;
/** Stars (night and dusk): fixed art pixels, a third of them twinkle. */
const STARS = Array.from({ length: 40 }, (_, i) => {
  const a = Math.sin(i * 91.7 + 3.1) * 43758.5453;
  const b = Math.sin(i * 17.3 + 9.4) * 24634.6345;
  return { x: Math.floor((a - Math.floor(a)) * 240), y: Math.floor((b - Math.floor(b)) * 110), twinkle: i % 3 === 0 };
});
const FLAP_FRAMES = [2, 1, 0, 1];
const GLIDE_FRAMES = [0, 1, 2, 1];

/** @param {HTMLCanvasElement} canvas */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('no 2D canvas');
  return {
    canvas,
    ctx,
    width: 1,
    height: 1,
    /** Art rows above the world's top (more sky): the canvas covers the whole stage. */
    top: 0,
    /** Art columns left of the world's left edge. */
    left: 0,
    art: /** @type {Art | null} */ (null),
    palette: /** @type {Palette | null} */ (null),
    /** Spark colours by particle hue: gold, the pipes' light, the bird's yellows, the grass. */
    sparkColors: /** @type {string[]} */ ([]),
  };
}

/** @typedef {ReturnType<typeof createRenderer>} Renderer */

/**
 * Sizes the art canvas and (re)makes the art for a palette.
 * @param {Renderer} r @param {{ width: number, height: number, top: number }} grid @param {number} worldWidth @param {Palette} palette
 */
export function resizeRenderer(r, grid, worldWidth, palette) {
  r.canvas.width = grid.width;
  r.canvas.height = grid.height;
  r.width = grid.width;
  r.height = grid.height;
  r.top = grid.top;
  r.left = Math.floor((grid.width - worldWidth / PIXEL) / 2);
  r.ctx.imageSmoothingEnabled = false;
  setPalette(r, palette, true);
}

/**
 * Makes the art for a palette (a new run's time of day); nothing when it is the same.
 * @param {Renderer} r @param {Palette} palette @param {boolean} [force]
 */
export function setPalette(r, palette, force = false) {
  if (!force && r.palette === palette) return;
  r.palette = palette;
  r.art = createArt(palette, r.width, r.height, Math.max(8, r.height - (r.top + GROUND_ROW)));
  r.sparkColors = ['#ffd166', palette.pipe[3], '#ffc94a', '#fff1b8', palette.grassLight];
}

/** World x → art column. @param {Renderer} r @param {number} x */
const ax = (r, x) => r.left + Math.round(x / PIXEL);
/** World y → art row. @param {Renderer} r @param {number} y */
const ay = (r, y) => r.top + Math.round(y / PIXEL);

/**
 * A strip that tiles sideways, scrolled by `offset` art pixels, its bottom at `bottom`.
 * @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} strip @param {number} offset @param {number} bottom @param {number} width
 */
function drawStrip(ctx, strip, offset, bottom, width) {
  const w = strip.width;
  const start = -(((Math.round(offset) % w) + w) % w);
  for (let x = start; x < width; x += w) ctx.drawImage(strip, x, bottom - strip.height);
}

/** @param {Renderer} r @param {Art} art @param {Scene} scene */
function renderBackdrop(r, art, scene) {
  const ctx = r.ctx;
  ctx.drawImage(art.sky, 0, 0);
  if (art.palette.stars) renderStars(r, scene);
  const ground = r.top + GROUND_ROW;
  const d = scene.distance / PIXEL;
  drawStrip(ctx, art.cloud, d * 0.08 + (scene.reduced ? 0 : scene.time * 1.5), r.top + 80, r.width);
  drawStrip(ctx, art.far, d * 0.18, ground - 8, r.width);
  drawStrip(ctx, art.near, d * 0.45, ground, r.width);
}

/** @param {Renderer} r @param {Scene} scene */
function renderStars(r, scene) {
  const ctx = r.ctx;
  ctx.fillStyle = '#ffffff';
  const blink = Math.floor(scene.time * 2);
  for (const star of STARS) {
    if (star.x >= r.width) continue;
    if (star.twinkle && !scene.reduced && (blink + star.x) % 3 === 0) continue;
    ctx.fillRect(star.x, star.y, 1, 1);
  }
}

/** @param {Renderer} r @param {Art} art @param {Scene} scene @param {number} sx @param {number} sy */
function renderPipes(r, art, scene, sx, sy) {
  const ctx = r.ctx;
  const ground = r.top + GROUND_ROW + sy;
  for (const pipe of scene.pipes) {
    const x = ax(r, pipe.x + scene.pipeLag) + sx;
    const topEnd = ay(r, pipe.gapY - pipe.gap / 2) + sy;
    const bottomStart = ay(r, pipe.gapY + pipe.gap / 2) + sy;
    if (topEnd - CAP_HEIGHT > 0) ctx.drawImage(art.pipe.body, x, 0, PIPE_WIDTH, topEnd - CAP_HEIGHT);
    ctx.drawImage(art.pipe.cap, x - 2, topEnd - CAP_HEIGHT);
    ctx.drawImage(art.pipe.cap, x - 2, bottomStart);
    if (ground - bottomStart - CAP_HEIGHT > 0) ctx.drawImage(art.pipe.body, x, bottomStart + CAP_HEIGHT, PIPE_WIDTH, ground - bottomStart - CAP_HEIGHT);
  }
}

/** @param {Renderer} r @param {Art} art @param {Scene} scene @param {number} sx @param {number} sy */
function renderGround(r, art, scene, sx, sy) {
  const top = r.top + GROUND_ROW + sy;
  drawStrip(r.ctx, art.ground, scene.distance / PIXEL - sx, top + art.ground.height, r.width);
}

/**
 * Which wing frame (0 up, 1 level, 2 down): a flap beats the wing down and back
 * quickly; gliding, it beats slowly.
 * @param {number} flapSince @param {number} time
 */
export function birdFrame(flapSince, time) {
  if (flapSince >= 0 && flapSince < 0.24) return FLAP_FRAMES[Math.floor(flapSince / 0.06)] ?? 1;
  return GLIDE_FRAMES[Math.floor(time * 7) % 4] ?? 1;
}

/**
 * The bird: its wing frame, the dead frame after a hit, tilted in 45° steps so the
 * pixels stay tidy.
 * @param {Renderer} r @param {Art} art @param {Scene['bird']} bird @param {number} sx @param {number} sy
 */
function renderBird(r, art, bird, sx, sy) {
  const ctx = r.ctx;
  const frame = art.bird[bird.alive ? birdFrame(bird.flapSince, bird.time) : 3];
  if (!frame) return;
  const tilt = Math.round((bird.tiltOverride ?? birdTilt(bird.vy)) / TILT_STEP) * TILT_STEP;
  const x = ax(r, bird.x) + sx;
  const y = ay(r, bird.y) + sy;
  if (tilt === 0) {
    ctx.drawImage(frame, x - 9, y - 6);
    return;
  }
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.drawImage(frame, -9, -6);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** @param {Renderer} r @param {Particle[]} particles @param {number} sx @param {number} sy */
function renderParticles(r, particles, sx, sy) {
  const ctx = r.ctx;
  for (const p of particles) {
    if (!p.alive) continue;
    const size = p.size > 2.5 && p.age < p.life * 0.6 ? 2 : 1;
    ctx.fillStyle = r.sparkColors[p.hue] ?? '#ffffff';
    ctx.fillRect(ax(r, p.x) + sx, ay(r, p.y) + sy, size, size);
  }
}

/**
 * The score in pixel digits at twice their size; it hops 2 pixels when it goes up.
 * @param {Renderer} r @param {Art} art @param {Scene} scene
 */
function renderScore(r, art, scene) {
  if (!scene.showScore) return;
  const score = scene.score;
  const digits = score < 10 ? 1 : score < 100 ? 2 : score < 1000 ? 3 : 4;
  const glyph = 14;
  const hop = !scene.reduced && scene.scoreSince >= 0 && scene.scoreSince < 0.12 ? -2 : 0;
  let x = Math.floor((r.width - (digits * glyph - 2)) / 2) + (digits - 1) * glyph;
  const y = r.top + 16 + hop;
  let rest = score;
  for (let i = 0; i < digits; i++) {
    const digit = art.digits[rest % 10];
    if (digit) r.ctx.drawImage(digit, x, y, digit.width * 2, digit.height * 2);
    rest = Math.floor(rest / 10);
    x -= glyph;
  }
}

/** A short white flash in two steps (not a smooth fade: pixel style). @param {Renderer} r @param {number} alpha */
function renderFlash(r, alpha) {
  if (alpha <= 0.05) return;
  r.ctx.globalAlpha = alpha > 0.3 ? 0.7 : 0.35;
  r.ctx.fillStyle = '#ffffff';
  r.ctx.fillRect(0, 0, r.width, r.height);
  r.ctx.globalAlpha = 1;
}

/**
 * One frame, back to front. A shake moves the world by whole art pixels.
 * @param {Renderer} r @param {Scene} scene
 */
export function renderFrame(r, scene) {
  const art = r.art;
  if (!art) return;
  const sx = Math.round(scene.shake.x / PIXEL);
  const sy = Math.round(scene.shake.y / PIXEL);
  renderBackdrop(r, art, scene);
  renderPipes(r, art, scene, sx, sy);
  renderGround(r, art, scene, sx, sy);
  renderBird(r, art, scene.bird, sx, sy);
  renderParticles(r, scene.particles, sx, sy);
  renderScore(r, art, scene);
  renderFlash(r, scene.flash);
}
