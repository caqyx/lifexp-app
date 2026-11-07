// The book's own table of contents (the reader, docs/v2/PLAN.md 9.1 row r-2): found
// in the text, marked, never dropped. A paragraph is part of it when
// - the file says so (EPUB nav / guide / landmarks, Para.toc), or its section is
//   titled "Spis treści", "Contents", "Inhalt", …;
// - it belongs to a run of entries: lines ending in a page number ("Rozdział 3.
//   Burza 45", "Wstęp ........ 5", roman page numbers too), or a paragraph made of
//   several such entries (a PDF page whose lines were joined), with a TOC title or
//   at least three entries; right after a TOC title, a plain chapter list
//   ("Rozdział I", "Część druga") counts too.
// The reader leaves the marked text out of reading and of the counts (readingView)
// and opens a new book after it (firstContentSentence). Pure.
import type { FlatBook, Para, Section } from './book';
import { normSpace } from './sentences';

/** Titles of a table of contents (pl, en, de, fr, es, it, cs, ru), compared without case and final punctuation. */
const TOC_TITLE =
  /^(spis treści|spis tresci|spis rzeczy|spis rozdziałów|treść|zawartość|contents|table of contents|toc|inhalt|inhaltsverzeichnis|sommaire|table des matières|índice|indice|sommario|obsah|содержание|оглавление)$/iu;

export function isTocTitle(text: string): boolean {
  return TOC_TITLE.test(normSpace(text).replace(/[\s.:]+$/u, ''));
}

/** A page number: arabic (1–4 digits) or roman (i … mmmm). */
const PAGE = String.raw`(?:\d{1,4}|[ivxlcdm]{1,7})`;
/** Dot (or other) leaders before a page number: "....... 12", ". . . . 7", "…… 3", "____ ix". */
const LEADER_ENTRY = new RegExp(String.raw`(?:(?:\.\s?){3,}|…{1,}\s?(?:\.\s?)*|·{3,}|_{3,})\s*${PAGE}(?![\p{L}\d])`, 'giu');
/** One leader entry closing the paragraph ("Wstęp ....... 5"). */
const LEADER_END = new RegExp(`${LEADER_ENTRY.source}$`, 'iu');
/** Ends with a page number after a space. */
const PAGE_END = new RegExp(String.raw`\s${PAGE}$`, 'iu');
/** Starts like an entry of a contents list: a chapter word, or a number / roman numeral and a dot. */
const ENTRY_START =
  /^(?:rozdział|rozdzial|chapter|część|czesc|part|księga|ksiega|book|kapitel|teil|section|sekcja|akt|act|scena|scene|prolog|prologue|epilog|epilogue|wstęp|wstep|introduction|przedmowa|preface|posłowie|poslowie|afterword|aneks|appendix|dodatek|bibliografia|bibliography|indeks|index|przypisy|notes|podziękowania|acknowledgements)(?![\p{L}])|^(?:\d{1,3}(?:\.\d{1,3})*|[ivxlc]{1,6})[.)]\s*\S/iu;
/** An entry inside a joined paragraph: a chapter word, a short title, then a page number. */
const INLINE_ENTRY =
  /(?:rozdział|rozdzial|chapter|część|czesc|part|księga|kapitel|section)\s+(?:\d{1,3}|[ivxlc]{1,6})[.:]?(?=\s)[^.!?]{0,80}?\s\d{1,4}(?=\s|$)/giu;

/** A chapter word and its number, nothing else. */
const CHAPTER_ONLY = /^(?:rozdział|rozdzial|chapter|część|czesc|part|księga|ksiega|book|kapitel|teil|section|sekcja|akt|act)\s+(?:\d{1,3}|[ivxlc]{1,6})[.:]?$/iu;

/** Longer than this, a paragraph is prose, not one entry. */
const ENTRY_MAX = 160;

type Kind = 'entries' | 'entry' | 'chapter' | 'title' | 'other';

function count(re: RegExp, text: string): number {
  re.lastIndex = 0;
  return [...text.matchAll(re)].length;
}

