// @ts-check
// Szybkie liczenie: confetti and sparks over the page (docs/v2/PLAN.md 9.1, q-own) —
// a burst from the card on a right answer, a bigger one when the streak reaches a new
// multiplier and on a new best. One canvas over everything, a fixed pool, and a loop of
// its own that runs only while something is flying (an idle page draws nothing). Never
// started with prefers-reduced-motion (main.js checks).

/** @typedef {{ alive: boolean, x: number, y: number, vx: number, vy: number, spin: number, angle: number, age: number, life: number, size: number, color: string }} Bit */

const POOL = 160;
const GRAVITY = 900;
const DRAG = 0.985;
export const COLORS = {
  correct: ['#4ecca3', '#8f88ff', '#e8eaf0'],
  combo: ['#ffd166', '#ff9e5e', '#8f88ff', '#4ecca3'],
  best: ['#ffd166', '#8f88ff', '#4ecca3', '#ff6b6b', '#e8eaf0'],
};

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D canvas');
  const fx = {
    canvas,
    ctx,
    bits: Array.from({ length: POOL }, () => /** @type {Bit} */ ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, spin: 0, angle: 0, age: 0, life: 1, size: 4, color: '#fff' })),
    alive: 0,
    frame: 0,
    last: /** @type {number | null} */ (null),
    seed: 7,
    dpr: 1,
    /** The band's top on the page (CSS pixels): bits are kept in page coordinates. */
    top: 0,
    /** Recent frame time (ms, smoothed): a slow phone gets fewer bits, or none. */
    frameMs: 16.7,
    /** The loop's callback, made once (no closure per frame). */
    tick: /** @type {FrameRequestCallback} */ (() => {}),
  };
  fx.tick = (now) => step(fx, now);
  return fx;
}

/** @typedef {ReturnType<typeof createFx>} Fx */

/** A small repeatable random (no Math.random: screenshots repeat). @param {Fx} fx */
function nextRandom(fx) {
  fx.seed = (fx.seed * 1103515245 + 12345) & 0x7fffffff;
  return fx.seed / 0x7fffffff;
}

/** The canvas's height (CSS pixels): a band around the burst, not the whole screen. */
const BAND = 560;
/** How far above the burst the band starts (bits fly up, then fall). */
const BAND_ABOVE = 320;

/**
 * Sizes the canvas: as wide as the window and BAND tall, at half the CSS resolution — paper
 * bits need no sharpness (they are drawn as small solid rectangles), and a quarter of the
 * pixels costs a phone little to clear and composite.
 * @param {Fx} fx
 */
export function resizeFx(fx) {
  fx.dpr = 0.5;
  fx.canvas.width = Math.round(innerWidth * fx.dpr);
  fx.canvas.height = Math.round(BAND * fx.dpr);
}

/**
 * Moves the band so it is centred on a burst at page y (only when nothing is flying,
 * so bits in the air never jump).
 * @param {Fx} fx @param {number} y
 */
function placeBand(fx, y) {
  if (fx.alive > 0) return;
  fx.top = Math.round(y - BAND_ABOVE);
  fx.canvas.style.transform = `translateY(${fx.top}px)`;
}

/**
 * Throws `count` bits from a point (CSS pixels), upward in a fan of `spread` radians.
 * @param {Fx} fx @param {number} x @param {number} y @param {number} count
 * @param {readonly string[]} colors @param {number} power @param {number} spread
 */
export function burst(fx, x, y, count, colors, power, spread) {
  let left = Math.round(count * effectsBudget(fx.frameMs));
  if (left === 0) return;
  placeBand(fx, y);
  for (const bit of fx.bits) {
    if (left === 0) break;
    if (bit.alive) continue;
    const angle = -Math.PI / 2 + (nextRandom(fx) - 0.5) * spread;
    const speed = power * (0.45 + nextRandom(fx) * 0.75);
    bit.alive = true;
    bit.x = x + (nextRandom(fx) - 0.5) * 24;
    bit.y = y;
    bit.vx = Math.cos(angle) * speed;
    bit.vy = Math.sin(angle) * speed;
    bit.spin = (nextRandom(fx) - 0.5) * 16;
    bit.angle = nextRandom(fx) * Math.PI;
    bit.age = 0;
    bit.life = 0.7 + nextRandom(fx) * 0.6;
    bit.size = 4 + nextRandom(fx) * 4;
    bit.color = colors[Math.floor(nextRandom(fx) * colors.length)] ?? '#fff';
    fx.alive += 1;
    left -= 1;
  }
  start(fx);
}

/**
 * The share of effects a phone can afford by its recent frame time: all of them at 60 fps,
 * half when frames run over ~18 ms, none past ~26 ms (the game itself comes first).
 * @param {number} frameMs
 */
export function effectsBudget(frameMs) {
  if (frameMs <= 18) return 1;
  if (frameMs <= 26) return 0.5;
  return 0;
}

/**
 * Feeds a frame's length to the budget (an average that follows the last ~20 frames).
 * @param {Fx} fx @param {number} ms
 */
export function noteFrame(fx, ms) {
  if (ms > 0 && ms < 250) fx.frameMs += (ms - fx.frameMs) * 0.1;
}

/** @param {Fx} fx */
function start(fx) {
  if (fx.frame) return;
  fx.last = null;
  fx.frame = requestAnimationFrame(fx.tick);
}

/** @param {{ bits: Bit[], alive: number, last: number | null, frame: number, tick: FrameRequestCallback, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, dpr: number, seed: number, top: number, frameMs: number }} fx @param {number} now */
function step(fx, now) {
  const dt = fx.last === null ? 1 / 60 : Math.min(0.05, (now - fx.last) / 1000);
  fx.last = now;
  noteFrame(fx, dt * 1000);
  updateBits(fx, dt);
  renderBits(fx);
  fx.frame = fx.alive > 0 ? requestAnimationFrame(fx.tick) : 0;
}

/** @param {Fx} fx @param {number} dt */
function updateBits(fx, dt) {
  for (const bit of fx.bits) {
    if (!bit.alive) continue;
    bit.age += dt;
    if (bit.age >= bit.life) {
      bit.alive = false;
      fx.alive -= 1;
      continue;
    }
    bit.vx *= DRAG;
    bit.vy = bit.vy * DRAG + GRAVITY * dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    bit.angle += bit.spin * dt;
  }
}

/** Paper bits: a rectangle that flips as it spins (its width follows the angle). @param {Fx} fx */
function renderBits(fx) {
  const { ctx, dpr, top } = fx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, fx.canvas.width, fx.canvas.height);
  for (const bit of fx.bits) {
    if (!bit.alive) continue;
    const fade = 1 - Math.max(0, (bit.age - bit.life * 0.6) / (bit.life * 0.4));
    ctx.globalAlpha = fade;
    ctx.fillStyle = bit.color;
    const w = bit.size * Math.abs(Math.cos(bit.angle)) + 1;
    ctx.fillRect((bit.x - w / 2) * dpr, (bit.y - top - bit.size / 3) * dpr, w * dpr, (bit.size * 2 * dpr) / 3);
  }
  ctx.globalAlpha = 1;
}
