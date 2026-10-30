// @ts-check
// Ship Rush's backgrounds (docs/v2/PLAN.md 9.1, stage s-1), back to front: the sky, a sun
// or a moon, stars and an aurora at night, three layers of clouds scrolling slower than
// the level (parallax), birds by day, rain and lightning in the storm, the glow of the
// horizon far below at night, and floating motes. Clouds are painted once per look and
// size into small canvases and only copied per frame. With reduced motion nothing moves
// on its own and the storm does not flash.
import { beatPulse, hash } from '../../../_engine/render/backdrop.js';
import { screenY } from '../../../_engine/render/view.js';

export { beatPulse };

/**
 * @typedef {import('./themes.js').Theme} Theme
 * @typedef {import('../../../_engine/render/view.js').View} View
 * @typedef {{ time: number, pulse: number, reduced: boolean }} Clock
 */

/** Cloud layers: depth (share of the level's scroll), size (cells), height band (world y). */
const LAYERS = /** @type {const} */ ([
  { key: 'far', depth: 0.06, size: 2.2, top: -1, bottom: 4.5, span: 14 },
  { key: 'mid', depth: 0.16, size: 3.4, top: 0, bottom: 9, span: 11 },
  { key: 'near', depth: 0.34, size: 4.6, top: 7.5, bottom: 13, span: 13 },
]);
/** Lightning: one strike in each period, at a place of its own. */
const STRIKE = { period: 4.6, length: 0.32 };

/** @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th */
function drawSky(ctx, v, th) {
  const g = ctx.createLinearGradient(0, 0, 0, v.height);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(0.55, th.sky[1]);
  g.addColorStop(1, th.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.width, v.height);
  const haze = ctx.createRadialGradient(v.width * 0.5, screenY(v, 12), 0, v.width * 0.5, screenY(v, 12), Math.max(v.width, v.height) * 0.75);
  haze.addColorStop(0, th.haze);
  haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, v.width, v.height);
}

/**
 * The sun by day (a glow and slow rays) or the moon at night (a crescent).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {Clock} clock
 */
function drawLight(ctx, v, th, clock) {
  const sun = th.sun;
  if (!sun) return;
  const cx = v.width * sun.x;
  const cy = screenY(v, sun.y);
  const r = sun.r * v.cell;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * (th.backdrop === 'day' ? 5.5 : 3.5));
  glow.addColorStop(0, sun.glow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 6, cy - r * 6, r * 12, r * 12);
  if (th.backdrop === 'day' || th.backdrop === 'space') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 245, 210, 0.07)';
    const spin = clock.reduced ? 0 : clock.time * 0.03;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = spin + (i / 12) * Math.PI * 2;
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r * 9, a, a + 0.12);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = sun.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // A crescent: the disc, with the sky's colour taken out of one side.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sun.color;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx + r * 0.45, cy - r * 0.2, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Stars that twinkle (still with reduced motion), barely scrolling.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {number} camX @param {Clock} clock @param {number} count
 */
