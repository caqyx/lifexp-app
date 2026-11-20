// Calendar entries and their categories (docs/v2/PLAN.md 9.1, row c-1). New in v2,
// nothing in v1 reads them: users/{uid}/calendarEvents and calendarCategories. An
// entry is a day (the device's local calendar, like tasks, G13), all day or from–to
// a wall-clock time, once or repeating; one occurrence can be ticked done or skipped.
// Ticking gives no points and touches no balance or statistics. Pure.
import { addDays, daysInMonth, isoWeekday, monthKeyOfDay, parseClock } from '@/lib/dates';

export const EVENT_TITLE_MAX = 80;
export const CATEGORY_NAME_MAX = 40;
export const EVENTS_MAX = 500;
export const CATEGORIES_MAX = 30;
/** A category's own weight: 0 (none) … 5. */
export const CATEGORY_IMPORTANCE_MAX = 5;
/** Extra points on one entry, on top of its category: 0 … 5. */
export const EXTRA_IMPORTANCE_MAX = 5;

/** Category colours: names of the theme's palette (tokens.css --palette-*), not hex values. */
export const CATEGORY_COLORS = ['violet', 'blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink'] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];
export const isCategoryColor = (value: unknown): value is CategoryColor =>
  (CATEGORY_COLORS as readonly unknown[]).includes(value);

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'monthly';
export const REPEAT_KINDS: readonly RepeatKind[] = ['none', 'daily', 'weekly', 'monthly'];

/** 1 = Monday … 7 = Sunday (lib/dates isoWeekday). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
export const isWeekday = (value: unknown): value is Weekday => (WEEKDAYS as readonly unknown[]).includes(value);

export interface Repeat {
  kind: RepeatKind;
  /** 'weekly': the days it happens on, sorted; empty for the other kinds. */
  weekdays: readonly Weekday[];
  /** The last day it may happen on; null = no end. */
  until: string | null;
}

/** What happened to one occurrence. */
export type OccurrenceMark = 'done' | 'skipped';

/** users/{uid}/calendarCategories/{id}. */
export interface CalendarCategory {
  id: string;
  name: string;
  color: CategoryColor;
  /** 0 … CATEGORY_IMPORTANCE_MAX. */
  importance: number;
  createdAt: Date | null;
}

/** users/{uid}/calendarEvents/{id}. */
export interface CalendarEvent {
  id: string;
  title: string;
  /** null = no category (also when its category was deleted). */
  categoryId: string | null;
  /** 0 … EXTRA_IMPORTANCE_MAX. */
  extraImportance: number;
  /** Local "YYYY-MM-DD": the day, or the first day of a repeating entry. */
  date: string;
  /** Minutes after midnight; null = all day. */
  start: number | null;
  /** Minutes after midnight, after start; null = no end given (or all day). */
  end: number | null;
  repeat: Repeat;
  /** Ticked or skipped occurrences, by their day. */
  marks: Readonly<Record<string, OccurrenceMark>>;
  createdAt: Date | null;
}

/** An entry's own values, as the sheet edits them (no id, marks or createdAt). */
export type EventValues = Omit<CalendarEvent, 'id' | 'marks' | 'createdAt'>;

/** What the entry sheet holds: strings as the inputs give them. */
export interface EventDraft {
  title: string;
  categoryId: string | null;
  extraImportance: number;
  date: string;
  allDay: boolean;
  /** "HH:mm" or "". */
  start: string;
  /** "HH:mm" or "" (no end). */
  end: string;
  repeat: RepeatKind;
  weekdays: readonly Weekday[];
  /** "" = no end. */
  until: string;
}

export type EventProblem =
  | 'titleRequired'
  | 'dateRequired'
  | 'startRequired'
  | 'endBeforeStart'
  | 'weekdaysRequired'
  | 'untilBeforeDate';

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)));

export function clampExtraImportance(value: number): number {
  return clamp(value, EXTRA_IMPORTANCE_MAX);
}

export function clampCategoryImportance(value: number): number {
  return clamp(value, CATEGORY_IMPORTANCE_MAX);
}

export function eventProblem(draft: EventDraft): EventProblem | null {
  if (!draft.title.trim()) return 'titleRequired';
  if (!draft.date) return 'dateRequired';
  if (!draft.allDay) {
    const start = parseClock(draft.start);
    if (start === null) return 'startRequired';
    const end = draft.end ? parseClock(draft.end) : null;
    if (draft.end && (end === null || end <= start)) return 'endBeforeStart';
  }
  if (draft.repeat === 'weekly' && draft.weekdays.length === 0) return 'weekdaysRequired';
  if (draft.repeat !== 'none' && draft.until && draft.until < draft.date) return 'untilBeforeDate';
  return null;
}

