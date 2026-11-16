// What is on a PDF page besides running text (the reader, PLAN.md 9.1 row r-5): from the
// positioned text pdf.js gives, the pictures it paints and the lines and boxes it draws,
// this finds
// - tables: a grid of ruled lines (or a block of column-aligned runs of text), rebuilt
//   as rows and cells; a grid it cannot read reliably becomes a picture of its region;
// - pictures: painted images, vector drawings (charts, diagrams) and formula lines, as
//   regions of the page to render into an image;
// - frames ("ramki"): boxes around text (a sidebar, a note), kept as text in a frame;
// and puts them in reading order with the paragraphs around them (top to bottom).
// Everything is in PDF page units, y growing upwards. Pure: services/reader-pdf feeds it.
import type { TableCell } from './book';
import { itemsToLines, linesToParagraphs, type PdfLine, type PdfTextItem } from './parse-pdf';
import { normSpace } from './sentences';

/** A rectangle: x, y = its lower left corner (PDF space), w, h its size. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** One painted path: its line segments (curves as their chords), its box, how it was painted. */
export interface PdfPath {
  segs: Seg[];
  box: Rect;
  stroke: boolean;
  fill: boolean;
  /** It has curves (a drawing, not a rule). */
  curves: boolean;
  /** It is one rectangle (re operator, or four segments closing a box). */
  rect: boolean;
}

export interface PdfPageInput {
  width: number;
  height: number;
  items: PdfTextItem[];
  images: Rect[];
  paths: PdfPath[];
}

export type RegionReason = 'image' | 'drawing' | 'table' | 'formula';

export type PageBlock =
  | { kind: 'text'; paras: string[] }
  | { kind: 'frame'; paras: string[] }
  | { kind: 'table'; rows: TableCell[][]; header: boolean; box: Rect }
  | { kind: 'region'; box: Rect; reason: RegionReason };

const top = (r: Rect) => r.y + r.h;
const right = (r: Rect) => r.x + r.w;

export function rectOf(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

export function union(a: Rect, b: Rect): Rect {
  return rectOf(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(right(a), right(b)), Math.max(top(a), top(b)));
}

function grow(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < right(b) && b.x < right(a) && a.y < top(b) && b.y < top(a);
}

function contains(outer: Rect, x: number, y: number): boolean {
  return x >= outer.x && x <= right(outer) && y >= outer.y && y <= top(outer);
}

/** A text item's box (baseline y; height from the item). */
export function itemBox(it: PdfTextItem): Rect {
  const x = it.transform[4] ?? 0;
  const y = it.transform[5] ?? 0;
  const h = it.height || Math.abs(it.transform[3] ?? 0) || 10;
  return { x, y: y - h * 0.2, w: it.width || it.str.length * h * 0.5, h: h * 1.1 };
}

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// ── Rules (the lines tables are drawn with) ────────────────────────────────────

export interface Rules {
  h: Seg[];
  v: Seg[];
}

/** Horizontal and vertical rules: stroked straight segments, and thin filled rectangles. */
export function findRules(paths: readonly PdfPath[]): Rules {
  const h: Seg[] = [];
  const v: Seg[] = [];
  for (const p of paths) {
    if (p.curves) continue;
    if (p.fill && !p.stroke && p.rect) {
      const b = p.box;
      if (b.h <= 2.5 && b.w >= 10) h.push({ x1: b.x, y1: b.y + b.h / 2, x2: right(b), y2: b.y + b.h / 2 });
      else if (b.w <= 2.5 && b.h >= 10) v.push({ x1: b.x + b.w / 2, y1: b.y, x2: b.x + b.w / 2, y2: top(b) });
      continue;
    }
    if (!p.stroke) continue;
    for (const s of p.segs) {
      if (Math.abs(s.y1 - s.y2) < 1.5 && Math.abs(s.x2 - s.x1) >= 10) {
        h.push({ x1: Math.min(s.x1, s.x2), y1: s.y1, x2: Math.max(s.x1, s.x2), y2: s.y1 });
      } else if (Math.abs(s.x1 - s.x2) < 1.5 && Math.abs(s.y2 - s.y1) >= 10) {
        v.push({ x1: s.x1, y1: Math.min(s.y1, s.y2), x2: s.x1, y2: Math.max(s.y1, s.y2) });
      }
    }
  }
  return { h, v };
}

/** Values within `tol` of each other as one (their mean), sorted ascending. */
export function clusterValues(values: readonly number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[][] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last && v - (last[last.length - 1] as number) <= tol) last.push(v);
    else out.push([v]);
  }
  return out.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
}

