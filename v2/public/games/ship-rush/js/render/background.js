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
  if (th.backdrop === 'day') {
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
  const color = th.clouds[layer.key];
  ctx.fillStyle = color;
  ctx.fill(path);
  // Shade gathering beneath.
  ctx.save();
  ctx.clip(path);
  const shade = ctx.createLinearGradient(0, h * 0.25, 0, base);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, th.clouds.shade);
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

/**
 * All background layers of one look.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
export function drawBackground(ctx, v, th, camX, clock) {
  drawSky(ctx, v, th);
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
