// In-app reminders (docs/v2/PLAN.md 9.1, row c-3): which notifications are due now.
// Calendar entries remind by importance (reminders.ts), open tasks by their due date
// (weighed like entries, items.ts) and once more the morning after it passes. The app
// shows them only while it is open — no push, no server — so on its return from the
// background it may find several waiting: those still worth it (recent and not past)
// are shown once, the rest only marked as seen. Pure: the clock and what this device
// already showed come in as arguments.
import { addDays, localDayKey, localInstant } from '@/lib/dates';
import type { Task } from '../tasks';
import { occurrencesBetween } from './agenda';
import type { CalendarCategory, CalendarEvent } from './events';
import { importanceLevel, levelRank, type ImportanceLevel } from './importance';
import { taskImportance, taskTitle } from './items';
import { MORNING_MINUTES, remindersFor, type ReminderKind } from './reminders';

/** A reminder shown late (the app was closed) is still worth showing for this long. */
export const MISSED_WINDOW_MS = 2 * 60 * 60 * 1000;
/** What this device showed is remembered for a week, then forgotten. */
export const DELIVERED_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

/** "overdue": the morning after a task's due day, once. */
export type NoticeKind = ReminderKind | 'overdue';

export type NoticeTarget = { type: 'event'; eventId: string; day: string } | { type: 'task'; taskId: string };

export interface Notice {
  /** Stable: the same reminder has the same id every time it is computed. */
  id: string;
  /** When it is due (ms). */
  at: number;
  /** After this (ms) it is pointless: the entry has started, or its day is over. */
  expiresAt: number;
  kind: NoticeKind;
  title: string;
  level: ImportanceLevel;
  target: NoticeTarget;
  /** The day of the entry or the task's due day. */
  day: string;
  /** Minutes after midnight; null = all day (tasks always). */
  start: number | null;
  end: number | null;
}

const endOfDay = (day: string) => localInstant(addDays(day, 1), 0).getTime();

/** Reminders of the entries' occurrences from `from` to `to`; ticked or skipped days have none. */
export function eventNotices(
  events: readonly CalendarEvent[],
  categories: readonly CalendarCategory[],
  from: string,
  to: string,
): Notice[] {
  const out: Notice[] = [];
  for (const o of occurrencesBetween(events, categories, from, to)) {
    if (o.mark !== null) continue;
    const expiresAt = o.start === null ? endOfDay(o.day) : localInstant(o.day, o.start).getTime();
    for (const r of remindersFor({ day: o.day, start: o.start, level: o.level })) {
      out.push({
        id: `e:${o.event.id}@${o.day}:${r.kind}`,
        at: r.at.getTime(),
        expiresAt,
        kind: r.kind,
        title: o.event.title,
        level: o.level,
        target: { type: 'event', eventId: o.event.id, day: o.day },
        day: o.day,
        start: o.start,
        end: o.end,
      });
    }
  }
  return out;
}

/**
 * Reminders of open tasks: by the due day as an all-day entry of the task's weight
 * (S/M: that morning; L: also the evening before), and "overdue" the morning after.
 * Changing the due date gives new ids, so the new date reminds again.
 */
export function taskNotices(tasks: readonly Task[]): Notice[] {
  const out: Notice[] = [];
  for (const task of tasks) {
    if (task.done || task.dueDate === null) continue;
    const due = task.dueDate;
    const title = taskTitle(task.text);
    const base = { title, target: { type: 'task', taskId: task.id } as const, day: due, start: null, end: null };
    // Its weight on the due day (not overdue yet): the reminders lead up to it.
    const level = importanceLevel(taskImportance(task, due));
    for (const r of remindersFor({ day: due, start: null, level })) {
      out.push({ ...base, id: `t:${task.id}@${due}:${r.kind}`, at: r.at.getTime(), expiresAt: endOfDay(due), kind: r.kind, level });
    }
    const after = addDays(due, 1);
    out.push({
      ...base,
      id: `t:${task.id}@${due}:overdue`,
      at: localInstant(after, MORNING_MINUTES).getTime(),
      expiresAt: endOfDay(after),
      kind: 'overdue',
      // Overdue from then on: its weight with the overdue bonus.
      level: importanceLevel(taskImportance(task, after)),
    });
  }
  return out;
}

export interface ScheduleInput {
  events: readonly CalendarEvent[];
  categories: readonly CalendarCategory[];
  tasks: readonly Task[];
  now: number;
}

/**
 * Every reminder that can matter around `now`: entries from yesterday to three days
 * ahead (a "two days before" reminder looks that far), all open tasks; by time.
 */
export function scheduleNotices({ events, categories, tasks, now }: ScheduleInput): Notice[] {
  const today = localDayKey(new Date(now));
  return [...eventNotices(events, categories, addDays(today, -1), addDays(today, 3)), ...taskNotices(tasks)].sort(
    (a, b) => a.at - b.at || a.id.localeCompare(b.id),
  );
}

export interface DueNotices {
  /** To show now, the most important first (then the latest). */
  fresh: Notice[];
  /** Due but no longer worth showing (too late, or the entry already started): mark as seen. */
  stale: Notice[];
}

/** The reminders due at `now` that this device has not shown yet. */
export function dueNotices(notices: readonly Notice[], now: number, delivered: ReadonlySet<string>): DueNotices {
  const fresh: Notice[] = [];
  const stale: Notice[] = [];
  for (const n of notices) {
    if (n.at > now || delivered.has(n.id)) continue;
    if (now - n.at <= MISSED_WINDOW_MS && now < n.expiresAt) fresh.push(n);
    else stale.push(n);
  }
  fresh.sort((a, b) => levelRank(b.level) - levelRank(a.level) || b.at - a.at || a.id.localeCompare(b.id));
  return { fresh, stale };
}

/** When the next reminder not shown yet is due (ms), or null. */
export function nextNoticeAt(notices: readonly Notice[], now: number, delivered: ReadonlySet<string>): number | null {
  let next: number | null = null;
  for (const n of notices) {
    if (n.at > now && !delivered.has(n.id) && (next === null || n.at < next)) next = n.at;
  }
  return next;
}

/** What this device showed, without what is older than DELIVERED_KEEP_MS. */
export function pruneDelivered(delivered: Readonly<Record<string, number>>, now: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, at] of Object.entries(delivered)) if (now - at <= DELIVERED_KEEP_MS) out[id] = at;
  return out;
}