/** The values to store for a draft eventProblem accepted. */
export function eventValues(draft: EventDraft): EventValues {
  const start = draft.allDay ? null : parseClock(draft.start);
  const end = start === null || !draft.end ? null : parseClock(draft.end);
  return {
    title: draft.title.trim(),
    categoryId: draft.categoryId,
    extraImportance: clampExtraImportance(draft.extraImportance),
    date: draft.date,
    start,
    end,
    repeat: {
      kind: draft.repeat,
      weekdays: draft.repeat === 'weekly' ? [...new Set(draft.weekdays)].sort((a, b) => a - b) : [],
      until: draft.repeat === 'none' || !draft.until ? null : draft.until,
    },
  };
}

/** A new entry on `day`: all day, once, no category. */
export function emptyEventDraft(day: string): EventDraft {
  return {
    title: '',
    categoryId: null,
    extraImportance: 0,
    date: day,
    allDay: true,
    start: '',
    end: '',
    repeat: 'none',
    weekdays: [isoWeekday(day) as Weekday],
    until: '',
  };
}

const clock = (minutes: number | null) => {
  if (minutes === null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

/** The sheet's draft for an existing entry. */
export function eventDraft(event: CalendarEvent): EventDraft {
  return {
    title: event.title,
    categoryId: event.categoryId,
    extraImportance: event.extraImportance,
    date: event.date,
    allDay: event.start === null,
    start: clock(event.start),
    end: clock(event.end),
    repeat: event.repeat.kind,
    weekdays: event.repeat.kind === 'weekly' ? event.repeat.weekdays : [isoWeekday(event.date) as Weekday],
    until: event.repeat.until ?? '',
  };
}

export function canAddEvent(events: readonly CalendarEvent[]): boolean {
  return events.length < EVENTS_MAX;
}

// ── Recurrence ───────────────────────────────────────────────────────────────

/**
 * The entry happens on `day`. Monthly entries keep their day of the month; in a
 * month too short for it (the 31st in April, the 29th–31st in February) they
 * happen on its last day instead of being lost.
 */
export function occursOn(event: CalendarEvent, day: string): boolean {
  if (day < event.date) return false;
  const { kind, weekdays, until } = event.repeat;
  if (until !== null && day > until) return false;
  switch (kind) {
    case 'none':
      return day === event.date;
    case 'daily':
      return true;
    case 'weekly':
      return (weekdays.length > 0 ? weekdays : [isoWeekday(event.date)]).includes(isoWeekday(day) as Weekday);
    case 'monthly': {
      const wanted = Number(event.date.slice(8));
      return Number(day.slice(8)) === Math.min(wanted, daysInMonth(monthKeyOfDay(day)));
    }
  }
}

/** Longest range expanded at once (a year and a bit): a guard, not a feature. */
export const RANGE_DAYS_MAX = 400;

/** The days from `from` to `to` (inclusive) the entry happens on, in order. */
export function occurrenceDays(event: CalendarEvent, from: string, to: string): string[] {
  const first = from > event.date ? from : event.date;
  const until = event.repeat.until;
  const last = until !== null && until < to ? until : to;
  if (event.repeat.kind === 'none') return first <= event.date && event.date <= last ? [event.date] : [];
  const out: string[] = [];
  for (let day = first, n = 0; day <= last && n < RANGE_DAYS_MAX; day = addDays(day, 1), n += 1) {
    if (occursOn(event, day)) out.push(day);
  }
  return out;
}

// ── Categories ───────────────────────────────────────────────────────────────

export interface CategoryDraft {
  name: string;
  color: CategoryColor;
  importance: number;
}

export type CategoryProblem = 'nameRequired' | 'nameTaken' | 'limit';

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** A name, unique among the other categories (case does not count). */
export function categoryProblem(
  draft: CategoryDraft,
  categories: readonly CalendarCategory[],
  editingId: string | null = null,
): CategoryProblem | null {
  if (!draft.name.trim()) return 'nameRequired';
  if (categories.some((c) => c.id !== editingId && sameName(c.name, draft.name))) return 'nameTaken';
  if (editingId === null && categories.length >= CATEGORIES_MAX) return 'limit';
  return null;
}

export function categoryValues(draft: CategoryDraft): CategoryDraft {
  return { name: draft.name.trim(), color: draft.color, importance: clampCategoryImportance(draft.importance) };
}

/** A new category gets the first colour no other category uses yet. */
export function emptyCategoryDraft(categories: readonly CalendarCategory[]): CategoryDraft {
  const used = new Set(categories.map((c) => c.color));
  return { name: '', color: CATEGORY_COLORS.find((c) => !used.has(c)) ?? CATEGORY_COLORS[0], importance: 1 };
}

/** Categories by name, in the language's order. */
export function sortedCategories(categories: readonly CalendarCategory[], locale: string): CalendarCategory[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name, locale));
}
