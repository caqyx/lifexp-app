// Liquid glass, the lens (iOS theme, docs/v2/PLAN.md 4.9): displacement maps for an
// SVG feDisplacementMap that bends what is behind a floating bar near its rim, like
// light through a convex glass edge. Pure functions only: the canvas encoding and
// the <filter> elements live in lens.ts; both load only in refract mode.
//
// The map is an RGBA image the size of the element: R moves the sampled point
// horizontally, G vertically, 128 = no move (feDisplacementMap: P'(x) = P(x + scale ·
// (C − 0.5))). Every point samples INWARD, towards the middle, so the filter never
// reads outside the element's own backdrop, and the middle stays a clear window.

import type { GlassShape } from './bucket';

/** Index of refraction of the glass: 1.5 is window glass. */
const IOR = 1.5;

/**
 * Sideways shift of a ray seen through the bevel, 0…1 (1 at the rim, 0 where the
 * glass turns flat). `s` is the distance from the rim as a share of the bezel.
 * The surface is a squircle edge h(s) = (1 − (1 − s)⁴)^¼: steep at the rim, flat
 * inside, so the bend is strong right at the edge and fades out smoothly (no ring).
 * A vertical ray hits a surface tilted by θ = atan(h′) and refracts by Snell's law;
 * the shift is tan(θ − θr), normalised by its value at the rim (θ = 90°).
 */
export function bevelShift(s: number): number {
  if (s <= 0) return 1;
  if (s >= 1) return 0;
  const u = 1 - s;
  const slope = u ** 3 * (1 - u ** 4) ** -0.75;
  const theta = Math.atan(slope);
  const refracted = Math.asin(Math.sin(theta) / IOR);
  const rim = Math.PI / 2 - Math.asin(1 / IOR);
  return Math.tan(theta - refracted) / Math.tan(rim);
}

export interface EdgePoint {
  /** Distance to the nearest glass edge, px (negative outside the shape). */
  distance: number;
  /** Outward unit normal of that edge. */
  nx: number;
  ny: number;
}

/**
 * Distance and outward normal at the pixel centre (x + ½, y + ½) of a rounded
 * rectangle. Sides that are not glass edges are pushed far out, so they never
 * count as near (their corners go with them).
 */
export function edgePoint(shape: GlassShape, x: number, y: number): EdgePoint {
  const far = shape.bezel * 4 + shape.radius * 2 + 1;
  const left = shape.edges.left ? 0 : -far;
  const top = shape.edges.top ? 0 : -far;
  const right = shape.width + (shape.edges.right ? 0 : far);
  const bottom = shape.height + (shape.edges.bottom ? 0 : far);
  const halfW = (right - left) / 2;
  const halfH = (bottom - top) / 2;
  const r = Math.max(0, Math.min(shape.radius, halfW, halfH));
  const px = x + 0.5 - (left + halfW);
  const py = y + 0.5 - (top + halfH);
  const qx = Math.abs(px) - (halfW - r);
  const qy = Math.abs(py) - (halfH - r);
  const sx = px < 0 ? -1 : 1;
  const sy = py < 0 ? -1 : 1;
  if (qx > 0 && qy > 0) {
    const length = Math.hypot(qx, qy);
    return { distance: r - length, nx: (sx * qx) / length, ny: (sy * qy) / length };
  }
  if (qx > qy) return { distance: r - qx, nx: sx, ny: 0 };
  return { distance: r - qy, nx: 0, ny: sy };
}

/** The neutral channel value: no displacement. */
export const NEUTRAL = 128;

/**
 * RGBA pixels (width × height × 4) of the displacement map for `shape`, sampled
 * every `step` CSS px (step > 1 for big panels: the filter scales the image up
 * smoothly). R/G = 128 ∓ normal · shift · 127, B = 128, A = 255 (opaque, so no
 * premultiplication can skew the vectors).
 */
export function displacementMap(
  shape: GlassShape,
  step = 1,
): { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } {
  const width = Math.max(1, Math.ceil(shape.width / step));
  const height = Math.max(1, Math.ceil(shape.height / step));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = NEUTRAL;
    data[i + 1] = NEUTRAL;
    data[i + 2] = NEUTRAL;
    data[i + 3] = 255;
  }
  if (shape.bezel <= 0) return { width, height, data };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Map pixel centre → element px (edgePoint adds the half pixel back).
      const point = edgePoint(shape, (x + 0.5) * step - 0.5, (y + 0.5) * step - 0.5);
      if (point.distance < 0 || point.distance >= shape.bezel) continue;
      const shift = bevelShift(point.distance / shape.bezel);
      const i = (y * width + x) * 4;
      data[i] = Math.round(NEUTRAL - point.nx * shift * 127);
      data[i + 1] = Math.round(NEUTRAL - point.ny * shift * 127);
    }
  }
  return { width, height, data };
}

/** Map pixels kept under this many; bigger panels get a coarser map (it is smooth anyway). */
const MAX_MAP_PIXELS = 80_000;

export function mapStep(width: number, height: number): number {
  const area = width * height;
  return area <= MAX_MAP_PIXELS ? 1 : Math.ceil(Math.sqrt(area / MAX_MAP_PIXELS));
}
