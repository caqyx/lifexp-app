// What the calendar shows (docs/v2/PLAN.md 9.1, row c-1): occurrences of the entries
// in a range of days, in the order a person should see them — the most important
// first — the month's grid with each day's marks, and timed blocks of a day laid out
// side by side where they overlap. Pure.
import { addDays, daysInMonth, isoWeekday, monthKeyOfDay } from '@/lib/dates';
import { occurrenceDays, type CalendarCategory, type CalendarEvent, type OccurrenceMark } from './events';
import { importanceLevel, totalImportance, type ImportanceLevel } from './importance';

/** One day of one entry. */
export interface Occurrence {
  /** `${eventId}@${day}`: unique among occurrences. */
  key: string;
  event: CalendarEvent;
  category: CalendarCategory | null;
  day: string;
  /** Minutes after midnight; null = all day. */
  start: number | null;
  end: number | null;
  mark: OccurrenceMark | null;
  importance: number;
  level: ImportanceLevel;
}

export function occurrenceOf(
  event: CalendarEvent,
  day: string,
  categories: ReadonlyMap<string, CalendarCategory>,
): Occurrence {
  const category = event.categoryId === null ? null : (categories.get(event.categoryId) ?? null);
  const importance = totalImportance(event, category);
  return {
    key: `${event.id}@${day}`,
    event,
    category,
    day,
    start: event.start,
    end: event.end,
    mark: event.marks[day] ?? null,
    importance,
    level: importanceLevel(importance),
  };
}

export function categoryIndex(categories: readonly CalendarCategory[]): Map<string, CalendarCategory> {
  return new Map(categories.map((c) => [c.id, c]));
}

/**
 * The order of a list (a day's agenda, Today's card): what is still to do before
 * what is done or skipped, then the most important first, then all-day entries
 * before timed ones, earlier before later, and by title.
 */
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  const settled = (o: Occurrence) => (o.mark === null ? 0 : 1);
  return (
    settled(a) - settled(b) ||
    b.importance - a.importance ||
    (a.start ?? -1) - (b.start ?? -1) ||
    a.event.title.localeCompare(b.event.title) ||
    a.key.localeCompare(b.key)
  );
}

/** Every occurrence from `from` to `to` (inclusive), by day, each day in list order. */
export function occurrencesBetween(
  events: readonly CalendarEvent[],
  categories: readonly CalendarCategory[],
  from: string,
  to: string,
): Occurrence[] {
  const index = categoryIndex(categories);
  const out: Occurrence[] = [];
  for (const event of events) {
    for (const day of occurrenceDays(event, from, to)) out.push(occurrenceOf(event, day, index));
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || compareOccurrences(a, b));
}

/** Occurrences grouped by day (only days that have any). */
export function byDay(occurrences: readonly Occurrence[]): Map<string, Occurrence[]> {
  const out = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    const list = out.get(o.day);
    if (list) list.push(o);
    else out.set(o.day, [o]);
  }
  return out;
}

export interface DayAgenda {
  allDay: Occurrence[];
  timed: Occurrence[];
}

/** One day split into the all-day row and the timeline; both in list order (timed by time). */
export function dayAgenda(occurrences: readonly Occurrence[]): DayAgenda {
  const sorted = [...occurrences].sort(compareOccurrences);
  return {
    allDay: sorted.filter((o) => o.start === null),
    timed: sorted
      .filter((o) => o.start !== null)
      .sort((a, b) => (a.start ?? 0) - (b.start ?? 0) || compareOccurrences(a, b)),
  };
}

// ── Month grid ───────────────────────────────────────────────────────────────

export interface MonthGrid {
  /** Whole weeks, Monday first; days of the neighbouring months fill the first and last. */
  weeks: string[][];
  first: string;
  last: string;
}

export function monthGrid(monthKey: string): MonthGrid {
  const first = `${monthKey}-01`;
  const last = `${monthKey}-${String(daysInMonth(monthKey)).padStart(2, '0')}`;
  const start = addDays(first, 1 - isoWeekday(first));
  const end = addDays(last, 7 - isoWeekday(last));
  const weeks: string[][] = [];
  for (let day = start; day <= end; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
  }
  return { weeks, first, last };
}

export const inMonth = (day: string, monthKey: string) => monthKeyOfDay(day) === monthKey;

/** How many marks a day cell of the month shows; the rest is a "+n". */
export const DAY_MARKS_MAX = 3;

export interface DaySummary {
  /** The most important occurrences still to do, at most DAY_MARKS_MAX. */
  marks: Occurrence[];
  /** Occurrences not among the marks. */
  more: number;
  /** The highest level of the day's open occurrences; null when there are none. */
  top: ImportanceLevel | null;
  total: number;
}

export function daySummary(occurrences: readonly Occurrence[]): DaySummary {
  const open = [...occurrences].filter((o) => o.mark !== 'skipped').sort(compareOccurrences);
  const todo = open.filter((o) => o.mark === null);
  return {
    marks: open.slice(0, DAY_MARKS_MAX),
    more: Math.max(0, open.length - DAY_MARKS_MAX),
    top: todo[0]?.level ?? null,
    total: open.length,
  };
}

// ── Timeline ─────────────────────────────────────────────────────────────────

/** A timed entry without an end takes this long on the timeline. */
export const DEFAULT_DURATION = 60;
/** Shortest block drawn, so a 5-minute entry is still a target. */
export const MIN_BLOCK = 30;

export interface TimelineBlock {
  occurrence: Occurrence;
  /** Minutes after midnight. */
  top: number;
  /** Minutes. */
  length: number;
  /** Column within its group of overlapping blocks, 0-based. */
  column: number;
  /** Columns of that group. */
  columns: number;
}

/**
 * Timed occurrences as blocks: overlapping ones share the width in columns (each
 * takes the first free column), the rest use all of it.
 */
export function layoutTimeline(occurrences: readonly Occurrence[]): TimelineBlock[] {
  const items = occurrences
    .filter((o) => o.start !== null)
    .map((o) => {
      const top = o.start ?? 0;
      const end = Math.min(24 * 60, Math.max(top + MIN_BLOCK, o.end ?? top + DEFAULT_DURATION));
      return { occurrence: o, top, end };
    })
    .sort((a, b) => a.top - b.top || b.end - a.end || compareOccurrences(a.occurrence, b.occurrence));

  const out: TimelineBlock[] = [];
  let group: { block: TimelineBlock; end: number }[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    const columns = Math.max(1, ...group.map((g) => g.block.column + 1));
    for (const g of group) out.push({ ...g.block, columns });
    group = [];
  };
  for (const item of items) {
    if (item.top >= groupEnd && group.length > 0) closeGroup();
    const taken = new Set(group.filter((g) => g.end > item.top).map((g) => g.block.column));
    let column = 0;
    while (taken.has(column)) column += 1;
    group.push({
      block: { occurrence: item.occurrence, top: item.top, length: item.end - item.top, column, columns: 1 },
      end: item.end,
    });
    groupEnd = Math.max(groupEnd, item.end);
  }
  if (group.length > 0) closeGroup();
  return out;
}
