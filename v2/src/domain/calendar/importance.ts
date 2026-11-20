// How important a calendar entry is (docs/v2/PLAN.md 9.1, row c-1; owner's decision
// 2): its category's own weight plus the entry's extra points. The total decides two
// things — how many in-app reminders it gets (reminders.ts) and where it stands and
// how strongly it shows (higher in Today and in the lists, a stronger look). Pure.
import type { CalendarCategory, CalendarEvent } from './events';
import { CATEGORY_IMPORTANCE_MAX, EXTRA_IMPORTANCE_MAX } from './events';

export const IMPORTANCE_MAX = CATEGORY_IMPORTANCE_MAX + EXTRA_IMPORTANCE_MAX;

export type ImportanceLevel = 'low' | 'medium' | 'high' | 'critical';
export const IMPORTANCE_LEVELS: readonly ImportanceLevel[] = ['low', 'medium', 'high', 'critical'];

/**
 * The lowest total of each level:
 *
 * | total | level    |
 * |-------|----------|
 * | 0–1   | low      |
 * | 2–4   | medium   |
 * | 5–7   | high     |
 * | 8–10  | critical |
 */
export const LEVEL_FROM: Readonly<Record<ImportanceLevel, number>> = { low: 0, medium: 2, high: 5, critical: 8 };

export function importanceLevel(total: number): ImportanceLevel {
  if (total >= LEVEL_FROM.critical) return 'critical';
  if (total >= LEVEL_FROM.high) return 'high';
  if (total >= LEVEL_FROM.medium) return 'medium';
  return 'low';
}

/** The category's weight (0 without one) plus the entry's extra points, 0 … IMPORTANCE_MAX. */
export function totalImportance(event: Pick<CalendarEvent, 'extraImportance'>, category: CalendarCategory | null): number {
  const sum = (category?.importance ?? 0) + event.extraImportance;
  return Math.max(0, Math.min(IMPORTANCE_MAX, sum));
}

/** Where a level stands, for ordering: 0 = low … 3 = critical. */
export function levelRank(level: ImportanceLevel): number {
  return IMPORTANCE_LEVELS.indexOf(level);
}
