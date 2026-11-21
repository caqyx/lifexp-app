// Tasks next to calendar entries (docs/v2/PLAN.md 9.1, row c-2): a task shows on
// its due day, weighed like an entry, so one list — a day of the calendar, Today's
// "Ważne dzisiaj" — puts the most important first whatever it is. The task rules
// stay those of domain/tasks (v1): ticking it is final and goes through the tasks
// service. Pure.
import { isOverdue, type Task, type TaskSize } from '../tasks';
import { byDay, occurrencesBetween, type Occurrence } from './agenda';
import type { CalendarCategory, CalendarEvent } from './events';
import { IMPORTANCE_MAX, importanceLevel, type ImportanceLevel } from './importance';

/**
 * A task's weight by its size, on the scale of calendar entries:
 *
 * | size | importance | level  |
 * |------|------------|--------|
 * | S    | 2          | medium |
 * | M    | 4          | medium |
 * | L    | 6          | high   |
 *
 * Overdue adds TASK_OVERDUE_BONUS (an overdue L is "Bardzo ważne").
 */
export const TASK_SIZE_IMPORTANCE: Readonly<Record<TaskSize, number>> = { S: 2, M: 4, L: 6 };
export const TASK_OVERDUE_BONUS = 2;

export function taskImportance(task: Task, today: string): number {
  return Math.min(IMPORTANCE_MAX, TASK_SIZE_IMPORTANCE[task.size] + (isOverdue(task, today) ? TASK_OVERDUE_BONUS : 0));
}

/** The first line of a task's Markdown as plain text, for a one-line row. */
export function taskTitle(text: string): string {
  const line = text.split('\n').find((l) => l.trim() !== '') ?? '';
  return line
    .trim()
    .replace(/^(#{1,6}\s+|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+|>\s*)/, '')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
}

export type ItemState = 'open' | 'done' | 'skipped';

interface ItemBase {
  /** Unique among items: "event:<id>@<day>" or "task:<id>". */
  key: string;
  /** The day the item is listed on. */
  day: string;
  title: string;
  importance: number;
  level: ImportanceLevel;
  state: ItemState;
  /** Minutes after midnight; null = all day (tasks always). */
  start: number | null;
}

export interface EventItem extends ItemBase {
  kind: 'event';
  occurrence: Occurrence;
}

export interface TaskItem extends ItemBase {
  kind: 'task';
  task: Task;
  overdue: boolean;
}

export type CalendarItem = EventItem | TaskItem;

export function eventItem(o: Occurrence): EventItem {
  return {
    kind: 'event',
    key: `event:${o.key}`,
    day: o.day,
    title: o.event.title,
    importance: o.importance,
    level: o.level,
    state: o.mark ?? 'open',
    start: o.start,
    occurrence: o,
  };
}

/** A task listed on `day` (its due day, or today for an overdue one on Today). */
export function taskItem(task: Task, today: string, day = task.dueDate ?? today): TaskItem {
  const importance = taskImportance(task, today);
  return {
    kind: 'task',
    key: `task:${task.id}`,
    day,
    title: taskTitle(task.text),
    importance,
    level: importanceLevel(importance),
    state: task.done ? 'done' : 'open',
    start: null,
    task,
    overdue: isOverdue(task, today),
  };
}

/**
 * The order of a list: what is still open before what is done or skipped, the more
 * important first, all day before timed, earlier before later, then by title.
 */
export function compareItems(a: CalendarItem, b: CalendarItem): number {
  const settled = (i: CalendarItem) => (i.state === 'open' ? 0 : 1);
  return (
    settled(a) - settled(b) ||
    b.importance - a.importance ||
    (a.start ?? -1) - (b.start ?? -1) ||
    a.title.localeCompare(b.title) ||
    a.key.localeCompare(b.key)
  );
}

/** Tasks due from `from` to `to` (inclusive), each on its due day. */
export function tasksBetween(tasks: readonly Task[], from: string, to: string, today: string): TaskItem[] {
  return tasks
    .filter((t) => t.dueDate !== null && t.dueDate >= from && t.dueDate <= to)
    .map((t) => taskItem(t, today));
}

/** Entries and (when given) tasks from `from` to `to`, grouped by day, each day in list order. */
export function itemsByDay(
  events: readonly CalendarEvent[],
  categories: readonly CalendarCategory[],
  tasks: readonly Task[] | null,
  from: string,
  to: string,
  today: string,
): Map<string, CalendarItem[]> {
  const out = new Map<string, CalendarItem[]>();
  for (const [day, list] of byDay(occurrencesBetween(events, categories, from, to))) out.set(day, list.map(eventItem));
  for (const item of tasks ? tasksBetween(tasks, from, to, today) : []) {
    const list = out.get(item.day);
    if (list) list.push(item);
    else out.set(item.day, [item]);
  }
  for (const list of out.values()) list.sort(compareItems);
  return out;
}

/** How many marks a day cell shows; the rest is a "+n". */
export const ITEM_MARKS_MAX = 3;

export interface ItemSummary {
  /** The most important items not skipped, at most ITEM_MARKS_MAX. */
  marks: CalendarItem[];
  more: number;
  /** The highest level among open items; null when nothing is open. */
  top: ImportanceLevel | null;
  /** Items not skipped. */
  total: number;
}

export function itemSummary(items: readonly CalendarItem[]): ItemSummary {
  const shown = items.filter((i) => i.state !== 'skipped').sort(compareItems);
  const open = shown.filter((i) => i.state === 'open');
  return {
    marks: shown.slice(0, ITEM_MARKS_MAX),
    more: Math.max(0, shown.length - ITEM_MARKS_MAX),
    top: open[0]?.level ?? null,
    total: shown.length,
  };
}

// ── Today: "Ważne dzisiaj" ───────────────────────────────────────────────────

/** How many items Today's card lists before "więcej w kalendarzu". */
export const TODAY_ITEMS_MAX = 5;

export interface ImportantToday {
  /** Open items, the most important first (at most TODAY_ITEMS_MAX). */
  items: CalendarItem[];
  /** Open items beyond those. */
  more: number;
  /** Items of today already done (or skipped). */
  settled: number;
}

/**
 * Today's entries and tasks for the card: what is still open, the most important
 * first. Overdue tasks belong here too (listed today, marked overdue): they are
 * what matters now.
 */
export function importantToday(
  events: readonly CalendarEvent[],
  categories: readonly CalendarCategory[],
  tasks: readonly Task[],
  today: string,
): ImportantToday {
  const occurrences = occurrencesBetween(events, categories, today, today).map(eventItem);
  const dueTasks = tasks
    .filter((t) => t.dueDate === today || isOverdue(t, today))
    .map((t) => taskItem(t, today, today));
  const all = [...occurrences, ...dueTasks].sort(compareItems);
  const open = all.filter((i) => i.state === 'open');
  return {
    items: open.slice(0, TODAY_ITEMS_MAX),
    more: Math.max(0, open.length - TODAY_ITEMS_MAX),
    settled: all.length - open.length,
  };
}
