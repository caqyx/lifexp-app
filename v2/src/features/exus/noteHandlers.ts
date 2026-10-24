// The note commands (docs/v2/PLAN.md 6.5, "Notatki"): /notatka, /archiwizuj,
// /szukaj. They go through the same services as the Notes screen (services/notes),
// so the same rules hold: a title, at most 30 active notes, at most 1000 lines.
// They wait for the notes the listener delivers instead of answering from nothing.
import { matchEntity } from '@/domain/exus/entities';
import { searchNotes } from '@/domain/exus/notes';
import { NOTE_TITLE_MAX, NOTES_MAX, type Note } from '@/domain/notes';
import { t } from '@/i18n';
import { archiveNote, createNote, deleteNote } from '@/services/notes';
import { notes } from '@/stores/notes';
import type { CommandHandler } from './handlers';
import { loadedNotes } from './loaded';

/** Why a note cannot be saved, in the Notes screen's own words. */
function problemText(problem: Exclude<ReturnType<typeof createNote>, { ok: true }>['problem']): string {
  if ('lines' in problem) return t('notes.maxLines', { lines: problem.lines, max: problem.max });
  return problem.kind === 'limit' ? t('notes.maxNotes', { max: problem.max }) : t('notes.needTitle');
}

export const NOTE_HANDLERS = {
  'create-note': {
    run: async (args, { uid }) => {
      const list = await loadedNotes().catch(() => null);
      if (!list) return { reply: t('notes.loadFailed') };
      const title = String(args.title).trim();
      const content = typeof args.content === 'string' ? args.content : '';
      if (title.length > NOTE_TITLE_MAX) return { reply: t('exus.note.titleTooLong', { max: NOTE_TITLE_MAX }) };
      const result = createNote(uid, { title, content, icon: '', color: '' }, list);
      if (!result.ok) return { reply: problemText(result.problem) };
      const { id } = result;
      return {
        reply: t('exus.note.created', { title, count: list.filter((n) => !n.archived).length + 1, max: NOTES_MAX }),
        write: { saved: result.saved, toast: t('notes.saved'), failed: t('notes.saveFailed') },
        undo: {
          what: t('exus.undoWhat.create-note', { title }),
          // The note goes again, unless it was edited in the meantime: then its new text would be lost.
          run: async () => {
            const now = notes.value.list?.find((n) => n.id === id);
            if (now && (now.title !== title || now.content !== content)) throw new Error('edited');
            await deleteNote(uid, id);
          },
        },
      };
    },
  },

  'archive-note': {
    run: async (args, { uid }) => {
      const list = await loadedNotes().catch(() => null);
      if (!list) return { reply: t('notes.loadFailed') };
      const name = String(args.note);
      const match = matchEntity(
        name,
        list.filter((n: Note) => !n.archived).map((n) => ({ id: n.id, name: n.title })),
      );
      if (match.kind === 'ambiguous') return { reply: t('exus.note.ambiguous', { names: match.items.map((n) => `„${n.name}”`).join(', ') }) };
      if (match.kind === 'none') return { reply: t('exus.note.none', { name }) };
      const { id, name: title } = match.item;
      return {
        reply: t('exus.note.archived', { title }),
        write: { saved: archiveNote(uid, id, true), toast: t('notes.archivedToast'), failed: t('notes.saveFailed') },
        undo: { what: t('exus.undoWhat.archive-note', { title }), run: () => archiveNote(uid, id, false) },
      };
    },
  },

  'find-note': {
    run: async (args) => {
      const list = await loadedNotes().catch(() => null);
      if (!list) return { reply: t('notes.loadFailed') };
      const query = String(args.query);
      const { hits, total } = searchNotes(list, query);
      if (hits.length === 0) return { reply: t('exus.note.nothingFound', { query }) };
      const lines = hits.map(({ note, snippet }) => {
        const tag = note.archived ? ` [${t('notes.inArchive')}]` : '';
        return `• ${note.title}${tag}${snippet ? ` — ${snippet}` : ''}`;
      });
      return {
        reply: [
          t('exus.note.found', { count: total }),
          ...lines,
          ...(total > hits.length ? [t('exus.note.more', { shown: hits.length, total })] : []),
        ].join('\n'),
      };
    },
  },
} satisfies Record<string, CommandHandler>;
