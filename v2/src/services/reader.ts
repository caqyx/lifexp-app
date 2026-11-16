// The reader's books (docs/v2/PLAN.md 9.1 row "r"): importing files, opening a book,
// saving where reading stopped and the reader's settings. Everything stays on the
// device (offline/readerLibrary); reading earns no points and is in no statistics.
// PDF and EPUB support (pdf.js, JSZip) loads only when such a file is imported.
import {
  extensionOf,
  flatten,
  formatOf,
  sortLibrary,
  withText,
  type BookContent,
  type BookMeta,
} from '@/domain/reader/book';
import { decodeText, parseText } from '@/domain/reader/parse-text';
import { detectToc, readingView } from '@/domain/reader/toc';
import { normalizeReaderSettings, type ReaderSettings } from '@/domain/reader/settings';
import {
  getBook,
  listBookMeta,
  openReaderLibrary,
  getAsset,
  putAssets,
  putBook,
  putBookMeta,
  removeBookAssets,
  readReaderSettings,
  removeBook,
  writeReaderSettings,
} from '@/offline/readerLibrary';
import { ReaderImportError } from './reader-errors';

export { ReaderImportError, type ReaderImportProblem } from './reader-errors';
import type { ParsedWithAssets } from './reader-assets';

/** false = IndexedDB is not available: books last until the page is closed. */
export async function libraryPersistent(): Promise<boolean> {
  return (await openReaderLibrary()).persistent;
}

export async function listLibrary(): Promise<BookMeta[]> {
  return sortLibrary(await listBookMeta());
}

/** One file as a book (0 … 1 progress on the way); throws ReaderImportError. */
export async function parseBookFile(file: File, onProgress: (p: number) => void = () => undefined): Promise<ParsedWithAssets> {
  const format = formatOf(file.name);
  if (format === null) throw new ReaderImportError('unsupported', extensionOf(file.name));
  if (format === 'PDF') {
    const { parsePdfFile } = await import('./reader-pdf').catch(() => {
      throw new ReaderImportError('library');
    });
    return parsePdfFile(file, onProgress);
  }
  if (format === 'EPUB') {
    const { parseEpubFile } = await import('./reader-epub').catch(() => {
      throw new ReaderImportError('library');
    });
    return parseEpubFile(file, onProgress);
  }
  return { ...parseText(decodeText(await file.arrayBuffer()), file.name, format === 'MD'), assets: [] };
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** How files are read now: 2 = with tables and pictures (r-5). */
export const PARSER_VERSION = 2;

/** Pictures get the book's id in their keys, and are stored. */
async function storeParsed(id: string, parsed: ParsedWithAssets) {
  const sections = withText(parsed.sections).map((sec) => ({
    ...sec,
    paras: sec.paras.map((p) => (p.el?.kind === 'image' ? { ...p, el: { ...p.el, asset: `${id}:${p.el.asset}` } } : p)),
  }));
  const { sents, secStart } = flatten(sections);
  if (!sents.length) throw new ReaderImportError('empty');
  await putAssets(parsed.assets.map((a) => ({ key: `${id}:${a.key}`, blob: a.blob })));
  // What the library counts: the book without its own table of contents, unless the reader keeps it.
  const { skipToc } = await loadReaderSettings(false);
  const view = readingView(sections, { sents, secStart }, detectToc(sections), skipToc);
  return { sections, total: sents.length, readTotal: view.toFull.length };
}

/** Parses and stores one file; the new book's meta. */
export async function importBook(file: File, onProgress?: (p: number) => void): Promise<BookMeta> {
  const parsed = await parseBookFile(file, onProgress);
  const id = newId();
  const { sections, total, readTotal } = await storeParsed(id, parsed);
  const meta: BookMeta = {
    id,
    title: parsed.title,
    format: parsed.format,
    added: Date.now(),
    opened: 0,
    pos: 0,
    total,
    progress: { pos: 0, total: readTotal },
    parser: PARSER_VERSION,
  };
  const content: BookContent = { id, sections };
  await putBook(meta, content);
  return meta;
}

/** A book read before tables and pictures were (no original file is kept): read the same file again in its place. */
export function needsReprocess(meta: BookMeta): boolean {
  return (meta.format === 'PDF' || meta.format === 'EPUB') && (meta.parser ?? 1) < PARSER_VERSION;
}

/**
 * Reads `file` again for book `meta`: new content with tables and pictures, the same
 * book (title, dates); the place stays at the same share of the book.
 */
export async function reprocessBook(meta: BookMeta, file: File, onProgress?: (p: number) => void): Promise<BookMeta> {
  if (formatOf(file.name) !== meta.format) throw new ReaderImportError('unsupported', extensionOf(file.name));
  const parsed = await parseBookFile(file, onProgress);
  await removeBookAssets(meta.id);
  const { sections, total, readTotal } = await storeParsed(meta.id, parsed);
  const share = meta.total > 1 ? meta.pos / (meta.total - 1) : 0;
  const pos = Math.round(share * Math.max(0, total - 1));
  const readShare = meta.progress && meta.progress.total > 1 ? meta.progress.pos / (meta.progress.total - 1) : share;
  const next: BookMeta = {
    ...meta,
    total,
    pos,
    progress: { pos: Math.round(readShare * Math.max(0, readTotal - 1)), total: readTotal },
    parser: PARSER_VERSION,
  };
  await putBook(next, { id: meta.id, sections });
  return next;
}

/** A picture of a book's element, as a URL for <img> (made once per session). */
const urls = new Map<string, Promise<string | null>>();
export function assetUrl(key: string): Promise<string | null> {
  let url = urls.get(key);
  if (!url) {
    url = getAsset(key)
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null);
    urls.set(key, url);
  }
  return url;
}

export async function openBook(id: string): Promise<{ meta: BookMeta; content: BookContent } | null> {
  return getBook(id);
}

/** Where reading stopped, and that the book was just read (it moves to the top of the library). */
export function saveReadingPosition(meta: BookMeta, pos: number, progress?: BookMeta['progress']): Promise<void> {
  return putBookMeta({ ...meta, pos, opened: Date.now(), ...(progress ? { progress } : {}) });
}

export function deleteBook(id: string): Promise<void> {
  return removeBook(id);
}

export async function loadReaderSettings(wide: boolean): Promise<ReaderSettings> {
  return normalizeReaderSettings(await readReaderSettings().catch(() => undefined), wide);
}

export function saveReaderSettings(settings: ReaderSettings): Promise<void> {
  return writeReaderSettings(settings);
}
