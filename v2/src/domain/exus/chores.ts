// Chore commands, the pure part (docs/v2/PLAN.md 6.5, "Obowiązki"): which day
// "/obowiazek" logs for and what "/obowiazki" says. The caller gives the
// definitions and entries it has; nothing here reads a store.
import { addDays } from '@/lib/dates';
import { entriesInMonth, monthKeyOf, todayChores, unpaidChores, type ChoreDef, type ChoreEntry, type ChoreRow, type Unpaid } from '../chores';
import { matchEntity } from './entities';
import { fold, oneOf } from './recognizers';

/** The days the Chores screen logs for (v1 addChore: today, or yesterday after asking). */
export type ChoreDay = 'today' | 'yesterday';

export const CHORE_DAY = oneOf<ChoreDay>({
  dzis: 'today',
  dzisiaj: 'today',
  today: 'today',
  wczoraj: 'yesterday',
  yesterday: 'yesterday',
});

/** The local day an entry goes to; `today` is a local day key (lib/dates localDayKey). */
export function choreDayKey(when: ChoreDay, today: string): string {
  return when === 'yesterday' ? addDays(today, -1) : today;
}

export interface ChoresOverview {
  /** Chores done today, each with how often. */
  done: ChoreRow[];
  /** Everything not settled yet, at the current rate (G8.5–G8.7). */
  unpaid: Unpaid;
  /** Entries of the month `today` is in (all entries are unpaid ones, v1 deletes paid ones). */
  monthEntries: number;
}

/** What "/obowiazki" says, from the same functions the Chores screen and Today's card use. */
export function choresOverview(defs: readonly ChoreDef[], entries: readonly ChoreEntry[], today: string, rate: number): ChoresOverview {
  return {
    done: todayChores(defs, entries, today).filter((row) => row.doneToday > 0),
    unpaid: unpaidChores(entries, rate),
    monthEntries: entriesInMonth(entries, monthKeyOf(today)).length,
  };
}

export type EntryMatch =
  | { kind: 'found'; entry: ChoreEntry }
  /** The text fits several chores: the caller lists their names. */
  | { kind: 'ambiguous'; names: string[] }
  | { kind: 'none' };

/** Words that mean "the newest one". */
const LAST = new Set(['ostatni', 'ostatnia', 'ostatnie', 'last', 'latest']);

/** Entries logged most recently first; one not yet confirmed by the server has no time and counts as newest. */
function newestFirst(entries: readonly ChoreEntry[]): ChoreEntry[] {
  const stamp = (e: ChoreEntry) => e.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return [...entries].sort((a, b) => stamp(b) - stamp(a) || (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0));
}

/**
 * The unpaid entry "/usun-wpis" means: nothing or "ostatni" is the newest one; any other text is
 * matched with the chores' names (like a goal name) and gives the newest entry of that chore.
 */
export function findChoreEntry(ref: string | undefined, entries: readonly ChoreEntry[]): EntryMatch {
  const sorted = newestFirst(entries);
  const text = ref?.trim() ?? '';
  if (!text || LAST.has(fold(text))) return sorted[0] ? { kind: 'found', entry: sorted[0] } : { kind: 'none' };
  const names = [...new Set(sorted.map((e) => e.name))].map((name) => ({ id: name, name }));
  const match = matchEntity(text, names);
  if (match.kind === 'found') return { kind: 'found', entry: sorted.find((e) => e.name === match.item.name)! };
  if (match.kind === 'ambiguous') return { kind: 'ambiguous', names: match.items.map((n) => n.name) };
  return { kind: 'none' };
}
