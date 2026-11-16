import { describe, expect, test } from 'vitest';
import { ALL_EDGES, bevelShift, displacementMap, edgePoint, glassFilterId, mapStep, NEUTRAL, parseRadius, type GlassShape } from './map';

const pill: GlassShape = { width: 200, height: 60, radius: 30, bezel: 20, edges: ALL_EDGES };
const px = (map: ReturnType<typeof displacementMap>, x: number, y: number) => {
  const i = (y * map.width + x) * 4;
  return [map.data[i] ?? -1, map.data[i + 1] ?? -1, map.data[i + 2] ?? -1, map.data[i + 3] ?? -1] as const;
};

describe('bevel profile', () => {
  test('strongest at the rim, none where the glass is flat, falling in between', () => {
    expect(bevelShift(0)).toBe(1);
    expect(bevelShift(1)).toBe(0);
    let last = 1;
    for (let s = 0.05; s < 1; s += 0.05) {
      const v = bevelShift(s);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      expect(v).toBeGreaterThanOrEqual(0);
      last = v;
    }
    // Convex edge: most of the bend is in the outer part of the bezel.
    expect(bevelShift(0.5)).toBeLessThan(0.5);
  });
});

describe('edge geometry', () => {
  test('straight sides and rounded corners', () => {
    expect(edgePoint(pill, 99, 0)).toMatchObject({ distance: 0.5, nx: 0, ny: -1 });
    expect(edgePoint(pill, 99, 59)).toMatchObject({ distance: 0.5, nx: 0, ny: 1 });
    const corner = edgePoint(pill, 0, 29);
    expect(corner.nx).toBeCloseTo(-1, 1);
    expect(corner.distance).toBeCloseTo(0.5, 1);
    // Outside the rounded corner.
    expect(edgePoint({ ...pill, width: 60, height: 60 }, 0, 0).distance).toBeLessThan(0);
  });

  test('a side that is not a glass edge never counts as near', () => {
    const bar: GlassShape = { width: 400, height: 56, radius: 0, bezel: 14, edges: { top: false, right: false, bottom: true, left: false } };
    expect(edgePoint(bar, 0, 28).ny).toBe(1); // the nearest glass edge is the bottom
    expect(edgePoint(bar, 0, 0).distance).toBeGreaterThan(14);
    expect(edgePoint(bar, 200, 55)).toMatchObject({ distance: 0.5, ny: 1 });
  });
});

describe('displacement map', () => {
  const map = displacementMap(pill);

  test('the middle is a clear window, opaque and neutral', () => {
    expect(map.width).toBe(200);
    expect(map.height).toBe(60);
    expect(px(map, 100, 30)).toEqual([NEUTRAL, NEUTRAL, NEUTRAL, 255]);
    for (let i = 3; i < map.data.length; i += 4) expect(map.data[i]).toBe(255);
  });

  test('the rim samples inward (towards the middle)', () => {
    // Top edge: sample below → G > 128; bottom edge: above → G < 128.
    expect(px(map, 100, 0)[1]).toBeGreaterThan(200);
    expect(px(map, 100, 59)[1]).toBeLessThan(56);
    // Left end of the pill: sample to the right → R > 128.
    expect(px(map, 1, 30)[0]).toBeGreaterThan(170);
    expect(px(map, 198, 30)[0]).toBeLessThan(86);
    // Vertical edges do not move sideways.
    expect(px(map, 100, 0)[0]).toBe(NEUTRAL);
  });

  test('symmetric: opposite edges bend by the same amount', () => {
    for (const y of [0, 5, 10, 15]) {
      const top = px(map, 100, y)[1] - NEUTRAL;
      const bottom = NEUTRAL - px(map, 100, 59 - y)[1];
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1);
    }
  });

  test('bezel 0 = flat glass', () => {
    const flat = displacementMap({ ...pill, bezel: 0 });
    expect(new Set(Array.from(flat.data.filter((_, i) => i % 4 < 3)))).toEqual(new Set([NEUTRAL]));
  });

  test('big panels get a coarser map of the same shape', () => {
    expect(mapStep(400, 64)).toBe(1);
    const step = mapStep(1000, 800);
    expect(step).toBeGreaterThan(1);
    const coarse = displacementMap({ ...pill, width: 1000, height: 800, radius: 28 }, step);
    expect(coarse.width * coarse.height).toBeLessThanOrEqual(160_000);
    expect(px(coarse, Math.floor(coarse.width / 2), 0)[1]).toBeGreaterThan(160);
  });
});

describe('helpers', () => {
  test('radius from computed style, clamped to a pill', () => {
    expect(parseRadius('12px', 100, 50)).toBe(12);
    expect(parseRadius('999px', 300, 64)).toBe(32);
    expect(parseRadius('50%', 40, 40)).toBe(20);
    expect(parseRadius('28px 28px 0px 0px', 300, 400)).toBe(28);
    expect(parseRadius('', 10, 10)).toBe(0);
  });

  test('filter id names size, shape and strength (cache key)', () => {
    expect(glassFilterId(pill, 18)).toBe('ui-glass-200x60-r30-b20-e15-s18');
    expect(glassFilterId({ ...pill, edges: { top: false, right: false, bottom: true, left: false } }, 18)).toContain('-e4-');
  });
});
