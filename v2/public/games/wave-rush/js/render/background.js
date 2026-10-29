// @ts-check
// Background layers (docs/v2/PLAN.md 9.1, stage w-1), back to front: sky, a far motif
// (a faint square grid, a banded sun, a moon with stars), silhouettes (hills, mesas,
// towers) and near columns, each scrolling slower than the level (parallax). The far
// layer pulses gently to a 128 BPM beat (no audio); with reduced motion it does not.
import { screenY } from './view.js';

/** @typedef {import('./themes.js').Theme} Theme @typedef {import('./view.js').View} View */

/** The beat: 128 per minute. */
export const BEAT = 60 / 128;

/**
 * 0..1, high just after each beat and fading: the pulse of the background.
 * @param {number} time
 */
export function beatPulse(time) {
  const t = (time % BEAT) / BEAT;
  return Math.exp(-t * 6);
}

/** A repeatable pseudo-random 0..1 for an integer. @param {number} n */
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th */
function drawSky(ctx, v, th) {
  const g = ctx.createLinearGradient(0, 0, 0, v.height);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.width, v.height);
  const haze = ctx.createRadialGradient(v.width * 0.5, screenY(v, 10), 0, v.width * 0.5, screenY(v, 10), Math.max(v.width, v.height) * 0.7);
  haze.addColorStop(0, th.haze);
  haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, v.width, v.height);
}

/**
 * The far grid: big faint squares with an inner square, staggered.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {number} pulse
 */
