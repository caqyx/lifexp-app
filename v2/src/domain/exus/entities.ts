// Finding the thing a command names (docs/v2/PLAN.md 6.3, the `entity` slot):
// "rower", "rowr", "Nowy rower" → one of the person's goals. Pure: the caller
// gives the candidates (id + name) and gets back one, several or none.
import { fold } from './recognizers';

export interface Named {
  id: string;
  name: string;
}

export type Match<T extends Named> =
  | { kind: 'found'; item: T }
  /** Several fit: the caller lists them by name and asks to be more precise. */
  | { kind: 'ambiguous'; items: T[] }
  | { kind: 'none' };

/** The farthest a typo may be from the name (Levenshtein, on folded text). */
export const FUZZY_MAX = 2;
/** Fuzzy matching needs this many characters, or two letters would match anything. */
const FUZZY_MIN_LENGTH = 3;

/** Edit distance (insert, delete, replace), two rows. */
export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** The name as typed: folded, with runs of spaces squeezed. */
const key = (text: string) => fold(text).trim().replace(/\s+/g, ' ');

function pick<T extends Named>(items: T[]): Match<T> {
  if (items.length === 0) return { kind: 'none' };
  return items.length === 1 ? { kind: 'found', item: items[0]! } : { kind: 'ambiguous', items };
}

/** The distance to the whole name or to its closest word ("rowr" → "Nowy rower"). */
function distance(query: string, name: string): number {
  return Math.min(levenshtein(query, name), ...name.split(' ').map((w) => levenshtein(query, w)));
}

/**
 * Case and Polish letters do not matter. Steps, the first with a hit decides:
 * the exact name, a name starting with the text, a name containing it, and
 * last the names closest to it (at most FUZZY_MAX away; the closest ones only).
 */
export function matchEntity<T extends Named>(query: string, items: readonly T[]): Match<T> {
  const q = key(query);
  if (!q) return { kind: 'none' };
  const folded = items.map((item) => ({ item, name: key(item.name) }));
  const steps: ((name: string) => boolean)[] = [
    (name) => name === q,
    (name) => name.startsWith(q),
    (name) => name.includes(q),
  ];
  for (const step of steps) {
    const hits = folded.filter((f) => step(f.name));
    if (hits.length > 0) return pick(hits.map((f) => f.item));
  }
  if (q.length < FUZZY_MIN_LENGTH) return { kind: 'none' };
  const near = folded.map((f) => ({ item: f.item, d: distance(q, f.name) })).filter((f) => f.d <= FUZZY_MAX);
  const best = Math.min(...near.map((f) => f.d));
  return pick(near.filter((f) => f.d === best).map((f) => f.item));
}
