// Liquid glass state: the mode on <html data-glass> and the SVG filters in use.
// Elements ask for a filter of their exact size (useLiquidGlass); equal sizes share
// one, and encoded maps stay cached, so resizing back and forth costs nothing.
import { signal } from '@preact/signals';
import { displacementMap, glassFilterId, mapStep, type GlassShape } from './map';
import { glassMode, probeGlass, SOLID_GLASS_QUERIES, type GlassMode } from './support';

export interface GlassFilter {
  id: string;
  width: number;
  height: number;
  /** PNG data URL of the displacement map. */
  map: string;
  /** Strongest shift at the rim, CSS px. */
  scale: number;
  /** Extra shift of red over blue at the rim (chromatic edge), CSS px; 0 = none. */
  chroma: number;
}

/** The current glass mode; 'off' outside the iOS theme. */
export const glassModeSignal = signal<GlassMode>('off');

/** Filters mounted by GlassFilters. */
export const glassFilters = signal<readonly GlassFilter[]>([]);

const users = new Map<string, number>();
/** Encoded maps, most recently used last. */
const mapCache = new Map<string, string>();
const MAP_CACHE_SIZE = 24;

function encodeMap(shape: GlassShape): string {
  const step = mapStep(shape.width, shape.height);
  const { width, height, data } = displacementMap(shape, step);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.putImageData(new ImageData(data, width, height), 0, 0);
  return canvas.toDataURL('image/png');
}

function cachedMap(key: string, shape: GlassShape): string {
  let url = mapCache.get(key);
  if (url) mapCache.delete(key);
  else url = encodeMap(shape);
  mapCache.set(key, url);
  while (mapCache.size > MAP_CACHE_SIZE) mapCache.delete(mapCache.keys().next().value as string);
  return url;
}

/** A filter for this shape and strength; call releaseGlassFilter(id) when done with it. */
export function acquireGlassFilter(shape: GlassShape, scale: number, chroma: number): string {
  const id = `${glassFilterId(shape, scale)}-c${Math.round(chroma * 10)}`;
  const count = users.get(id) ?? 0;
  users.set(id, count + 1);
  if (count === 0) {
    const filter: GlassFilter = { id, width: shape.width, height: shape.height, map: cachedMap(id, shape), scale, chroma };
    glassFilters.value = [...glassFilters.value, filter];
  }
  return id;
}

export function releaseGlassFilter(id: string): void {
  const count = users.get(id) ?? 0;
  if (count > 1) {
    users.set(id, count - 1);
    return;
  }
  users.delete(id);
  glassFilters.value = glassFilters.value.filter((f) => f.id !== id);
}

let themeWantsGlass = false;
let watching = false;

function apply(root: HTMLElement) {
  const mode = glassMode(themeWantsGlass, probeGlass());
  if (mode === 'off') delete root.dataset.glass;
  else root.dataset.glass = mode;
  glassModeSignal.value = mode;
}

/**
 * Turns the glass on or off for the current theme (app/theme.ts) and keeps it in
 * step with "Reduce transparency" / "Increase contrast" while the app runs.
 */
export function setThemeGlass(themeHasGlass: boolean, root: HTMLElement = document.documentElement): void {
  themeWantsGlass = themeHasGlass;
  apply(root);
  if (watching || typeof matchMedia !== 'function') return;
  watching = true;
  for (const query of SOLID_GLASS_QUERIES) matchMedia(query).addEventListener('change', () => apply(root));
}
