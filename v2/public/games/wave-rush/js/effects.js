// @ts-check
// Feedback that is not gameplay (docs/v2/PLAN.md 9.1, stage w-1): a burst of shards and
// a short shake and flash on a crash, a ring when a portal is passed. Kept short and
// subtle, and all off with prefers-reduced-motion (main.js passes `reduced`).

/** @typedef {{ alive: boolean, x: number, y: number, vx: number, vy: number, age: number, life: number, size: number, color: string }} Particle */

export const SHAKE_TIME = 0.3;
/** Shake strength in cells. */
export const SHAKE_CELLS = 0.22;
export const FLASH_TIME = 0.25;
export const RING_TIME = 0.45;
const POOL_SIZE = 64;
const BURST = 24;

/** @param {number} t 0..1 */
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/** A fixed pool, reused: no garbage while playing. @returns {Particle[]} */
export function createParticles() {
  return Array.from({ length: POOL_SIZE }, () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, size: 0, color: '#fff' }));
}

/**
 * Shards flying out of a crash, in the skin's colours (world units: cells).
 * @param {Particle[]} pool @param {number} x @param {number} y @param {string[]} colors @param {() => number} rng
 */
export function spawnBurst(pool, x, y, colors, rng) {
  let left = BURST;
  for (const p of pool) {
    if (left === 0) break;
    if (p.alive) continue;
    const angle = rng() * Math.PI * 2;
    const speed = 2 + rng() * 7;
    Object.assign(p, {
      alive: true,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 0.35 + rng() * 0.35,
      size: 0.08 + rng() * 0.16,
      color: colors[left % colors.length] ?? '#fff',
    });
    left -= 1;
  }
}

/** Moves and ages the particles; they slow down as they go. @param {Particle[]} pool @param {number} dt */
export function updateParticles(pool, dt) {
  const drag = Math.exp(-3.2 * dt);
  for (const p of pool) {
    if (!p.alive) continue;
    p.age += dt;
    if (p.age >= p.life) {
      p.alive = false;
      continue;
    }
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

/**
 * The camera offset (cells) `since` seconds after a crash: fades out, never loops.
 * @param {number} since @param {() => number} rng
 */
export function shakeOffset(since, rng) {
  if (since < 0 || since >= SHAKE_TIME) return { x: 0, y: 0 };
  const strength = SHAKE_CELLS * (1 - since / SHAKE_TIME) ** 2;
  return { x: (rng() * 2 - 1) * strength, y: (rng() * 2 - 1) * strength };
}

/** The flash over the world `since` seconds after a crash (0..1). @param {number} since */
export function flashAlpha(since) {
  if (since < 0 || since >= FLASH_TIME) return 0;
  return 0.4 * (1 - easeOutCubic(since / FLASH_TIME));
}

/** A portal's ring: 0..1 of its growth, or null once it is gone. @param {number} since */
export function ringProgress(since) {
  if (since < 0 || since >= RING_TIME) return null;
  return easeOutCubic(since / RING_TIME);
}
