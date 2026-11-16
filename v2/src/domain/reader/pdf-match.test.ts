import { describe, expect, it } from 'vitest';
import type { PdfTextItem } from './parse-pdf';
import { boxesOf, compactPages, compactSentence, firstSentenceFrom, matchSentences, sentencePages, spreadOf, unionBox, wordRange } from './pdf-match';

const item = (str: string, x: number, y: number, w = str.length * 6, h = 10): PdfTextItem => ({ str, transform: [h, 0, 0, h, x, y], width: w, height: h });

const page1 = [item('Ala ma ko-', 72, 700), item('ta. Kot ma', 72, 686), item('Imię', 300, 600), item('Alę.', 72, 672)];
const page2 = [item('Zdanie z dwóch', 72, 700), item('stron.', 72, 686)];

describe('compact text', () => {
  it('drops spaces, hyphens and case; ligatures split', () => {
    expect(compactPages([{ page: 1, items: [item('Ko- ta ﬁ', 0, 0)] }]).text).toBe('kotafi');
    expect(compactSentence('Kota fi.').text).toBe('kotafi.');
  });
  it('every compact character points back to its item and character', () => {
    const c = compactPages([{ page: 3, items: [item('a b', 0, 0), item('c', 0, 0)] }]);
    expect(c.refs).toEqual([
      { page: 3, item: 0, ch: 0 },
      { page: 3, item: 0, ch: 2 },
      { page: 3, item: 1, ch: 0 },
    ]);
  });
});

describe('matchSentences', () => {
  const stream = compactPages([
    { page: 1, items: page1 },
    { page: 2, items: page2 },
  ]);
  it('finds sentences in order across line breaks, a hyphenated word and text that is not a sentence (a table cell)', () => {
    const m = matchSentences(stream.text, [
      { i: 0, t: 'Ala ma kota.' },
      { i: 1, t: 'Kot ma Alę.' },
      { i: 2, t: 'Zdanie z dwóch stron.' },
    ]);
    const text = (i: number) => {
      const r = m.get(i);
      return r ? stream.text.slice(r.from, r.to) : null;
    };
    expect(text(0)).toBe('alamakota.');
    // "Imię" from the table sits between "Kot ma" and "Alę.": the start is enough.
    expect(m.get(1)?.from).toBe(stream.text.indexOf('kotma'));
    expect(text(2)).toBe('zdaniezdwóchstron.');
  });
  it('the same sentence twice: each finds its own place', () => {
    const s = compactPages([{ page: 1, items: [item('Tak. Nie. Tak.', 0, 0)] }]);
    const m = matchSentences(s.text, [
      { i: 0, t: 'Tak.' },
      { i: 1, t: 'Nie.' },
      { i: 2, t: 'Tak.' },
    ]);
    expect([m.get(0)?.from, m.get(2)?.from]).toEqual([0, 8]);
  });
  it('a sentence not on the page has no range and does not move the search', () => {
    const s = compactPages([{ page: 1, items: [item('Jeden. Dwa.', 0, 0)] }]);
    const m = matchSentences(s.text, [
      { i: 0, t: 'Czegoś tu nie ma wcale.' },
      { i: 1, t: 'Jeden.' },
    ]);
    expect(m.has(0)).toBe(false);
    expect(m.get(1)).toEqual({ from: 0, to: 6 });
  });
});

describe('boxes on the page', () => {
  const stream = compactPages([
    { page: 1, items: page1 },
    { page: 2, items: page2 },
  ]);
  const items = (p: number) => (p === 1 ? page1 : p === 2 ? page2 : undefined);
  it('one box per run in an item, on the page it is on', () => {
    const m = matchSentences(stream.text, [{ i: 0, t: 'Ala ma kota.' }]);
    const r = m.get(0) as { from: number; to: number };
    const boxes = boxesOf(stream.refs, r.from, r.to, items);
    expect([...boxes.keys()]).toEqual([1]);
    const list = boxes.get(1) ?? [];
    expect(list).toHaveLength(2);
    // "Ala ma ko" from the first line, "ta." from the start of the second.
    expect(list[0]?.x).toBe(72);
    expect(list[0]?.w).toBeCloseTo(9 * 6, 5);
    expect(list[1]).toMatchObject({ x: 72, w: 3 * 6 });
    expect(list[1]?.y).toBeLessThan(686);
  });
  it('a sentence across a page break has boxes on both pages; a word lights only itself', () => {
    const s = compactPages([
      { page: 1, items: [item('Koniec strony i', 72, 100)] },
      { page: 2, items: [item('dalej tutaj.', 72, 700)] },
    ]);
    const its = (p: number) => (p === 1 ? [item('Koniec strony i', 72, 100)] : [item('dalej tutaj.', 72, 700)]);
    const t = 'Koniec strony i dalej tutaj.';
    const r = matchSentences(s.text, [{ i: 5, t }]).get(5) as { from: number; to: number };
    expect([...boxesOf(s.refs, r.from, r.to, its).keys()]).toEqual([1, 2]);
    const w = wordRange(t, r, 16, 21);
    expect(s.text.slice(w.from, w.to)).toBe('dalej');
    expect([...boxesOf(s.refs, w.from, w.to, its).keys()]).toEqual([2]);
  });
  it('the union of boxes', () => {
    expect(unionBox([{ x: 1, y: 1, w: 2, h: 2 }, { x: 5, y: 0, w: 1, h: 1 }])).toEqual({ x: 1, y: 0, w: 5, h: 3 });
    expect(unionBox([])).toBeNull();
  });
});

describe('pages and sentences', () => {
  it('each sentence is on its section page; the first sentence from a page on', () => {
    const pages = sentencePages([{ sec: 0 }, { sec: 0 }, { sec: 1 }, { sec: 2 }], (sec) => [1, 3, null][sec] ?? null);
    expect(pages).toEqual([1, 1, 3, 3]);
    expect(firstSentenceFrom(pages, 2)).toBe(2);
    expect(firstSentenceFrom(pages, 1)).toBe(0);
    expect(firstSentenceFrom(pages, 9)).toBe(3);
  });
  it('spreads pair pages 1–2, 3–4', () => {
    expect(spreadOf(1)).toEqual([1, 2]);
    expect(spreadOf(4)).toEqual([3, 4]);
  });
});
