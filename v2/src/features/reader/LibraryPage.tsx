// The reader's library (#/reader): add books (file picker or drag and drop, several
// at once), the books by last read with how far each is read, and a two-tap delete.
import { BookOpen, FilePlus, RefreshCw } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatOf, percentRead, type BookMeta } from '@/domain/reader/book';
import { t } from '@/i18n';
import type { Navigate } from '@/lib/route-match';
import { deleteBook, importBook, libraryPersistent, listLibrary, needsReprocess, reprocessBook } from '@/services/reader';
import { showToast } from '@/ui/toast';
import { Button } from '@/ui/components/Button';
import { EmptyState, IconTile, ProgressBar } from '@/ui/components/Display';
import { Card, Page, Section, Stack } from '@/ui/components/Layout';
import { markOpenedFromLibrary } from './history';
import { fmt, importErrorMessage } from './texts';
import './library.css';

const ACCEPT = '.pdf,.epub,.txt,.md,.markdown,.text,application/pdf,application/epub+zip,text/plain,text/markdown';

/** How long "Na pewno?" waits for the second tap. */
const ARM_MS = 3000;

interface Busy {
  name: string;
  pct: number;
  /** Reading a book's file again (Przetwórz ponownie), not adding one. */
  again?: boolean;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let storageWarned = false;

export function LibraryPage({ navigate }: { navigate: Navigate }) {
  const [books, setBooks] = useState<BookMeta[] | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [over, setOver] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const againInput = useRef<HTMLInputElement>(null);
  /** The book whose file is being chosen again. */
  const again = useRef<BookMeta | null>(null);

  const refresh = () =>
    listLibrary()
      .then(setBooks)
      .catch(() => setBooks([]));

  useEffect(() => {
    void refresh();
    libraryPersistent()
      .then((persistent) => {
        if (!persistent && !storageWarned) {
          storageWarned = true;
          showToast({ message: t('reader.library.noStorage'), durationMs: 4500 });
        }
      })
      .catch(() => undefined);
    // A file dropped next to the drop zone must not open in the tab instead.
    const stop = (e: DragEvent) => e.preventDefault();
    addEventListener('dragover', stop);
    addEventListener('drop', stop);
    return () => {
      removeEventListener('dragover', stop);
      removeEventListener('drop', stop);
    };
  }, []);

  useEffect(() => {
    if (armed === null) return;
    const timer = setTimeout(() => setArmed(null), ARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const importFiles = async (files: File[]) => {
    if (busy) return;
    let added = 0;
    for (const file of files) {
      try {
        setBusy({ name: file.name, pct: 0 });
        await importBook(file, (p) => setBusy({ name: file.name, pct: Math.round(p * 100) }));
        added++;
      } catch (err) {
        setBusy(null);
        showToast({
          message: t('reader.library.fileError', { name: file.name, message: importErrorMessage(err) }),
          tone: 'negative',
          durationMs: 5200,
        });
        await wait(300);
      }
    }
    setBusy(null);
    await refresh();
    if (added) {
      showToast({ message: t('reader.library.added', { count: added }), tone: 'positive' });
      if (!(await libraryPersistent())) showToast({ message: t('reader.library.noStorageAdded'), durationMs: 5200 });
    }
  };

  const onPick = () => {
    const el = input.current;
    if (!el) return;
    const files = [...(el.files ?? [])];
    el.value = '';
    if (files.length) void importFiles(files);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) void importFiles(files);
  };

  // Books added before r-5 have no tables or pictures: the file is not kept, so the
  // reader chooses it again and the book is read anew in place.
  const reprocess = async (book: BookMeta, file: File) => {
    if (busy) return;
    if (formatOf(file.name) !== book.format) {
      showToast({ message: t('reader.library.reprocessWrong'), tone: 'negative', durationMs: 5200 });
      return;
    }
    try {
      setBusy({ name: book.title, pct: 0, again: true });
      await reprocessBook(book, file, (p) => setBusy({ name: book.title, pct: Math.round(p * 100), again: true }));
      showToast({ message: t('reader.library.reprocessed'), tone: 'positive' });
    } catch (err) {
      showToast({ message: t('reader.library.fileError', { name: file.name, message: importErrorMessage(err) }), tone: 'negative', durationMs: 5200 });
    }
    setBusy(null);
    await refresh();
  };

  const onPickAgain = () => {
    const el = againInput.current;
    const book = again.current;
    const file = el?.files?.[0];
    if (el) el.value = '';
    again.current = null;
    if (book && file) void reprocess(book, file);
  };

  const remove = (book: BookMeta) => {
    if (armed !== book.id) return setArmed(book.id);
    setArmed(null);
    deleteBook(book.id)
      .catch(() => showToast({ message: t('reader.errors.saveFailed'), tone: 'negative' }))
      .finally(() => void refresh());
  };

  const open = (book: BookMeta) => {
    markOpenedFromLibrary();
    navigate(`/reader/${encodeURIComponent(book.id)}`);
  };

  return (
    <Page>
      <Stack>
        <p class="reader-lib__intro">{t('reader.library.intro')}</p>
        <div
          class={`reader-lib__drop${over ? ' is-over' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setOver(false);
          }}
          onDrop={onDrop}
        >
          <Card>
            {busy ? (
              <div class="reader-lib__busy" role="status">
                <p class="reader-lib__busy-name">{t(busy.again ? 'reader.library.reprocessing' : 'reader.library.importingPct', { name: busy.name, pct: busy.pct })}</p>
                <ProgressBar value={busy.pct / 100} label={t(busy.again ? 'reader.library.reprocessing' : 'reader.library.importingPct', { name: busy.name, pct: busy.pct })} />
              </div>
            ) : (
              <div class="reader-lib__add">
                <Button variant="primary" onClick={() => input.current?.click()}>
                  <FilePlus aria-hidden="true" />
                  {t('reader.library.add')}
                </Button>
                <p class="reader-lib__hint">{t('reader.library.dropHint')}</p>
                <input
                  ref={input}
                  class="visually-hidden"
                  type="file"
                  multiple
                  accept={ACCEPT}
                  tabIndex={-1}
                  aria-label={t('reader.library.add')}
                  onChange={onPick}
                />
              </div>
            )}
          </Card>
        </div>
        <p class="reader-lib__local">{t('reader.library.local')}</p>
        {books?.some(needsReprocess) && (
          <input
            ref={againInput}
            class="visually-hidden"
            type="file"
            accept={ACCEPT}
            tabIndex={-1}
            aria-hidden="true"
            data-testid="reader-reprocess-input"
            onChange={onPickAgain}
          />
        )}

        <Section title={t('reader.library.shelf')}>
          <Card padding="none">
            {books !== null && books.length === 0 ? (
              <EmptyState title={t('reader.library.empty')} />
            ) : (
              <ul class="reader-lib__books">
                {(books ?? []).map((book) => {
                  // Without the book's own table of contents when the reader skips it (domain/reader/toc).
                  const shown = book.progress ?? { pos: book.pos, total: book.total };
                  const pct = percentRead(shown.pos, shown.total);
                  const sure = armed === book.id;
                  return (
                    <li key={book.id} class="reader-lib__book">
                      <button type="button" class="reader-lib__open" onClick={() => open(book)}>
                        <IconTile>
                          <BookOpen />
                        </IconTile>
                        <span class="reader-lib__text">
                          <span class="reader-lib__title user-text clamp-2">{book.title}</span>
                          <span class="reader-lib__meta">
                            {t('reader.library.meta', {
                              format: book.format,
                              sentences: t('reader.library.sentences', { count: shown.total, n: fmt(shown.total) }),
                              pct,
                            })}
                          </span>
                          <ProgressBar value={pct / 100} label={t('reader.library.progress', { pct })} />
                        </span>
                      </button>
                      {needsReprocess(book) && (
                        <div class="reader-lib__again">
                          <p class="reader-lib__again-hint">{t('reader.library.reprocessHint')}</p>
                          <Button
                            aria-label={t('reader.library.reprocessLabel', { title: book.title })}
                            disabled={busy !== null}
                            onClick={() => {
                              again.current = book;
                              againInput.current?.click();
                            }}
                          >
                            <RefreshCw aria-hidden="true" />
                            {t('reader.library.reprocess')}
                          </Button>
                        </div>
                      )}
                      <button
                        type="button"
                        class={`reader-lib__delete${sure ? ' is-sure' : ''}`}
                        aria-label={t(sure ? 'reader.library.deleteSureLabel' : 'reader.library.deleteLabel', { title: book.title })}
                        onClick={() => remove(book)}
                      >
                        {t(sure ? 'reader.library.deleteSure' : 'reader.library.delete')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </Section>
      </Stack>
    </Page>
  );
}
