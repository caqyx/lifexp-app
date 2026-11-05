// @ts-check
// Robot Rush's backgrounds (docs/v2/PLAN.md 9.1, stage rr-b): a neon city at night, all
// original art from canvas shapes. Every theme is a night sky with the city's glow and a
// skyline in three layers scrolling at different depths (parallax), its windows lit by a
// fixed hash (the same city every time), then its own things: rooftop tanks and antennas,
// shop signs, harbour cranes, railway arches with passing trains, rain and lightning, an
// outline city on a grid, red warning lights in a blackout, every light at once, and a
// beacon above the clouds. Nothing here hurts; the hazards are drawn over it.
import { drawMotes } from '../../../_engine/render/backdrop.js';
import { screenY } from '../../../_engine/render/view.js';

/**
 * @typedef {import('../../../_engine/render/view.js').View} View
 * @typedef {import('./themes.js').Theme} Theme
 * @typedef {{ time: number, pulse: number, reduced: boolean }} Clock
 */

/** A fixed pseudo-random number in 0..1 for an index and a salt. @param {number} i @param {number} salt */
function hash(i, salt) {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th */
function drawSky(ctx, v, th) {
  const g = ctx.createLinearGradient(0, 0, 0, v.height);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(0.6, th.sky[1]);
  g.addColorStop(1, th.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.width, v.height);
  const glow = ctx.createRadialGradient(v.width * 0.5, v.height, 0, v.width * 0.5, v.height, Math.max(v.width, v.height) * 0.8);
  glow.addColorStop(0, th.glow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, v.width, v.height);
}

/** Stars that hardly move. @param {CanvasRenderingContext2D} ctx @param {View} v @param {number} camX @param {Clock} clock */
function drawStars(ctx, v, camX, clock) {
  const span = v.width + 400;
  for (let i = 0; i < 70; i++) {
    const x = (((hash(i, 1) * span - camX * v.cell * 0.02) % span) + span) % span - 200;
    const y = hash(i, 2) * v.height * 0.55;
    const twinkle = clock.reduced ? 1 : 0.6 + 0.4 * Math.sin(clock.time * (1 + hash(i, 3) * 2) + i);
    ctx.globalAlpha = 0.25 + 0.5 * hash(i, 4) * twinkle;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, Math.max(1, v.cell * 0.05), Math.max(1, v.cell * 0.05));
  }
  ctx.globalAlpha = 1;
}

/** @param {CanvasRenderingContext2D} ctx @param {View} v @param {string} color */
function drawMoon(ctx, v, color) {
  const x = v.width * 0.78;
  const y = v.height * 0.18;
  const r = v.cell * 1.3;
  const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3);
  halo.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * One layer of the skyline: buildings `gap` cells apart (each its own width and height by
 * the hash), at `depth` of the level's scroll, their windows lit or dark.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 * @param {{ depth: number, gap: number, salt: number, color: string, base: number, tall: number, windows: number, outline?: boolean, blink?: boolean, tops?: boolean }} layer
 *   base: where their feet are (world y); tall: the tallest, in cells; windows: share of
 *   windows lit; outline: drawn as outlines (the grid); blink: a red light on each roof;
 *   tops: water tanks and antennas on the roofs.
 */
