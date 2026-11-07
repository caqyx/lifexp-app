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
  type ParsedBook,
} from '@/domain/reader/book';
import { decodeText, parseText } from '@/domain/reader/parse-text';
import { detectToc, readingView } from '@/domain/reader/toc';
import { normalizeReaderSettings, type ReaderSettings } from '@/domain/reader/settings';
import {
  getBook,
  listBookMeta,
  openReaderLibrary,
  putBook,
  putBookMeta,
  readReaderSettings,
  removeBook,
  writeReaderSettings,
} from '@/offline/readerLibrary';
import { ReaderImportError } from './reader-errors';

export { ReaderImportError, type ReaderImportProblem } from './reader-errors';

/** false = IndexedDB is not available: books last until the page is closed. */
export async function libraryPersistent(): Promise<boolean> {
  return (await openReaderLibrary()).persistent;
}

export async function listLibrary(): Promise<BookMeta[]> {
  return sortLibrary(await listBookMeta());
}

/** One file as a book (0 … 1 progress on the way); throws ReaderImportError. */
export async function parseBookFile(file: File, onProgress: (p: number) => void = () => undefined): Promise<ParsedBook> {
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
  return parseText(decodeText(await file.arrayBuffer()), file.name, format === 'MD');
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Parses and stores one file; the new book's meta. */
export async function importBook(file: File, onProgress?: (p: number) => void): Promise<BookMeta> {
  const parsed = await parseBookFile(file, onProgress);
  const sections = withText(parsed.sections);
  const { sents, secStart } = flatten(sections);
  if (!sents.length) throw new ReaderImportError('empty');
  const id = newId();
  // What the library counts: the book without its own table of contents, unless the reader keeps it.
  const { skipToc } = await loadReaderSettings(false);
  const view = readingView(sections, { sents, secStart }, detectToc(sections), skipToc);
  const meta: BookMeta = {
    id,
    title: parsed.title,
    format: parsed.format,
    added: Date.now(),
    opened: 0,
    pos: 0,
    total: sents.length,
    progress: { pos: 0, total: view.toFull.length },
  };
  const content: BookContent = { id, sections };
  await putBook(meta, content);
  return meta;
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
