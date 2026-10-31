import { describe, expect, it } from 'vitest';
import {
  baseName,
  buildGroups,
  chunkSections,
  flatten,
  formatOf,
  groupIndexOf,
  isPlainSection,
  percentRead,
  sortLibrary,
  type BookMeta,
  type Section,
} from './book';

const sec = (title: string, ...paras: [string, 0 | 1][]): Section => ({
  title,
  label: null,
  paras: paras.map(([t, h]) => ({ t, h })),
});

const book: Section[] = [
  sec('Rozdział pierwszy', ['Rozdział pierwszy', 1], ['Jedno. Dwa. Trzy.', 0], ['Cztery.', 0]),
  sec('Drugi', ['Pięć. Sześć.', 0]),
];

describe('flatten', () => {
  it('lists sentences with their section and paragraph; headings stay whole', () => {
    const { sents, secStart } = flatten(book);
    expect(sents.map((s) => s.t)).toEqual(['Rozdział pierwszy', 'Jedno.', 'Dwa.', 'Trzy.', 'Cztery.', 'Pięć.', 'Sześć.']);
    expect(sents[0]).toEqual({ t: 'Rozdział pierwszy', sec: 0, para: 0, h: true });
    expect(sents[4]).toEqual({ t: 'Cztery.', sec: 0, para: 2, h: false });
    expect(secStart).toEqual([0, 5]);
  });

  it('a section without text starts where the next one does', () => {
    expect(flatten([sec('A', ['Raz.', 0]), sec('Pusty'), sec('B', ['Dwa.', 0])]).secStart).toEqual([0, 1, 1]);
  });
});

describe('buildGroups', () => {
  const { sents } = flatten(book);

  it('one sentence per screen', () => {
    expect(buildGroups(sents, 1)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('two per screen, never across a heading, a paragraph or a section', () => {
    // heading | Jedno. Dwa. | Trzy. | Cztery. | Pięć. Sześć.
    expect(buildGroups(sents, 2)).toEqual([0, 1, 3, 4, 5]);
  });

  it('nothing for an empty book', () => {
    expect(buildGroups([], 2)).toEqual([]);
  });
});

describe('groupIndexOf', () => {
  const groups = [0, 1, 3, 4, 5];
  it('finds the group holding a sentence', () => {
    expect(groupIndexOf(groups, 0)).toBe(0);
    expect(groupIndexOf(groups, 2)).toBe(1);
    expect(groupIndexOf(groups, 3)).toBe(2);
    expect(groupIndexOf(groups, 6)).toBe(4);
    expect(groupIndexOf(groups, 99)).toBe(4);
  });
  it('the first group for anything before it', () => {
    expect(groupIndexOf(groups, -3)).toBe(0);
    expect(groupIndexOf([0], 10)).toBe(0);
  });
});

describe('chunkSections', () => {
  it('cuts paragraphs into numbered parts', () => {
    const paras = Array.from({ length: 85 }, (_, i) => ({ t: `P${i}.`, h: 0 as const }));
    const parts = chunkSections(paras);
    expect(parts.map((p) => [p.label, p.paras.length])).toEqual([
      [{ kind: 'part', n: 1 }, 40],
      [{ kind: 'part', n: 2 }, 40],
      [{ kind: 'part', n: 3 }, 5],
    ]);
    expect(parts.every(isPlainSection)).toBe(true);
  });
});

describe('isPlainSection', () => {
  it('pages and parts are plain; chapters, the start and real titles are not', () => {
    expect(isPlainSection({ title: '', label: { kind: 'page', n: 2 }, paras: [] })).toBe(true);
    expect(isPlainSection({ title: '', label: { kind: 'chapter', n: 2 }, paras: [] })).toBe(false);
    expect(isPlainSection({ title: '', label: { kind: 'start', n: 1 }, paras: [] })).toBe(false);
    expect(isPlainSection(sec('Prolog'))).toBe(false);
  });
});

describe('formatOf / baseName', () => {
  it('reads the extension, any case', () => {
    expect(formatOf('a.PDF')).toBe('PDF');
    expect(formatOf('a.epub')).toBe('EPUB');
    expect(formatOf('a.markdown')).toBe('MD');
    expect(formatOf('a.md')).toBe('MD');
    expect(formatOf('a.text')).toBe('TXT');
    expect(formatOf('a.docx')).toBeNull();
    expect(formatOf('bez')).toBeNull();
  });
  it('drops only the last extension', () => {
    expect(baseName('Pan.Tadeusz.txt')).toBe('Pan.Tadeusz');
  });
});

describe('percentRead', () => {
  it('the last sentence is 100%', () => {
    expect(percentRead(0, 11)).toBe(0);
    expect(percentRead(5, 11)).toBe(50);
    expect(percentRead(10, 11)).toBe(100);
    expect(percentRead(3, 1)).toBe(0);
    expect(percentRead(2, 4)).toBe(66);
  });
});

describe('sortLibrary', () => {
  const meta = (id: string, added: number, opened: number): BookMeta => ({ id, title: id, format: 'TXT', added, opened, pos: 0, total: 1 });
  it('last opened first; a book never opened counts from when it was added', () => {
    expect(sortLibrary([meta('a', 1, 0), meta('b', 2, 10), meta('c', 5, 0)]).map((m) => m.id)).toEqual(['b', 'c', 'a']);
  });
});