function drawSkyline(ctx, v, th, camX, clock, layer) {
  const c = v.cell;
  const step = layer.gap * c;
  const shift = camX * layer.depth * c;
  const first = Math.floor(shift / step) - 1;
  const count = Math.ceil(v.width / step) + 3;
  const foot = screenY(v, layer.base);
  for (let k = 0; k < count; k++) {
    const i = first + k;
    const left = i * step - shift;
    const w = step * (0.55 + 0.4 * hash(i, layer.salt));
    const h = c * layer.tall * (0.35 + 0.65 * hash(i, layer.salt + 1));
    const top = foot - h;
    if (layer.outline) {
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = Math.max(1, c * 0.05);
      ctx.strokeRect(left, top, w, foot - top + v.height);
    } else {
      ctx.fillStyle = layer.color;
      ctx.fillRect(left, top, w, foot - top + v.height);
    }
    // Windows: a grid of small lights, some on.
    const cols = Math.max(1, Math.floor(w / (c * 0.45)));
    const rows = Math.max(1, Math.floor(h / (c * 0.6)));
    const pw = c * 0.16;
    const ph = c * 0.22;
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        const n = i * 1000 + r * 31 + q;
        if (hash(n, layer.salt + 2) > layer.windows) continue;
        ctx.fillStyle = /** @type {string} */ (th.windows[Math.floor(hash(n, layer.salt + 3) * th.windows.length)]);
        ctx.globalAlpha = 0.45 + 0.5 * hash(n, layer.salt + 4);
        ctx.fillRect(left + (q + 0.5) * (w / cols) - pw / 2, top + c * 0.35 + r * c * 0.6, pw, ph);
      }
    }
    ctx.globalAlpha = 1;
    if (layer.tops && hash(i, layer.salt + 5) > 0.5) {
      // A water tank on legs, or an antenna.
      ctx.fillStyle = layer.color;
      if (hash(i, layer.salt + 6) > 0.5) {
        ctx.fillRect(left + w * 0.3, top - c * 0.9, c * 0.7, c * 0.6);
        ctx.fillRect(left + w * 0.3 + c * 0.05, top - c * 0.3, c * 0.08, c * 0.3);
        ctx.fillRect(left + w * 0.3 + c * 0.57, top - c * 0.3, c * 0.08, c * 0.3);
      } else {
        ctx.fillRect(left + w * 0.5, top - c * 1.4, Math.max(1, c * 0.06), c * 1.4);
      }
    }
    if (layer.blink && hash(i, layer.salt + 7) > 0.3) {
      const on = clock.reduced || Math.sin(clock.time * 3 + i) > -0.2;
      if (on) {
        ctx.fillStyle = /** @type {string} */ (th.neon[0]);
        ctx.beginPath();
        ctx.arc(left + w * 0.5, top - c * 0.15, c * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** Shop signs on the mid layer: neon boxes that flicker now and then. @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock @param {number} density */
function drawSigns(ctx, v, th, camX, clock, density) {
  const c = v.cell;
  const step = 5 * c;
  const shift = camX * 0.45 * c;
  const first = Math.floor(shift / step) - 1;
  for (let k = 0; k < Math.ceil(v.width / step) + 3; k++) {
    const i = first + k;
    if (hash(i, 40) > density) continue;
    const x = i * step - shift + hash(i, 41) * c * 2;
    const y = screenY(v, 1 + hash(i, 42) * 8);
    const w = c * (1.2 + hash(i, 43) * 2);
    const h = c * (0.5 + hash(i, 44) * 0.8);
    const color = /** @type {string} */ (th.neon[Math.floor(hash(i, 45) * th.neon.length)]);
    const flicker = clock.reduced ? 1 : Math.sin(clock.time * 17 + i * 3) > 0.92 ? 0.3 : 1;
    ctx.globalAlpha = 0.85 * flicker;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, c * 0.08);
    ctx.shadowColor = color;
    ctx.shadowBlur = c * 0.5;
    ctx.strokeRect(x, y, w, h);
    // A line of "letters": short bars.
    ctx.fillStyle = color;
    for (let b = 0; b < Math.floor(w / (c * 0.35)); b++) ctx.fillRect(x + c * 0.15 + b * c * 0.35, y + h * 0.35, c * 0.2, h * 0.3);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/** Harbour cranes: lattice towers with a long arm, a red light at the tip. @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock */
function drawCranes(ctx, v, th, camX, clock) {
  const c = v.cell;
  const step = 16 * c;
  const shift = camX * 0.3 * c;
  const first = Math.floor(shift / step) - 1;
  const foot = screenY(v, 13);
  for (let k = 0; k < Math.ceil(v.width / step) + 3; k++) {
    const i = first + k;
    const x = i * step - shift + hash(i, 50) * c * 4;
    const top = screenY(v, -0.5 + hash(i, 51) * 2);
    ctx.strokeStyle = th.mid;
    ctx.lineWidth = Math.max(1, c * 0.07);
    ctx.beginPath();
    ctx.moveTo(x, foot);
    ctx.lineTo(x, top);
    ctx.moveTo(x + c * 0.6, foot);
    ctx.lineTo(x + c * 0.6, top);
    for (let y = top; y < foot; y += c * 0.7) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + c * 0.6, y + c * 0.7);
    }
    // The arm, and its cable with a hook swinging.
    ctx.moveTo(x - c * 3, top);
    ctx.lineTo(x + c * 7, top);
    ctx.moveTo(x - c * 3, top + c * 0.4);
    ctx.lineTo(x + c * 7, top + c * 0.4);
    const sway = clock.reduced ? 0 : Math.sin(clock.time * 0.8 + i) * c * 0.3;
    const hookX = x + c * (3 + hash(i, 52) * 3);
    ctx.moveTo(hookX, top + c * 0.4);
    ctx.lineTo(hookX + sway, top + c * (3 + hash(i, 53) * 3));
    ctx.stroke();
    if (clock.reduced || Math.sin(clock.time * 2.5 + i) > 0) {
      ctx.fillStyle = /** @type {string} */ (th.neon[0]);
      ctx.beginPath();
      ctx.arc(x + c * 7, top, c * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The bay's shimmer under the city.
  ctx.fillStyle = 'rgba(120, 210, 255, 0.08)';
  for (let k = 0; k < 24; k++) {
    const x = ((hash(k, 54) * v.width - camX * c * 0.6) % v.width + v.width) % v.width;
    ctx.fillRect(x, screenY(v, 11.5 + hash(k, 55) * 2), c * (0.6 + hash(k, 56)), Math.max(1, c * 0.05));
  }
}

/** The elevated railway: arches, lamps, and a lit train now and then. @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock */
function drawRailway(ctx, v, th, camX, clock) {
  const c = v.cell;
  const deck = screenY(v, 0.8);
  ctx.fillStyle = th.mid;
  ctx.fillRect(0, deck - c * 0.5, v.width, c * 0.7);
  const step = 6 * c;
  const shift = camX * 0.55 * c;
  const first = Math.floor(shift / step) - 1;
  for (let k = 0; k < Math.ceil(v.width / step) + 3; k++) {
    const x = (first + k) * step - shift;
    ctx.fillStyle = th.mid;
    ctx.fillRect(x, deck, c * 0.8, v.height);
    ctx.fillStyle = /** @type {string} */ (th.neon[0]);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(x + c * 0.4, deck + c * 1.2, c * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (clock.reduced) return;
  // A train crossing every few seconds, its windows a row of light.
  const period = 9;
  const phase = (clock.time % period) / period;
  const trainX = v.width * 1.2 - phase * v.width * 2.6;
  ctx.fillStyle = th.near;
  ctx.fillRect(trainX, deck - c * 1.3, c * 14, c * 0.8);
  ctx.fillStyle = /** @type {string} */ (th.windows[1]);
  for (let w = 0; w < 18; w++) ctx.fillRect(trainX + c * 0.3 + w * c * 0.75, deck - c * 1.15, c * 0.45, c * 0.3);
}

/** Rain and, now and then, lightning. @param {CanvasRenderingContext2D} ctx @param {View} v @param {Clock} clock */
function drawStorm(ctx, v, clock) {
  const c = v.cell;
  if (!clock.reduced) {
    const flash = (clock.time % 7) < 0.12 || ((clock.time + 0.2) % 7) < 0.06;
    if (flash) {
      ctx.fillStyle = 'rgba(220, 255, 240, 0.18)';
      ctx.fillRect(0, 0, v.width, v.height);
    }
  }
  ctx.strokeStyle = 'rgba(200, 255, 230, 0.22)';
  ctx.lineWidth = Math.max(1, c * 0.03);
  ctx.beginPath();
  for (let i = 0; i < 90; i++) {
    const fall = clock.reduced ? 0 : clock.time * v.height * 1.6;
    const x = hash(i, 60) * v.width;
    const y = ((hash(i, 61) * v.height + fall) % v.height);
    ctx.moveTo(x, y);
    ctx.lineTo(x - c * 0.15, y + c * 0.7);
  }
  ctx.stroke();
}

/** The grid: a floor of lines running to the horizon. @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX */
function drawGridFloor(ctx, v, th, camX) {
  const c = v.cell;
  const horizon = screenY(v, 5);
  ctx.strokeStyle = th.far;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 1; k < 10; k++) {
    const y = horizon + (v.height - horizon) * (k / 10) ** 1.8;
    ctx.moveTo(0, y);
    ctx.lineTo(v.width, y);
  }
  const shift = ((camX * c * 0.8) % (c * 2) + c * 2) % (c * 2);
  for (let x = -v.width; x < v.width * 2; x += c * 2) {
    ctx.moveTo(v.width / 2 + (x - shift - v.width / 2) * 0.15, horizon);
    ctx.lineTo(x - shift, v.height);
  }
  ctx.stroke();
}

/** A beacon on the highest tower, its beam sweeping the clouds; clouds below. @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock */
function drawSummit(ctx, v, th, camX, clock) {
  const c = v.cell;
  const angle = clock.reduced ? -0.6 : Math.sin(clock.time * 0.5) * 0.9 - Math.PI / 2;
  const ox = v.width * 0.5;
  const oy = screenY(v, 13);
  const beam = ctx.createLinearGradient(ox, oy, ox + Math.cos(angle) * v.height, oy + Math.sin(angle) * v.height);
  beam.addColorStop(0, 'rgba(57, 246, 255, 0.28)');
  beam.addColorStop(1, 'rgba(57, 246, 255, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + Math.cos(angle - 0.08) * v.height * 1.5, oy + Math.sin(angle - 0.08) * v.height * 1.5);
  ctx.lineTo(ox + Math.cos(angle + 0.08) * v.height * 1.5, oy + Math.sin(angle + 0.08) * v.height * 1.5);
  ctx.closePath();
  ctx.fill();
  // Clouds drifting below the summit.
  ctx.fillStyle = 'rgba(200, 190, 255, 0.12)';
  for (let i = 0; i < 12; i++) {
    const x = ((hash(i, 70) * v.width * 1.5 - camX * c * 0.25 - (clock.reduced ? 0 : clock.time * c * 0.3)) % (v.width * 1.5) + v.width * 1.5) % (v.width * 1.5) - v.width * 0.25;
    const y = screenY(v, 9.5 + hash(i, 71) * 3);
    ctx.beginPath();
    ctx.ellipse(x, y, c * (3 + hash(i, 72) * 3), c * (0.5 + hash(i, 73) * 0.5), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The whole background of a theme.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {Theme} th @param {number} camX @param {Clock} clock
 */
export function drawBackground(ctx, v, th, camX, clock) {
  drawSky(ctx, v, th);
  const b = th.backdrop;
  if (b !== 'storm' && b !== 'blackout') drawStars(ctx, v, camX, clock);
  if (b === 'rooftops' || b === 'cranes' || b === 'summit') drawMoon(ctx, v, b === 'rooftops' ? '#ffe2c4' : '#e8f4ff');
  if (b === 'summit') drawSummit(ctx, v, th, camX, clock);
  if (b === 'grid') drawGridFloor(ctx, v, th, camX);
  const outline = b === 'grid';
  const lit = b === 'blackout' ? 0.04 : b === 'overload' ? 0.75 : b === 'summit' ? 0.4 : 0.32;
  drawSkyline(ctx, v, th, camX, clock, { depth: 0.12, gap: 3.2, salt: 10, color: th.far, base: b === 'summit' ? 14 : 12, tall: b === 'summit' ? 4 : 9, windows: lit * 0.7, outline, blink: b === 'blackout' || b === 'cranes' });
  if (b === 'cranes') drawCranes(ctx, v, th, camX, clock);
  drawSkyline(ctx, v, th, camX, clock, { depth: 0.3, gap: 4.4, salt: 20, color: th.mid, base: 13, tall: b === 'summit' ? 3 : 7, windows: lit, outline, blink: b === 'blackout', tops: b === 'rooftops' || b === 'storm' });
  if (b === 'avenue' || b === 'signs' || b === 'overload') drawSigns(ctx, v, th, camX, clock, b === 'avenue' ? 0.45 : 0.8);
  if (b === 'tunnels') drawRailway(ctx, v, th, camX, clock);
  drawSkyline(ctx, v, th, camX, clock, { depth: 0.55, gap: 6, salt: 30, color: th.near, base: 14, tall: 4, windows: lit * 0.5, tops: b === 'rooftops' });
  if (b === 'storm') drawStorm(ctx, v, clock);
  if (th.motes && !clock.reduced && b !== 'storm') drawMotes(ctx, v, th.motes, camX, clock.time);
}