function drawGrid(ctx, v, th, camX, pulse) {
  const size = 3 * v.cell;
  const gap = 4.6 * v.cell;
  const shift = (camX * 0.12 * v.cell) % (gap * 2);
  ctx.strokeStyle = th.farColor;
  ctx.lineWidth = Math.max(1, v.cell * 0.06);
  ctx.globalAlpha = 0.8 + pulse * 0.5;
  ctx.beginPath();
  for (let row = -1; row * gap < v.height + gap; row++) {
    const offset = row % 2 === 0 ? 0 : gap;
    for (let x = -shift - gap * 2 + offset; x < v.width + gap; x += gap * 2) {
      const y = row * gap + gap * 0.2;
      ctx.rect(x, y, size, size);
      ctx.rect(x + size * 0.25, y + size * 0.25, size * 0.5, size * 0.5);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * A banded sun low over the horizon (so far away it does not scroll).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} pulse
 */
function drawSun(ctx, v, th, pulse) {
  const r = 4.2 * v.cell;
  const cx = v.width * 0.68;
  const cy = screenY(v, 6.4);
  const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.4);
  halo.addColorStop(0, `rgba(255, 190, 120, ${0.22 + pulse * 0.08})`);
  halo.addColorStop(1, 'rgba(255, 190, 120, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.5, cy - r * 2.5, r * 5, r * 5);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, '#ffe2a0');
  g.addColorStop(1, th.farColor);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Bands cut out of the lower half, thicker further down.
  ctx.fillStyle = th.sky[1];
  for (let i = 0; i < 6; i++) {
    const y = cy + r * (0.05 + i * 0.17);
    ctx.fillRect(cx - r, y, r * 2, r * (0.03 + i * 0.018));
  }
  ctx.restore();
}

/**
 * A moon with craters, and stars that twinkle (still with reduced motion).
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {number} time @param {boolean} reduced
 */
function drawMoon(ctx, v, th, camX, time, reduced) {
  const span = v.width + 40;
  for (let i = 0; i < 70; i++) {
    const x = ((hash(i) * span - camX * 0.04 * v.cell) % span + span) % span - 20;
    const y = hash(i + 100) * v.height * 0.8;
    const tw = reduced ? 0.7 : 0.55 + 0.45 * Math.sin(time * (1 + hash(i + 7) * 2) + i);
    ctx.globalAlpha = 0.35 + 0.5 * tw * hash(i + 50);
    ctx.fillStyle = '#ffffff';
    const s = Math.max(1, v.cell * (0.05 + hash(i + 9) * 0.07));
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
  const r = 2.1 * v.cell;
  const cx = v.width * 0.74;
  const cy = screenY(v, 2.8);
  const halo = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 3.2);
  halo.addColorStop(0, 'rgba(220, 210, 255, 0.22)');
  halo.addColorStop(1, 'rgba(220, 210, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 3.3, cy - r * 3.3, r * 6.6, r * 6.6);
  ctx.fillStyle = th.farColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 140, 190, 0.35)';
  for (const [dx, dy, rr] of /** @type {[number, number, number][]} */ ([[-0.35, -0.2, 0.28], [0.3, 0.25, 0.2], [0.05, 0.5, 0.14], [0.4, -0.4, 0.12]])) {
    ctx.beginPath();
    ctx.arc(cx + dx * r, cy + dy * r, rr * r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The silhouette height (world y) of a layer at world position u.
 * @param {Theme['mid']} kind @param {number} u @param {number} layer
 */
function silhouetteY(kind, u, layer) {
  const base = layer === 0 ? 7.4 : 8.6;
  if (kind === 'hills') return base - 1.3 * (0.6 + 0.4 * Math.sin(u * 0.21 + layer * 2) + 0.3 * Math.sin(u * 0.53 + layer));
  if (kind === 'mesas') {
    // Flat-topped buttes with sloped sides, some of them missing.
    const span = 9;
    const cell = Math.floor(u / span);
    const h = hash(cell * 3 + layer * 17);
    const local = u - cell * span;
    const ground = base + 1.4;
    if (h < 0.3) return ground;
    const top = ground - 1.4 - h * 1.8;
    const rise = Math.min(local - 1, span - 1 - local);
    return rise <= 0 ? ground : Math.max(top, ground - rise * 1.6);
  }
  if (kind === 'spires') {
    // Crystal spires: sharp peaks every 1.5 cells, taller every few.
    const cell = Math.floor(u / 1.5);
    const local = (u - cell * 1.5) / 1.5;
    const h = hash(cell * 7 + layer * 31);
    const peak = base + 1.5 - (0.6 + h * h * 3.2);
    return peak + Math.abs(local - 0.5) * 2 * (base + 1.5 - peak);
  }
  const cell = Math.floor(u / 6);
  return base - 1 - hash(cell * 3 + layer * 17) * 2.4;
}

/**
 * Two silhouette layers along the bottom of the band.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX
 */
function drawSilhouettes(ctx, v, th, camX) {
  const bottom = v.height;
  for (const layer of [0, 1]) {
    const speed = layer === 0 ? 0.18 : 0.32;
    const left = camX * speed;
    ctx.fillStyle = th.midColor[layer] ?? th.midColor[0];
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    const step = th.mid === 'hills' ? 0.5 : th.mid === 'spires' ? 0.75 : 0.25;
    for (let u = Math.floor(left / step) * step; ; u += step) {
      const x = (u - left) * v.cell;
      let y = silhouetteY(th.mid, u, layer);
      if (th.mid === 'towers') {
        const local = ((u % 6) + 6) % 6;
        if (local > 3.2) y = 9.5;
        else if (local < 0.6 || local > 2.6) y += 0.6;
        else if (local > 1.4 && local < 1.8) y -= 1.1; // a spire
      }
      ctx.lineTo(x, screenY(v, y));
      if (x > v.width + v.cell) break;
    }
    ctx.lineTo(v.width, bottom);
    ctx.closePath();
    ctx.fill();
    if (th.mid === 'towers' && layer === 0) drawWindows(ctx, v, camX * speed);
  }
}

/**
 * Small lit windows in the far towers.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {number} left
 */
function drawWindows(ctx, v, left) {
  ctx.fillStyle = 'rgba(240, 205, 130, 0.35)';
  const first = Math.floor(left / 6) * 6;
  for (let u = first; (u - left) * v.cell < v.width + v.cell * 6; u += 6) {
    const top = silhouetteY('towers', u + 1, 0);
    for (let k = 0; k < 3; k++) {
      if (hash(u + k * 13) < 0.4) continue;
      const x = (u + 1.2 + (k % 2) * 0.8 - left) * v.cell;
      ctx.fillRect(x, screenY(v, top + 0.9 + k * 0.7), v.cell * 0.18, v.cell * 0.28);
    }
  }
}

/**
 * Near columns behind the playfield, faint.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX
 */
function drawColumns(ctx, v, th, camX) {
  const speed = 0.55;
  const spacing = 7;
  const left = camX * speed;
  ctx.fillStyle = th.near;
  for (let u = Math.floor(left / spacing) * spacing; (u - left) * v.cell < v.width + v.cell; u += spacing) {
    const x = (u - left) * v.cell;
    const w = v.cell * 0.9;
    ctx.fillRect(x, screenY(v, 2.6), w, screenY(v, 10) - screenY(v, 2.6));
    ctx.fillRect(x - w * 0.25, screenY(v, 2.3), w * 1.5, v.cell * 0.3);
    ctx.fillRect(x - w * 0.15, screenY(v, 2.6), w * 1.3, v.cell * 0.15);
    ctx.fillRect(x - w * 0.25, screenY(v, 9.7), w * 1.5, v.cell * 0.3);
  }
}

/**
 * All background layers of one theme.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX
 * @param {{ time: number, pulse: number, reduced: boolean }} clock
 */
export function drawBackground(ctx, v, th, camX, clock) {
  drawSky(ctx, v, th);
  if (th.fx && th.fx.bg !== 'none') drawGeometry(ctx, v, th, camX, clock);
  if (th.far === 'grid') drawGrid(ctx, v, th, camX, clock.pulse);
  else if (th.far === 'sun') drawSun(ctx, v, th, clock.pulse);
  else if (th.far === 'moon') drawMoon(ctx, v, th, camX, clock.time, clock.reduced);
  else if (th.far === 'aurora') drawAurora(ctx, v, th, clock.time, clock.reduced);
  else if (th.far === 'eclipse') drawEclipse(ctx, v, th, clock.pulse);
  if (th.mid !== 'none') drawSilhouettes(ctx, v, th, camX);
  drawColumns(ctx, v, th, camX);
  if (th.fx?.particles && !clock.reduced) drawMotes(ctx, v, th.fx.particles, camX, clock.time);
}

/**
 * Ribbons of light across the sky, swaying slowly.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} time @param {boolean} reduced
 */
function drawAurora(ctx, v, th, time, reduced) {
  const t = reduced ? 0 : time;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = th.farColor;
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = 0.35 - k * 0.08;
    ctx.lineWidth = v.cell * (1.6 - k * 0.4);
    ctx.beginPath();
    for (let x = -v.cell; x <= v.width + v.cell; x += v.cell) {
      const y = screenY(v, 2.6 + k * 1.1 + Math.sin(x / (v.cell * 6) + t * 0.4 + k) * 0.8);
      if (x < 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A black sun with a bright corona, high in the sky.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} pulse
 */
function drawEclipse(ctx, v, th, pulse) {
  const r = 2.4 * v.cell;
  const cx = v.width * 0.72;
  const cy = screenY(v, 3.6);
  const corona = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * (2.6 + pulse * 0.25));
  corona.addColorStop(0, th.farColor);
  corona.addColorStop(0.18, th.block.glow);
  corona.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = corona;
  ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = th.farColor;
  ctx.lineWidth = Math.max(1, v.cell * 0.06);
  ctx.stroke();
}

/** Pattern tiles, by theme and cell size. @type {Map<string, CanvasPattern | null>} */
const tiles = new Map();

/**
 * One tile of a theme's background geometry.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th
 */
function geometryTile(ctx, v, th) {
  const key = `${th.id}@${v.cell}`;
  if (tiles.has(key)) return tiles.get(key) ?? null;
  const fx = /** @type {import('./themes.js').Fx} */ (th.fx);
  const size = Math.max(8, Math.round(v.cell * 4));
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const t = /** @type {CanvasRenderingContext2D} */ (tile.getContext('2d'));
  t.strokeStyle = fx.bgColor;
  t.fillStyle = fx.bgColor;
  t.lineWidth = Math.max(1, v.cell * 0.06);
  t.beginPath();
  if (fx.bg === 'triangles') {
    // Two rows of up and down triangles.
    for (const [y0, flip] of /** @type {[number, boolean][]} */ ([[0, false], [size / 2, true]])) {
      for (let x = flip ? -size / 4 : 0; x < size; x += size / 2) {
        const h = size / 2;
        t.moveTo(x, y0 + h);
        t.lineTo(x + size / 4, y0);
        t.lineTo(x + size / 2, y0 + h);
        t.closePath();
      }
    }
    t.stroke();
  } else if (fx.bg === 'diamonds') {
    t.moveTo(size / 2, 0);
    t.lineTo(size, size / 2);
    t.lineTo(size / 2, size);
    t.lineTo(0, size / 2);
    t.closePath();
    t.moveTo(size / 2, size * 0.3);
    t.lineTo(size * 0.7, size / 2);
    t.lineTo(size / 2, size * 0.7);
    t.lineTo(size * 0.3, size / 2);
    t.closePath();
    t.stroke();
  } else {
    // Shards: a few sharp triangles scattered over the tile.
    for (let i = 0; i < 4; i++) {
      const x = hash(i * 3 + 1) * size;
      const y = hash(i * 3 + 2) * size;
      const r = size * (0.08 + hash(i * 3 + 3) * 0.12);
      t.moveTo(x, y - r * 1.6);
      t.lineTo(x + r, y + r);
      t.lineTo(x - r, y + r * 0.6);
      t.closePath();
    }
    t.fill();
  }
  const pattern = ctx.createPattern(tile, 'repeat');
  tiles.set(key, pattern);
  return pattern;
}

/**
 * Background geometry: a tiled pattern (triangles, diamonds, shards) or light rays,
 * drifting slower than the level and brightening a little on the beat.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX
 * @param {{ time: number, pulse: number, reduced: boolean }} clock
 */
function drawGeometry(ctx, v, th, camX, clock) {
  const fx = /** @type {import('./themes.js').Fx} */ (th.fx);
  ctx.save();
  ctx.globalAlpha = 0.85 + clock.pulse * 0.3;
  if (fx.bg === 'rays') {
    const cx = v.width * 0.72;
    const cy = screenY(v, 3.6);
    const spin = clock.reduced ? 0 : clock.time * 0.05;
    ctx.fillStyle = fx.bgColor;
    ctx.beginPath();
    const reach = Math.hypot(v.width, v.height);
    for (let i = 0; i < 18; i++) {
      const a = spin + (i / 18) * Math.PI * 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
      ctx.lineTo(cx + Math.cos(a + 0.09) * reach, cy + Math.sin(a + 0.09) * reach);
      ctx.closePath();
    }
    ctx.fill();
  } else {
    const pattern = geometryTile(ctx, v, th);
    if (pattern) {
      pattern.setTransform(new DOMMatrix().translate(-camX * 0.15 * v.cell, v.top));
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, v.width, v.height);
    }
  }
  ctx.restore();
}

/**
 * Floating motes: a fixed number, each placed by its own seed and time (no state),
 * drifting up and scrolling at their own depth; lighter where they overlap.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {{ color: string, count: number }} p @param {number} camX @param {number} time
 */
function drawMotes(ctx, v, p, camX, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = p.color;
  const span = v.width + v.cell * 2;
  for (let i = 0; i < p.count; i++) {
    const depth = 0.2 + hash(i + 900) * 0.6;
    const x = (((hash(i + 300) * span - camX * depth * v.cell) % span) + span) % span - v.cell;
    const rise = (time * (0.15 + hash(i + 500) * 0.35) + hash(i + 700)) % 1;
    const y = v.height * (1 - rise);
    const size = v.cell * (0.05 + hash(i + 100) * 0.09) * (0.6 + depth);
    ctx.globalAlpha = 0.25 + 0.5 * Math.sin(rise * Math.PI);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