function drawStars(ctx, v, camX, clock, count) {
  const span = v.width + 40;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < count; i++) {
    const x = ((((hash(i + 11) * span - camX * 0.02 * v.cell) % span) + span) % span) - 20;
    const y = hash(i + 211) * v.height * 0.72;
    const tw = clock.reduced ? 0.75 : 0.55 + 0.45 * Math.sin(clock.time * (0.8 + hash(i + 5) * 2.4) + i * 1.7);
    ctx.globalAlpha = (0.3 + 0.6 * hash(i + 77)) * tw;
    const s = Math.max(1, v.cell * (0.04 + hash(i + 19) * 0.07));
    ctx.fillRect(x, y, s, s);
    if (hash(i + 313) > 0.93) {
      // A few bright ones with a cross of light.
      ctx.fillRect(x - s * 2, y + s * 0.35, s * 5, Math.max(1, s * 0.3));
      ctx.fillRect(x + s * 0.35, y - s * 2, Math.max(1, s * 0.3), s * 5);
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * The aurora: curtains of light hanging from high up, swaying slowly, green into violet.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {number} camX @param {Clock} clock
 */
function drawAurora(ctx, v, camX, clock) {
  const t = clock.reduced ? 0 : clock.time;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const step = Math.max(2, Math.round(v.cell * 0.35));
  const scroll = camX * 0.05 * v.cell;
  for (const [band, alpha, hue] of /** @type {[number, number, 'green' | 'violet'][]} */ ([[0, 0.2, 'green'], [1, 0.13, 'violet'], [2, 0.16, 'green']])) {
    for (let x = 0; x < v.width + step; x += step) {
      const u = (x + scroll) / v.cell;
      const top = screenY(v, 0.2 + band * 1.3 + Math.sin(u * 0.18 + t * 0.35 + band * 2) * 0.9 + Math.sin(u * 0.47 - t * 0.2) * 0.35);
      const length = v.cell * (3.2 + Math.sin(u * 0.31 + band + t * 0.25) * 1.2);
      const strength = 0.5 + 0.5 * Math.sin(u * 0.9 + band * 3 + t * 0.6);
      const g = ctx.createLinearGradient(0, top, 0, top + length);
      const color = hue === 'green' ? '90, 255, 180' : '190, 120, 255';
      g.addColorStop(0, `rgba(${color}, 0)`);
      g.addColorStop(0.25, `rgba(${color}, ${alpha * strength})`);
      g.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, top, step, length);
    }
  }
  ctx.restore();
}

/**
 * The glow of the world's horizon far below (the high atmosphere at night): a wide, faint
 * curve of light near the bottom of the screen.
 * @param {CanvasRenderingContext2D} ctx @param {View} v
 */
function drawHorizonGlow(ctx, v) {
  const cx = v.width / 2;
  const cy = screenY(v, 13.5) + v.width * 1.6;
  const r = v.width * 1.6;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, a] of [[v.cell * 1.6, 0.08], [v.cell * 0.6, 0.18], [v.cell * 0.15, 0.4]]) {
    ctx.strokeStyle = `rgba(120, 220, 255, ${a})`;
    ctx.lineWidth = /** @type {number} */ (w);
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  }
  ctx.restore();
}

/** Painted cloud sprites, by look, layer, shape and cell size. @type {Map<string, HTMLCanvasElement>} */
const cloudCache = new Map();

/**
 * One cloud: a few round puffs on a flatter base, lit from above, shaded beneath.
 * @param {Theme} th @param {typeof LAYERS[number]} layer @param {number} shape @param {number} cell
 */
function cloudSprite(th, layer, shape, cell) {
  const key = `${th.id}:${layer.key}:${shape}:${cell}`;
  const cached = cloudCache.get(key);
  if (cached) return cached;
  const w = Math.max(4, Math.round(layer.size * 2.2 * cell));
  const h = Math.max(4, Math.round(layer.size * 1.1 * cell));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const base = h * 0.78;
  const puffs = 5 + Math.floor(hash(shape * 7 + 1) * 3);
  const path = new Path2D();
  for (let i = 0; i < puffs; i++) {
    const u = (i + 0.5) / puffs;
    const r = h * (0.2 + 0.22 * Math.sin(u * Math.PI) + hash(shape * 13 + i) * 0.1);
    const x = w * (0.12 + u * 0.76);
    const y = base - r * 0.75;
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, Math.PI * 2);
  }
  path.rect(w * 0.12, base - h * 0.12, w * 0.76, h * 0.12);
  const clouds = /** @type {NonNullable<Theme['clouds']>} */ (th.clouds);
  const color = clouds[layer.key];
  ctx.fillStyle = color;
  ctx.fill(path);
  // Shade gathering beneath.
  ctx.save();
  ctx.clip(path);
  const shade = ctx.createLinearGradient(0, h * 0.25, 0, base);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, clouds.shade);
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  cloudCache.set(key, canvas);
  return canvas;
}

/**
 * Three layers of clouds, each scrolling at its own depth.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX
 * @param {typeof LAYERS[number]} layer
 */
function drawCloudLayer(ctx, v, th, camX, layer) {
  if (!th.clouds) return;
  const left = camX * layer.depth;
  const first = Math.floor(left / layer.span) - 1;
  for (let k = first; (k * layer.span - left) * v.cell < v.width + layer.size * 3 * v.cell; k++) {
    for (let j = 0; j < Math.ceil(th.clouds.count / 3); j++) {
      const seed = k * 17 + j * 131 + layer.span * 7;
      if (hash(seed) > 0.75) continue;
      const u = k * layer.span + hash(seed + 1) * layer.span;
      const y = layer.top + hash(seed + 2) * (layer.bottom - layer.top);
      const sprite = cloudSprite(th, layer, Math.floor(hash(seed + 3) * 4), v.cell);
      ctx.drawImage(sprite, (u - left) * v.cell - sprite.width / 2, screenY(v, y) - sprite.height / 2);
    }
  }
}

