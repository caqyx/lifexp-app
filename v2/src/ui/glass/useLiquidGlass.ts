// Gives a floating element (with class "ui-glass") its lens in refract mode: watches
// its size, asks for the filter of exactly that size and points the CSS variable
// --glass-refract at it (glass.css puts it first in backdrop-filter). Outside
// refract mode it does nothing; the blur/solid material is pure CSS.
import type { RefObject } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { ALL_EDGES, parseRadius, type GlassEdges } from './map';
import { acquireGlassFilter, glassModeSignal, releaseGlassFilter } from './registry';

export interface LiquidGlassOptions {
  /** Glass sides; default all four. A bar along the screen edge bends only its free side. */
  edges?: GlassEdges;
  /** How far in the rim curves, px (default: a third of the shorter side, 6…24). */
  bezel?: number;
  /** Strongest shift at the rim, px (default 1.8 × bezel; the shift is at most half of it). */
  scale?: number;
  /** Chromatic edge, px (default 1.5); 0 for big panels, where it costs the most. */
  chroma?: number;
}

export function useLiquidGlass(ref: RefObject<HTMLElement>, options: LiquidGlassOptions = {}): void {
  const refract = glassModeSignal.value === 'refract';
  const { edges = ALL_EDGES, bezel, scale, chroma = 1.5 } = options;
  const edgeKey = `${edges.top}${edges.right}${edges.bottom}${edges.left}`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!refract || !el) return;
    let current: string | null = null;
    let lastKey = '';
    const update = () => {
      // Layout size: a transform (sheet sliding, press scale) never changes the map.
      const width = Math.round(el.offsetWidth);
      const height = Math.round(el.offsetHeight);
      if (width < 4 || height < 4) {
        // Hidden (a closed dialog): give the filter back until it shows again.
        if (current) releaseGlassFilter(current);
        current = null;
        lastKey = '';
        el.style.removeProperty('--glass-refract');
        return;
      }
      const radius = parseRadius(getComputedStyle(el).borderTopLeftRadius, width, height);
      const b = bezel ?? Math.max(6, Math.min(24, Math.min(width, height) / 3));
      const s = scale ?? b * 1.8;
      const key = `${width}x${height}r${radius}b${b}s${s}c${chroma}${edgeKey}`;
      if (key === lastKey) return;
      lastKey = key;
      const id = acquireGlassFilter({ width, height, radius, bezel: b, edges }, s, chroma);
      if (current) releaseGlassFilter(current);
      current = id;
      el.style.setProperty('--glass-refract', `url(#${id})`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.style.removeProperty('--glass-refract');
      if (current) releaseGlassFilter(current);
    };
  }, [refract, edgeKey, bezel, scale, chroma]);
}
