// PDF import for the reader, loaded only when a PDF is imported: pdf.js (its legacy
// build, which also runs on older iPhones) reads the text layer page by page, and
// domain/reader/parse-pdf turns it into paragraphs. pdf.js and its worker are big:
// the Service Worker caches them on first use instead of installing them (src/sw.ts).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { baseName, type ParsedBook } from '@/domain/reader/book';
import { itemsToLines, linesToParagraphs, looksScanned, mergeAcrossPages, pdfSections } from '@/domain/reader/parse-pdf';
import { ReaderImportError } from './reader-errors';

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export async function parsePdfFile(file: File, onProgress: (p: number) => void): Promise<ParsedBook> {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try {
    const pdf = await task.promise.catch((err: unknown) => {
      throw new ReaderImportError('unreadable', err instanceof Error ? err.message : String(err));
    });
    const meta = await pdf.getMetadata().catch(() => null);
    const pages: string[][] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      pages.push(linesToParagraphs(itemsToLines(tc.items)));
      page.cleanup();
      if (p % 3 === 0) {
        onProgress(p / pdf.numPages);
        await nextFrame();
      }
    }
    if (looksScanned(pages)) throw new ReaderImportError('scanned');
    mergeAcrossPages(pages);
    const info = meta?.info as { Title?: unknown } | undefined;
    const title = typeof info?.Title === 'string' ? info.Title.trim() : '';
    return { title: title || baseName(file.name), format: 'PDF', sections: pdfSections(pages) };
  } finally {
    void task.destroy();
  }
}