/** Groups of horizontal rules that belong together (overlapping in x, joined by verticals or close). */
function ruleGroups(rules: Rules): Seg[][] {
  const hs = [...rules.h].sort((a, b) => b.y1 - a.y1);
  const parent = hs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i] as number)));
  for (let i = 0; i < hs.length; i++) {
    for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i] as Seg;
      const b = hs[j] as Seg;
      const overlap = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      const shorter = Math.min(a.x2 - a.x1, b.x2 - b.x1);
      if (overlap < shorter * 0.6) continue;
      const dy = Math.abs(a.y1 - b.y1);
      const joined = rules.v.some((v) => v.y1 <= Math.min(a.y1, b.y1) + 2 && v.y2 >= Math.max(a.y1, b.y1) - 2 && v.x1 >= Math.max(a.x1, b.x1) - 2 && v.x1 <= Math.min(a.x2, b.x2) + 2);
      if (joined || dy <= 60) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, Seg[]>();
  hs.forEach((s, i) => {
    const g = find(i);
    groups.set(g, [...(groups.get(g) ?? []), s]);
  });
  return [...groups.values()];
}

// ── Tables ─────────────────────────────────────────────────────────────────────

export interface TableGuess {
  box: Rect;
  rows: TableCell[][];
  header: boolean;
  /** 0 … 1: how surely the text sits in the cells. */
  confidence: number;
  /** Indexes of the text items it took. */
  items: number[];
}

/** Text of items, top to bottom, left to right. */
function cellText(items: readonly PdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => (b.transform[5] ?? 0) - (a.transform[5] ?? 0) || (a.transform[4] ?? 0) - (b.transform[4] ?? 0));
  return normSpace(sorted.map((i) => i.str).join(' '));
}

/**
 * Rebuilds the table inside `box` from its row boundaries (y, top to bottom), column
 * boundaries (x, left to right) and the text items in it. Vertical rules, when given,
 * decide merged cells: a row with no rule at an inner boundary joins the two cells.
 */
export function buildTable(
  box: Rect,
  rowYs: readonly number[],
  colXs: readonly number[],
  items: readonly PdfTextItem[],
  indexes: readonly number[],
  verticals: readonly Seg[] | null,
): TableGuess {
  const nRows = rowYs.length - 1;
  const nCols = colXs.length - 1;
  const cells: number[][][] = Array.from({ length: nRows }, () => Array.from({ length: nCols }, () => []));
  let straddling = 0;
  const taken: number[] = [];
  for (const i of indexes) {
    const it = items[i] as PdfTextItem;
    const b = itemBox(it);
    const c = centre(b);
    const r = rowYs.findIndex((y, k) => k < nRows && c.y <= y + 1 && c.y >= (rowYs[k + 1] as number) - 1);
    const col = colXs.findIndex((x, k) => k < nCols && c.x >= x - 1 && c.x <= (colXs[k + 1] as number) + 1);
    if (r < 0 || col < 0) continue;
    // A run of text crossing a column boundary by a good part of itself: the columns are wrong.
    const crosses = colXs.slice(1, -1).some((x) => b.x < x - b.w * 0.3 && right(b) > x + b.w * 0.3);
    if (crosses && !verticals) straddling++;
    (cells[r] as number[][])[col]?.push(i);
    taken.push(i);
  }
  const rows: TableCell[][] = cells.map((row, r) => {
    const out: TableCell[] = [];
    row.forEach((ids, c) => {
      const text = cellText(ids.map((i) => items[i] as PdfTextItem));
      const prev = out[out.length - 1];
      const boundary = colXs[c] as number;
      const yTop = rowYs[r] as number;
      const yBottom = rowYs[r + 1] as number;
      const ruled =
        !verticals ||
        verticals.some((v) => Math.abs(v.x1 - boundary) <= 2.5 && Math.min(v.y2, yTop) - Math.max(v.y1, yBottom) >= (yTop - yBottom) * 0.6);
      if (c > 0 && prev && !ruled && !text) {
        prev.span = (prev.span ?? 1) + 1;
        return;
      }
      if (c > 0 && prev && !ruled) {
        prev.t = normSpace(`${prev.t} ${text}`);
        prev.span = (prev.span ?? 1) + 1;
        return;
      }
      out.push({ t: text });
    });
    return out;
  });
  const total = nRows * nCols;
  const filled = rows.flat().filter((c) => c.t).length;
  const fillRatio = total ? filled / Math.max(1, rows.flat().length) : 0;
  const straddleRatio = taken.length ? straddling / taken.length : 1;
  const confidence = nRows >= 2 && nCols >= 2 && taken.length > 0 ? Math.max(0, Math.min(1, fillRatio * (1 - straddleRatio * 3))) : 0;
  return { box, rows, header: nRows >= 2, confidence, items: taken };
}

