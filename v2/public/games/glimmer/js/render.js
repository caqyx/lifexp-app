// @ts-check
// Świetlik (Glimmer): drawing. One canvas the size of the arena in art pixels, scaled up by
// the page by a whole number of device pixels with no smoothing (crisp squares). The
// meadow (drawn once per size), the warnings (a pulsing band for beams, the edge markers of a
// wall's gap, a ring's centre), walls and beams, the shots, the wisp with its glow and —
// while focusing — its hitbox, particles, then the HUD in pixel digits and hearts. Reads
// the game only (js/sim.js); effects from its events. With "fewer effects" or reduced
// motion: no shake, no flash, fewer particles.

import { EVENT_RING } from './sim.js';
import { PALETTE, digitsWidth, drawDigits, heart, shotSprites, wisp } from './sprites.js';
import { clockText } from './i18n.js';

/** @typedef {import('./sim.js').Game} Game */
/** @typedef {{ alive: boolean, x: number, y: number, vx: number, vy: number, life: number, max: number, color: string }} Particle */

const PARTICLES = 260;

/** The glow's pixels round the wisp: [dx, dy, ring] (0: the inner ring, 1: the outer). */
const GLOW = /** @type {[number, number, number][]} */ ([]);
for (let dy = -10; dy <= 10; dy++) {
  for (let dx = -10; dx <= 10; dx++) {
    const d = Math.hypot(dx, dy + 0.5);
    if (d > 6.5 && d <= 8.5) GLOW.push([dx, dy, 0]);
    else if (d > 8.5 && d <= 10.5 && (dx * 3 + dy * 5) % 4 === 0) GLOW.push([dx, dy, 1]);
  }
}

/** @param {HTMLCanvasElement} canvas */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2d canvas missing');
  return {
    canvas,
    ctx,
    bg: /** @type {HTMLCanvasElement | null} */ (null),
    shots: shotSprites(),
    wisps: [wisp(0), wisp(1)],
    hurtWisps: [wisp(0, true), wisp(1, true)],
    hearts: [heart(true), heart(false)],
    particles: Array.from({ length: PARTICLES }, () => /** @type {Particle} */ ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#fff' })),
    cursor: 0,
    lastSeq: 0,
    shake: 0,
    flash: 0,
    rings: Array.from({ length: 8 }, () => ({ alive: false, x: 0, y: 0, life: 0, max: 1 })),
    lastClock: 0,
    /** Ambient fireflies of the meadow (positions in art pixels, fixed per size). */
    motes: /** @type {{ x: number, y: number, phase: number }[]} */ ([]),
  };
}

/** @typedef {ReturnType<typeof createRenderer>} Renderer */

/**
 * Sizes the canvas to the arena and paints the meadow behind it: night ground, darker
 * tufts of grass, a few pale flowers, a soft dark border.
 * @param {Renderer} r @param {number} width @param {number} height
 */
export function resizeRenderer(r, width, height) {
  r.canvas.width = width;
  r.canvas.height = height;
  r.ctx.imageSmoothingEnabled = false;
  const bg = document.createElement('canvas');
  bg.width = width;
  bg.height = height;
  const b = /** @type {CanvasRenderingContext2D} */ (bg.getContext('2d'));
  b.fillStyle = PALETTE.n;
  b.fillRect(0, 0, width, height);
  // A fixed pattern (the same every time for a size): tufts, flowers, faint stars.
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < (width * height) / 220; i++) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * height);
    const kind = rand();
    if (kind < 0.55) {
      b.fillStyle = PALETTE.N;
      b.fillRect(x, y, 1, 2);
      b.fillRect(x + 2, y + 1, 1, 1);
    } else if (kind < 0.8) {
      b.fillStyle = PALETTE.m;
      b.fillRect(x, y, 1, 1);
    } else if (kind < 0.9) {
      b.fillStyle = PALETTE.M;
      b.fillRect(x, y, 1, 1);
      b.fillRect(x - 1, y + 1, 3, 1);
    } else {
      b.fillStyle = PALETTE.v;
      b.fillRect(x, y, 1, 1);
    }
  }
  // A dithered dark rim: the arena's edge reads as its edge.
  b.fillStyle = PALETTE.k;
  for (let i = 0; i < 3; i++) {
    for (let x = i % 2; x < width; x += 2) {
      b.fillRect(x, i, 1, 1);
      b.fillRect(x, height - 1 - i, 1, 1);
    }
    for (let y = i % 2; y < height; y += 2) {
      b.fillRect(i, y, 1, 1);
      b.fillRect(width - 1 - i, y, 1, 1);
    }
  }
  r.bg = bg;
  r.motes = Array.from({ length: Math.round((width * height) / 4000) }, () => ({ x: rand() * width, y: rand() * height, phase: rand() * Math.PI * 2 }));
}

