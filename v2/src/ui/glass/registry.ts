// Liquid glass state: the mode on <html data-glass> and the SVG filters in use.
//
// Budget (owner: "more glass, but optimised"): elements share filters by size bucket
// (bucket.ts), at most MAX_FILTERS live at once (an element past the cap keeps the
// blur material), the last few unused ones stay mounted for the next opening, maps are
// cached, and building a new map waits for an idle moment, never a frame of an
// animation. The refracting code (lens.ts) loads only in refract mode.
import { signal } from '@preact/signals';
import type { GlassSpec } from './bucket';
import { glassMode, probeGlass, SOLID_GLASS_QUERIES, type GlassMode } from './support';

type Lens = typeof import('./lens');

export interface MountedFilter {
  spec: GlassSpec;
  /** PNG data URL of the displacement map. */
  map: string;
}

/** The current glass mode; 'off' outside the iOS theme. */
export const glassModeSignal = signal<GlassMode>('off');
/** Filters ready to use, rendered by GlassFilters. */
export const glassFilters = signal<readonly MountedFilter[]>([]);
/** lens.ts once loaded (refract mode only). */
export const lensModule = signal<Lens | null>(null);

/** Distinct filters alive at once (in use + kept for reuse). */
export const MAX_FILTERS = 8;
/** Unused filters kept mounted (a sheet opened again reuses its own). */
export const IDLE_FILTERS = 3;
const MAP_CACHE_SIZE = 16;

interface Entry {
  spec: GlassSpec;
  users: number;
  map: string | null;
  waiting: Set<() => void>;
}

/** Least recently used first. */
const entries = new Map<string, Entry>();
const mapCache = new Map<string, string>();
let lensLoading: Promise<Lens> | null = null;

function loadLens(): Promise<Lens> {
  lensLoading ??= import('./lens').then((lens) => {
    lensModule.value = lens;
    return lens;
  });
  return lensLoading;
}

function whenIdle(task: () => void) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(task, { timeout: 300 });
  else setTimeout(task, 32);
}

function publish() {
  glassFilters.value = [...entries.values()].flatMap((e) => (e.map ? [{ spec: e.spec, map: e.map }] : []));
}

/** Drops unused filters past the idle allowance (and, if `room`, one more to make space). */
function evict(room: boolean): boolean {
  const unused = [...entries.values()].filter((e) => e.users === 0);
  let changed = false;
  while (unused.length > IDLE_FILTERS || (room && entries.size >= MAX_FILTERS && unused.length > 0)) {
    const oldest = unused.shift();
    if (!oldest) break;
    entries.delete(oldest.spec.id);
    changed = true;
  }
  return changed;
}

function build(entry: Entry) {
  void loadLens().then((lens) =>
    whenIdle(() => {
      if (entries.get(entry.spec.id) !== entry) return; // evicted meanwhile
      let map = mapCache.get(entry.spec.id);
      if (map) mapCache.delete(entry.spec.id);
      else map = lens.encodeMap(entry.spec);
      mapCache.set(entry.spec.id, map);
      while (mapCache.size > MAP_CACHE_SIZE) mapCache.delete(mapCache.keys().next().value as string);
      entry.map = map;
      publish();
      // The <filter> is in the DOM by the next frame (Preact renders in a microtask).
      requestAnimationFrame(() => {
        for (const ready of entry.waiting) ready();
        entry.waiting.clear();
      });
    }),
  );
}

export interface GlassHandle {
  id: string;
  release(): void;
}

/**
 * The shared filter for `spec`. `onReady` runs once its <filter> exists (at once if
 * it already does). Null when MAX_FILTERS are all in use: stay with the blur material.
 */
export function acquireGlass(spec: GlassSpec, onReady: () => void): GlassHandle | null {
  let entry = entries.get(spec.id);
  if (!entry) {
    if (entries.size >= MAX_FILTERS && evict(true)) publish();
    if (entries.size >= MAX_FILTERS) return null;
    entry = { spec, users: 0, map: null, waiting: new Set() };
    build(entry);
  }
  entries.delete(spec.id);
  entries.set(spec.id, entry); // most recently used
  entry.users += 1;
  const own = entry;
  let waiter: (() => void) | null = null;
  if (own.map) onReady();
  else {
    waiter = () => onReady(); // one per request, even for the same callback
    own.waiting.add(waiter);
  }
  let released = false;
  return {
    id: spec.id,
    release() {
      if (released) return;
      released = true;
      if (waiter) own.waiting.delete(waiter);
      own.users -= 1;
      if (own.users === 0 && evict(false)) publish();
    },
  };
}

/** For tests: how many filters are alive (in use or kept). */
export function liveGlassFilters(): number {
  return entries.size;
}

/** For tests: forget every filter. */
export function resetGlassForTests(): void {
  entries.clear();
  mapCache.clear();
  glassFilters.value = [];
}

// ── Mode ──

let themeWantsGlass = false;
let watching = false;
/** Measured once per session: the device cannot keep up (see probeFrames). */
const SLOW_KEY = 'lifexp-v2-glass-slow';
let slowDevice = readSlow();
let probed = false;

function readSlow(): boolean {
  try {
    return sessionStorage.getItem(SLOW_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Frame-time check before the lens is trusted: 30 frames of an idle page. A device
 * that cannot hold ~45 fps even then gets the blur material for the session.
 */
function probeFrames(root: HTMLElement) {
  if (probed || document.visibilityState !== 'visible') return;
  probed = true;
  const times: number[] = [];
  let last = 0;
  const tick = (t: number) => {
    if (last) times.push(t - last);
    last = t;
    if (times.length < 30) return void requestAnimationFrame(tick);
    times.sort((a, b) => a - b);
    if ((times[15] ?? 0) <= 22) return;
    slowDevice = true;
    try {
      sessionStorage.setItem(SLOW_KEY, '1');
    } catch {
      // the session still knows
    }
    apply(root);
  };
  whenIdle(() => requestAnimationFrame(tick));
}

function apply(root: HTMLElement) {
  const mode = glassMode(themeWantsGlass, { ...probeGlass(), slowDevice });
  if (mode === 'off') delete root.dataset.glass;
  else root.dataset.glass = mode;
  glassModeSignal.value = mode;
  if (mode === 'refract') {
    void loadLens();
    probeFrames(root);
  }
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
