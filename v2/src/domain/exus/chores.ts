// Chore commands, the pure part (docs/v2/PLAN.md 6.5, "Obowiązki"): which day
// "/obowiazek" logs for and what "/obowiazki" says. The caller gives the
// definitions and entries it has; nothing here reads a store.
import { addDays } from '@/lib/dates';
import { entriesInMonth, monthKeyOf, todayChores, unpaidChores, type ChoreDef, type ChoreEntry, type ChoreRow, type Unpaid } from '../chores';
import { oneOf } from './recognizers';

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
