// @ts-check
// Strażnicy Doliny: pixel particles and ambience (docs/v2/PLAN.md 9.1, td-3), in art
// pixels on the board — sparks, smoke puffs, debris that bounces and settles, frost snow,
// arrow trails, scorch marks that fade, enemies falling apart, and each map's own air:
// butterflies and petals on Łąka, drifting dust on Kanion, fireflies and fog on Mokradła.
// Fixed pools, no allocation per frame; the renderer starts them from the game's events.
// With reduced motion nothing is started and the ambience stands still.

import { PALETTE } from './pixelart.js';

/** @typedef {'spark' | 'smoke' | 'debris' | 'snow' | 'trail' | 'ember'} Kind */
/** @typedef {{ alive: boolean, kind: Kind, x: number, y: number, vx: number, vy: number, floor: number, life: number, max: number, color: string, size: number }} Particle */
/** @typedef {{ alive: boolean, x: number, y: number, r: number, life: number, max: number }} Decal */
/** @typedef {{ alive: boolean, x: number, y: number, img: HTMLCanvasElement | null, flash: HTMLCanvasElement | null, life: number, max: number }} Corpse */
/** @typedef {{ x: number, y: number, vx: number, vy: number, phase: number, color: string }} Mote */
/** @typedef {{ alive: boolean, x: number, y: number, r: number, life: number, max: number }} Boom */

const POOL = 420;
const DECALS = 24;
const CORPSES = 40;
const BOOMS = 12;
const BOOM_LIFE = 0.24;
export const GROUND_TO_AIR = 9;

export function createParticles() {
  return {
    bits: Array.from({ length: POOL }, () => /** @type {Particle} */ ({ alive: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, floor: 0, life: 0, max: 1, color: '#fff', size: 1 })),
    decals: Array.from({ length: DECALS }, () => /** @type {Decal} */ ({ alive: false, x: 0, y: 0, r: 4, life: 0, max: 1 })),
    corpses: Array.from({ length: CORPSES }, () => /** @type {Corpse} */ ({ alive: false, x: 0, y: 0, img: null, flash: null, life: 0, max: 1 })),
    booms: Array.from({ length: BOOMS }, () => /** @type {Boom} */ ({ alive: false, x: 0, y: 0, r: 4, life: 0, max: 1 })),
    motes: /** @type {Mote[]} */ ([]),
    ambience: /** @type {'meadow' | 'canyon' | 'marsh'} */ ('meadow'),
    seed: 3,
    cursor: 0,
  };
}

/** @typedef {ReturnType<typeof createParticles>} Particles */

/** A small repeatable random. @param {Particles} p */
function rand(p) {
  p.seed = (p.seed * 1103515245 + 12345) & 0x7fffffff;
  return p.seed / 0x7fffffff;
}

/** The next free slot (round robin; the oldest is reused when all are busy). @param {Particles} p */
function slot(p) {
  for (let i = 0; i < POOL; i++) {
    const bit = /** @type {Particle} */ (p.bits[(p.cursor + i) % POOL]);
    if (!bit.alive) {
      p.cursor = (p.cursor + i + 1) % POOL;
      return bit;
    }
  }
  const bit = /** @type {Particle} */ (p.bits[p.cursor]);
  p.cursor = (p.cursor + 1) % POOL;
  return bit;
}

/**
 * Starts `count` particles of a kind at an art point.
 * @param {Particles} p @param {Kind} kind @param {number} x @param {number} y @param {number} count
 * @param {string} color @param {number} speed
 */
export function emit(p, kind, x, y, count, color, speed) {
  for (let i = 0; i < count; i++) {
    const bit = slot(p);
    const a = rand(p) * Math.PI * 2;
    const v = speed * (0.4 + rand(p) * 0.8);
    bit.alive = true;
    bit.kind = kind;
    bit.x = x + (rand(p) - 0.5) * 3;
    bit.y = y + (rand(p) - 0.5) * 3;
    bit.vx = Math.cos(a) * v;
    bit.vy = kind === 'smoke' ? -6 - rand(p) * 8 : kind === 'snow' ? 4 + rand(p) * 6 : Math.sin(a) * v - (kind === 'debris' ? speed * 0.8 : 0);
    bit.floor = y + 2 + rand(p) * 4;
    bit.max = bit.life = kind === 'smoke' ? 0.6 + rand(p) * 0.5 : kind === 'trail' ? 0.18 : kind === 'debris' ? 0.9 + rand(p) * 0.6 : kind === 'snow' ? 0.8 + rand(p) * 0.5 : 0.3 + rand(p) * 0.3;
    bit.color = color;
    bit.size = kind === 'smoke' ? 1 : kind === 'debris' ? (rand(p) > 0.6 ? 2 : 1) : 1;
  }
}

