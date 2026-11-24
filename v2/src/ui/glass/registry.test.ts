import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ALL_EDGES, glassSpec } from './bucket';
import { acquireGlass, glassFilters, IDLE_FILTERS, liveGlassFilters, MAX_FILTERS, resetGlassForTests } from './registry';

const encoded: string[] = [];
vi.mock('./lens', () => ({
  encodeMap: (spec: { id: string }) => {
    encoded.push(spec.id);
    return `data:${spec.id}`;
  },
  filterDef: () => null,
}));

const spec = (width: number, height = 64) => glassSpec({ width, height, radius: 20, bezel: 18, edges: ALL_EDGES }, 30, 0);
const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  resetGlassForTests();
  encoded.length = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe('glass filter registry', () => {
  test('a filter is built once, after the lens loads; every user is told when it is ready', async () => {
    const ready = vi.fn();
    const a = acquireGlass(spec(380), ready);
    const b = acquireGlass(spec(384), ready); // same bucket
    expect(a?.id).toBe(b?.id);
    expect(ready).not.toHaveBeenCalled(); // not before the <filter> exists
    await settle();
    expect(ready).toHaveBeenCalledTimes(2);
    expect(encoded).toEqual([a?.id]);
    expect(glassFilters.value.map((f) => f.spec.id)).toEqual([a?.id]);
    // Ready already: the next user is told at once.
    const late = vi.fn();
    acquireGlass(spec(386), late);
    expect(late).toHaveBeenCalledTimes(1);
  });

  test('released filters stay for reuse up to the idle allowance, then the oldest go', async () => {
    const handles = [200, 240, 280, 320, 360].map((w) => acquireGlass(spec(w), () => {}));
    await settle();
    for (const h of handles) h?.release();
    expect(liveGlassFilters()).toBe(IDLE_FILTERS);
    expect(glassFilters.value).toHaveLength(IDLE_FILTERS);
    // Reopening one of the kept ones rebuilds nothing.
    const before = encoded.length;
    acquireGlass(spec(360), () => {});
    await settle();
    expect(encoded.length).toBe(before);
  });

  test('never more than MAX_FILTERS alive: past the cap an element keeps the blur material', async () => {
    const widths = Array.from({ length: MAX_FILTERS + 3 }, (_, i) => 100 + i * 40);
    const handles = widths.map((w) => acquireGlass(spec(w), () => {}));
    expect(handles.filter(Boolean)).toHaveLength(MAX_FILTERS);
    expect(handles.slice(MAX_FILTERS).every((h) => h === null)).toBe(true);
    expect(liveGlassFilters()).toBe(MAX_FILTERS);
    // An unused filter makes room for a new one.
    handles[0]?.release();
    expect(acquireGlass(spec(2000), () => {})).not.toBeNull();
    expect(liveGlassFilters()).toBeLessThanOrEqual(MAX_FILTERS);
    await settle();
    expect(glassFilters.value.length).toBeLessThanOrEqual(MAX_FILTERS);
  });

  test('a filter released before its map is built is not reported ready to that user', async () => {
    const ready = vi.fn();
    acquireGlass(spec(500), ready)?.release();
    await settle();
    expect(ready).not.toHaveBeenCalled();
  });
});
