// #/reader/:id: loads the book and the reader's settings from the device, then reads.
import { useEffect, useState } from 'preact/hooks';
import type { BookContent, BookMeta } from '@/domain/reader/book';
import type { ReaderSettings } from '@/domain/reader/settings';
import { t } from '@/i18n';
import type { Navigate } from '@/lib/route-match';
import { loadReaderSettings, openBook } from '@/services/reader';
import { showToast } from '@/ui/toast';
import { takeOpenedFromLibrary } from './history';
import { Reader } from './Reader';
import './reader.css';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; meta: BookMeta; content: BookContent; settings: ReaderSettings };

/** The standalone reader's breakpoint for a larger first text size. */
const WIDE = 700;

export function ReaderScreen({ id, navigate }: { id: string; navigate: Navigate }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [fromLibrary] = useState(takeOpenedFromLibrary);

  const back = () => {
    if (fromLibrary) history.back();
    else navigate('/reader', { replace: true });
  };

  useEffect(() => {
    let current = true;
    Promise.all([openBook(id), loadReaderSettings(innerWidth > WIDE)])
      .then(([book, settings]) => {
        if (!current) return;
        if (!book || flatEmpty(book.content)) throw new Error('missing');
        setState({ kind: 'ready', meta: book.meta, content: book.content, settings });
      })
      .catch(() => {
        if (!current) return;
        showToast({ message: t('reader.library.notFound'), tone: 'negative' });
        navigate('/reader', { replace: true });
      });
    return () => {
      current = false;
    };
  }, [id]);

  if (state.kind === 'loading') {
    return (
      <div class="reader reader--loading" data-theme="paper" role="status">
        <p class="reader__loading">{t('reader.library.opening')}</p>
      </div>
    );
  }
  return <Reader meta={state.meta} content={state.content} initialSettings={state.settings} onBack={back} />;
}

function flatEmpty(content: BookContent): boolean {
  return !content.sections.some((s) => s.paras.length > 0);
}
