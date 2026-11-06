// @ts-check
// Feedback that is not gameplay (docs/v2/PLAN.md 9.1, g-3, q-own): a puff of pixels on
// a flap, sparks on a point, feathers, a short shake and a two-step flash on a death.
// Kept subtle, and all off with prefers-reduced-motion (main.js passes `reduced`).
// Particles live in world units; render.js draws them as 1- or 2-pixel squares.

/** @typedef {{ alive: boolean, x: number, y: number, vx: number, vy: number, age: number, life: number, size: number, hue: number }} Particle */

export const SQUASH_TIME = 0.14;
export const SHAKE_TIME = 0.28;
export const SHAKE_MAGNITUDE = 6;
export const FLASH_TIME = 0.22;
const POOL_SIZE = 64;
const BURST = 10;

/** @param {number} t 0..1 */
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * The bird's scale after a flap `since` seconds ago: short and wide, then back.
 * @param {number} since
 */
export function squashScale(since) {
  const t = Math.min(1, Math.max(0, since / SQUASH_TIME));
  const amount = 1 - easeOutCubic(t);
  return { x: 1 + 0.22 * amount, y: 1 - 0.18 * amount };
}

/**
 * The camera offset `since` seconds after a death: fades out, never loops.
 * @param {number} since @param {() => number} rng
 */
export function shakeOffset(since, rng) {
  if (since < 0 || since >= SHAKE_TIME) return { x: 0, y: 0 };
  const strength = SHAKE_MAGNITUDE * (1 - since / SHAKE_TIME) ** 2;
  return { x: (rng() * 2 - 1) * strength, y: (rng() * 2 - 1) * strength };
}

/**
 * The white flash over the world `since` seconds after a death (0..1 opacity).
 * @param {number} since
 */
export function flashAlpha(since) {
  if (since < 0 || since >= FLASH_TIME) return 0;
  return 0.55 * (1 - easeOutCubic(since / FLASH_TIME));
}

/** A fixed pool, reused: no garbage while playing. @returns {Particle[]} */
export function createParticles() {
  return Array.from({ length: POOL_SIZE }, () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, size: 0, hue: 0 }));
}

/**
 * Wakes up to `count` sleeping particles at a point, flying out at `speed` (± half),
 * nudged by (`pushX`, `pushY`), coloured by `hues` (render.js's colour list).
 * @param {Particle[]} pool @param {number} x @param {number} y @param {() => number} rng
 * @param {{ count: number, speed: number, pushX: number, pushY: number, life: number, hues: readonly number[] }} kind
 */
function spawn(pool, x, y, rng, kind) {
  let left = kind.count;
  for (const p of pool) {
    if (left === 0) break;
    if (p.alive) continue;
    const angle = rng() * Math.PI * 2;
    const speed = kind.speed * (0.5 + rng());
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed + kind.pushX;
    p.vy = Math.sin(angle) * speed + kind.pushY;
    p.age = 0;
    p.life = kind.life * (0.8 + rng() * 0.4);
    p.size = 1.5 + rng() * 2;
    p.hue = kind.hues[Math.floor(rng() * kind.hues.length)] ?? 0;
    left -= 1;
  }
}

const SPARKS = { count: BURST, speed: 100, pushX: -40, pushY: -30, life: 0.45, hues: [0, 1] };
const FEATHERS = { count: 14, speed: 140, pushX: -20, pushY: -90, life: 0.7, hues: [2, 3] };
const PUFF = { count: 3, speed: 30, pushX: -70, pushY: 20, life: 0.25, hues: [3] };

/**
 * A small burst of sparks at a point (a scored pipe).
 * @param {Particle[]} pool @param {number} x @param {number} y @param {() => number} rng
 */
export function spawnBurst(pool, x, y, rng) {
  spawn(pool, x, y, rng, SPARKS);
}

/**
 * Feathers when the bird hits something.
 * @param {Particle[]} pool @param {number} x @param {number} y @param {() => number} rng
 */
export function spawnFeathers(pool, x, y, rng) {
  spawn(pool, x, y, rng, FEATHERS);
}

/**
 * A puff behind the bird on a flap.
 * @param {Particle[]} pool @param {number} x @param {number} y @param {() => number} rng
 */
export function spawnPuff(pool, x, y, rng) {
  spawn(pool, x, y, rng, PUFF);
}

/**
 * Moves the sparks and retires the old ones.
 * @param {Particle[]} pool @param {number} dt
 */
export function updateParticles(pool, dt) {
  for (const p of pool) {
    if (!p.alive) continue;
    p.age += dt;
    if (p.age >= p.life) {
      p.alive = false;
      continue;
    }
    p.vy += 220 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}
