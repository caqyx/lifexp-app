// @ts-check
// Strażnicy Doliny: the juice — sparks, rings and floating gold — kept apart from the
// rules: js/render.js turns the game's events into effects here and draws them; the
// game never reads them. Fixed pools, no allocation per frame. With reduced motion the
// renderer does not start any (a hit still flashes the enemy, which is not motion).

/** @typedef {{ alive: boolean, x: number, y: number, vx: number, vy: number, life: number, max: number, size: number, color: string }} Spark */
/** @typedef {{ alive: boolean, x: number, y: number, from: number, to: number, life: number, max: number, color: string }} Ring */
/** @typedef {{ alive: boolean, x: number, y: number, life: number, max: number, text: string, color: string }} Float */

const SPARKS = 220;
const RINGS = 48;
const FLOATS = 40;

/** Number labels made once ("+1" … "+200"), so a kill allocates no string. */
const PLUS = Array.from({ length: 201 }, (_, n) => `+${n}`);

/** @param {number} n */
export function plusLabel(n) {
  return PLUS[Math.max(0, Math.min(200, Math.round(n)))] ?? '+';
}

export function createEffects() {
  return {
    sparks: Array.from({ length: SPARKS }, () => /** @type {Spark} */ ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 0, color: '' })),
    rings: Array.from({ length: RINGS }, () => /** @type {Ring} */ ({ alive: false, x: 0, y: 0, from: 0, to: 0, life: 0, max: 1, color: '' })),
    floats: Array.from({ length: FLOATS }, () => /** @type {Float} */ ({ alive: false, x: 0, y: 0, life: 0, max: 1, text: '', color: '' })),
    /** A deterministic spread for the sparks (no Math.random: screenshots repeat). */
    seed: 1,
  };
}

/** @typedef {ReturnType<typeof createEffects>} Effects */

/** @template {{ alive: boolean }} T @param {T[]} pool @returns {T | null} */
function freeSlot(pool) {
  for (let i = 0; i < pool.length; i++) {
    const item = /** @type {T} */ (pool[i]);
    if (!item.alive) return item;
  }
  return null;
}

/** @param {Effects} fx */
function nextRandom(fx) {
  fx.seed = (fx.seed * 1103515245 + 12345) & 0x7fffffff;
  return fx.seed / 0x7fffffff;
}

/**
 * A burst of `count` sparks at a map point (tiles), flying outwards.
 * @param {Effects} fx @param {number} x @param {number} y @param {number} count @param {string} color @param {number} speed
 */
export function addBurst(fx, x, y, count, color, speed) {
  for (let i = 0; i < count; i++) {
    const s = freeSlot(fx.sparks);
    if (!s) return;
    const angle = nextRandom(fx) * Math.PI * 2;
    const v = speed * (0.4 + nextRandom(fx) * 0.8);
    s.alive = true;
    s.x = x;
    s.y = y;
    s.vx = Math.cos(angle) * v;
    s.vy = Math.sin(angle) * v;
    s.max = s.life = 0.35 + nextRandom(fx) * 0.3;
    s.size = 0.05 + nextRandom(fx) * 0.05;
    s.color = color;
  }
}

/** @param {Effects} fx @param {number} x @param {number} y @param {number} from @param {number} to @param {number} time @param {string} color */
export function addRing(fx, x, y, from, to, time, color) {
  const r = freeSlot(fx.rings);
  if (!r) return;
  r.alive = true;
  r.x = x;
  r.y = y;
  r.from = from;
  r.to = to;
  r.max = r.life = time;
  r.color = color;
}

/** @param {Effects} fx @param {number} x @param {number} y @param {string} text @param {string} color */
export function addFloat(fx, x, y, text, color) {
  const f = freeSlot(fx.floats);
  if (!f) return;
  f.alive = true;
  f.x = x;
  f.y = y;
  f.max = f.life = 0.8;
  f.text = text;
  f.color = color;
}

/**
 * Moves and ages every effect by `dt` seconds of game time.
 * @param {Effects} fx @param {number} dt
 */
export function updateEffects(fx, dt) {
  for (const s of fx.sparks) {
    if (!s.alive) continue;
    s.life -= dt;
    if (s.life <= 0) {
      s.alive = false;
      continue;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 0.9;
    s.vy *= 0.9;
  }
  for (const r of fx.rings) {
    if (!r.alive) continue;
    r.life -= dt;
    if (r.life <= 0) r.alive = false;
  }
  for (const f of fx.floats) {
    if (!f.alive) continue;
    f.life -= dt;
    if (f.life <= 0) f.alive = false;
  }
}

/** @param {Effects} fx */
export function clearEffects(fx) {
  for (const s of fx.sparks) s.alive = false;
  for (const r of fx.rings) r.alive = false;
  for (const f of fx.floats) f.alive = false;
}