/** What one paragraph looks like, for the run detection. */
export function classifyPara(p: Para): Kind {
  const t = normSpace(p.t);
  if (!t) return 'other';
  if (isTocTitle(t)) return 'title';
  const leaders = count(LEADER_ENTRY, t);
  const inline = count(INLINE_ENTRY, t);
  const entries = Math.max(leaders, inline);
  // Several entries in one paragraph (three, or two with leaders), and the paragraph is
  // mostly entries (≤ 90 characters each): a list whose lines were joined.
  if ((entries >= 3 || leaders >= 2) && t.length / entries <= 90) return 'entries';
  if (t.length <= ENTRY_MAX) {
    if (LEADER_END.test(t)) return 'entry';
    // "Rozdział IV" alone is a chapter's name, not "Rozdział" on page iv.
    if (CHAPTER_ONLY.test(t)) return 'chapter';
    if (ENTRY_START.test(t) && PAGE_END.test(t)) return 'entry';
    if (ENTRY_START.test(t) && !/[.!?…]["”»)]*$/u.test(t)) return 'chapter';
  }
  return 'other';
}

/** Per section, per paragraph: true = part of the book's table of contents. */
export type TocMarks = boolean[][];

interface Ref {
  si: number;
  pi: number;
  kind: Kind;
}

/**
 * Marks the table(s) of contents. The marks only describe the text; nothing is
 * removed (readingView decides what reading skips).
 */
export function detectToc(sections: readonly Section[]): TocMarks {
  const marks: TocMarks = sections.map((s) => s.paras.map((p) => p.toc === 1));
  // A section titled like a table of contents is one, whole.
  sections.forEach((s, si) => {
    if (isTocTitle(s.title)) marks[si] = s.paras.map(() => true);
  });

  const all: Ref[] = [];
  sections.forEach((s, si) => s.paras.forEach((p, pi) => all.push({ si, pi, kind: classifyPara(p) })));
  const mark = (r: Ref) => {
    (marks[r.si] as boolean[])[r.pi] = true;
  };

  let i = 0;
  while (i < all.length) {
    const titled = (all[i] as Ref).kind === 'title';
    const start = titled ? i + 1 : i;
    // A run: entries (and, after a title, chapter lines), possibly across sections (PDF pages).
    let j = start;
    let strong = 0;
    let entriesInParas = 0;
    while (j < all.length) {
      const k = (all[j] as Ref).kind;
      if (k === 'entry') strong++;
      else if (k === 'entries') {
        strong++;
        entriesInParas++;
      } else if (k === 'chapter') {
        // A chapter line belongs to a list of chapter lines under a TOC title, or sits
        // between entries (a part's name above its chapters); one after the list is chapter 1.
        const next = all[j + 1]?.kind;
        if (!((titled && strong === 0) || next === 'entry' || next === 'entries')) break;
      } else break;
      j++;
    }
    const length = j - start;
    const isToc = titled ? length >= 2 || entriesInParas >= 1 : strong >= 3 || entriesInParas >= 1;
    if (isToc && length > 0) {
      for (let k = titled ? i : start; k < j; k++) mark(all[k] as Ref);
      i = j;
    } else {
      i = Math.max(i + 1, titled ? i + 1 : j);
    }
  }
  return marks;
}

export function hasToc(marks: TocMarks): boolean {
  return marks.some((s) => s.some(Boolean));
}

/** The book as reading sees it: sections without the marked paragraphs, and where each sentence comes from. */
export interface ReadingView {
  sections: Section[];
  /** Sentence of the view → sentence of the whole book (flatten of all sections), ascending. */
  toFull: number[];
  /** Sentences of the whole book. */
  fullTotal: number;
}

/**
 * The sections reading walks: with `skip`, the table of contents is left out (and a
 * section left empty disappears); without it, everything, in place.
 */
export function readingView(sections: readonly Section[], full: FlatBook, marks: TocMarks, skip: boolean): ReadingView {
  const fullTotal = full.sents.length;
  if (!skip || !hasToc(marks)) {
    return { sections: [...sections], toFull: full.sents.map((_, i) => i), fullTotal };
  }
  const out: Section[] = [];
  const toFull: number[] = [];
  full.sents.forEach((s, i) => {
    if (!marks[s.sec]?.[s.para]) toFull.push(i);
  });
  sections.forEach((sec, si) => {
    const paras = sec.paras.filter((_, pi) => !marks[si]?.[pi]);
    if (paras.length) out.push({ ...sec, paras });
  });
  return { sections: out, toFull, fullTotal };
}

/** The view's sentence at or after the book's sentence `full` (the last one past the end). */
export function fromFull(view: ReadingView, full: number): number {
  const list = view.toFull;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid] as number) < full) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, Math.max(0, list.length - 1));
}

/** The share of the book that is front matter: a contents list starting within it is the one before chapter 1. */
const FRONT = 0.3;

/**
 * Where a book opens the first time: after a table of contents near its start (the
 * first sentence of chapter 1), else at its beginning. Sentence of the whole book.
 */
export function firstContentSentence(full: FlatBook, marks: TocMarks): number {
  const limit = full.sents.length * FRONT;
  let lastToc = -1;
  for (let i = 0; i < full.sents.length; i++) {
    const s = full.sents[i] as FlatBook['sents'][number];
    const marked = marks[s.sec]?.[s.para] ?? false;
    if (marked) {
      if (lastToc < 0 && i > limit) break;
      lastToc = i;
    } else if (lastToc >= 0) {
      return i;
    }
  }
  return 0;
}

/** The marked paragraphs, in order, each run as one block (what "Spis treści książki" shows). */
export function tocBlocks(sections: readonly Section[], marks: TocMarks): Para[][] {
  const blocks: Para[][] = [];
  let open = false;
  sections.forEach((sec, si) =>
    sec.paras.forEach((p, pi) => {
      if (marks[si]?.[pi]) {
        if (!open) blocks.push([]);
        (blocks[blocks.length - 1] as Para[]).push(p);
        open = true;
      } else {
        open = false;
      }
    }),
  );
  return blocks;
}