/** A scorch mark that fades over a few seconds. @param {Particles} p @param {number} x @param {number} y @param {number} r */
export function scorch(p, x, y, r) {
  const d = p.decals.find((q) => !q.alive) ?? p.decals[0];
  if (!d) return;
  d.alive = true;
  d.x = x;
  d.y = y;
  d.r = r;
  d.max = d.life = 4;
}

/**
 * A fireball where a shell lands: a white-hot core in rings of gold, orange and red that
 * swells to `r` and burns out in a quarter of a second.
 * @param {Particles} p @param {number} x @param {number} y @param {number} r
 */
export function boom(p, x, y, r) {
  const b = p.booms.find((q) => !q.alive) ?? p.booms[0];
  if (!b) return;
  b.alive = true;
  b.x = x;
  b.y = y;
  b.r = r;
  b.max = b.life = BOOM_LIFE;
}

/**
 * An enemy falling apart where it died: a white flash, then its picture squashing and fading.
 * @param {Particles} p @param {number} x @param {number} y @param {HTMLCanvasElement} img @param {HTMLCanvasElement} flash
 */
export function corpse(p, x, y, img, flash) {
  const c = p.corpses.find((q) => !q.alive) ?? p.corpses[0];
  if (!c) return;
  c.alive = true;
  c.x = x;
  c.y = y;
  c.img = img;
  c.flash = flash;
  c.max = c.life = 0.4;
}

/**
 * The map's air: where its motes start (art pixels) and what they are.
 * @param {Particles} p @param {'meadow' | 'canyon' | 'marsh'} kind @param {number} width @param {number} height
 */
export function setAmbience(p, kind, width, height) {
  p.ambience = kind;
  const count = kind === 'meadow' ? 14 : kind === 'canyon' ? 26 : 22;
  p.motes = Array.from({ length: count }, (_, i) => ({
    x: rand(p) * width,
    y: rand(p) * height,
    vx: kind === 'canyon' ? 3 + rand(p) * 4 : (rand(p) - 0.5) * 6,
    vy: kind === 'meadow' ? 2 + rand(p) * 3 : (rand(p) - 0.5) * 2,
    phase: rand(p) * Math.PI * 2,
    color: kind === 'meadow' ? (i % 3 === 0 ? PALETTE.y : i % 3 === 1 ? PALETTE.P : PALETTE.w) : kind === 'canyon' ? (i % 2 ? PALETTE.B : PALETTE.Y) : i % 2 ? PALETTE.y : PALETTE.F,
  }));
}

/**
 * Moves everything by `dt` seconds (art pixels a second).
 * @param {Particles} p @param {number} dt @param {number} width @param {number} height @param {boolean} still
 */
export function updateParticles(p, dt, width, height, still) {
  for (const b of p.bits) {
    if (!b.alive) continue;
    b.life -= dt;
    if (b.life <= 0) {
      b.alive = false;
      continue;
    }
    if (b.kind === 'debris' || b.kind === 'spark') b.vy += 160 * dt;
    if (b.kind === 'snow') b.vx = Math.sin(b.life * 9) * 6;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.kind === 'debris' && b.y > b.floor) {
      b.y = b.floor;
      b.vy *= -0.3;
      b.vx *= 0.5;
    }
    if (b.kind === 'smoke') {
      b.vx *= 0.96;
      b.size = b.life / b.max > 0.6 ? 1 : b.life / b.max > 0.3 ? 2 : 3;
    }
  }
  for (const d of p.decals) {
    if (!d.alive) continue;
    d.life -= dt;
    if (d.life <= 0) d.alive = false;
  }
  for (const c of p.corpses) {
    if (!c.alive) continue;
    c.life -= dt;
    if (c.life <= 0) c.alive = false;
  }
  for (const b of p.booms) {
    if (!b.alive) continue;
    b.life -= dt;
    if (b.life <= 0) b.alive = false;
  }
  if (still) return;
  for (const m of p.motes) {
    m.phase += dt * (p.ambience === 'marsh' ? 2.5 : 4);
    m.x += (m.vx + Math.sin(m.phase) * (p.ambience === 'meadow' ? 8 : 2)) * dt;
    m.y += (m.vy + Math.cos(m.phase * 0.7) * (p.ambience === 'meadow' ? 4 : 2)) * dt;
    if (m.x < -4) m.x = width + 3;
    if (m.x > width + 4) m.x = -3;
    if (m.y < -4) m.y = height + 3;
    if (m.y > height + 4) m.y = -3;
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Particles} p */
export function renderDecals(ctx, p) {
  ctx.fillStyle = PALETTE.k;
  for (const d of p.decals) {
    if (!d.alive) continue;
    ctx.globalAlpha = 0.45 * (d.life / d.max);
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    ctx.fillRect(x - d.r, y - 1, d.r * 2 + 1, 3);
    ctx.fillRect(x - d.r + 2, y - 2, d.r * 2 - 3, 5);
    ctx.fillRect(x - 1, y - 3, 3, 7);
  }
  ctx.globalAlpha = 1;
}

