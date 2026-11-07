import { describe, expect, it } from 'vitest';
import { flatten, type Para, type Section } from './book';
import { classifyPara, detectToc, firstContentSentence, fromFull, hasToc, isTocTitle, readingView, tocBlocks } from './toc';

const p = (t: string, h: 0 | 1 = 0, toc?: 1): Para => (toc ? { t, h, toc } : { t, h });
const sec = (title: string, ...paras: Para[]): Section => ({ title, label: null, paras });
const page = (n: number, ...paras: string[]): Section => ({ title: '', label: { kind: 'page', n }, paras: paras.map((t) => p(t)) });

/** The marked paragraphs' texts. */
const marked = (sections: Section[]) => {
  const marks = detectToc(sections);
  return sections.flatMap((s, si) => s.paras.filter((_, pi) => marks[si]?.[pi]).map((x) => x.t));
};

const prose = (n: number) => `Zwykły akapit numer ${n}. Ma dwa zdania, a w środku liczbę 12 i jeszcze 1984 rok.`;

describe('isTocTitle', () => {
  it('knows the usual titles in several languages, any case, with a final colon or dot', () => {
    for (const t of ['Spis treści', 'SPIS TREŚCI:', 'Spis rzeczy', 'Contents', 'Table of Contents.', 'Inhaltsverzeichnis', 'Table des matières', 'Índice', 'Содержание'])
      expect(isTocTitle(t), t).toBe(true);
    for (const t of ['Spis treści i podziękowania za pomoc', 'Rozdział 1', 'Content strategy']) expect(isTocTitle(t), t).toBe(false);
  });
});

describe('classifyPara', () => {
  it('entries: dot leaders, page numbers after a chapter word, roman page numbers', () => {
    expect(classifyPara(p('Wstęp ........ 5'))).toBe('entry');
    expect(classifyPara(p('Przedmowa . . . . . xi'))).toBe('entry');
    expect(classifyPara(p('Rozdział 3. Burza 45'))).toBe('entry');
    expect(classifyPara(p('Chapter IV The Storm 112'))).toBe('entry');
    expect(classifyPara(p('12. Powrót do domu 231'))).toBe('entry');
    expect(classifyPara(p('Prologue …… 1'))).toBe('entry');
  });

  it('a joined list of entries (a PDF page) is one paragraph of entries', () => {
    expect(classifyPara(p('Spis treści Wstęp ....... 5 Rozdział 1. Dom ....... 9 Rozdział 2. Droga ....... 21'))).toBe('entries');
    expect(classifyPara(p('Rozdział 1. Początek 5 Rozdział 2. Dalej 12 Rozdział 3. Koniec 30'))).toBe('entries');
  });

  it('a chapter line without a page number; prose is not an entry', () => {
    expect(classifyPara(p('Rozdział I'))).toBe('chapter');
    expect(classifyPara(p('Część druga'))).toBe('chapter');
    expect(classifyPara(p(prose(1)))).toBe('other');
    expect(classifyPara(p('Czekał... 5 minut, potem poszedł.'))).toBe('other');
    expect(classifyPara(p('Chapter 3 shows 5 ways, and part 2 has 7 more.'))).toBe('other');
    expect(classifyPara(p('Rozdział 1', 1))).toBe('chapter');
  });
});

