// A book in the reader (docs/v2/PLAN.md 9.1 row "r"): sections of paragraphs, kept
// on the device only (offline/readerLibrary). Reading walks a flat list of
// sentences; Easy mode shows them in groups of one or two, never across a
// paragraph or a heading. Pure.
import { splitSentences } from './sentences';

export type BookFormat = 'PDF' | 'EPUB' | 'TXT' | 'MD';

/** One paragraph; h = it is a heading (shown whole, never split into sentences). */
export interface Para {
  t: string;
  h: 0 | 1;
  /** The file itself says this is its table of contents (an EPUB nav or guide/landmarks "toc"). */
  toc?: 1;
}

/**
 * A title the parser made up, shown in the reader's language: "Część 3" for a
 * chunk of a plain text, "Strona 3" for a PDF page, "Rozdział 3" for an EPUB file
 * without a heading, "Początek" for the text before a Markdown file's first heading.
 */
export interface SectionLabel {
  kind: 'part' | 'page' | 'chapter' | 'start';
  n: number;
}

export interface Section {
  /** The book's own title of the section; '' when the parser made one up (label). */
  title: string;
  label: SectionLabel | null;
  paras: Para[];
}

export interface ParsedBook {
  title: string;
  format: BookFormat;
  sections: Section[];
}

/** What the library lists: small, read on every visit. */
export interface BookMeta {
  id: string;
  title: string;
  format: BookFormat;
  /** ms since epoch. */
  added: number;
  /** Last time it was read (ms); 0 = never opened. */
  opened: number;
  /** Index of the sentence reading stopped at. */
  pos: number;
  /** Sentences in the book. */
  total: number;
  /**
   * Where reading is and how many sentences there are without the book's own table of
   * contents (domain/reader/toc), as the library shows them; absent = pos / total.
   */
  progress?: { pos: number; total: number };
}

/** The text itself, stored apart from the meta (it can be megabytes). */
export interface BookContent {
  id: string;
  sections: Section[];
}

export interface Sentence {
  t: string;
  /** Index of its section and of its paragraph in that section. */
  sec: number;
  para: number;
  h: boolean;
}

export interface FlatBook {
  sents: Sentence[];
  /** Index of each section's first sentence (a section without text starts where the next one does). */
  secStart: number[];
}

export function flatten(sections: readonly Section[]): FlatBook {
  const sents: Sentence[] = [];
  const secStart: number[] = [];
  sections.forEach((sec, si) => {
    secStart.push(sents.length);
    sec.paras.forEach((p, pi) => {
      const list = p.h ? [p.t] : splitSentences(p.t);
      for (const t of list) sents.push({ t, sec: si, para: pi, h: !!p.h });
    });
  });
  return { sents, secStart };
}

/**
 * The first sentence of each Easy-mode screen, `per` sentences at most: a new
 * group starts at every new paragraph or section and at every heading.
 */
export function buildGroups(sents: readonly Sentence[], per: number): number[] {
  const groups: number[] = [];
  let cnt = 0;
  for (let i = 0; i < sents.length; i++) {
    const s = sents[i] as Sentence;
    const p = sents[i - 1];
    if (!p || p.sec !== s.sec || p.para !== s.para || s.h || p.h || cnt >= per) {
      groups.push(i);
      cnt = 0;
    }
    cnt++;
  }
  return groups;
}

/** The group holding sentence `sentIdx` (binary search over the sorted group starts). */
export function groupIndexOf(groups: readonly number[], sentIdx: number): number {
  let lo = 0;
  let hi = groups.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((groups[mid] as number) <= sentIdx) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The last index in sorted `starts` whose value is ≤ x (0 when none is). */
export function lastAtOrBefore(starts: readonly number[], x: number): number {
  return groupIndexOf(starts, x);
}

/** Paragraphs of a text without headings, in sections of `size` ("Część 1", "Część 2", …). */
export function chunkSections(paras: readonly Para[], size = 40): Section[] {
  const out: Section[] = [];
  for (let i = 0; i < paras.length; i += size) {
    out.push({ title: '', label: { kind: 'part', n: out.length + 1 }, paras: paras.slice(i, i + size) });
  }
  return out;
}

/** "Książka.v2.pdf" → "Książka.v2". */
export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/** The format by the file's extension; null = not one the reader opens. */
export function formatOf(fileName: string): BookFormat | null {
  const ext = (fileName.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
  if (ext === 'pdf') return 'PDF';
  if (ext === 'epub') return 'EPUB';
  if (ext === 'md' || ext === 'markdown') return 'MD';
  if (ext === 'txt' || ext === 'text') return 'TXT';
  return null;
}

/** The extension as typed, for the "unsupported format" message. */
export function extensionOf(fileName: string): string {
  return (fileName.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
}

/** A made-up title that is not worth a heading or the crumb ("Strona 3", "Część 2"). */
export function isPlainSection(sec: Section): boolean {
  return sec.title === '' && (sec.label?.kind === 'part' || sec.label?.kind === 'page');
}

/** Whole percent read when at sentence `pos` of `total` (the last sentence = 100%). */
export function percentRead(pos: number, total: number): number {
  if (total <= 1) return 0;
  return Math.floor((Math.min(Math.max(pos, 0), total - 1) / (total - 1)) * 100);
}

/** The library: last opened first, a book never opened by when it was added. */
export function sortLibrary(list: readonly BookMeta[]): BookMeta[] {
  return [...list].sort((a, b) => (b.opened || b.added) - (a.opened || a.added));
}

/** Sections without paragraphs dropped (the parsers' last step before saving). */
export function withText(sections: readonly Section[]): Section[] {
  return sections.filter((s) => s.paras.length > 0);
}
