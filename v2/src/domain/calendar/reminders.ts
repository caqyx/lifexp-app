// When an occurrence reminds (docs/v2/PLAN.md 9.1, rows c-1 and c-3; owner's decision
// 2): the more important, the more often. In-app only — the notification banner
// shows while the app is open — and computed here, from the occurrence alone. Pure,
// apart from the device's clock rules (lib/dates localInstant): wall-clock times
// stay wall-clock times across a DST change.
import { addDays, localInstant } from '@/lib/dates';
import type { ImportanceLevel } from './importance';

/** "Rano": the morning reminder of the day, local time. */
export const MORNING_MINUTES = 8 * 60;
/** "Wieczorem": reminders on the days before, local time. */
export const EVENING_MINUTES = 19 * 60;
/** Two reminders closer than this become one (the later, nearer the start). */
export const REMINDER_MIN_GAP_MINUTES = 30;

export type ReminderKind =
  /** Two days before, in the evening. */
  | 'twoDaysBefore'
  /** The day before, in the evening. */
  | 'dayBefore'
  /** In the morning of the day. */
  | 'morning'
  /** An hour before the start (timed entries only). */
  | 'hourBefore'
  /** Fifteen minutes before the start (timed entries only). */
  | 'quarterBefore';

/**
 * The reminders of each level. An all-day entry has no start, so the reminders
 * before a start become the morning one.
 *
 * | level    | timed                                              | all day                         |
 * |----------|----------------------------------------------------|---------------------------------|
 * | low      | 1 h before                                         | morning                         |
 * | medium   | morning, 1 h before                                | morning                         |
 * | high     | day before, morning, 1 h before                    | day before, morning             |
 * | critical | 2 days before, day before, morning, 1 h, 15 min    | 2 days before, day before, morning |
 */
export const REMINDER_PLAN: Readonly<Record<ImportanceLevel, readonly ReminderKind[]>> = {
  low: ['hourBefore'],
  medium: ['morning', 'hourBefore'],
  high: ['dayBefore', 'morning', 'hourBefore'],
  critical: ['twoDaysBefore', 'dayBefore', 'morning', 'hourBefore', 'quarterBefore'],
};

export interface ReminderSubject {
  /** Local day of the occurrence. */
  day: string;
  /** Minutes after midnight; null = all day. */
  start: number | null;
  level: ImportanceLevel;
}

export interface Reminder {
  kind: ReminderKind;
  at: Date;
}

const MINUTE = 60_000;

function reminderAt(kind: ReminderKind, { day, start }: ReminderSubject): { kind: ReminderKind; at: Date } {
  if (start === null && (kind === 'hourBefore' || kind === 'quarterBefore')) {
    return { kind: 'morning', at: localInstant(day, MORNING_MINUTES) };
  }
  switch (kind) {
    case 'twoDaysBefore':
      return { kind, at: localInstant(addDays(day, -2), EVENING_MINUTES) };
    case 'dayBefore':
      return { kind, at: localInstant(addDays(day, -1), EVENING_MINUTES) };
    case 'morning':
      return { kind, at: localInstant(day, MORNING_MINUTES) };
    case 'hourBefore':
      return { kind, at: new Date(localInstant(day, start ?? 0).getTime() - 60 * MINUTE) };
    case 'quarterBefore':
      return { kind, at: new Date(localInstant(day, start ?? 0).getTime() - 15 * MINUTE) };
  }
}

/**
 * The occurrence's reminders, earliest first. A timed entry is never reminded at or
 * after its start (an 07:30 walk gets no 08:00 "morning"), and reminders closer than
 * REMINDER_MIN_GAP_MINUTES become the later one.
 */
export function remindersFor(subject: ReminderSubject): Reminder[] {
  const startAt = subject.start === null ? null : localInstant(subject.day, subject.start).getTime();
  const all = REMINDER_PLAN[subject.level]
    .map((kind) => reminderAt(kind, subject))
    .filter((r) => startAt === null || r.at.getTime() < startAt)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const kept: Reminder[] = [];
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const r = all[i]!;
    const next = kept[0];
    if (next && next.at.getTime() - r.at.getTime() < REMINDER_MIN_GAP_MINUTES * MINUTE) continue;
    kept.unshift(r);
  }
  return kept;
}