/** Tables drawn with rules. Each group of rules with at least two rows or two columns is one. */
export function ruledTables(page: PdfPageInput, rules: Rules): TableGuess[] {
  const out: TableGuess[] = [];
  for (const group of ruleGroups(rules)) {
    let box = group.slice(1).reduce((r, s) => union(r, rectOf(s.x1, s.y1, s.x2, s.y2)), rectOf((group[0] as Seg).x1, (group[0] as Seg).y1, (group[0] as Seg).x2, (group[0] as Seg).y2));
    const verts = rules.v.filter((v) => v.x1 >= box.x - 2 && v.x1 <= right(box) + 2 && v.y2 >= box.y - 2 && v.y1 <= top(box) + 2);
    for (const v of verts) box = union(box, rectOf(v.x1, v.y1, v.x2, v.y2));
    if (box.h < 8 || box.w < 40) continue;
    const indexes = page.items.map((it, i) => ({ c: centre(itemBox(it)), i })).filter(({ c }) => contains(box, c.x, c.y)).map(({ i }) => i);
    if (!indexes.length) continue;
    let rowYs = clusterValues([...group.map((s) => s.y1), top(box), box.y], 2).sort((a, b) => b - a);
    let colXs = clusterValues(
      verts.filter((v) => v.y2 - v.y1 >= Math.min(box.h * 0.3, 40) || verts.length > 2).map((v) => v.x1).concat([box.x, right(box)]),
      2.5,
    );
    const hasVerticals = colXs.length > 2;
    if (!hasVerticals) {
      // Only horizontal rules (a "booktabs" table): columns from where the text runs start.
      colXs = alignedColumns(page.items, indexes, box);
      // Bands holding several text lines are rows of one line each.
      rowYs = splitBandsByLines(rowYs, page.items, indexes);
    }
    if (rowYs.length - 1 < 1 || colXs.length - 1 < 1 || (rowYs.length - 1) * (colXs.length - 1) < 2) continue;
    out.push(buildTable(box, rowYs, colXs, page.items, indexes, hasVerticals ? verts : null));
  }
  return out;
}

/** Baselines of the given items, top to bottom. */
function baselines(items: readonly PdfTextItem[], indexes: readonly number[]): number[] {
  return clusterValues(
    indexes.map((i) => (items[i] as PdfTextItem).transform[5] ?? 0),
    2,
  ).sort((a, b) => b - a);
}

function splitBandsByLines(rowYs: number[], items: readonly PdfTextItem[], indexes: readonly number[]): number[] {
  const out: number[] = [rowYs[0] as number];
  for (let k = 0; k + 1 < rowYs.length; k++) {
    const hi = rowYs[k] as number;
    const lo = rowYs[k + 1] as number;
    const inside = indexes.filter((i) => {
      const y = centre(itemBox(items[i] as PdfTextItem)).y;
      return y <= hi && y >= lo;
    });
    const lines = baselines(items, inside);
    for (let j = 1; j < lines.length; j++) {
      const a = lines[j - 1] as number;
      const b = lines[j] as number;
      out.push((a + b) / 2 + 2);
    }
    out.push(lo);
  }
  return out;
}

