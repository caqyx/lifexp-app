// PDF import for the reader, loaded only when a PDF is imported: pdf.js (its legacy
// build, which also runs on older iPhones) reads each page's text and what it paints
// (images, lines, boxes), domain/reader/pdf-layout finds tables, pictures, frames and
// formulas among them (row r-5), and the regions that become pictures are rendered from
// the page and cropped. pdf.js parses in its worker; pages are read one at a time with a
// frame between them, so a long PDF never freezes the screen. pdf.js and its worker are
// big: the Service Worker caches them on first use instead of installing them (src/sw.ts).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { baseName, type BookElement, type Para } from '@/domain/reader/book';
import { MIN_PDF_CHARS, mergeParasAcrossPages, pdfParaSections, type PdfTextItem } from '@/domain/reader/parse-pdf';
import { blockChars, layoutPage, type PageBlock, type PdfPageInput, type PdfPath, type Rect, type Seg } from '@/domain/reader/pdf-layout';
import type { ParsedWithAssets, PendingAsset } from './reader-assets';
import { ReaderImportError } from './reader-errors';

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

type Matrix = [number, number, number, number, number, number];

const multiply = (m: Matrix, n: readonly number[]): Matrix => [
  (n[0] ?? 1) * m[0] + (n[1] ?? 0) * m[2],
  (n[0] ?? 1) * m[1] + (n[1] ?? 0) * m[3],
  (n[2] ?? 0) * m[0] + (n[3] ?? 1) * m[2],
  (n[2] ?? 0) * m[1] + (n[3] ?? 1) * m[3],
  (n[4] ?? 0) * m[0] + (n[5] ?? 0) * m[2] + m[4],
  (n[4] ?? 0) * m[1] + (n[5] ?? 0) * m[3] + m[5],
];
const apply = (m: Matrix, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

function boxOf(points: readonly { x: number; y: number }[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

interface PendingPath {
  segs: Seg[];
  points: { x: number; y: number }[];
  curves: boolean;
  rect: boolean;
  lines: number;
}

/** Images and paths a page paints, in page space (from pdf.js's operator list). */
export function readOperators(fnArray: readonly number[], argsArray: readonly unknown[]): { images: Rect[]; paths: PdfPath[] } {
  const OPS = pdfjs.OPS;
  const images: Rect[] = [];
  const paths: PdfPath[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  let pending: PendingPath | null = null;
  const imageOps = new Set<number>([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObjectRepeat]);
  const strokeOps = new Set<number>([OPS.stroke, OPS.closeStroke]);
  const fillOps = new Set<number>([OPS.fill, OPS.eoFill]);
  const bothOps = new Set<number>([OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke]);
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i] as number;
    const args = (argsArray[i] ?? []) as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = multiply(ctm, args as number[]);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      if (Array.isArray(args[0])) ctm = multiply(ctm, args[0] as number[]);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (imageOps.has(fn)) {
      images.push(boxOf([apply(ctm, 0, 0), apply(ctm, 1, 0), apply(ctm, 0, 1), apply(ctm, 1, 1)]));
    } else if (fn === OPS.constructPath) {
      const ops = (args[0] ?? []) as number[];
      const coords = (args[1] ?? []) as number[];
      const path: PendingPath = pending ?? { segs: [], points: [], curves: false, rect: false, lines: 0 };
      let j = 0;
      let cur = { x: 0, y: 0 };
      let start = { x: 0, y: 0 };
      for (const op of ops) {
        if (op === OPS.rectangle) {
          const x = coords[j++] ?? 0;
          const y = coords[j++] ?? 0;
          const w = coords[j++] ?? 0;
          const h = coords[j++] ?? 0;
          const p = [apply(ctm, x, y), apply(ctm, x + w, y), apply(ctm, x + w, y + h), apply(ctm, x, y + h)];
          for (let k = 0; k < 4; k++) {
            const a = p[k] as { x: number; y: number };
            const b = p[(k + 1) % 4] as { x: number; y: number };
            path.segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
          }
          path.points.push(...p);
          path.rect = ops.length === 1 && path.segs.length === 4;
          cur = p[0] as { x: number; y: number };
        } else if (op === OPS.moveTo) {
          cur = apply(ctm, coords[j++] ?? 0, coords[j++] ?? 0);
          start = cur;
          path.points.push(cur);
        } else if (op === OPS.lineTo) {
          const next = apply(ctm, coords[j++] ?? 0, coords[j++] ?? 0);
          path.segs.push({ x1: cur.x, y1: cur.y, x2: next.x, y2: next.y });
          path.points.push(next);
          path.lines++;
          cur = next;
        } else if (op === OPS.curveTo || op === OPS.curveTo2 || op === OPS.curveTo3) {
          const n = op === OPS.curveTo ? 6 : 4;
          const pts: { x: number; y: number }[] = [];
          for (let k = 0; k < n; k += 2) pts.push(apply(ctm, coords[j + k] ?? 0, coords[j + k + 1] ?? 0));
          j += n;
          const end = pts[pts.length - 1] as { x: number; y: number };
          path.segs.push({ x1: cur.x, y1: cur.y, x2: end.x, y2: end.y });
          path.points.push(...pts);
          path.curves = true;
          cur = end;
        } else if (op === OPS.closePath) {
          path.segs.push({ x1: cur.x, y1: cur.y, x2: start.x, y2: start.y });
          cur = start;
        }
      }
      // Four straight, upright sides closing a box are a rectangle too.
      if (!path.curves && !path.rect && path.segs.length === 4 && path.lines >= 3) {
        const b = boxOf(path.points);
        path.rect = path.segs.every((s) => Math.abs(s.x1 - s.x2) < 1 || Math.abs(s.y1 - s.y2) < 1) && b.w > 0 && b.h > 0;
      }
      pending = path;
    } else if (pending && (strokeOps.has(fn) || fillOps.has(fn) || bothOps.has(fn))) {
      if (pending.points.length) {
        paths.push({
          segs: pending.segs,
          box: boxOf(pending.points),
          stroke: strokeOps.has(fn) || bothOps.has(fn),
          fill: fillOps.has(fn) || bothOps.has(fn),
          curves: pending.curves,
          rect: pending.rect,
        });
      }
      pending = null;
    } else if (fn === OPS.endPath) pending = null;
  }
  return { images, paths };
}

/** Pixels per PDF unit for pictures: 2 (144 dpi), less for a page that would be over 2000 px wide. */
/** CSS pixels in a PDF point (96 / 72). */
const PT_TO_PX = 4 / 3;
const renderScale = (pageWidth: number) => Math.min(2, 2000 / Math.max(1, pageWidth));

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === 'image/webp') return resolve(webp);
        canvas.toBlob((jpeg) => resolve(jpeg), 'image/jpeg', 0.85);
      },
      'image/webp',
      0.82,
    );
  });
}