/**
 * Birds far off by day: small wings beating (still with reduced motion).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {number} camX @param {Clock} clock
 */
function drawBirds(ctx, v, camX, clock) {
  const span = 26;
  const left = camX * 0.1;
  ctx.strokeStyle = 'rgba(40, 70, 110, 0.55)';
  ctx.lineWidth = Math.max(1, v.cell * 0.05);
  ctx.lineCap = 'round';
  for (let k = Math.floor(left / span) - 1; (k * span - left) * v.cell < v.width + v.cell * 4; k++) {
    for (let b = 0; b < 3; b++) {
      const seed = k * 7 + b * 29;
      const u = k * span + hash(seed) * span + (clock.reduced ? 0 : clock.time * 0.4);
      const x = (u - left) * v.cell;
      const y = screenY(v, 0.8 + hash(seed + 4) * 3.5);
      const s = v.cell * (0.18 + hash(seed + 8) * 0.12);
      const flap = clock.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(clock.time * 9 + seed);
      ctx.beginPath();
      ctx.moveTo(x - s, y - s * (0.2 + flap * 0.5));
      ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.1, x, y);
      ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.1, x + s, y - s * (0.2 + flap * 0.5));
      ctx.stroke();
    }
  }
}

/**
 * Rain: thin slanted streaks falling past, faster near (still with reduced motion).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {number} camX @param {Clock} clock
 */
function drawRain(ctx, v, camX, clock) {
  const count = Math.round(70 * (v.width / v.height));
  ctx.save();
  ctx.strokeStyle = 'rgba(190, 210, 240, 0.32)';
  ctx.lineWidth = Math.max(1, v.cell * 0.035);
  ctx.beginPath();
  const t = clock.reduced ? 0 : clock.time;
  for (let i = 0; i < count; i++) {
    const depth = 0.4 + hash(i + 900) * 0.6;
    const fall = (hash(i + 400) + t * (1.1 + depth)) % 1;
    const x = ((((hash(i + 600) * v.width - camX * depth * v.cell * 0.6) % v.width) + v.width) % v.width) - fall * v.cell * 2;
    const y = fall * v.height;
    const len = v.cell * (0.5 + depth * 0.6);
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.3, y + len);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Lightning in the storm: now and then a jagged bolt deep in the clouds and a faint
 * flash of the sky (never with reduced motion; soft and seconds apart).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Clock} clock
 */
