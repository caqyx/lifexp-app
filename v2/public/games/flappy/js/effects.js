// @ts-check
// Feedback that is not gameplay (docs/v2/PLAN.md 9.1, stage g-3): squash on a flap,
// a short shake and flash on a death, a few sparks on a point. Kept subtle, and all
// off with prefers-reduced-motion (main.js passes `reduced`).

/** @typedef {{ alive: boolean, x: number, y: number, vx: number, vy: number, age: number, life: number, size: number, hue: number }} Particle */

export const SQUASH_TIME = 0.14;
export const SHAKE_TIME = 0.28;
export const SHAKE_MAGNITUDE = 6;
export const FLASH_TIME = 0.22;
const POOL_SIZE = 48;
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
 * A small burst of sparks at a point (a scored pipe).
 * @param {Particle[]} pool @param {number} x @param {number} y @param {() => number} rng
 */
export function spawnBurst(pool, x, y, rng) {
  let left = BURST;
  for (const p of pool) {
    if (left === 0) break;
    if (p.alive) continue;
    const angle = rng() * Math.PI * 2;
    const speed = 60 + rng() * 90;
    Object.assign(p, {
      alive: true,
      x,
      y,
      vx: Math.cos(angle) * speed - 40,
      vy: Math.sin(angle) * speed - 30,
      age: 0,
      life: 0.35 + rng() * 0.2,
      size: 1.5 + rng() * 2,
      hue: rng() < 0.5 ? 0 : 1,
    });
    left -= 1;
  }
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
