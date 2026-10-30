// @ts-check
// Background helpers both Rush games paint with (docs/v2/PLAN.md 9.1, stages w-1 and
// s-1): the beat the far layers pulse to (128 BPM, no audio), a repeatable hash for
// placing things, the sky gradient with its haze, and floating motes.
import { screenY } from './view.js';

/** @typedef {import('./view.js').View} View */

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

/** @param {CanvasRenderingContext2D} ctx @param {View} v @param {{ sky: [string, string], haze: string }} th */
export function drawSky(ctx, v, th) {
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
 * Floating motes: a fixed number, each placed by its own seed and time (no state),
 * drifting up and scrolling at their own depth; lighter where they overlap.
 * @param {CanvasRenderingContext2D} ctx @param {View} v @param {{ color: string, count: number }} p @param {number} camX @param {number} time
 */
export function drawMotes(ctx, v, p, camX, time) {
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
