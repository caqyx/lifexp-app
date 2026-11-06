// @ts-check
// Strażnicy Doliny: page text in the game's pixel font (docs/v2/PLAN.md 9.1, td-2). An
// element given a text here holds it twice: as real text for screen readers, search and
// tests (out of sight), and as a small canvas drawn with the bitmap font, scaled up by a
// whole number of device pixels with no smoothing — crisp, like the board. Every pixel
// text is redrawn when the window changes size (the scale or a wrapped line may change).

import { LINE_HEIGHT, PALETTE, createCanvas, drawText, measureText, wrapText } from './pixelart.js';

/** @typedef {import('./pixelart.js').Colour} Colour */
/**
 * @typedef {{ color?: Colour, shadow?: Colour | null, size?: 0 | 1 | 2, wrap?: boolean, spoken?: string, align?: 'start' | 'center' }} TextStyle
 * size: 0 small (labels in tight grids), 1 body, 2 headings — each a whole number of device pixels per font pixel.
 */

/** Device pixels per font pixel, set by `setTextScale` (about 13 CSS px for a capital). */
const scale = { device: 4, dpr: 1 };

/** @type {Map<HTMLElement, { text: string, style: TextStyle, width: number }>} */
const texts = new Map();

/**
 * Chooses the font's scale for this screen: a whole number of device pixels per font
 * pixel, at least 2, so a capital is about 13 CSS pixels tall.
 * @param {number} dpr
 */
export function textScaleFor(dpr) {
  return Math.max(2, Math.round(dpr * 1.9));
}

/** @param {number} dpr */
export function setTextScale(dpr) {
  scale.dpr = dpr;
  scale.device = textScaleFor(dpr);
  document.documentElement.style.setProperty('--upx', `${scale.device / dpr}px`);
}

/** One font pixel in CSS pixels (for borders and gaps that line up with the text). */
export function fontPixel() {
  return scale.device / scale.dpr;
}

/**
 * Gives an element its text in pixel letters. `style.spoken` is what is read out and
 * matched when it differs from what is shown (e.g. "Tempo 2×" shown as "2×").
 * @param {HTMLElement} el @param {string} text @param {TextStyle} [style]
 */
export function setPixelText(el, text, style = {}) {
  const old = texts.get(el);
  const width = style.wrap ? el.clientWidth : 0;
  if (old && old.text === text && old.style.spoken === style.spoken && old.style.color === style.color && old.width === width) return;
  texts.set(el, { text, style, width });
  renderText(el, text, style);
}

/** Redraws every pixel text (after a resize). */
export function refreshPixelTexts() {
  for (const [el, entry] of texts) {
    if (!el.isConnected) texts.delete(el);
    else {
      entry.width = entry.style.wrap ? el.clientWidth : 0;
      renderText(el, entry.text, entry.style);
    }
  }
}

/** @param {HTMLElement} el @param {string} text @param {TextStyle} style */
function renderText(el, text, style) {
  let spoken = /** @type {HTMLElement | null} */ (el.querySelector(':scope > .pt-spoken'));
  let canvas = /** @type {HTMLCanvasElement | null} */ (el.querySelector(':scope > .pt-canvas'));
  if (!spoken || !canvas) {
    spoken = document.createElement('span');
    spoken.className = 'pt-spoken';
    canvas = document.createElement('canvas');
    canvas.className = 'pt-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    el.replaceChildren(spoken, canvas);
  }
  spoken.textContent = style.spoken ?? text;
  drawInto(canvas, el, text, style);
}

/**
 * @param {HTMLCanvasElement} canvas @param {HTMLElement} el @param {string} text @param {TextStyle} style
 */
function drawInto(canvas, el, text, style) {
  const unit = unitFor(style.size ?? 1);
  const maxWidth = style.wrap ? Math.max(20, Math.floor((contentWidth(el) * scale.dpr) / unit) - 1) : Infinity;
  const lines = style.wrap ? wrapText(text, maxWidth) : [text];
  const width = Math.max(1, ...lines.map((line) => measureText(line))) + 1;
  const height = lines.length * LINE_HEIGHT;
  const { ctx } = sizeCanvas(canvas, width, height);
  const color = PALETTE[style.color ?? 'w'];
  const shadow = style.shadow === null ? null : PALETTE[style.shadow ?? 'k'];
  lines.forEach((line, i) => {
    const x = style.align === 'center' ? Math.floor((width - 1 - measureText(line)) / 2) : 0;
    drawText(ctx, line, x, i * LINE_HEIGHT, color, shadow);
  });
  canvas.style.width = `${(width * unit) / scale.dpr}px`;
  canvas.style.height = `${(height * unit) / scale.dpr}px`;
}

/** The width inside an element's padding (CSS pixels); 300 before it is laid out. @param {HTMLElement} el */
function contentWidth(el) {
  if (!el.clientWidth) return 300;
  const cs = getComputedStyle(el);
  return el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
}

/**
 * Device pixels per font pixel for a text size: small is two less than body (at least 2).
 * @param {0 | 1 | 2} size
 */
function unitFor(size) {
  return size === 0 ? Math.max(2, scale.device - 2) : scale.device * size;
}

/** @param {HTMLCanvasElement} canvas @param {number} w @param {number} h */
function sizeCanvas(canvas, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return createCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  return { canvas, ctx };
}

/**
 * A sprite as an element-sized icon at the text's scale (HUD coins, hearts, stars).
 * @param {HTMLCanvasElement} sprite @param {number} [times]
 */
export function createIcon(sprite, times = 1) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pt-icon';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  canvas.getContext('2d')?.drawImage(sprite, 0, 0);
  sizeIcon(canvas, times);
  icons.add({ canvas, times });
  return canvas;
}

/** @type {Set<{ canvas: HTMLCanvasElement, times: number }>} */
const icons = new Set();

/** @param {HTMLCanvasElement} canvas @param {number} times */
function sizeIcon(canvas, times) {
  const unit = Math.max(1, Math.round(scale.device * times));
  canvas.style.width = `${(canvas.width * unit) / scale.dpr}px`;
  canvas.style.height = `${(canvas.height * unit) / scale.dpr}px`;
}

/** Re-sizes every icon to the current scale. */
export function refreshIcons() {
  for (const icon of icons) {
    if (!icon.canvas.isConnected) icons.delete(icon);
    else sizeIcon(icon.canvas, icon.times);
  }
}
