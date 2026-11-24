import { describe, expect, test } from 'vitest';
import { glassMode, type GlassEnvironment } from './support';

const chrome: GlassEnvironment = {
  urlBackdrop: true,
  blurBackdrop: true,
  chromium: true,
  reduceTransparency: false,
  lowEnd: false,
  slowDevice: false,
};

describe('glass mode', () => {
  test('Chromium with url() in backdrop-filter refracts', () => {
    expect(glassMode(true, chrome)).toBe('refract');
  });

  test('Safari/iOS and Firefox parse url() but do not draw it: blur fallback', () => {
    expect(glassMode(true, { ...chrome, chromium: false })).toBe('blur');
    expect(glassMode(true, { ...chrome, urlBackdrop: false })).toBe('blur');
  });

  test('Reduce transparency / Increase contrast, or no backdrop-filter at all: solid', () => {
    expect(glassMode(true, { ...chrome, reduceTransparency: true })).toBe('solid');
    expect(glassMode(true, { ...chrome, urlBackdrop: false, blurBackdrop: false, chromium: false })).toBe('solid');
  });

  test('a low-end or measured-slow device keeps the material over a plain blur', () => {
    expect(glassMode(true, { ...chrome, lowEnd: true })).toBe('blur');
    expect(glassMode(true, { ...chrome, slowDevice: true })).toBe('blur');
    // Reduce transparency still wins.
    expect(glassMode(true, { ...chrome, lowEnd: true, reduceTransparency: true })).toBe('solid');
  });

  test('themes without glass are left alone', () => {
    expect(glassMode(false, chrome)).toBe('off');
  });
});
