// Liquid glass, sharing (startup code, tiny): which filter an element uses. Filters are
// sized in the element's own box (objectBoundingBox), so one filter fits every element
// whose size falls in the same bucket: the map is stretched by at most a few per cent.
// Many toasts, banners, sheets and buttons then share a handful of filters, and the
// displacement maps behind them are built once (lens.ts, loaded only in refract mode).

/** Which sides of the element are glass edges; a bar glued to the screen edge has three off. */
export interface GlassEdges {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export const ALL_EDGES: GlassEdges = { top: true, right: true, bottom: true, left: true };

export interface GlassShape {
  /** Size in CSS px (whole pixels). */
  width: number;
  height: number;
  /** Corner radius in CSS px; clamped to half the shorter side (a pill). */
  radius: number;
  /** How far in from the rim the glass curves, CSS px. Past it the glass is flat. */
  bezel: number;
  edges: GlassEdges;
}

/** A filter: the bucket shape its map is built for, and the shift in px. */
export interface GlassSpec {
  id: string;
  shape: GlassShape;
  /** Strongest shift at the rim, CSS px (for the bucket's width). */
  scale: number;
  /** Extra red-over-blue shift at the rim, CSS px; 0 = no chromatic edge. */
  chroma: number;
}

/**
 * The bucket a length falls in: steps of 1/16 of its power of two (so at most ~3 %
 * stretch), never finer than 8 px. 388 → 384, 64 → 64, 61 → 64, 900 → 896.
 */
export function bucketLength(px: number): number {
  const n = Math.max(1, Math.round(px));
  const step = Math.max(8, 2 ** (Math.floor(Math.log2(n)) - 4));
  return Math.max(step, Math.round(n / step) * step);
}

/** A computed radius ("12px", "999px", "50%", "16px 16px") → px for this element. */
export function parseRadius(value: string, width: number, height: number): number {
  const first = value.trim().split(/\s+/)[0] ?? '';
  const n = Number.parseFloat(first);
  if (!Number.isFinite(n) || n < 0) return 0;
  const px = first.endsWith('%') ? (n / 100) * Math.min(width, height) : n;
  return Math.min(px, Math.min(width, height) / 2);
}

const edgeMask = (e: GlassEdges) => (e.top ? 1 : 0) | (e.right ? 2 : 0) | (e.bottom ? 4 : 0) | (e.left ? 8 : 0);

/**
 * The shared filter for an element of this size: dimensions bucketed, radius, bezel
 * and strengths rounded to even px (a pill stays a pill).
 */
export function glassSpec(shape: GlassShape, scale: number, chroma: number): GlassSpec {
  const width = bucketLength(shape.width);
  const height = bucketLength(shape.height);
  // Radius and bezel are not scaled: the map is stretched by the same few per cent.
  const pill = shape.radius >= Math.min(shape.width, shape.height) / 2 - 0.5;
  const radius = pill ? Math.min(width, height) / 2 : Math.min(Math.round(shape.radius / 2) * 2, Math.min(width, height) / 2);
  const bezel = Math.max(2, Math.round(shape.bezel / 2) * 2);
  const s = Math.max(0, Math.round(scale));
  const c = Math.round(chroma * 2) / 2;
  const id = `ui-glass-${width}x${height}-r${radius}-b${bezel}-e${edgeMask(shape.edges)}-s${s}-c${c * 10}`;
  return { id, shape: { width, height, radius, bezel, edges: shape.edges }, scale: s, chroma: c };
}
