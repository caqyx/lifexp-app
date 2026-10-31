// PDF text layout to paragraphs (the reader). pdf.js gives positioned pieces of
// text; these become lines (same baseline), lines become paragraphs (a gap wider
// than usual, or a short line ending a sentence), hyphenated words are joined
// across lines, page numbers dropped, and a sentence that runs onto the next page
// goes back to the page it started on. Pure: services/reader-pdf feeds it pdf.js output.
import type { Para, Section } from './book';
import { normSpace } from './sentences';

/** The parts of a pdf.js TextItem this needs (transform[4] = x, transform[5] = y). */
export interface PdfTextItem {
  str: string;
  transform: readonly number[];
  width?: number;
  height?: number;
}

export interface PdfLine {
  y: number;
  x: number;
  end: number;
  h: number;
  text: string;
}

/** A line that is only a page number ("12", "- 12 -", "– 7"). */
const PAGE_NUMBER = /^[-–—]?\s*\d{1,4}\s*[-–—]?$/;

/** Text pieces in reading order → lines; empty lines and page numbers dropped. */
export function itemsToLines(items: readonly (PdfTextItem | object)[]): PdfLine[] {
  const lines: PdfLine[] = [];
  let line: PdfLine | null = null;
  let lastEnd = 0;
  for (const raw of items) {
    if (!('str' in raw)) continue;
    const it = raw as PdfTextItem;
    const x = it.transform[4] ?? 0;
    const y = it.transform[5] ?? 0;
    const ht = it.height || Math.abs(it.transform[3] ?? 0) || 10;
    if (!line || Math.abs(y - line.y) > ht * 0.5) {
      if (line) lines.push(line);
      line = { y, x, end: x, h: ht, text: '' };
      lastEnd = x;
    }
    if (line.text && !line.text.endsWith(' ') && !it.str.startsWith(' ') && x - lastEnd > ht * 0.15) line.text += ' ';
    line.text += it.str;
    lastEnd = x + (it.width || 0);
    line.end = Math.max(line.end, lastEnd);
  }
  if (line) lines.push(line);
  return lines.map((l) => ({ ...l, text: normSpace(l.text) })).filter((l) => l.text && !PAGE_NUMBER.test(l.text));
}

/** Ends like a sentence (or a lead-in with a colon), closing marks allowed. */
const ENDS_SENTENCE = /[.!?:…]["”»)]*$/;

/** One page's lines → paragraphs. */
export function linesToParagraphs(lines: readonly PdfLine[]): string[] {
  if (!lines.length) return [];
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const g = (lines[i - 1] as PdfLine).y - (lines[i] as PdfLine).y;
    if (g > 0) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const typical = gaps.length ? (gaps[Math.floor(gaps.length / 2)] as number) : 14;
  const maxW = Math.max(...lines.map((l) => l.end - l.x));
  const paras: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    let t = '';
    for (const ln of buf) {
      // "przy-" + "kład" → "przykład"; "Polsko-" + "Litwa" stays hyphenated.
      if (t && /\p{L}-$/u.test(t) && /^\p{Ll}/u.test(ln)) t = t.slice(0, -1) + ln;
      else t = t ? `${t} ${ln}` : ln;
    }
    paras.push(normSpace(t));
    buf = [];
  };
  lines.forEach((l, i) => {
    if (i > 0) {
      const p = lines[i - 1] as PdfLine;
      const gap = p.y - l.y;
      const shortEnd = p.end - p.x < maxW * 0.55 && ENDS_SENTENCE.test(p.text);
      if (gap > typical * 1.55 || shortEnd) flush();
    }
    buf.push(l.text);
  });
  flush();
  return paras;
}

const ENDS_PARAGRAPH = /[.!?…:]["”»)]*$/;

/**
 * A page's last paragraph that does not end a sentence, followed by a page that
 * starts in lower case, is one paragraph cut by the page break: the start of the
 * next page joins it. Changes `pages` in place and returns it.
 */
export function mergeAcrossPages(pages: string[][]): string[][] {
  for (let i = 1; i < pages.length; i++) {
    const prev = pages[i - 1] as string[];
    const cur = pages[i] as string[];
    const last = prev[prev.length - 1];
    const first = cur[0];
    if (last !== undefined && first !== undefined && !ENDS_PARAGRAPH.test(last) && /^\p{Ll}/u.test(first)) {
      prev[prev.length - 1] = `${last} ${first}`;
      cur.shift();
    }
  }
  return pages;
}

/** Fewer characters than this in the whole file: a scan without a text layer. */
export const MIN_PDF_CHARS = 40;

export function looksScanned(pages: readonly (readonly string[])[]): boolean {
  return pages.reduce((n, paras) => n + paras.reduce((m, s) => m + s.length, 0), 0) < MIN_PDF_CHARS;
}

/** The pages as sections ("Strona N"), empty pages left out. */
export function pdfSections(pages: readonly (readonly string[])[]): Section[] {
  return pages
    .map((paras, i) => ({ title: '', label: { kind: 'page' as const, n: i + 1 }, paras: paras.map((t): Para => ({ t, h: 0 })) }))
    .filter((s) => s.paras.length);
}