/** Column boundaries from where runs of text start (runs = items separated by a wide gap). */
function alignedColumns(items: readonly PdfTextItem[], indexes: readonly number[], box: Rect): number[] {
  const starts: number[] = [];
  for (const line of linesOf(items, indexes)) for (const run of runsOf(items, line)) starts.push(run.x);
  const cols = clusterValues(starts, 6).filter((x) => starts.filter((s) => Math.abs(s - x) <= 6).length >= 2);
  // The first column starts at the table's edge; each further run start opens a column.
  const inner = cols.slice(1).map((x) => x - 2);
  return [box.x, ...inner, right(box)];
}

/** Items grouped into lines (same baseline), top to bottom, each line left to right. */
function linesOf(items: readonly PdfTextItem[], indexes: readonly number[]): number[][] {
  const lines: number[][] = [];
  const sorted = [...indexes].sort((a, b) => ((items[b] as PdfTextItem).transform[5] ?? 0) - ((items[a] as PdfTextItem).transform[5] ?? 0));
  for (const i of sorted) {
    const y = (items[i] as PdfTextItem).transform[5] ?? 0;
    const last = lines[lines.length - 1];
    const h = (items[i] as PdfTextItem).height || 10;
    if (last && Math.abs(((items[last[0] as number] as PdfTextItem).transform[5] ?? 0) - y) <= h * 0.4) last.push(i);
    else lines.push([i]);
  }
  return lines.map((l) => l.sort((a, b) => ((items[a] as PdfTextItem).transform[4] ?? 0) - ((items[b] as PdfTextItem).transform[4] ?? 0)));
}

interface Run {
  x: number;
  end: number;
  ids: number[];
}

/** A line's items as runs: a new run where the gap is wider than about two characters. */
function runsOf(items: readonly PdfTextItem[], line: readonly number[]): Run[] {
  const runs: Run[] = [];
  for (const i of line) {
    const b = itemBox(items[i] as PdfTextItem);
    const last = runs[runs.length - 1];
    const gap = last ? b.x - last.end : Infinity;
    if (last && gap <= Math.max(6, b.h * 1.2)) {
      last.end = Math.max(last.end, right(b));
      last.ids.push(i);
    } else runs.push({ x: b.x, end: right(b), ids: [i] });
  }
  return runs;
}

/**
 * Tables without rules: three or more lines in a row, each with two or more runs of
 * text separated by wide gaps, whose runs start at the same columns.
 */
export function alignedTables(page: PdfPageInput, free: readonly number[]): TableGuess[] {
  const lines = linesOf(page.items, free);
  const out: TableGuess[] = [];
  let k = 0;
  while (k < lines.length) {
    let j = k;
    while (j < lines.length && runsOf(page.items, lines[j] as number[]).length >= 2) j++;
    if (j - k >= 3) {
      const block = lines.slice(k, j);
      const runs = block.map((l) => runsOf(page.items, l));
      const starts = runs.flat().map((r) => r.x);
      const cols = clusterValues(starts, 6).filter((x) => runs.filter((rs) => rs.some((r) => Math.abs(r.x - x) <= 6)).length >= Math.ceil(block.length * 0.6));
      const aligned = starts.filter((s) => cols.some((c) => Math.abs(c - s) <= 6)).length / starts.length;
      if (cols.length >= 2 && aligned >= 0.7) {
        const ids = block.flat();
        const box = ids.slice(1).reduce((r, i) => union(r, itemBox(page.items[i] as PdfTextItem)), itemBox(page.items[ids[0] as number] as PdfTextItem));
        const ys = block.map((l) => page.items[l[0] as number]?.transform[5] ?? 0);
        const rowYs = [top(box) + 1, ...ys.slice(1).map((y, n) => ((ys[n] as number) + y) / 2 + 2), box.y - 1];
        const colXs = [box.x - 1, ...cols.slice(1).map((c) => c - 2), right(box) + 1];
        const table = buildTable(grow(box, 1), rowYs, colXs, page.items, ids, null);
        if (table.confidence >= 0.5) out.push(table);
      }
      k = j;
    } else k = Math.max(k + 1, j);
  }
  return out;
}

