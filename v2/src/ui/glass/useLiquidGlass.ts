// Gives a floating element (with class "ui-glass") its lens in refract mode. Only
// while it is on screen (IntersectionObserver): it asks for the shared filter of its
// size bucket and points --glass-refract at it once the filter exists (glass.css puts
// it first in backdrop-filter). Off screen, hidden or closed, it gives the filter back
// and keeps the blur material. Outside refract mode it does nothing.
import type { RefObject } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { ALL_EDGES, glassSpec, parseRadius, type GlassEdges } from './bucket';
import { acquireGlass, glassModeSignal, type GlassHandle } from './registry';

export interface LiquidGlassOptions {
  /** Glass sides; default all four. A bar along the screen edge bends only its free side. */
  edges?: GlassEdges;
  /** How far in the rim curves, px (default: a third of the shorter side, 6…24). */
  bezel?: number;
  /** Strongest shift at the rim, px (default 1.8 × bezel; the shift is at most half of it). */
  scale?: number;
  /**
   * Chromatic edge, px (default 0). It triples the displacement passes: measured on a
   * Pixel 7 profile (CPU 4×), chroma on the top and tab bars doubled long frames while
   * a new screen rose in, so only the tab bar has it.
   */
  chroma?: number;
}

export function useLiquidGlass(ref: RefObject<HTMLElement>, options: LiquidGlassOptions = {}): void {
  const refract = glassModeSignal.value === 'refract';
  const { edges = ALL_EDGES, bezel, scale, chroma = 0 } = options;
  const edgeKey = `${edges.top}${edges.right}${edges.bottom}${edges.left}`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!refract || !el) return;
    let handle: GlassHandle | null = null;
    let visible = false;

    const drop = () => {
      handle?.release();
      handle = null;
      el.style.removeProperty('--glass-refract');
    };

    const update = () => {
      // Layout size: a transform (sheet sliding, press scale) never changes the map.
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      if (!visible || width < 4 || height < 4) return drop();
      const radius = parseRadius(getComputedStyle(el).borderTopLeftRadius, width, height);
      const b = bezel ?? Math.max(6, Math.min(24, Math.min(width, height) / 3));
      const spec = glassSpec({ width, height, radius, bezel: b, edges }, scale ?? b * 1.8, chroma);
      if (handle?.id === spec.id) return; // same bucket: nothing to do
      const previous = handle;
      // Until the new filter exists: the blur material, never a url() to a filter that went.
      el.style.removeProperty('--glass-refract');
      const request = { live: true };
      handle = acquireGlass(spec, () => {
        if (request.live) el.style.setProperty('--glass-refract', `url(#${spec.id})`);
      });
      const release = handle?.release;
      if (handle && release) handle.release = () => ((request.live = false), release());
      previous?.release();
    };

    const resize = new ResizeObserver(update);
    resize.observe(el);
    const intersection = new IntersectionObserver(
      (records) => {
        const record = records[records.length - 1];
        visible = record?.isIntersecting ?? false;
        update();
      },
      { rootMargin: '64px' },
    );
    intersection.observe(el);
    return () => {
      resize.disconnect();
      intersection.disconnect();
      drop();
    };
  }, [refract, edgeKey, bezel, scale, chroma]);
}