/** @param {CanvasRenderingContext2D} ctx @param {Particles} p */
export function renderCorpses(ctx, p) {
  for (const c of p.corpses) {
    if (!c.alive || !c.img || !c.flash) continue;
    const k = 1 - c.life / c.max;
    const img = k < 0.25 ? c.flash : c.img;
    const h = Math.max(1, Math.round(img.height * (k < 0.25 ? 1 : k < 0.55 ? 0.6 : 0.3)));
    ctx.globalAlpha = k < 0.55 ? 1 : 0.6;
    ctx.drawImage(img, Math.round(c.x - img.width / 2), Math.round(c.y - h), img.width, h);
  }
  ctx.globalAlpha = 1;
}

/** Pixel rings of a fireball, outside in. */
const BOOM_RINGS = /** @type {const} */ ([['r', 1], ['o', 0.8], ['O', 0.6], ['y', 0.4], ['Y', 0.2]]);

/** @param {CanvasRenderingContext2D} ctx @param {Particles} p */
export function renderBooms(ctx, p) {
  for (const b of p.booms) {
    if (!b.alive) continue;
    const k = 1 - b.life / b.max;
    // Swells fast, then the hot middle goes out first.
    const r = Math.max(2, Math.round(b.r * Math.min(1, 0.45 + k * 1.6)));
    const cool = k > 0.6 ? 2 : k > 0.35 ? 1 : 0;
    for (let i = 0; i < BOOM_RINGS.length - cool; i++) {
      const [c, f] = /** @type {readonly [keyof typeof PALETTE, number]} */ (BOOM_RINGS[i]);
      const rr = Math.max(1, Math.round(r * f));
      ctx.fillStyle = PALETTE[c];
      for (let dy = -rr; dy <= rr; dy++) {
        const half = Math.round(rr * Math.sqrt(1 - (dy * dy) / (rr * rr + 0.01)));
        // Flattened a little: the ground is seen from above at a slant.
        ctx.fillRect(Math.round(b.x) - half, Math.round(b.y) + Math.round(dy * 0.75), half * 2 + 1, 1);
      }
    }
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Particles} p */
export function renderParticles(ctx, p) {
  for (const b of p.bits) {
    if (!b.alive) continue;
    const k = b.life / b.max;
    ctx.fillStyle = b.color;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (b.kind === 'smoke') {
      // A puff in two steps of see-through, a pixel growing to a plus and a rounded square.
      ctx.globalAlpha = k > 0.5 ? 0.7 : 0.4;
      if (b.size === 1) ctx.fillRect(x, y, 1, 1);
      else if (b.size === 2) {
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
      } else {
        ctx.fillRect(x - 1, y - 1, 3, 3);
        ctx.fillRect(x - 2, y, 1, 1);
        ctx.fillRect(x + 2, y, 1, 1);
        ctx.fillRect(x, y - 2, 1, 1);
      }
      continue;
    }
    ctx.globalAlpha = b.kind === 'trail' ? (k > 0.5 ? 0.8 : 0.4) : k < 0.3 ? 0.6 : 1;
    const s = b.size;
    ctx.fillRect(Math.round(b.x - (s - 1) / 2), Math.round(b.y - (s - 1) / 2), s, s);
  }
  ctx.globalAlpha = 1;
}

/**
 * The map's air: butterflies and petals (Łąka), dust (Kanion), blinking fireflies (Mokradła).
 * @param {CanvasRenderingContext2D} ctx @param {Particles} p @param {number} clock
 */
export function renderAmbience(ctx, p, clock) {
  for (let i = 0; i < p.motes.length; i++) {
    const m = /** @type {Mote} */ (p.motes[i]);
    const x = Math.round(m.x);
    const y = Math.round(m.y);
    ctx.fillStyle = m.color;
    if (p.ambience === 'meadow' && i % 3 === 0) {
      // A butterfly: two wings that open and close.
      const open = Math.floor(clock * 8 + i) % 2 === 0;
      ctx.fillRect(x - (open ? 2 : 1), y, open ? 2 : 1, 2);
      ctx.fillRect(x + 1, y, open ? 2 : 1, 2);
      ctx.fillStyle = PALETTE.k;
      ctx.fillRect(x, y, 1, 2);
    } else if (p.ambience === 'marsh') {
      const glow = (Math.sin(m.phase * 2) + 1) / 2;
      if (glow < 0.35) continue;
      ctx.globalAlpha = glow;
      ctx.fillRect(x, y, 1, 1);
      ctx.globalAlpha = glow * 0.3;
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = p.ambience === 'canyon' ? 0.6 : 1;
      ctx.fillRect(x, y, 1, 1);
      ctx.globalAlpha = 1;
    }
  }
}
