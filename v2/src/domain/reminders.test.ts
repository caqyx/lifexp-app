import { describe, expect, test } from 'vitest';
import type { DayLog } from './activity';
import type { ChoreEntry } from './chores';
import {
  CHORES_REMINDER_LAST_DAYS,
  REMINDERS_PER_DAY,
  STREAK_REMINDER_MIN,
  choresDue,
  daysLeftInMonth,
  pickReminder,
  streakAtRisk,
  type ReminderInput,
} from './reminders';

// Tuesday 27 October 2026, 19:00 in Warsaw (18:00 UTC).
const NOW = new Date('2026-10-27T18:00:00Z');
const TODAY = '2026-10-27';
/** Used 3 days ago: no freeze available, so a gap would end the streak. */
const FREEZE_USED = '2026-10-24';

const logs = (keys: string[], points = 10): Map<string, DayLog> =>
  new Map(keys.map((k) => [k, { pointsEarned: points, gamingMinutes: 0 }]));

const entry = (dateISO: string): ChoreEntry => ({
  id: dateISO,
  choreId: 'x',
  name: 'Zmywanie',
  emoji: '',
  points: 5,
  dateISO,
  monthKey: dateISO.slice(0, 7),
  createdAt: null,
});

function input(over: Partial<ReminderInput> = {}): ReminderInput {
  return {
    modules: { enabledModules: null, disabledModules: null },
    notifHours: [19],
    hour: 19,
    todayUtc: TODAY,
    todayLocal: TODAY,
    now: NOW,
    streakFreezeLastUsed: FREEZE_USED,
    days: logs(['2026-10-25', '2026-10-26']),
    choreDefs: 0,
    choreEntries: [],
    sentToday: { kinds: [], hours: [] },
    lastChoresReminder: null,
    ...over,
  };
}

describe('streakAtRisk (G3 days, UTC)', () => {
  test.each([
    ['two days up to yesterday, nothing today', ['2026-10-25', '2026-10-26'], 2],
    ['three days', ['2026-10-24', '2026-10-25', '2026-10-26'], 3],
    [`one day is below ${STREAK_REMINDER_MIN}`, ['2026-10-26'], null],
    ['yesterday empty: the streak is already gone', ['2026-10-24', '2026-10-25'], null],
    ['points today: safe', ['2026-10-25', '2026-10-26', TODAY], null],
  ])('%s', (_name, keys, expected) => {
    expect(streakAtRisk(input({ days: logs(keys) }))).toBe(expected);
  });

  test('a freeze that would bridge today means no reminder', () => {
    expect(streakAtRisk(input({ streakFreezeLastUsed: null }))).toBeNull();
    expect(streakAtRisk(input({ streakFreezeLastUsed: '2026-10-01' }))).toBeNull();
  });

  test('a day log with 0 points does not count as done today', () => {
    const days = logs(['2026-10-25', '2026-10-26']);
    days.set(TODAY, { pointsEarned: 0, gamingMinutes: 30 });
    expect(streakAtRisk(input({ days }))).toBe(2);
  });

  test('the day boundary is the UTC day: after 1:00 in Warsaw (winter) the next day counts', () => {
    // 0:30 on the 28th in Warsaw is still the 27th in UTC: today has points, nothing at risk.
    const days = logs(['2026-10-25', '2026-10-26', TODAY]);
    expect(streakAtRisk(input({ days, todayUtc: TODAY, now: new Date('2026-10-27T23:30:00Z') }))).toBeNull();
    // 1:30 on the 28th in Warsaw is the 28th in UTC: nothing yet, the 3-day streak is at risk.
    expect(streakAtRisk(input({ days, todayUtc: '2026-10-28', now: new Date('2026-10-28T00:30:00Z') }))).toBe(3);
  });
});

describe('choresDue', () => {
  const due = (over: Partial<ReminderInput>) => choresDue(input({ choreDefs: 4, ...over }));

  test('days left in the month', () => {
    expect(daysLeftInMonth('2026-10-31')).toBe(0);
    expect(daysLeftInMonth('2026-10-25')).toBe(6);
    expect(daysLeftInMonth('2026-02-22')).toBe(6);
    expect(daysLeftInMonth('2028-02-22')).toBe(7);
  });

  test(`only in the last ${CHORES_REMINDER_LAST_DAYS} days of the month`, () => {
    expect(due({ todayLocal: '2026-10-24' })).toBe(false);
    expect(due({ todayLocal: '2026-10-25' })).toBe(true);
    expect(due({ todayLocal: '2026-10-31' })).toBe(true);
  });

  test('only with chores defined', () => {
    expect(due({ choreDefs: 0 })).toBe(false);
  });

  test('not when a chore was logged in the last 3 days', () => {
    expect(due({ choreEntries: [entry('2026-10-25')] })).toBe(false);
    expect(due({ choreEntries: [entry('2026-10-24')] })).toBe(true);
  });

  test('at most every second day', () => {
    expect(due({ lastChoresReminder: '2026-10-26' })).toBe(false);
    expect(due({ lastChoresReminder: '2026-10-25' })).toBe(true);
  });
});

describe('pickReminder', () => {
  test('only at one of the chosen hours (Warsaw clock)', () => {
    expect(pickReminder(input({ hour: 18 }))?.kind).toBeUndefined();
    expect(pickReminder(input())).toEqual({ kind: 'streak', days: 2 });
  });

  test('the streak first, then chores; each once a day', () => {
    const both = input({ choreDefs: 3 });
    expect(pickReminder(both)).toEqual({ kind: 'streak', days: 2 });
    expect(pickReminder({ ...both, notifHours: [19, 20], hour: 20, sentToday: { kinds: ['streak'], hours: [19] } })).toEqual({
      kind: 'chores',
      daysLeft: 4,
    });
  });

  test(`one per hour and ${REMINDERS_PER_DAY} per day`, () => {
    expect(pickReminder(input({ sentToday: { kinds: [], hours: [19] } }))).toBeNull();
    expect(pickReminder(input({ notifHours: [19, 21], hour: 21, sentToday: { kinds: ['streak', 'chores'], hours: [17, 19] } }))).toBeNull();
  });

  test('a module turned off gets no reminder', () => {
    const off = { enabledModules: ['money'], disabledModules: null };
    expect(pickReminder(input({ modules: off, choreDefs: 3 }))).toBeNull();
  });
});