// ── Pictures and frames ──────────────────────────────────────────────────────

/** Painted images at least this big (PDF units) are pictures; smaller ones are ornaments. */
const MIN_IMAGE = 20;

/** Merges overlapping or touching boxes. */
export function mergeBoxes(boxes: readonly Rect[], gap: number): Rect[] {
  const out = [...boxes];
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (overlaps(grow(out[i] as Rect, gap), out[j] as Rect)) {
          out[i] = union(out[i] as Rect, out[j] as Rect);
          out.splice(j, 1);
          merged = true;
          break;
        }
      }
    }
  }
  return out;
}

/** Vector drawings (charts, diagrams): curved or many-segment paths that are not rules or plain boxes, grouped. */
export function drawingRegions(paths: readonly PdfPath[], page: { width: number; height: number }): Rect[] {
  const marks = paths.filter((p) => (p.curves || p.segs.length >= 4) && !p.rect && p.box.w < page.width * 0.95);
  const groups = mergeBoxes(
    marks.map((p) => p.box),
    8,
  );
  return groups.filter((g) => g.w >= 40 && g.h >= 40 && marks.filter((p) => overlaps(p.box, g)).length >= 3);
}

/** Boxes drawn around (or filled behind) text: a stroked rectangle, or a filled one that is not the page's background. */
export function frameCandidates(paths: readonly PdfPath[], page: { width: number; height: number }): Rect[] {
  return paths
    .filter((p) => p.rect && !p.curves && p.box.w >= 60 && p.box.h >= 20)
    .filter((p) => !(p.box.w >= page.width * 0.85 && p.box.h >= page.height * 0.85))
    .map((p) => p.box);
}

const MATH = /[=+−×÷∑∫√∞≤≥≠≈±∂∆∇πΣλμσθαβγ^]/gu;

/** A formula line: math signs a fair share of it, and no ordinary words. */
export function isFormula(text: string): boolean {
  const t = text.replace(/\s+/g, '');
  if (t.length < 3 || t.length > 120) return false;
  if (!/[=∑∫√≤≥≈≠]/u.test(t)) return false;
  if (/\p{L}{4,}/u.test(text)) return false;
  return (t.match(MATH)?.length ?? 0) / t.length >= 0.15;
}

// ── The page in reading order ────────────────────────────────────────────────

/** A table that is not read surely enough is shown as a picture of its region. */
export const TABLE_CONFIDENCE = 0.6;

/**
 * The page as blocks, top to bottom: paragraphs of running text, tables, frames of text
 * and regions to render as pictures. Text inside a picture (a chart's labels) belongs
 * to the picture; text inside a table to the table; text inside a frame to the frame.
 */
