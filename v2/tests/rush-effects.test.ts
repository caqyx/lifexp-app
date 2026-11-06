// Rush juice (stage q-rush): squash and stretch, the hit-stop's constants and the shared
// "fewer effects" choice.
import { describe, expect, test } from 'vitest';
import { HIT_STOP, ringProgress, shakeOffset, SQUASH_TIME, squashOf } from '../public/games/_engine/effects.js';
import { readCalm, saveCalm } from '../public/games/_engine/records.js';
import { CALM_KEY } from '../public/games/rush/js/settings.js';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('squash and stretch', () => {
  test('rest is 0; a landing squashes, a take-off stretches, both ease back by SQUASH_TIME', () => {
    expect(squashOf(10, 10)).toBe(0);
    expect(squashOf(0, 10)).toBeLessThan(-0.1);
    expect(squashOf(10, 0)).toBeGreaterThan(0.1);
    expect(squashOf(SQUASH_TIME / 2, 10)).toBeGreaterThan(squashOf(0, 10));
    expect(squashOf(SQUASH_TIME, 10)).toBe(0);
    expect(squashOf(10, SQUASH_TIME)).toBe(0);
  });

  test('the later of landing and take-off wins', () => {
    expect(squashOf(0.01, 0.05)).toBeLessThan(0);
    expect(squashOf(0.05, 0.01)).toBeGreaterThan(0);
  });
});

describe('the crash', () => {
  test('the hit-stop is a few frames; shake and the shock ring start after it', () => {
    expect(HIT_STOP).toBeGreaterThanOrEqual(0.03);
    expect(HIT_STOP).toBeLessThanOrEqual(0.1);
    expect(shakeOffset(-0.01, () => 0.9)).toEqual({ x: 0, y: 0 });
    expect(ringProgress(-0.01)).toBeNull();
  });
});

describe('fewer effects', () => {
  test('off by default, kept once chosen, one key for every Rush mode', () => {
    const storage = memoryStorage();
    expect(readCalm(storage, CALM_KEY)).toBe(false);
    saveCalm(storage, CALM_KEY, true);
    expect(readCalm(storage, CALM_KEY)).toBe(true);
    expect(storage.getItem(CALM_KEY)).toBe('true');
    saveCalm(storage, CALM_KEY, false);
    expect(readCalm(storage, CALM_KEY)).toBe(false);
    expect(readCalm(null, CALM_KEY)).toBe(false);
    // A game with no key keeps nothing.
    saveCalm(storage, null, true);
    expect(readCalm(storage, null)).toBe(false);
  });
});
