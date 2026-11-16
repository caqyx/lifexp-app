// Oryginał (row r-6): where the reader's sentences are on the real PDF pages. The
// page's text items are joined into one "compact" string (letters only: no spaces,
// hyphens or soft hyphens, lower case, ligatures split), the sentences likewise, and
// each sentence is found in page order after the one before it. A found range maps
// back to characters of text items, and those to boxes on the page (in PDF units,
// y up), so the view can light a sentence or one of its words on the page itself.
import type { PdfTextItem } from './parse-pdf';

export interface CharRef {
  /** PDF page number (1-based), item index on that page and character in the item. */
  page: number;
  item: number;
  ch: number;
}

export interface CompactText {
  text: string;
  refs: CharRef[];
}

export interface PdfBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Characters left out of the compact text: they differ between the page and the parsed text. */
const SKIP = /[\s\-­‐‑]/u;

function compactChars(c: string): string {
  if (SKIP.test(c)) return '';
  return c.normalize('NFKC').toLowerCase().replace(/\s/gu, '');
}

/** The compact text of pages (in order), each character pointing back to its item. */
export function compactPages(pages: readonly { page: number; items: readonly PdfTextItem[] }[]): CompactText {
  let text = '';
  const refs: CharRef[] = [];
  for (const { page, items } of pages) {
    items.forEach((it, item) => {
      for (let ch = 0; ch < it.str.length; ch++) {
        const c = compactChars(it.str[ch] as string);
        for (const part of c) {
          text += part;
          refs.push({ page, item, ch });
        }
      }
    });
  }
  return { text, refs };
}

/** A sentence's compact text, and for each of its characters the compact index it starts at. */
export function compactSentence(sentence: string): { text: string; at: number[] } {
  let text = '';
  const at: number[] = [];
  for (const c of sentence) {
    for (let k = 0; k < c.length; k++) at.push(text.length);
    text += compactChars(c);
  }
  at.push(text.length);
  return { text, at };
}

/** How much of a sentence's start must match when the whole of it does not (at most; half of a short one). */
const PREFIX = 12;

/**
 * The compact range of each sentence in `stream`, searched in order from `from` (the
 * end of the sentence before). A sentence not found whole is found by its start, then
 * takes its own length; one not found at all has no range (no light, the view still
 * shows its page).
 */
export function matchSentences(stream: string, sentences: readonly { i: number; t: string }[], from = 0): Map<number, { from: number; to: number }> {
  const out = new Map<number, { from: number; to: number }>();
  let cursor = from;
  for (const { i, t } of sentences) {
    const s = compactSentence(t).text;
    if (!s) continue;
    let at = stream.indexOf(s, cursor);
    const head = Math.min(PREFIX, Math.ceil(s.length / 2));
    if (at < 0 && head >= 4) at = stream.indexOf(s.slice(0, head), cursor);
    if (at < 0) continue;
    const to = Math.min(stream.length, at + s.length);
    out.set(i, { from: at, to });
    cursor = to;
  }
  return out;
}

/** The compact range of word `[start, end)` (character offsets in the sentence) inside the sentence's range. */
export function wordRange(sentence: string, range: { from: number; to: number }, start: number, end: number): { from: number; to: number } {
  const { at } = compactSentence(sentence);
  const a = range.from + (at[start] ?? 0);
  const b = range.from + (at[end] ?? at[at.length - 1] ?? 0);
  return { from: Math.min(a, range.to), to: Math.min(Math.max(b, a + 1), range.to) };
}

/**
 * Boxes (PDF units, y up) of compact range `[from, to)`, one per run of characters in
 * one text item; a character's place in its item is proportional to its index (the
 * item's width spread evenly, close enough to light a word).
 */
export function boxesOf(
  refs: readonly CharRef[],
  from: number,
  to: number,
  itemsOf: (page: number) => readonly PdfTextItem[] | undefined,
): Map<number, PdfBox[]> {
  const out = new Map<number, PdfBox[]>();
  let k = from;
  while (k < to) {
    const r = refs[k];
    if (!r) break;
    let end = k;
    while (end + 1 < to && refs[end + 1]?.page === r.page && refs[end + 1]?.item === r.item) end++;
    const last = refs[end] as CharRef;
    const it = itemsOf(r.page)?.[r.item];
    if (it) {
      const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = it.transform;
      const size = Math.hypot(c, d) || it.height || 10;
      const width = it.width ?? Math.hypot(a, b) * it.str.length * 0.5;
      const per = width / Math.max(1, it.str.length);
      const box = { x: e + r.ch * per, y: f - size * 0.22, w: (last.ch - r.ch + 1) * per, h: size * 1.18 };
      const list = out.get(r.page) ?? [];
      list.push(box);
      out.set(r.page, list);
    }
    k = end + 1;
  }
  return out;
}

/** The smallest box around `boxes`. */
export function unionBox(boxes: readonly PdfBox[]): PdfBox | null {
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The PDF page each sentence starts on (its section is the page; `fallback` for a section without one). */
export function sentencePages(sents: readonly { sec: number }[], pageOfSection: (sec: number) => number | null): number[] {
  let lastPage = 1;
  return sents.map((s) => {
    const p = pageOfSection(s.sec);
    if (p !== null) lastPage = p;
    return lastPage;
  });
}

/** First sentence on page `page` or after it (the last sentence past the end). */
export function firstSentenceFrom(pages: readonly number[], page: number): number {
  let lo = 0;
  let hi = pages.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((pages[mid] ?? 0) < page) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, Math.max(0, pages.length - 1));
}

/** The two pages of the spread holding `page`: 1–2, 3–4, … */
export function spreadOf(page: number): [number, number] {
  const left = page % 2 === 1 ? page : page - 1;
  return [left, left + 1];
}
