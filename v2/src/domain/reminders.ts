// Push reminders (docs/v2/PLAN.md 9.1, row 6-7; owner's decision 4 of 2026-10-25):
// not v1's hourly "log something", only two cases where a nudge helps, at the hours
// the person chose (v1 notifHours, Warsaw clock), and few of them. Pure: the Cloud
// Function (functions/src/push) reads the data and sends; this decides.
import { addDays } from '@/lib/dates';
import type { DayLog } from './activity';
import type { ChoreEntry } from './chores';
import { isModuleOn, type ModuleChoice } from './modules';
import { streakOf } from './streak';

/** A streak worth a reminder: a single day is not one yet. */
export const STREAK_REMINDER_MIN = 2;
/** Chores: only in the last days of the month (the last 7, the 25th of a 31-day month on). */
export const CHORES_REMINDER_LAST_DAYS = 7;
/** Chores: only when nothing was logged in this many days (today included). */
export const CHORES_QUIET_DAYS = 3;
/** Chores: at most every second day. */
export const CHORES_REMINDER_EVERY_DAYS = 2;
/** At most this many reminders per person per (Warsaw) day, and one per hour. */
export const REMINDERS_PER_DAY = 2;

export type ReminderKind = 'streak' | 'chores';

export interface ReminderInput {
  modules: ModuleChoice;
  /** v1 notifHours (0–23, Warsaw clock); the reminder goes only at one of them. */
  notifHours: readonly number[];
  /** The hour now on the Warsaw clock. */
  hour: number;
  /** Today as the streak counts it: the UTC day (dailyLog keys, G13). */
  todayUtc: string;
  /** Today on the Warsaw calendar (chore entries are local days, G8). */
  todayLocal: string;
  now: Date;
  streakFreezeLastUsed: string | null;
  days: ReadonlyMap<string, DayLog>;
  /** How many chore definitions there are. */
  choreDefs: number;
  /** Unpaid chore entries (paid ones are gone, v1 deletes them). */
  choreEntries: readonly ChoreEntry[];
  /** What was already sent: today's kinds and hours, and the last day a chores reminder went. */
  sentToday: { kinds: readonly ReminderKind[]; hours: readonly number[] };
  lastChoresReminder: string | null;
}

/**
 * The streak would end today: it is at least STREAK_REMINDER_MIN days long (counted
 * up to yesterday, G3), today has no points yet, and no freeze would bridge today
 * (with one available, v2 and v1 would keep the streak anyway). Returns its length.
 */
export function streakAtRisk(input: Pick<ReminderInput, 'streakFreezeLastUsed' | 'days' | 'todayUtc' | 'now'>): number | null {
  if ((input.days.get(input.todayUtc)?.pointsEarned ?? 0) > 0) return null;
  const { streak, freezeAvailable } = streakOf(input.streakFreezeLastUsed, input.days, input.todayUtc, input.now);
  if (freezeAvailable) return null;
  return streak.days >= STREAK_REMINDER_MIN ? streak.days : null;
}

/** Days left in the month after `day` ("YYYY-MM-DD"): 0 on its last day. */
export function daysLeftInMonth(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate() - d;
}

/**
 * Chores near the month's end: in its last CHORES_REMINDER_LAST_DAYS days, with chores
 * defined, nothing logged in the last CHORES_QUIET_DAYS days, and not on the day
 * after a chores reminder (every CHORES_REMINDER_EVERY_DAYS days at most).
 */
export function choresDue(
  input: Pick<ReminderInput, 'todayLocal' | 'choreDefs' | 'choreEntries' | 'lastChoresReminder'>,
): boolean {
  if (input.choreDefs === 0) return false;
  if (daysLeftInMonth(input.todayLocal) >= CHORES_REMINDER_LAST_DAYS) return false;
  const quietSince = addDays(input.todayLocal, -(CHORES_QUIET_DAYS - 1));
  if (input.choreEntries.some((e) => e.dateISO >= quietSince && e.dateISO <= input.todayLocal)) return false;
  if (input.lastChoresReminder && input.lastChoresReminder > addDays(input.todayLocal, -CHORES_REMINDER_EVERY_DAYS)) return false;
  return true;
}

export type Reminder = { kind: 'streak'; days: number } | { kind: 'chores'; daysLeft: number };

/** What to send now, if anything: the streak first, each kind once a day, within the limits. */
export function pickReminder(input: ReminderInput): Reminder | null {
  if (!input.notifHours.includes(input.hour)) return null;
  if (input.sentToday.hours.includes(input.hour) || input.sentToday.kinds.length >= REMINDERS_PER_DAY) return null;
  if (isModuleOn('stats', input.modules) && !input.sentToday.kinds.includes('streak')) {
    const days = streakAtRisk(input);
    if (days !== null) return { kind: 'streak', days };
  }
  if (isModuleOn('chores', input.modules) && !input.sentToday.kinds.includes('chores') && choresDue(input)) {
    return { kind: 'chores', daysLeft: daysLeftInMonth(input.todayLocal) };
  }
  return null;
}