/** @param {Renderer} r @param {number} x @param {number} y @param {number} n @param {string} color @param {number} speed */
function burst(r, x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const p = /** @type {Particle} */ (r.particles[r.cursor]);
    r.cursor = (r.cursor + 1) % PARTICLES;
    const a = (i / n) * Math.PI * 2 + (r.cursor % 7) * 0.3;
    const v = speed * (0.5 + ((i * 37) % 10) / 20);
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * v;
    p.vy = Math.sin(a) * v;
    p.max = p.life = 0.35 + ((i * 13) % 5) * 0.06;
    p.color = color;
  }
}

/**
 * Starts the effects of the game's events since the last frame (none with fewer effects,
 * beyond the essentials: a hit still flashes the hearts and shows a few sparks).
 * @param {Renderer} r @param {Game} game @param {boolean} calm
 */
export function consumeEvents(r, game, calm) {
  const from = Math.max(r.lastSeq, game.eventSeq - EVENT_RING);
  for (let seq = from; seq < game.eventSeq; seq++) {
    const e = game.events[seq % EVENT_RING];
    if (!e) continue;
    if (e.type === 'graze') burst(r, e.x, e.y, calm ? 1 : 3, PALETTE.Y, 30);
    else if (e.type === 'hit') {
      burst(r, e.x, e.y, calm ? 6 : 18, PALETTE.r, 70);
      if (!calm) {
        r.shake = 0.3;
        r.flash = 0.2;
      }
    } else if (e.type === 'mercy') burst(r, e.x, e.y, calm ? 1 : 4, PALETTE.P, 25);
    else if (e.type === 'ring') {
      const ring = r.rings.find((x) => !x.alive) ?? r.rings[0];
      if (ring) {
        ring.alive = true;
        ring.x = e.x;
        ring.y = e.y;
        ring.life = ring.max = e.value;
      }
    } else if (e.type === 'over') burst(r, e.x, e.y, calm ? 8 : 30, PALETTE.y, 60);
  }
  r.lastSeq = game.eventSeq;
}

/** Forgets the effects of the last run. @param {Renderer} r @param {Game} game */
export function resetRenderer(r, game) {
  r.lastSeq = game.eventSeq;
  r.shake = r.flash = 0;
  for (const p of r.particles) p.alive = false;
  for (const ring of r.rings) ring.alive = false;
}

/**
 * A beam's warning: a faint band as wide as the beam will be, pulsing as the moment nears,
 * with a dashed line down its middle that crawls along it.
 * @param {CanvasRenderingContext2D} ctx @param {Game} game @param {number} px @param {number} py @param {number} angle
 * @param {number} half @param {number} urgency 0 (just started) … 1 (about to burn) @param {number} clock
 */