describe('detectToc', () => {
  it('a Polish TOC with dot leaders after its title, before chapter 1', () => {
    const book = [
      sec('', p('Tytuł książki'), p('Autor')),
      sec('', p('Spis treści'), p('Wstęp ........ 5'), p('Rozdział 1. Dom ........ 9'), p('Rozdział 2. Droga ........ 21')),
      sec('Rozdział 1', p('Rozdział 1', 1), p(prose(1)), p(prose(2))),
    ];
    expect(marked(book)).toEqual(['Spis treści', 'Wstęp ........ 5', 'Rozdział 1. Dom ........ 9', 'Rozdział 2. Droga ........ 21']);
  });

  it('an English contents list with roman numerals and no title: three entries are enough', () => {
    const book = [sec('', p('Preface vii'), p('Chapter I The Beginning 1'), p('Chapter II The Road 17'), p('Chapter III Home 33'), p(prose(1)))];
    expect(marked(book)).toEqual(['Preface vii', 'Chapter I The Beginning 1', 'Chapter II The Road 17', 'Chapter III Home 33']);
  });

  it('two stray entry-like lines in prose are not a TOC', () => {
    const book = [sec('', p(prose(1)), p('Rozdział 3. Burza 45'), p(prose(2)), p('Wstęp ........ 5'), p(prose(3)))];
    expect(marked(book)).toEqual([]);
  });

  it('a chapter list without page numbers counts only after a TOC title', () => {
    expect(marked([sec('', p('Spis treści', 1), p('Rozdział I'), p('Rozdział II'), p('Rozdział III'), p(prose(1)))])).toEqual([
      'Spis treści',
      'Rozdział I',
      'Rozdział II',
      'Rozdział III',
    ]);
    expect(marked([sec('', p('Rozdział I'), p('Rozdział II'), p('Rozdział III'), p(prose(1)))])).toEqual([]);
  });

  it('a section titled "Spis treści" (Markdown, EPUB) is a TOC whole', () => {
    const book = [sec('Spis treści', p('Spis treści', 1), p('Pierwszy'), p('Drugi')), sec('Pierwszy', p('Pierwszy', 1), p(prose(1)))];
    expect(marked(book)).toEqual(['Spis treści', 'Pierwszy', 'Drugi']);
  });

  it('PDF: TOC pages whose lines were joined, across a page break', () => {
    const book = [
      page(1, 'Tytuł. Autor.'),
      page(2, 'Spis treści Wstęp ....... 5 Rozdział 1. Dom ....... 9 Rozdział 2. Droga ....... 21'),
      page(3, 'Rozdział 3. Las ....... 40 Rozdział 4. Rzeka ....... 52 Zakończenie ....... 70'),
      page(4, prose(1)),
    ];
    expect(marked(book)).toEqual([
      'Spis treści Wstęp ....... 5 Rozdział 1. Dom ....... 9 Rozdział 2. Droga ....... 21',
      'Rozdział 3. Las ....... 40 Rozdział 4. Rzeka ....... 52 Zakończenie ....... 70',
    ]);
  });

  it('TXT: a TOC block of single lines joined into one paragraph', () => {
    expect(marked([sec('', p('Spis treści Rozdział 1. Początek 5 Rozdział 2. Dalej 12 Rozdział 3. Koniec 30'), p(prose(1)))])).toHaveLength(1);
  });

  it('EPUB: what the file marks (nav, guide) stays marked', () => {
    const book = [sec('', p('Okładka', 0, 1), p('Rozdział pierwszy', 0, 1)), sec('Rozdział pierwszy', p(prose(1)))];
    expect(marked(book)).toEqual(['Okładka', 'Rozdział pierwszy']);
  });

  it('a TOC at the end of the book is found too', () => {
    const book = [sec('', p(prose(1)), p(prose(2))), sec('Spis treści', p('Rozdział 1. Dom 9'), p('Rozdział 2. Droga 21'))];
    expect(marked(book)).toEqual(['Rozdział 1. Dom 9', 'Rozdział 2. Droga 21']);
  });

  it('a book without a TOC has no marks', () => {
    const marks = detectToc([sec('', p(prose(1)), p(prose(2)))]);
    expect(hasToc(marks)).toBe(false);
  });
});

describe('readingView / fromFull / firstContentSentence', () => {
  const book = [
    sec('', p('Tytuł.')),
    sec('', p('Spis treści'), p('Rozdział 1. Dom ........ 9'), p('Rozdział 2. Droga ........ 21'), p('Rozdział 3. Las ........ 30')),
    sec('Rozdział 1', p('Rozdział 1', 1), p('Raz. Dwa.'), p('Trzy.')),
  ];
  const full = flatten(book);
  const marks = detectToc(book);

  const firstOf = (sec: number) => full.sents.findIndex((s) => s.sec === sec);

  it('leaves the TOC out of reading and keeps where each sentence came from', () => {
    const view = readingView(book, full, marks, true);
    expect(flatten(view.sections).sents.map((s) => s.t)).toEqual(['Tytuł.', 'Rozdział 1', 'Raz.', 'Dwa.', 'Trzy.']);
    const c1 = firstOf(2);
    expect(view.toFull).toEqual([0, c1, c1 + 1, c1 + 2, c1 + 3]);
    expect(view.fullTotal).toBe(full.sents.length);
    expect(view.sections).toHaveLength(2);
  });

  it('without skipping, everything stays in place', () => {
    const view = readingView(book, full, marks, false);
    expect(view.toFull).toEqual(full.sents.map((_, i) => i));
    expect(view.sections).toHaveLength(3);
  });

  it('a position inside the TOC moves to the next readable sentence', () => {
    const view = readingView(book, full, marks, true);
    const c1 = firstOf(2);
    expect(fromFull(view, 0)).toBe(0);
    expect(fromFull(view, 2)).toBe(1);
    expect(fromFull(view, c1 + 2)).toBe(3);
    expect(fromFull(view, 999)).toBe(4);
  });

  it('a new book opens after a TOC near its start; a TOC at the end changes nothing', () => {
    expect(firstContentSentence(full, marks)).toBe(firstOf(2));
    const late = [sec('', p('Raz. Dwa. Trzy. Cztery. Pięć.')), sec('Spis treści', p('Rozdział 1. Dom 9'))];
    expect(firstContentSentence(flatten(late), detectToc(late))).toBe(0);
    expect(firstContentSentence(flatten([sec('', p('Raz.'))]), [[false]])).toBe(0);
  });

  it('tocBlocks lists the marked paragraphs by run', () => {
    expect(tocBlocks(book, marks).map((b) => b.map((x) => x.t))).toEqual([
      ['Spis treści', 'Rozdział 1. Dom ........ 9', 'Rozdział 2. Droga ........ 21', 'Rozdział 3. Las ........ 30'],
    ]);
  });
});
