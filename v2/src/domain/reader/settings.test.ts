import { describe, expect, it } from 'vitest';
import { clampWpm, defaultReaderSettings, normalizeReaderSettings, wordAt, wordDelay, wordRanges, wordsOf } from './settings';

describe('normalizeReaderSettings', () => {
  it('starts from the defaults, a size up on a wide screen', () => {
    expect(normalizeReaderSettings(undefined, false)).toEqual(defaultReaderSettings(false));
    expect(normalizeReaderSettings(null, true).size).toBe(3);
    expect(normalizeReaderSettings({}, false)).toEqual({
      theme: 'paper',
      size: 2,
      per: 1,
      mode: 'easy',
      wpm: 250,
      view: 'sentences',
      zoom: true,
      swapButtons: false,
      skipToc: true,
    });
  });

  it('keeps valid values', () => {
    const s = { theme: 'night', size: 6, per: 2, mode: 'auto', wpm: 420, view: 'page', zoom: false, swapButtons: true, skipToc: false };
    expect(normalizeReaderSettings(s, false)).toEqual(s);
  });

  it('repairs broken values as the standalone reader did', () => {
    expect(normalizeReaderSettings({ theme: 'x', size: 99, per: 3, mode: 'fast', wpm: 5000, view: 'x' }, false)).toEqual({
      theme: 'paper',
      size: 6,
      per: 1,
      mode: 'normal',
      wpm: 900,
      view: 'sentences',
      zoom: true,
      swapButtons: false,
      skipToc: true,
    });
    expect(normalizeReaderSettings({ size: -2, wpm: 10 }, false)).toMatchObject({ size: 0, wpm: 60 });
    expect(normalizeReaderSettings({ wpm: 'x' }, false).wpm).toBe(250);
  });
});

describe('clampWpm', () => {
  it('rounds to tens within 60 … 900', () => {
    expect(clampWpm(254)).toBe(250);
    expect(clampWpm(255)).toBe(260);
    expect(clampWpm(20)).toBe(60);
    expect(clampWpm(1000)).toBe(900);
  });
});

describe('wordDelay', () => {
  it('one beat per word, longer at punctuation and for long words', () => {
    expect(wordDelay('kot', 300)).toBe(200);
    expect(wordDelay('kot.', 300)).toBe(400);
    expect(wordDelay('kot?”', 300)).toBe(400);
    expect(wordDelay('kot,', 300)).toBe(300);
    expect(wordDelay('kot—', 300)).toBe(300);
    expect(wordDelay('niezwykły', 300)).toBeCloseTo(240);
    expect(wordDelay('niezwykły.', 300)).toBeCloseTo(480);
  });
});

describe('wordsOf', () => {
  it('splits at spaces, no empty words', () => {
    expect(wordsOf('Ala  ma kota.')).toEqual(['Ala', 'ma', 'kota.']);
  });
});

describe('wordRanges / wordAt', () => {
  it('each word\'s place in the sentence, as wordsOf counts them', () => {
    const t = 'Ala  ma kota.';
    expect(wordRanges(t)).toEqual([
      { start: 0, end: 3 },
      { start: 5, end: 7 },
      { start: 8, end: 13 },
    ]);
    expect(wordRanges(t).map((r) => t.slice(r.start, r.end))).toEqual(wordsOf(t));
  });

  it('the word under a character', () => {
    expect(wordAt('Ala ma kota.', 0)).toBe(0);
    expect(wordAt('Ala ma kota.', 3)).toBe(0);
    expect(wordAt('Ala ma kota.', 5)).toBe(1);
    expect(wordAt('Ala ma kota.', 99)).toBe(2);
  });
});