function beamWarning(ctx, game, px, py, angle, half, urgency, clock) {
  const len = game.width + game.height;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  const pulse = Math.floor(clock * (6 + urgency * 10)) % 2 === 0;
  ctx.globalAlpha = 0.14 + urgency * 0.22 + (pulse ? 0.08 : 0);
  ctx.fillStyle = PALETTE.r;
  ctx.fillRect(-len, -half, len * 2, half * 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = pulse || urgency > 0.7 ? PALETTE.R : PALETTE.r;
  const shift = (clock * 40) % 8;
  for (let t = -len - shift; t < len; t += 8) ctx.fillRect(t, -0.5, 4, 1);
  ctx.restore();
}

/** A solid beam: a wide pink body, a white core. @param {CanvasRenderingContext2D} ctx @param {Game} game @param {import('./sim.js').Beam} b @param {number} clock */
function beamBody(ctx, game, b, clock) {
  const len = game.width + game.height;
  ctx.save();
  ctx.translate(b.px, b.py);
  ctx.rotate(b.angle);
  const flick = Math.floor(clock * 30) % 2;
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(-len, -b.half - 1, len * 2, b.half * 2 + 2);
  ctx.fillStyle = PALETTE.r;
  ctx.fillRect(-len, -b.half, len * 2, b.half * 2);
  ctx.fillStyle = flick ? PALETTE.w : PALETTE.R;
  ctx.fillRect(-len, -1, len * 2, 2);
  ctx.restore();
}

/**
 * One frame. `view.focus`: the hitbox shows; `view.calm`: no shake or flash.
 * @param {Renderer} r @param {Game} game @param {{ clock: number, calm: boolean, playing: boolean }} view
 */
export function renderFrame(r, game, view) {
  const ctx = r.ctx;
  const dt = Math.max(0, Math.min(0.1, view.clock - r.lastClock));
  r.lastClock = view.clock;
  let ox = 0;
  let oy = 0;
  if (r.shake > 0) {
    r.shake = Math.max(0, r.shake - dt);
    const amp = Math.ceil(r.shake * 10);
    ox = ((Math.floor(view.clock * 60) * 7) % (amp * 2 + 1)) - amp;
    oy = ((Math.floor(view.clock * 60) * 11) % (amp * 2 + 1)) - amp;
  }
  ctx.setTransform(1, 0, 0, 1, ox, oy);
  if (r.bg) ctx.drawImage(r.bg, 0, 0);
  // The meadow's fireflies: a pale blink here and there.
  for (const m of r.motes) {
    const glow = Math.sin(view.clock * 1.7 + m.phase);
    if (glow < 0.4) continue;
    ctx.fillStyle = glow > 0.85 ? PALETTE.Y : PALETTE.M;
    ctx.fillRect(Math.round(m.x + Math.sin(view.clock * 0.4 + m.phase) * 6), Math.round(m.y), 1, 1);
  }

  // Warnings first (under everything that can hurt).
  const blink = Math.floor(view.clock * 8) % 2 === 0;
  for (const b of game.beams) {
    if (!b.alive || b.warn <= 0) continue;
    const urgency = 1 - b.warn / b.warnTotal;
    beamWarning(ctx, game, b.px, b.py, b.angle, b.half, urgency, view.clock);
    // A sweep: where it will end, too (a thin line), so the safe side is plain.
    if (b.spin !== 0) beamWarning(ctx, game, b.px, b.py, b.angle + b.sweep, 0.5, urgency * 0.5, view.clock);
  }
  for (const w of game.walls) {
    if (!w.alive || w.warn <= 0) continue;
    // Gold brackets at the edge it will come from, round the gap; red where it is solid.
    const entering = w.vel > 0 ? 1 : (w.horizontal ? game.height : game.width) - 3;
    ctx.fillStyle = blink || w.warn < 0.35 ? PALETTE.r : PALETTE.R;
    const span = w.horizontal ? game.width : game.height;
    for (let a = 0; a < span; a += 4) {
      if (a + 3 > w.gapA && a < w.gapB) continue;
      if (w.horizontal) ctx.fillRect(a, entering, 3, 2);
      else ctx.fillRect(entering, a, 2, 3);
    }
    ctx.fillStyle = PALETTE.y;
    for (const g of [w.gapA, w.gapB]) {
      if (w.horizontal) ctx.fillRect(Math.round(g), entering - 1, 1, 4);
      else ctx.fillRect(entering - 1, Math.round(g), 4, 1);
    }
  }
  for (const ring of r.rings) {
    if (!ring.alive) continue;
    ring.life -= dt;
    if (ring.life <= 0) {
      ring.alive = false;
      continue;
    }
    const k = 1 - ring.life / ring.max;
    const rad = 3 + k * 8;
    ctx.fillStyle = blink ? PALETTE.V : PALETTE.p;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.fillRect(Math.round(ring.x + Math.cos(a) * rad), Math.round(ring.y + Math.sin(a) * rad), 1, 1);
    }
  }

  // Walls and beams that burn.
  for (const w of game.walls) {
    if (!w.alive || w.warn > 0) continue;
    const span = w.horizontal ? game.width : game.height;
    const a0 = Math.round(w.pos - w.thick / 2);
    for (const [from, to] of [[0, w.gapA], [w.gapB, span]]) {
      const f = Math.round(from ?? 0);
      const len = Math.round((to ?? 0) - (from ?? 0));
      if (len <= 0) continue;
      ctx.fillStyle = PALETTE.k;
      if (w.horizontal) ctx.fillRect(f - 1, a0 - 1, len + 2, w.thick + 2);
      else ctx.fillRect(a0 - 1, f - 1, w.thick + 2, len + 2);
      ctx.fillStyle = PALETTE.M;
      if (w.horizontal) ctx.fillRect(f, a0, len, w.thick);
      else ctx.fillRect(a0, f, w.thick, len);
      ctx.fillStyle = PALETTE.V;
      if (w.horizontal) ctx.fillRect(f, a0, len, 1);
      else ctx.fillRect(a0, f, 1, len);
      ctx.fillStyle = PALETTE.m;
      for (let s = 3; s < len; s += 6) {
        if (w.horizontal) ctx.fillRect(f + s, a0 + 2, 1, w.thick - 3);
        else ctx.fillRect(a0 + 2, f + s, w.thick - 3, 1);
      }
    }
  }
  for (const b of game.beams) if (b.alive && b.warn <= 0) beamBody(ctx, game, b, view.clock);

  // Shots.
  for (const s of game.shots) {
    if (!s.alive || s.delay > 0) continue;
    const img = r.shots[s.kind];
    let alpha = 1;
    if (s.life !== Infinity && s.life - s.age < 0.6) alpha = Math.floor((s.life - s.age) * 10) % 2 ? 0.4 : 1;
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(img, Math.round(s.x - img.width / 2), Math.round(s.y - img.height / 2));
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  // The wisp: a soft glow, the sprite (blinking pale after a hit), the hitbox when focusing.
  const p = game.player;
  const frame = Math.floor(view.clock * (p.moving ? 10 : 4)) % 2;
  const blinkOff = p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0;
  const px = Math.round(p.x);
  const py = Math.round(p.y);
  if (game.phase === 'play') {
    // The glow: dithered rings of light round the wisp (pixel art, no blending), the
    // checkerboard's parity turning with the frame so it shimmers.
    const parity = frame;
    for (const [dx, dy, ring] of GLOW) {
      if (((dx + dy + parity) & 1) !== 0) continue;
      ctx.fillStyle = ring === 0 ? PALETTE.M : PALETTE.m;
      ctx.fillRect(px + dx, py + dy, 1, 1);
    }
    const img = (blinkOff ? r.hurtWisps : r.wisps)[frame] ?? r.wisps[0];
    if (img) {
      if (p.face < 0) {
        ctx.save();
        ctx.translate(px + 1, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -6, py - 7);
        ctx.restore();
      } else ctx.drawImage(img, px - 6, py - 7);
    }
    if (p.focus) {
      // The hitbox (what can be hit): a white 3 × 3 dot with a red heart pixel, in an ink ring.
      ctx.fillStyle = PALETTE.k;
      ctx.fillRect(px - 2, py - 1, 5, 3);
      ctx.fillRect(px - 1, py - 2, 3, 5);
      ctx.fillStyle = PALETTE.w;
      ctx.fillRect(px - 1, py - 1, 3, 3);
      ctx.fillStyle = PALETTE.r;
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // Particles.
  for (const part of r.particles) {
    if (!part.alive) continue;
    part.life -= dt;
    if (part.life <= 0) {
      part.alive = false;
      continue;
    }
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vx *= 0.92;
    part.vy *= 0.92;
    ctx.fillStyle = part.color;
    ctx.fillRect(Math.round(part.x), Math.round(part.y), 1, 1);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (r.flash > 0 && !view.calm) {
    r.flash = Math.max(0, r.flash - dt);
    ctx.globalAlpha = Math.min(0.2, r.flash);
    ctx.fillStyle = PALETTE.r;
    ctx.fillRect(0, 0, game.width, game.height);
    ctx.globalAlpha = 1;
  }

  // The HUD: score (big), the clock (small) at the top left, hearts at the top right.
  if (view.playing) {
    drawDigits(ctx, String(game.score), 6, 6, PALETTE.Y, 2);
    drawDigits(ctx, clockText(game.time - game.startTime), 6, 19, PALETTE.V, 1);
    if (p.maxHp <= 5) {
      for (let i = 0; i < p.maxHp; i++) {
        const img = r.hearts[i < p.hp ? 0 : 1];
        if (img) ctx.drawImage(img, game.width - 8 - (p.maxHp - i) * 10, 6);
      }
    } else {
      // Many lives (a test switch): one heart and the number.
      const text = String(p.hp);
      const x = game.width - 6 - digitsWidth(text) * 2;
      drawDigits(ctx, text, x, 6, PALETTE.R, 2);
      const img = r.hearts[0];
      if (img) ctx.drawImage(img, x - 12, 7);
    }
  }
}

/** The width in art pixels of the score as the HUD draws it (for tests and layout). @param {number} score */
export function scoreWidth(score) {
  return digitsWidth(String(score)) * 2;
}