type PdfDocument = Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>;

/** Renders the page once and cuts out each region as a picture. */
async function cropRegions(page: PdfPage, regions: readonly Rect[]): Promise<({ blob: Blob; w: number; h: number } | null)[]> {
  const [x0, , x1] = page.view as number[];
  const viewport = page.getViewport({ scale: renderScale((x1 ?? 0) - (x0 ?? 0)) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return regions.map(() => null);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const out: ({ blob: Blob; w: number; h: number } | null)[] = [];
  for (const r of regions) {
    const [ax = 0, ay = 0, bx = 0, by = 0] = viewport.convertToViewportRectangle([r.x - 3, r.y - 3, r.x + r.w + 3, r.y + r.h + 3]) as number[];
    const sx = Math.max(0, Math.floor(Math.min(ax, bx)));
    const sy = Math.max(0, Math.floor(Math.min(ay, by)));
    const w = Math.min(canvas.width - sx, Math.ceil(Math.abs(bx - ax)));
    const h = Math.min(canvas.height - sy, Math.ceil(Math.abs(by - ay)));
    if (w < 4 || h < 4) {
      out.push(null);
      continue;
    }
    const crop = document.createElement('canvas');
    crop.width = w;
    crop.height = h;
    crop.getContext('2d')?.drawImage(canvas, sx, sy, w, h, 0, 0, w, h);
    const blob = await canvasBlob(crop);
    // The size to show it at is the region's on the page (the picture itself is sharper).
    out.push(blob ? { blob, w: Math.round((w / viewport.scale) * PT_TO_PX), h: Math.round((h / viewport.scale) * PT_TO_PX) } : null);
  }
  canvas.width = 0;
  canvas.height = 0;
  return out;
}

export async function parsePdfFile(file: File, onProgress: (p: number) => void): Promise<ParsedWithAssets> {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try {
    const pdf = await task.promise.catch((err: unknown) => {
      throw new ReaderImportError('unreadable', err instanceof Error ? err.message : String(err));
    });
    const meta = await pdf.getMetadata().catch(() => null);
    const pages: Para[][] = [];
    const assets: PendingAsset[] = [];
    let chars = 0;
    let frame = 0;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view as number[];
      const [tc, ops] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
      const { images, paths } = readOperators(ops.fnArray, ops.argsArray);
      const input: PdfPageInput = {
        width: x1 - x0,
        height: y1 - y0,
        items: tc.items.filter((it) => 'str' in it) as PdfTextItem[],
        images,
        paths,
      };
      const blocks = layoutPage(input);
      chars += blockChars(blocks);
      const regions = blocks.filter((b): b is Extract<PageBlock, { kind: 'region' }> => b.kind === 'region');
      const pictures = regions.length ? await cropRegions(page, regions.map((r) => r.box)) : [];
      const paras: Para[] = [];
      let n = 0;
      for (const b of blocks) {
        if (b.kind === 'text') paras.push(...b.paras.map((t): Para => ({ t, h: 0 })));
        else if (b.kind === 'frame') {
          frame++;
          paras.push(...b.paras.map((t): Para => ({ t, h: 0, frame })));
        } else if (b.kind === 'table') paras.push({ t: '', h: 0, el: { kind: 'table', rows: b.rows, header: b.header } });
        else {
          const pic = pictures[n++];
          if (!pic) continue;
          const key = `p${p}-${n}`;
          assets.push({ key, blob: pic.blob });
          const el: BookElement = { kind: 'image', asset: key, w: pic.w, h: pic.h, alt: '', role: b.reason };
          paras.push({ t: '', h: 0, el });
        }
      }
      pages.push(paras);
      page.cleanup();
      onProgress(p / pdf.numPages);
      await nextFrame();
    }
    if (chars < MIN_PDF_CHARS) throw new ReaderImportError('scanned');
    mergeParasAcrossPages(pages);
    const info = meta?.info as { Title?: unknown } | undefined;
    const title = typeof info?.Title === 'string' ? info.Title.trim() : '';
    return { title: title || baseName(file.name), format: 'PDF', sections: pdfParaSections(pages), assets };
  } finally {
    void task.destroy();
  }
}