function drawLightning(ctx, v, clock) {
  if (clock.reduced) return;
  const n = Math.floor(clock.time / STRIKE.period);
  const since = clock.time - n * STRIKE.period - hash(n + 3) * (STRIKE.period - STRIKE.length);
  if (since < 0 || since > STRIKE.length) return;
  const fade = 1 - since / STRIKE.length;
  ctx.save();
  ctx.fillStyle = `rgba(200, 215, 255, ${0.1 * fade})`;
  ctx.fillRect(0, 0, v.width, v.height);
  ctx.globalCompositeOperation = 'lighter';
  let x = v.width * (0.15 + hash(n + 9) * 0.7);
  let y = screenY(v, -1);
  const end = screenY(v, 4 + hash(n + 5) * 3);
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let k = 1; y < end; k++) {
    x += (hash(n * 31 + k) - 0.5) * v.cell * 1.2;
    y += v.cell * (0.4 + hash(n * 17 + k) * 0.5);
    ctx.lineTo(x, y);
  }
  for (const [w, a] of [[v.cell * 0.5, 0.18], [v.cell * 0.14, 0.9]]) {
    ctx.strokeStyle = `rgba(230, 235, 255, ${/** @type {number} */ (a) * fade})`;
    ctx.lineWidth = /** @type {number} */ (w);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Floating motes (ice in the night air), drifting up at their own depth.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {{ color: string, count: number }} p @param {number} camX @param {number} time
 */
function drawMotes(ctx, v, p, camX, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = p.color;
  const span = v.width + v.cell * 2;
  for (let i = 0; i < p.count; i++) {
    const depth = 0.2 + hash(i + 900) * 0.6;
    const x = ((((hash(i + 300) * span - camX * depth * v.cell) % span) + span) % span) - v.cell;
    const rise = (time * (0.05 + hash(i + 500) * 0.12) + hash(i + 700)) % 1;
    const y = v.height * (1 - rise);
    ctx.globalAlpha = 0.2 + 0.45 * Math.sin(rise * Math.PI);
    ctx.beginPath();
    ctx.arc(x, y, v.cell * (0.03 + hash(i + 100) * 0.06) * (0.6 + depth), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Space (stage s-2) ────────────────────────────────────────────────────────

/** The far layer of space, painted once per look and size (it only scrolls). @type {Map<string, HTMLCanvasElement>} */
const farCache = new Map();

/**
 * A spiral galaxy: a bright core, a tilted disc and two curling arms of dots.
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {number} seed
 */
function paintGalaxy(ctx, x, y, r, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(hash(seed) * Math.PI);
  ctx.scale(1, 0.45 + hash(seed + 1) * 0.3);
  const disc = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  disc.addColorStop(0, 'rgba(255, 240, 220, 0.8)');
  disc.addColorStop(0.2, 'rgba(220, 200, 255, 0.35)');
  disc.addColorStop(1, 'rgba(120, 100, 220, 0)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(235, 225, 255, 0.55)';
  for (let arm = 0; arm < 2; arm++) {
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      const a = arm * Math.PI + t * Math.PI * 1.6;
      const d = r * (0.15 + t * 0.85);
      const s = Math.max(1, r * 0.035 * (1 - t * 0.6));
      ctx.fillRect(Math.cos(a) * d + (hash(seed * 7 + k) - 0.5) * r * 0.12, Math.sin(a) * d + (hash(seed * 11 + k) - 0.5) * r * 0.12, s, s);
    }
  }
  ctx.restore();
}

/**
 * The far layer: nebula haze, galaxies and a dense field of stars (still; a few twinkle on top).
 * @param {Theme} th @param {View} v
 */
function farLayer(th, v) {
  const key = `${th.id}@${v.width}x${v.height}`;
  const cached = farCache.get(key);
  if (cached) return cached;
  const space = /** @type {import('./themes.js').Space} */ (th.space);
  const canvas = document.createElement('canvas');
  canvas.width = v.width * 2;
  canvas.height = v.height;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const w = canvas.width;
  // Haze: soft blobs that wrap around (painted twice across the seam).
  space.haze.forEach((color, i) => {
    for (let k = 0; k < 5; k++) {
      const seed = i * 41 + k * 7;
      const x = hash(seed) * w;
      const y = v.height * (0.15 + hash(seed + 1) * 0.7);
      const r = v.height * (0.35 + hash(seed + 2) * 0.45);
      for (const dx of [0, -w, w]) {
        const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y - r, r * 2, r * 2);
      }
    }
  });
  for (let i = 0; i < space.galaxies; i++) paintGalaxy(ctx, w * (0.15 + i * 0.33 + hash(i + 5) * 0.1), v.height * (0.15 + hash(i + 9) * 0.5), v.cell * (1.2 + hash(i + 3) * 1.2), i + 1);
  for (let i = 0; i < space.stars * 2; i++) {
    const s = Math.max(1, v.cell * (0.03 + hash(i + 401) ** 3 * 0.12));
    ctx.globalAlpha = 0.25 + hash(i + 503) * 0.7;
    ctx.fillStyle = hash(i + 607) > 0.85 ? '#ffd9c8' : hash(i + 607) > 0.7 ? '#cfe0ff' : '#ffffff';
    ctx.fillRect(hash(i + 211) * w, hash(i + 307) * v.height, s, s);
  }
  ctx.globalAlpha = 1;
  farCache.set(key, canvas);
  return canvas;
}

/**
 * The far layer, scrolling very slowly, with a few stars twinkling on top.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
function drawFarSpace(ctx, v, th, camX, clock) {
  const far = farLayer(th, v);
  const shift = (((camX * 0.03 * v.cell) % far.width) + far.width) % far.width;
  ctx.drawImage(far, -shift, 0);
  if (shift > far.width - v.width) ctx.drawImage(far, far.width - shift, 0);
  if (!clock.reduced) drawStars(ctx, v, camX, clock, 40);
}

/**
 * Earth's curve below the band: the blue disc, continents and clouds, and the thin
 * bright line of its atmosphere.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {number} camX
 */
function drawEarth(ctx, v, camX) {
  const r = v.width * 1.4 + v.cell * 20;
  const cx = v.width * 0.45;
  const cy = screenY(v, 8.8) + r;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const sea = ctx.createLinearGradient(0, cy - r, 0, cy - r + v.cell * 6);
  sea.addColorStop(0, '#2f7ad8');
  sea.addColorStop(1, '#0a2a60');
  ctx.fillStyle = sea;
  ctx.fillRect(cx - r, cy - r, r * 2, v.cell * 8);
  // Land and cloud bands, drifting slowly as the ship orbits.
  const drift = camX * 0.04 * v.cell;
  for (let i = 0; i < 26; i++) {
    const u = ((((hash(i + 31) * v.width * 2.4 - drift) % (v.width * 2.4)) + v.width * 2.4) % (v.width * 2.4)) - v.width * 0.6;
    const depth = hash(i + 77) * v.cell * 3.5;
    const y = cy - Math.sqrt(Math.max(0, r * r - (u - cx) ** 2)) + depth + v.cell * 0.3;
    const land = hash(i + 13) > 0.45;
    ctx.fillStyle = land ? 'rgba(90, 140, 70, 0.75)' : 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(u, y, v.cell * (land ? 1.6 + hash(i) * 2.4 : 2 + hash(i) * 3), v.cell * (land ? 0.35 : 0.18), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, a] of [[v.cell * 1.4, 0.12], [v.cell * 0.5, 0.3], [v.cell * 0.12, 0.7]]) {
    ctx.strokeStyle = `rgba(120, 200, 255, ${a})`;
    ctx.lineWidth = /** @type {number} */ (w);
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Satellites passing far off: a body, two solar panels with their grid, a dish; slowly
 * turning (still with reduced motion).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {number} camX @param {Clock} clock @param {number} count
 */
function drawSatellites(ctx, v, camX, clock, count) {
  const span = 34;
  const left = camX * 0.12;
  for (let k = Math.floor(left / span) - 1; (k * span - left) * v.cell < v.width + v.cell * 6; k++) {
    for (let j = 0; j < count; j++) {
      const seed = k * 13 + j * 101;
      if (hash(seed) > 0.6) continue;
      const x = (k * span + hash(seed + 1) * span - left) * v.cell;
      const y = screenY(v, 0.5 + hash(seed + 2) * 8);
      const size = v.cell * (0.5 + hash(seed + 3) * 0.5);
      const turn = (clock.reduced ? 0 : clock.time * 0.15) + hash(seed + 4) * 6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(turn) * 0.4);
      ctx.globalAlpha = 0.75;
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#1d3d7a';
        ctx.fillRect(side > 0 ? size * 0.35 : -size * 1.95, -size * 0.32, size * 1.6, size * 0.64);
        ctx.strokeStyle = 'rgba(160, 200, 255, 0.7)';
        ctx.lineWidth = Math.max(1, size * 0.04);
        ctx.strokeRect(side > 0 ? size * 0.35 : -size * 1.95, -size * 0.32, size * 1.6, size * 0.64);
        ctx.beginPath();
        for (let g = 1; g < 4; g++) {
          const gx = (side > 0 ? size * 0.35 : -size * 1.95) + (g * size * 1.6) / 4;
          ctx.moveTo(gx, -size * 0.32);
          ctx.lineTo(gx, size * 0.32);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#d8dde6';
      ctx.fillRect(-size * 0.35, -size * 0.4, size * 0.7, size * 0.8);
      ctx.fillStyle = '#f2b84b';
      ctx.fillRect(-size * 0.35, -size * 0.4, size * 0.7, size * 0.18);
      ctx.strokeStyle = '#d8dde6';
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.4);
      ctx.lineTo(0, -size * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -size * 0.85, size * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * A ringed planet: a banded globe lit from one side, its ring passing behind and in front.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {NonNullable<import('./themes.js').Space['planet']>} p @param {number} camX
 */
function drawPlanet(ctx, v, p, camX) {
  const r = p.r * v.cell;
  const cx = v.width * p.x - ((camX * 0.01 * v.cell) % (v.width * 0.2));
  const cy = screenY(v, p.y);
  const ring = (/** @type {number} */ from, /** @type {number} */ to) => {
    ctx.strokeStyle = p.ring;
    for (const [w, k] of [[r * 0.16, 1.9], [r * 0.06, 2.2]]) {
      ctx.lineWidth = /** @type {number} */ (w);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * /** @type {number} */ (k), r * 0.42, -0.25, from, to);
      ctx.stroke();
    }
  };
  ring(Math.PI, Math.PI * 2);
  const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, p.body[0]);
  g.addColorStop(1, p.body[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let k = -3; k <= 3; k++) ctx.fillRect(cx - r, cy + k * r * 0.26, r * 2, r * 0.09);
  const night = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  night.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  night.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = night;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  ring(0, Math.PI);
}

/**
 * Burning asteroids streaking across the sky (the Insane Demon): a rock and a tail of fire.
 * Still with reduced motion.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Clock} clock @param {number} count
 */
function drawAsteroids(ctx, v, clock, count) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const speed = 0.06 + hash(i + 71) * 0.06;
    const t = clock.reduced ? hash(i + 3) : (clock.time * speed + hash(i + 3)) % 1;
    const x = v.width * (1.15 - t * 1.4);
    const y = v.height * (-0.1 + t * 0.6 + hash(i + 9) * 0.5);
    const r = v.cell * (0.18 + hash(i + 17) * 0.3);
    const tail = ctx.createLinearGradient(x, y, x + r * 9, y - r * 4);
    tail.addColorStop(0, 'rgba(255, 210, 120, 0.85)');
    tail.addColorStop(0.3, 'rgba(255, 90, 40, 0.5)');
    tail.addColorStop(1, 'rgba(255, 40, 40, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 9, y - r * 4);
    ctx.lineTo(x, y + r);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#3a1a14';
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const rr = r * (0.75 + hash(i * 13 + k) * 0.35);
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 150, 80, 0.9)';
    ctx.lineWidth = Math.max(1, r * 0.15);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Glowing outlined structures far behind (the Demon): towers of trusses, rings and broken
 * frames, scrolling at their own depth; dim, so hazards in front stay first to read.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {number} count
 */
function drawStructures(ctx, v, th, camX, count) {
  const span = 30 / Math.max(1, count / 3);
  const left = camX * 0.22;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = th.block.glow;
  ctx.lineWidth = Math.max(1, v.cell * 0.07);
  ctx.globalAlpha = 0.55;
  for (let k = Math.floor(left / span) - 1; (k * span - left) * v.cell < v.width + v.cell * 8; k++) {
    const seed = k * 23 + 5;
    const x = (k * span + hash(seed) * span * 0.6 - left) * v.cell;
    const kind = Math.floor(hash(seed + 1) * 3);
    const h = v.cell * (4 + hash(seed + 2) * 6);
    const base = screenY(v, 13.5);
    ctx.beginPath();
    if (kind === 0) {
      // A truss tower.
      const w = v.cell * 1.2;
      ctx.rect(x, base - h, w, h);
      for (let y = base - h; y < base; y += w) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + w);
        ctx.moveTo(x + w, y);
        ctx.lineTo(x, y + w);
      }
    } else if (kind === 1) {
      // A ring station.
      const r = v.cell * (1.6 + hash(seed + 3) * 1.4);
      const y = screenY(v, 1 + hash(seed + 4) * 8);
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.moveTo(x + r * 0.55, y);
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2;
        ctx.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
    } else {
      // A broken frame, hanging from above.
      const w = v.cell * (2 + hash(seed + 5) * 2);
      const top = screenY(v, -1.5);
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + h * 0.7);
      ctx.lineTo(x + w * 0.6, top + h * 0.8);
      ctx.moveTo(x + w, top);
      ctx.lineTo(x + w, top + h * 0.45);
      ctx.lineTo(x + w * 0.75, top + h * 0.55);
      ctx.moveTo(x, top + h * 0.3);
      ctx.lineTo(x + w, top + h * 0.3);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Light rays from a black sun (the Extreme Demon), slowly turning (still with reduced motion).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {string} color @param {Clock} clock
 */
function drawRays(ctx, v, color, clock) {
  const cx = v.width * 0.7;
  const cy = screenY(v, 3.2);
  const spin = clock.reduced ? 0 : clock.time * 0.04;
  const reach = Math.hypot(v.width, v.height);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 20; i++) {
    const a = spin + (i / 20) * Math.PI * 2;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
    ctx.lineTo(cx + Math.cos(a + 0.08) * reach, cy + Math.sin(a + 0.08) * reach);
    ctx.closePath();
  }
  ctx.fill();
  // The black sun and its white corona.
  const r = v.cell * 1.8;
  const corona = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 2.6);
  corona.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  corona.addColorStop(0.15, 'rgba(255, 40, 60, 0.5)');
  corona.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = corona;
  ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A black hole: its burning disc seen nearly edge-on, bent over and under the dark centre,
 * and a thin bright ring around the shadow; the disc turns slowly (still with reduced motion).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {number} camX @param {Clock} clock
 */
function drawBlackHole(ctx, v, camX, clock) {
  const r = v.cell * 2.2;
  const cx = v.width * 0.68 - ((camX * 0.01 * v.cell) % (v.width * 0.1));
  const cy = screenY(v, 4.2);
  const spin = clock.reduced ? 0 : clock.time * 0.6;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 4.5);
  halo.addColorStop(0, 'rgba(255, 170, 80, 0.35)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 5, cy - r * 5, r * 10, r * 10);
  // The disc: bands of light around an ellipse, the far side bent up over the shadow.
  for (let k = 0; k < 4; k++) {
    const g = ctx.createLinearGradient(cx - r * 3.4, 0, cx + r * 3.4, 0);
    const phase = (spin + k * 0.7) % (Math.PI * 2);
    g.addColorStop(0, 'rgba(255, 120, 40, 0)');
    g.addColorStop(0.5 + 0.25 * Math.sin(phase), 'rgba(255, 235, 190, 0.55)');
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = r * (0.22 - k * 0.04);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * (2.4 + k * 0.3), r * (0.42 + k * 0.05), -0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * (1.25 + k * 0.08), r * (1.15 + k * 0.08), 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 245, 220, 0.9)';
  ctx.lineWidth = Math.max(1, v.cell * 0.06);
  ctx.stroke();
  // The near side of the disc passes in front of the shadow.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255, 210, 150, 0.6)';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 2.4, r * 0.42, -0.12, 0.05, Math.PI - 0.05);
  ctx.stroke();
  ctx.restore();
}

/**
 * Space: the far layer, a sun, Earth and satellites in orbit, a ringed planet, light rays,
 * structures and burning asteroids — whichever the look has.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
function drawSpace(ctx, v, th, camX, clock) {
  const space = /** @type {import('./themes.js').Space} */ (th.space);
  drawFarSpace(ctx, v, th, camX, clock);
  if (space.rays) drawRays(ctx, v, space.rays, clock);
  if (space.blackHole) drawBlackHole(ctx, v, camX, clock);
  drawLight(ctx, v, th, clock);
  if (space.planet) drawPlanet(ctx, v, space.planet, camX);
  if (space.structures) drawStructures(ctx, v, th, camX, space.structures);
  if (space.satellites) drawSatellites(ctx, v, camX, clock, space.satellites);
  if (space.earth) drawEarth(ctx, v, camX);
  if (space.asteroids) drawAsteroids(ctx, v, clock, space.asteroids);
}

/**
 * All background layers of one look.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
export function drawBackground(ctx, v, th, camX, clock) {
  drawSky(ctx, v, th);
  if (th.backdrop === 'space') {
    drawSpace(ctx, v, th, camX, clock);
    if (th.motes && !clock.reduced) drawMotes(ctx, v, th.motes, camX, clock.time);
    return;
  }
  if (th.backdrop === 'night') {
    drawStars(ctx, v, camX, clock, 110);
    drawAurora(ctx, v, camX, clock);
  }
  drawLight(ctx, v, th, clock);
  const [far, mid, near] = LAYERS;
  drawCloudLayer(ctx, v, th, camX, far);
  if (th.backdrop === 'day') drawBirds(ctx, v, camX, clock);
  if (th.backdrop === 'storm') drawLightning(ctx, v, clock);
  drawCloudLayer(ctx, v, th, camX, mid);
  if (th.backdrop === 'night') drawHorizonGlow(ctx, v);
  drawCloudLayer(ctx, v, th, camX, near);
  if (th.backdrop === 'storm') drawRain(ctx, v, camX, clock);
  if (th.motes && !clock.reduced) drawMotes(ctx, v, th.motes, camX, clock.time);
}
