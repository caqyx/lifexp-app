import { describe, expect, it } from 'vitest';
import {
  CHUNK_HARD,
  chunkIndexOf,
  chunkSentences,
  MAX_ZOOM,
  OVERVIEW,
  pageCount,
  pageOfX,
  sentenceOfSpread,
  firstSentenceFrom,
  spreadLayout,
  spreadOfPage,
  spreadShift,
  unionBox,
  zoomTo,
} from './spread';

describe('spreadLayout', () => {
  it('is the same for the same screen and text size (stable pages), in whole pixels', () => {
    const a = spreadLayout(707, 331.6, 17.16);
    const b = spreadLayout(707, 331.6, 17.16);
    expect(a).toEqual(b);
    for (const v of Object.values(a)) expect(Number.isInteger(v)).toBe(true);
  });

  it('two pages: the text of the right page starts one column + gap after the left one', () => {
    const l = spreadLayout(700, 330, 17);
    expect(l.pageW).toBe(350);
    // Left text starts at padOuter; right text at pageW + padInner; the distance is colW + gap.
    expect(l.pageW + l.padInner - l.padOuter).toBe(l.colW + l.gap);
    expect(l.colH).toBe(l.pageH - l.padTop - l.padBottom);
  });

  it('larger text, wider margins; never a negative page', () => {
    expect(spreadLayout(700, 330, 30).padInner).toBeGreaterThan(spreadLayout(700, 330, 14).padInner);
    const tiny = spreadLayout(10, 10, 17);
    expect(tiny.colW).toBeGreaterThan(0);
    expect(tiny.colH).toBeGreaterThan(0);
  });
});

describe('pages and spreads', () => {
  const l = { colW: 300, gap: 40 };

  it('a point maps to its page; spreads hold two pages', () => {
    expect(pageOfX(0, l)).toBe(0);
    expect(pageOfX(299, l)).toBe(0);
    expect(pageOfX(340, l)).toBe(1);
    expect(pageOfX(680, l)).toBe(2);
    expect(pageOfX(-5, l)).toBe(0);
    expect([0, 1, 2, 3, 4].map(spreadOfPage)).toEqual([0, 0, 1, 1, 2]);
  });

  it('spread k moves the columns by two pages each', () => {
    expect(spreadShift(0, l)).toBe(0);
    expect(spreadShift(3, l)).toBe(3 * 2 * 340);
  });

  it('counts pages from the columns\' width', () => {
    expect(pageCount(300, l)).toBe(1);
    expect(pageCount(640, l)).toBe(2);
    expect(pageCount(1660, l)).toBe(5);
    expect(pageCount(0, l)).toBe(1);
  });
});

describe('sentence ↔ spread', () => {
  // Sentence spreads: 0 0 0 1 1 3 3 (spread 2 is the continuation of sentence 4).
  const spreads = [0, 0, 0, 1, 1, 3, 3];
  const spreadOf = (s: number) => spreads[s] as number;

  it('finds the first sentence starting on a spread', () => {
    expect(firstSentenceFrom(0, 7, spreadOf)).toBe(0);
    expect(firstSentenceFrom(1, 7, spreadOf)).toBe(3);
    expect(firstSentenceFrom(2, 7, spreadOf)).toBe(5);
    expect(firstSentenceFrom(4, 7, spreadOf)).toBe(7);
  });

  it('a spread where no sentence starts belongs to the one running onto it', () => {
    expect(sentenceOfSpread(1, 7, spreadOf)).toBe(3);
    expect(sentenceOfSpread(2, 7, spreadOf)).toBe(4);
    expect(sentenceOfSpread(3, 7, spreadOf)).toBe(5);
    expect(sentenceOfSpread(9, 7, spreadOf)).toBe(6);
    expect(sentenceOfSpread(0, 0, spreadOf)).toBe(0);
  });
});

