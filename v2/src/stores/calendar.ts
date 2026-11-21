// Calendar entries and categories, live (docs/v2/PLAN.md 9.1, row c-1). Shared by
// every screen that shows them (the calendar, later Today and the reminders): the
// listeners run while at least one of them watches, one pair per account.
import { signal } from '@preact/signals';
import type { CalendarCategory, CalendarEvent } from '@/domain/calendar/events';

export interface CalendarState {
  /** undefined = still loading. */
  events: readonly CalendarEvent[] | undefined;
  categories: readonly CalendarCategory[] | undefined;
  failed: boolean;
}

const EMPTY: CalendarState = { events: undefined, categories: undefined, failed: false };

export const calendar = signal<CalendarState>(EMPTY);

/**
 * The day the calendar is looking at ("YYYY-MM-DD"; null = today). Kept across its
 * views, so Month → Day opens the day that was chosen.
 */
export const calendarFocus = signal<string | null>(null);

/** How long the listeners outlive their last watcher. */
const LEAVE_GRACE_MS = 2000;

let active: { uid: string; watchers: number; stop: () => void } | null = null;

function start(uid: string): () => void {
  calendar.value = EMPTY;
  let stopped = false;
  const stops: (() => void)[] = [];
  const set = (patch: Partial<CalendarState>) => {
    if (!stopped) calendar.value = { ...calendar.value, ...patch };
  };
  const fail = () => set({ failed: true });
  void import('@/data/repos/calendar')
    .then((repo) => {
      if (stopped) return;
      stops.push(
        repo.watchEvents(uid, (events) => set({ events, failed: false }), fail),
        repo.watchCategories(uid, (categories) => set({ categories }), fail),
      );
    })
    .catch(fail);
  return () => {
    stopped = true;
    for (const stop of stops) stop();
  };
}

/** Start watching (or join the watch already running); call the result to leave. */
export function watchCalendar(uid: string): () => void {
  if (active && active.uid !== uid) {
    active.stop();
    active = null;
  }
  if (!active) active = { uid, watchers: 0, stop: start(uid) };
  const mine = active;
  mine.watchers += 1;
  let left = false;
  return () => {
    if (left) return;
    left = true;
    mine.watchers -= 1;
    // A moment's grace: moving between two screens that both watch keeps the data.
    setTimeout(() => {
      if (mine.watchers === 0 && active === mine) {
        mine.stop();
        active = null;
      }
    }, LEAVE_GRACE_MS);
  };
}