export function layoutPage(page: PdfPageInput): PageBlock[] {
  const used = new Set<number>();
  const anchored: { top: number; x: number; block: PageBlock }[] = [];
  const takeInside = (r: Rect) => {
    page.items.forEach((it, i) => {
      if (used.has(i)) return;
      const c = centre(itemBox(it));
      if (contains(grow(r, 1), c.x, c.y)) used.add(i);
    });
  };

  // Pictures first: painted images and drawings own the text inside them.
  const pictures = mergeBoxes(
    page.images.filter((r) => r.w >= MIN_IMAGE && r.h >= MIN_IMAGE),
    4,
  );
  const drawings = drawingRegions(page.paths, page).filter((d) => !pictures.some((p) => overlaps(p, d)));
  for (const r of pictures) {
    takeInside(r);
    anchored.push({ top: top(r), x: r.x, block: { kind: 'region', box: r, reason: 'image' } });
  }

  // Tables: ruled ones, then aligned text.
  const rules = findRules(page.paths);
  const tables = ruledTables(page, rules).filter((tb) => !pictures.some((p) => overlaps(p, tb.box)));
  for (const tb of tables) {
    tb.items.forEach((i) => used.add(i));
    takeInside(tb.box);
    const block: PageBlock =
      tb.confidence >= TABLE_CONFIDENCE ? { kind: 'table', rows: tb.rows, header: tb.header, box: tb.box } : { kind: 'region', box: grow(tb.box, 2), reason: 'table' };
    anchored.push({ top: top(tb.box), x: tb.box.x, block });
  }
  for (const d of drawings.filter((dr) => !tables.some((tb) => overlaps(tb.box, dr)))) {
    takeInside(d);
    anchored.push({ top: top(d), x: d.x, block: { kind: 'region', box: grow(d, 2), reason: 'drawing' } });
  }

  // Frames around text.
  for (const f of frameCandidates(page.paths, page)) {
    if (tables.some((tb) => overlaps(grow(tb.box, -2), f) && tb.box.w * tb.box.h >= f.w * f.h * 0.5)) continue;
    if (pictures.some((p) => overlaps(p, f) && p.w * p.h >= f.w * f.h * 0.5)) continue;
    const inside = page.items.map((it, i) => ({ c: centre(itemBox(it)), i })).filter(({ c, i }) => !used.has(i) && contains(f, c.x, c.y)).map(({ i }) => i);
    if (!inside.length) continue;
    inside.forEach((i) => used.add(i));
    const paras = linesToParagraphs(itemsToLines(inside.map((i) => page.items[i] as PdfTextItem)));
    if (paras.length) anchored.push({ top: top(f), x: f.x, block: { kind: 'frame', paras } });
  }

  // Tables of aligned text among what is left.
  const free = page.items.map((_, i) => i).filter((i) => !used.has(i));
  for (const tb of alignedTables(page, free)) {
    tb.items.forEach((i) => used.add(i));
    anchored.push({ top: top(tb.box), x: tb.box.x, block: { kind: 'table', rows: tb.rows, header: tb.header, box: tb.box } });
  }

  // Formula lines become pictures; the rest is running text, cut where blocks sit.
  const rest = page.items.map((it, i) => ({ it, i })).filter(({ i }) => !used.has(i));
  const lines = itemsToLines(rest.map((r) => r.it));
  const textLines: PdfLine[] = [];
  const formulaBoxes: Rect[] = [];
  for (const l of lines) {
    if (isFormula(l.text)) formulaBoxes.push(rectOf(l.x, l.y - l.h * 0.35, l.end, l.y + l.h * 1.05));
    else textLines.push(l);
  }
  for (const r of mergeBoxes(formulaBoxes, 4)) anchored.push({ top: top(r), x: r.x, block: { kind: 'region', box: grow(r, 2), reason: 'formula' } });

  anchored.sort((a, b) => b.top - a.top || a.x - b.x);
  const blocks: PageBlock[] = [];
  let buffer: PdfLine[] = [];
  const flush = () => {
    if (!buffer.length) return;
    const paras = linesToParagraphs(buffer);
    if (paras.length) blocks.push({ kind: 'text', paras });
    buffer = [];
  };
  let a = 0;
  for (const line of textLines) {
    while (a < anchored.length && (anchored[a] as { top: number }).top > line.y + line.h * 0.5) {
      flush();
      blocks.push((anchored[a] as { block: PageBlock }).block);
      a++;
    }
    buffer.push(line);
  }
  flush();
  while (a < anchored.length) blocks.push((anchored[a++] as { block: PageBlock }).block);
  return blocks;
}

/** Characters of text on a page (for the scanned-PDF check). */
export function blockChars(blocks: readonly PageBlock[]): number {
  return blocks.reduce((n, b) => {
    if (b.kind === 'text' || b.kind === 'frame') return n + b.paras.reduce((m, p) => m + p.length, 0);
    if (b.kind === 'table') return n + b.rows.flat().reduce((m, c) => m + c.t.length, 0);
    return n;
  }, 0);
}
