import { beforeEach, describe, expect, test } from 'vitest';
import { BANNER_QUEUE_MAX, banners, dismissBanner, showBanner, swipeDismisses } from './banner';

describe('banner queue', () => {
  beforeEach(() => {
    banners.value = [];
  });

  test('one after another; dismissing shows the next', () => {
    const a = showBanner({ source: 'Kalendarz', title: 'A' });
    showBanner({ source: 'Kalendarz', title: 'B' });
    expect(banners.value.map((b) => b.title)).toEqual(['A', 'B']);
    dismissBanner(a);
    expect(banners.value.map((b) => b.title)).toEqual(['B']);
  });

  test(`a burst keeps the one on screen and the newest, ${BANNER_QUEUE_MAX} in all`, () => {
    for (const title of ['A', 'B', 'C', 'D', 'E']) showBanner({ source: 'x', title });
    expect(banners.value.map((b) => b.title)).toEqual(['A', 'D', 'E']);
  });
});

describe('swipe up', () => {
  test('far enough or a flick up dismisses; down or a little does not', () => {
    expect(swipeDismisses(-40, 0, 100)).toBe(true);
    expect(swipeDismisses(-20, 0, 100)).toBe(false);
    expect(swipeDismisses(-5, -0.5, 100)).toBe(true);
    expect(swipeDismisses(30, 0.5, 100)).toBe(false);
  });
});
