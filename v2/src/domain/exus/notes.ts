// Note commands, the pure part (docs/v2/PLAN.md 6.5, "Notatki"): the local search
// behind "/szukaj". The caller gives the notes it has; nothing here reads a store.
import { noteExcerpt, type Note } from '../notes';
import { fold } from './recognizers';

/** "/szukaj" shows this many notes. */
export const FIND_MAX = 5;
/** The snippet around the hit. */
const SNIPPET_MAX = 90;

export interface NoteHit {
  note: Note;
  /** A short piece of the content around the first hit, or its start when only the title matched (empty for an empty content). */
  snippet: string;
}

/** Points per search term: a title weighs more than the content, a title that starts with the term most. */
const TITLE_STARTS = 4;
const TITLE_HAS = 3;
const CONTENT_HAS = 1;

/** A fixed-length fold, so an index in the folded text is an index in the original. */
const foldChars = (text: string) => text.split('').map((c) => fold(c).padEnd(1, ' ').slice(0, 1)).join('');

function snippetAround(content: string, terms: readonly string[]): string {
  const plain = noteExcerpt(content, content.length + 1);
  const folded = foldChars(plain);
  const at = terms.map((term) => folded.indexOf(term)).filter((i) => i >= 0);
  // Only the title matched: the content shows from its start.
  if (at.length === 0) return noteExcerpt(content, SNIPPET_MAX);
  // Start a little before the hit, at a word, so the snippet reads from the middle of a sentence.
  const first = Math.min(...at);
  let start = Math.max(0, first - 20);
  if (start > 0) {
    const space = plain.indexOf(' ', start);
    if (space >= 0 && space < first) start = space + 1;
  }
  const end = start + SNIPPET_MAX;
  const piece = plain.slice(start, end).trim();
  return `${start > 0 ? '…' : ''}${piece}${end < plain.length ? '…' : ''}`;
}

/**
 * Notes whose title or content has every word of `query` (case and Polish letters
 * do not matter), best first: titles before contents, active before archived,
 * newer before older. At most `max`; `total` is how many fit.
 */
export function searchNotes(notes: readonly Note[], query: string, max = FIND_MAX): { hits: NoteHit[]; total: number } {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { hits: [], total: 0 };
  const scored: { note: Note; score: number }[] = [];
  for (const note of notes) {
    const title = foldChars(note.title);
    const content = foldChars(note.content);
    let score = 0;
    let all = true;
    for (const term of terms) {
      const inTitle = title.includes(term);
      const inContent = content.includes(term);
      if (!inTitle && !inContent) {
        all = false;
        break;
      }
      score += (inTitle ? (title.startsWith(term) ? TITLE_STARTS : TITLE_HAS) : 0) + (inContent ? CONTENT_HAS : 0);
    }
    if (all) scored.push({ note, score });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(a.note.archived) - Number(b.note.archived) ||
      (b.note.createdAt?.getTime() ?? 0) - (a.note.createdAt?.getTime() ?? 0),
  );
  const hits = scored.slice(0, max).map(({ note }) => ({ note, snippet: snippetAround(note.content, terms) }));
  return { hits, total: scored.length };
}
