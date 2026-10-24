// Money commands, the pure part (docs/v2/PLAN.md 6.5, "Money"): which word of
// "/wydatek 5 jedzenie obiad" is the category and which the note, and which
// transaction "/usun-transakcje" means. The caller gives the categories and
// transactions it has; nothing here reads a store.
import type { MoneyCategory, MoneyTx } from '../money';
import { matchEntity } from './entities';
import { fold } from './recognizers';

export type CategoryWords =
  /** The category as the account spells it, and whatever is left as the note. */
  | { kind: 'found'; category: string; note: string }
  /** The first word fits several categories: the caller lists them. */
  | { kind: 'ambiguous'; names: string[] }
  /** No word names a category: everything is the note. */
  | { kind: 'none'; note: string };

/** A fuzzy or partial match of the first word needs this many letters, or "w" would match anything. */
const WORD_MIN = 3;

const squeeze = (words: readonly string[]) => fold(words.join(' '));

/**
 * The words after the amount and the day, e.g. "jedzenie obiad w szkole". Rules,
 * the first with a hit decides:
 * 1. a run of words that is exactly an existing category (case and Polish letters
 *    ignored), the longest and earliest first: "obiad jedzenie" and
 *    "kieszonkowe dodatkowe babcia" work, the rest is the note;
 * 2. the first word, when it is at least three letters and starts, contains or
 *    nearly equals one category ("jedz" → jedzenie, "gre" → gry);
 * 3. otherwise there is no category and all the words are the note. A word that
 *    names no category is never turned into a new one, so a typo cannot create
 *    one: a new category is written `kategoria=nazwa`.
 */
export function splitCategoryNote(words: readonly string[], categories: readonly MoneyCategory[]): CategoryWords {
  const names = new Map(categories.map((c) => [fold(c.name).trim(), c.name]));
  for (let length = words.length; length >= 1; length--) {
    for (let start = 0; start + length <= words.length; start++) {
      const hit = names.get(squeeze(words.slice(start, start + length)));
      if (hit !== undefined) {
        return { kind: 'found', category: hit, note: [...words.slice(0, start), ...words.slice(start + length)].join(' ') };
      }
    }
  }
  const first = words[0];
  if (first !== undefined && fold(first).length >= WORD_MIN) {
    const match = matchEntity(first, categories);
    if (match.kind === 'found') return { kind: 'found', category: match.item.name, note: words.slice(1).join(' ') };
    if (match.kind === 'ambiguous') return { kind: 'ambiguous', names: match.items.map((c) => c.name) };
  }
  return { kind: 'none', note: words.join(' ') };
}

/** The most recently entered transaction (a write not yet confirmed has no time and counts as newest). */
export function lastTransaction(txs: readonly MoneyTx[]): MoneyTx | null {
  let best: MoneyTx | null = null;
  const stamp = (tx: MoneyTx) => tx.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  for (const tx of txs) {
    if (!best || stamp(tx) > stamp(best) || (stamp(tx) === stamp(best) && tx.date > best.date)) best = tx;
  }
  return best;
}

export type TxMatch =
  | { kind: 'found'; tx: MoneyTx }
  | { kind: 'ambiguous'; txs: MoneyTx[] }
  | { kind: 'none' };

/** Words that mean "the newest one". */
const LAST = new Set(['ostatnia', 'ostatnią', 'ostatni', 'last', 'latest'].map(fold));

/** "ostatnia" (or nothing) = the newest; any other text is matched with "category note" like a goal name. */
export function findTransaction(ref: string | undefined, txs: readonly MoneyTx[]): TxMatch {
  const text = ref?.trim() ?? '';
  if (!text || LAST.has(fold(text))) {
    const tx = lastTransaction(txs);
    return tx ? { kind: 'found', tx } : { kind: 'none' };
  }
  const match = matchEntity(
    text,
    txs.map((tx) => ({ id: tx.id, name: `${tx.category} ${tx.note}`.trim(), tx })),
  );
  if (match.kind === 'found') return { kind: 'found', tx: match.item.tx };
  if (match.kind === 'ambiguous') return { kind: 'ambiguous', txs: match.items.map((i) => i.tx) };
  return { kind: 'none' };
}
