// The landscape two-page spread (the reader, PLAN.md 9.1 row r-2): page geometry,
// which page and spread a sentence is on, and the zoom onto one sentence. The text
// itself is laid out into pages by the browser (CSS columns of exactly one page's
// width); these pure functions decide the sizes, so the same screen and text size
// always give the same pages, and turn positions into page numbers. Pure.

export interface SpreadLayout {
  /** One page (half the spread), in px. */
  pageW: number;
  pageH: number;
  /** Text margins: outer edge, inner edge (the gutter side), top, bottom (room for the page number). */
  padOuter: number;
  padInner: number;
  padTop: number;
  padBottom: number;
  /** One column = the text width of a page; gap = the distance from one page's text to the next one's. */
  colW: number;
  gap: number;
  /** Text height of a page. */
  colH: number;
}

/**
 * A spread of `width` × `height` px with text of `fontPx`: margins grow with the
 * text, every size is a whole pixel. The distance between the left page's text and
 * the right page's text equals the distance between two columns, so column 2k is
 * always on the left page of spread k.
 */
export function spreadLayout(width: number, height: number, fontPx: number): SpreadLayout {
  const pageW = Math.floor(Math.max(0, width) / 2);
  const pageH = Math.floor(Math.max(0, height));
  const padOuter = Math.round(Math.min(32, Math.max(14, fontPx * 1.1)));
  const padInner = Math.round(Math.min(40, Math.max(18, fontPx * 1.5)));
  const padTop = Math.round(Math.min(28, Math.max(12, fontPx * 0.9)));
  const padBottom = Math.round(Math.min(40, Math.max(26, fontPx * 1.7)));
  const colW = Math.max(40, pageW - padOuter - padInner);
  const colH = Math.max(40, pageH - padTop - padBottom);
  return { pageW, pageH, padOuter, padInner, padTop, padBottom, colW, gap: 2 * padInner, colH };
}

/** The page (0-based, counted over the book) a point `x` px from the first column's start lies on. */
export function pageOfX(x: number, layout: Pick<SpreadLayout, 'colW' | 'gap'>): number {
  return Math.max(0, Math.floor((x + layout.gap / 2) / (layout.colW + layout.gap)));
}

export const spreadOfPage = (page: number) => Math.floor(page / 2);

/** How far the columns move left to show spread `k`. */
export function spreadShift(k: number, layout: Pick<SpreadLayout, 'colW' | 'gap'>): number {
  return k * 2 * (layout.colW + layout.gap);
}

/** Pages a text of `scrollWidth` px of columns fills. */
export function pageCount(scrollWidth: number, layout: Pick<SpreadLayout, 'colW' | 'gap'>): number {
  return Math.max(1, Math.round((scrollWidth + layout.gap) / (layout.colW + layout.gap)));
}

/**
 * The first sentence that starts on spread `k` or later, given each sentence's spread
 * (non-decreasing); `total` if none does. Binary search: few layout reads.
 */
export function firstSentenceFrom(k: number, total: number, spreadOf: (s: number) => number): number {
  let lo = 0;
  let hi = total;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (spreadOf(mid) < k) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Where reading stands when spread `k` is shown whole: its first sentence, or the
 * sentence that runs onto it from before when none starts on it.
 */
export function sentenceOfSpread(k: number, total: number, spreadOf: (s: number) => number): number {
  if (total <= 0) return 0;
  const first = firstSentenceFrom(k, total, spreadOf);
  if (first < total && spreadOf(first) === k) return first;
  return Math.max(0, first - 1);
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The camera: scale, then move by (x, y) — `translate(x, y) scale(scale)` with origin at the top left. */
export interface Camera {
  scale: number;
  x: number;
  y: number;
}

export const OVERVIEW: Camera = { scale: 1, x: 0, y: 0 };

/** The zoom never goes past this (a short sentence would otherwise fill the screen). */
export const MAX_ZOOM = 2.2;

/**
 * The camera that shows `box` (a sentence, in spread px) as large as fits in a
 * `view` of the spread's size with `margin` px around it, at most MAX_ZOOM, never
 * below 1, and never showing anything outside the spread.
 */
export function zoomTo(box: Box, view: { w: number; h: number }, margin = 24): Camera {
  if (view.w <= 0 || view.h <= 0) return OVERVIEW;
  const fit = Math.min((view.w - 2 * margin) / Math.max(1, box.w), (view.h - 2 * margin) / Math.max(1, box.h));
  const scale = Math.min(MAX_ZOOM, Math.max(1, fit));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const clampMove = (v: number, size: number) => Math.min(0, Math.max(size - size * scale, v));
  const x = clampMove(view.w / 2 - cx * scale, view.w);
  const y = clampMove(view.h / 2 - cy * scale, view.h);
  return { scale: round(scale), x: round(x), y: round(y) };
}

const round = (v: number) => Math.round(v * 100) / 100;

/** The smallest box around several (a sentence's line boxes). */
export function unionBox(boxes: readonly Box[]): Box | null {
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
