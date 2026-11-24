import { describe, expect, test } from 'vitest';
import { ALL_EDGES, bucketLength, glassSpec, parseRadius } from './bucket';

describe('size buckets', () => {
  test('steps of 1/16 of the power of two, at least 8 px', () => {
    expect(bucketLength(388)).toBe(384);
    expect(bucketLength(395)).toBe(400);
    expect(bucketLength(64)).toBe(64);
    expect(bucketLength(61)).toBe(64);
    expect(bucketLength(900)).toBe(896);
    expect(bucketLength(3)).toBe(8);
  });

  test('a bucket never stretches an element by more than ~3 % (from 128 px up)', () => {
    for (let px = 128; px <= 2000; px += 7) {
      expect(Math.abs(bucketLength(px) - px) / px).toBeLessThanOrEqual(0.032);
    }
  });

  test('elements of nearly the same size share one filter; different sizes do not', () => {
    const toast = (width: number, height: number) =>
      glassSpec({ width, height, radius: 20, bezel: 18, edges: ALL_EDGES }, 32, 0).id;
    expect(toast(380, 66)).toBe(toast(386, 64));
    expect(toast(380, 66)).not.toBe(toast(380, 120));
  });

  test('a pill stays a pill in its bucket; strengths are rounded', () => {
    const spec = glassSpec({ width: 388, height: 61, radius: 999, bezel: 20.4, edges: ALL_EDGES }, 36.6, 1.4);
    expect(spec.shape).toMatchObject({ width: 384, height: 64, radius: 32 });
    expect(spec.scale).toBe(37);
    expect(spec.chroma).toBe(1.5);
    expect(spec.id).toBe('ui-glass-384x64-r32-b20-e15-s37-c15');
  });

  test('the edges are part of the key', () => {
    const bar = glassSpec({ width: 412, height: 56, radius: 0, bezel: 14, edges: { top: false, right: false, bottom: true, left: false } }, 25, 0);
    expect(bar.id).toContain('-e4-');
  });
});

test('radius from computed style, clamped to a pill', () => {
  expect(parseRadius('12px', 100, 50)).toBe(12);
  expect(parseRadius('999px', 300, 64)).toBe(32);
  expect(parseRadius('50%', 40, 40)).toBe(20);
  expect(parseRadius('28px 28px 0px 0px', 300, 400)).toBe(28);
  expect(parseRadius('', 10, 10)).toBe(0);
});