describe('zoomTo', () => {
  const view = { w: 800, h: 320 };

  it('zooms a short sentence in, centred, up to the limit', () => {
    const cam = zoomTo({ x: 100, y: 100, w: 120, h: 30 }, view);
    expect(cam.scale).toBe(MAX_ZOOM);
    // The sentence's centre lands at the view's centre unless that would show beyond the spread.
    expect(cam.x).toBeCloseTo(Math.min(0, 400 - 160 * MAX_ZOOM));
  });

  it('a sentence as wide as the spread is not zoomed', () => {
    expect(zoomTo({ x: 0, y: 0, w: 800, h: 300 }, view)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('never shows anything outside the spread', () => {
    const corner = zoomTo({ x: 760, y: 290, w: 30, h: 20 }, view);
    expect(corner.x).toBeGreaterThanOrEqual(view.w - view.w * corner.scale - 0.01);
    expect(corner.y).toBeGreaterThanOrEqual(view.h - view.h * corner.scale - 0.01);
    expect(corner.x).toBeLessThanOrEqual(0);
    const origin = zoomTo({ x: 0, y: 0, w: 30, h: 20 }, view);
    expect(origin.x).toBe(0);
    expect(origin.y).toBe(0);
  });

  it('an empty view gives the overview', () => {
    expect(zoomTo({ x: 0, y: 0, w: 1, h: 1 }, { w: 0, h: 0 })).toEqual(OVERVIEW);
  });
});

describe('unionBox', () => {
  it('spans a sentence\'s lines', () => {
    expect(unionBox([{ x: 50, y: 10, w: 200, h: 20 }, { x: 10, y: 30, w: 80, h: 20 }])).toEqual({ x: 10, y: 10, w: 240, h: 40 });
    expect(unionBox([])).toBeNull();
  });
});

describe('chunkSentences', () => {
  /** `paras` paragraphs of `per` sentences in each of the sections given by their paragraph counts. */
  const book = (sections: number[], per: number) =>
    sections.flatMap((paras, sec) => Array.from({ length: paras * per }, (_, i) => ({ sec, para: Math.floor(i / per) })));

  it('the same text gives the same chunks, covering every sentence once, in order', () => {
    const sents = book([50, 3, 80], 4);
    const a = chunkSentences(sents);
    expect(chunkSentences(sents)).toEqual(a);
    expect(a[0]?.start).toBe(0);
    expect(a[a.length - 1]?.end).toBe(sents.length);
    for (let i = 1; i < a.length; i++) expect(a[i]?.start).toBe(a[i - 1]?.end);
  });

  it('ends a chunk at a paragraph past the soft limit, never past the hard one', () => {
    const sents = book([100], 7);
    const chunks = chunkSentences(sents);
    for (const c of chunks) expect(c.end - c.start).toBeLessThanOrEqual(CHUNK_HARD);
    for (const c of chunks.slice(1)) expect(sents[c.start]?.para).not.toBe(sents[c.start - 1]?.para);
    const long = chunkSentences(book([1], 500));
    expect(long.map((c) => c.end - c.start)).toEqual([CHUNK_HARD, CHUNK_HARD, 500 - 2 * CHUNK_HARD]);
  });

  it('a chapter starts a new chunk; small untitled sections (PDF pages) are grouped', () => {
    const pages = book([2, 2, 2, 2, 2, 2, 2, 2], 3);
    const grouped = chunkSentences(pages);
    expect(grouped.length).toBeLessThan(8);
    const chapters = chunkSentences(pages, (sec) => sec % 2 === 0);
    expect(chapters.map((c) => pages[c.start]?.sec)).toEqual([0, 2, 4, 6]);
  });

  it('finds the chunk of a sentence', () => {
    const chunks = [
      { start: 0, end: 10 },
      { start: 10, end: 25 },
      { start: 25, end: 30 },
    ];
    expect([0, 9, 10, 24, 25, 29, 99].map((s) => chunkIndexOf(chunks, s))).toEqual([0, 0, 1, 1, 2, 2, 2]);
    expect(chunkSentences([])).toEqual([]);
  });
});
