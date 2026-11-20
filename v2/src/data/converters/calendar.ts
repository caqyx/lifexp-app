// calendarEvents and calendarCategories documents ↔ domain values (docs/v2/PLAN.md
// 9.1, row c-1). New collections, written only by v2 (v1 does not read them). Every
// field is read with a default, so a field added later is simply missing in older
// documents; fields are flat strings and numbers, so they stay easy to extend.
import type { DocumentData } from 'firebase/firestore';
import {
  clampCategoryImportance,
  clampExtraImportance,
  isCategoryColor,
  isWeekday,
  REPEAT_KINDS,
  type CalendarCategory,
  type CalendarEvent,
  type CategoryDraft,
  type EventValues,
  type OccurrenceMark,
  type RepeatKind,
  type Weekday,
} from '@/domain/calendar/events';
import { clockValue, localDayKey, parseClock } from '@/lib/dates';
import { dateOrNull, dayKeyOrNull, nonEmptyStringOrNull, numberOr, stringOr } from './fields';

function repeatKindOr(value: unknown): RepeatKind {
  return REPEAT_KINDS.includes(value as RepeatKind) ? (value as RepeatKind) : 'none';
}

function weekdaysOf(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isWeekday))].sort((a, b) => a - b);
}

function marksOf(value: unknown): Record<string, OccurrenceMark> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, OccurrenceMark> = {};
  for (const [day, mark] of Object.entries(value as Record<string, unknown>)) {
    if (dayKeyOrNull(day) && (mark === 'done' || mark === 'skipped')) out[day] = mark;
  }
  return out;
}

const minutesOrNull = (value: unknown) => (typeof value === 'string' ? parseClock(value) : null);

export function eventFromData(id: string, data: DocumentData): CalendarEvent {
  const start = minutesOrNull(data.startTime);
  const end = start === null ? null : minutesOrNull(data.endTime);
  const kind = repeatKindOr(data.repeat);
  return {
    id,
    title: stringOr(data.title),
    categoryId: nonEmptyStringOrNull(data.categoryId),
    extraImportance: clampExtraImportance(numberOr(data.extraImportance)),
    // A document without a day is shown on the day it was made, never lost.
    date: dayKeyOrNull(data.date) ?? localDayKey(dateOrNull(data.createdAt) ?? new Date(0)),
    start,
    end: end !== null && end > (start ?? 0) ? end : null,
    repeat: {
      kind,
      weekdays: kind === 'weekly' ? weekdaysOf(data.weekdays) : [],
      until: kind === 'none' ? null : dayKeyOrNull(data.repeatUntil),
    },
    marks: marksOf(data.marks),
    createdAt: dateOrNull(data.createdAt),
  };
}

/** The entry's own fields (everything but marks and createdAt), as stored. */
export function eventValuesData(values: EventValues): DocumentData {
  return {
    title: values.title,
    categoryId: values.categoryId ?? '',
    extraImportance: values.extraImportance,
    date: values.date,
    startTime: values.start === null ? '' : clockValue(values.start),
    endTime: values.end === null ? '' : clockValue(values.end),
    repeat: values.repeat.kind,
    weekdays: [...values.repeat.weekdays],
    repeatUntil: values.repeat.until ?? '',
  };
}

export function newEventData(values: EventValues, now: Date): DocumentData {
  return { ...eventValuesData(values), marks: {}, createdAt: now.toISOString() };
}

/** Undo of a delete: the same document again. */
export function eventData(event: CalendarEvent): DocumentData {
  return {
    ...eventValuesData(event),
    marks: { ...event.marks },
    createdAt: (event.createdAt ?? new Date()).toISOString(),
  };
}

export function categoryFromData(id: string, data: DocumentData): CalendarCategory {
  return {
    id,
    name: stringOr(data.name),
    color: isCategoryColor(data.color) ? data.color : 'violet',
    importance: clampCategoryImportance(numberOr(data.importance)),
    createdAt: dateOrNull(data.createdAt),
  };
}

export function categoryValuesData(draft: CategoryDraft): DocumentData {
  return { name: draft.name, color: draft.color, importance: draft.importance };
}

export function newCategoryData(draft: CategoryDraft, now: Date): DocumentData {
  return { ...categoryValuesData(draft), createdAt: now.toISOString() };
}

export function categoryData(category: CalendarCategory): DocumentData {
  return { ...categoryValuesData(category), createdAt: (category.createdAt ?? new Date()).toISOString() };
}
