// Oryginał (row r-6): the real pages of a PDF book from its kept file. One document is
// open at a time (the book being read); pages are drawn into canvases on demand and a
// few are kept (LRU, a pixel budget per page), text items of pages are kept too (small).
// Loaded only when the reader switches to Oryginał (pdf.js is a large module).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PdfTextItem } from '@/domain/reader/parse-pdf';
import { getOriginal } from '@/offline/readerLibrary';

type PdfDocument = Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;

/** At most this many device pixels in one page's canvas (~20 MB of memory). */
export const MAX_PAGE_PIXELS = 5_000_000;
/** Pages kept drawn: the shown spread, the one before and the one after. */
export const PAGE_CACHE = 6;

export interface PageSize {
  /** PDF units; the page's origin (view box corner). */
  w: number;
  h: number;
  x0: number;
  y0: number;
}

export interface OriginalDoc {
  pages: number;
  size: (page: number) => Promise<PageSize>;
  text: (page: number) => Promise<PdfTextItem[]>;
  /** The page drawn `cssW` CSS pixels wide at the device's pixel ratio (cached). */
  draw: (page: number, cssW: number) => Promise<HTMLCanvasElement>;
  /** The drawn page if it is cached (no drawing). */
  cached: (page: number, cssW: number) => HTMLCanvasElement | null;
  close: () => void;
}

/** Opens the kept file of book `bookId`; null when there is none. */
export async function openOriginal(bookId: string): Promise<OriginalDoc | null> {
  const blob = await getOriginal(bookId);
  if (!blob) return null;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false });
  const doc: PdfDocument = await task.promise;
  const sizes = new Map<number, Promise<PageSize>>();
  const texts = new Map<number, Promise<PdfTextItem[]>>();
  const canvases = new Map<string, HTMLCanvasElement>();
  const drawing = new Map<string, Promise<HTMLCanvasElement>>();
  let closed = false;

  const size = (n: number) => {
    let p = sizes.get(n);
    if (!p) {
      p = doc.getPage(n).then((page) => {
        const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view as number[];
        return { w: x1 - x0, h: y1 - y0, x0, y0 };
      });
      sizes.set(n, p);
    }
    return p;
  };

  const text = (n: number) => {
    let p = texts.get(n);
    if (!p) {
      p = doc
        .getPage(n)
        .then((page) => page.getTextContent())
        .then((c) =>
          c.items.flatMap((it): PdfTextItem[] => ('str' in it ? [{ str: it.str, transform: it.transform as number[], width: it.width, height: it.height }] : [])),
        )
        .catch(() => []);
      texts.set(n, p);
    }
    return p;
  };

  const keyOf = (n: number, cssW: number) => `${n}@${Math.round(cssW)}`;
  const remember = (key: string, canvas: HTMLCanvasElement) => {
    canvases.delete(key);
    canvases.set(key, canvas);
    while (canvases.size > PAGE_CACHE) {
      const [oldKey, old] = canvases.entries().next().value as [string, HTMLCanvasElement];
      canvases.delete(oldKey);
      // Not on screen any more: give its memory back.
      if (!old.isConnected) {
        old.width = 0;
        old.height = 0;
      }
    }
  };

  const cached = (n: number, cssW: number) => {
    const key = keyOf(n, cssW);
    const c = canvases.get(key);
    if (c) remember(key, c);
    return c ?? null;
  };

  const draw = (n: number, cssW: number) => {
    const key = keyOf(n, cssW);
    const hit = cached(n, cssW);
    if (hit) return Promise.resolve(hit);
    let p = drawing.get(key);
    if (p) return p;
    p = (async () => {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      let scale = (cssW / base.width) * (globalThis.devicePixelRatio || 1);
      const pixels = base.width * base.height * scale * scale;
      if (pixels > MAX_PAGE_PIXELS) scale *= Math.sqrt(MAX_PAGE_PIXELS / pixels);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.className = 'orig__canvas';
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('no canvas');
      if (closed) return canvas;
      await page.render({ canvasContext: ctx, viewport }).promise;
      remember(key, canvas);
      return canvas;
    })().finally(() => drawing.delete(key));
    drawing.set(key, p);
    return p;
  };

  return {
    pages: doc.numPages,
    size,
    text,
    draw,
    cached,
    close: () => {
      closed = true;
      for (const c of canvases.values()) {
        c.width = 0;
        c.height = 0;
      }
      canvases.clear();
      void doc.destroy();
    },
  };
}
