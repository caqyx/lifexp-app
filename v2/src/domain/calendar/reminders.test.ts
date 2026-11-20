import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { REMINDER_PLAN, remindersFor, type Reminder } from './reminders';

// Wall-clock times are checked in Poland, where the owner lives: summer time starts
// on 2026-03-29 and ends on 2026-10-25.
const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Warsaw';
});
afterAll(() => {
  process.env.TZ = zone;
});

/** "kind local-day HH:mm" for readable expectations. */
const local = (reminders: Reminder[]) =>
  reminders.map(({ kind, at }) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${kind} ${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
  });

describe('the reminder plan', () => {
  test('more important = more reminders', () => {
    const counts = (['low', 'medium', 'high', 'critical'] as const).map((l) => REMINDER_PLAN[l].length);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(new Set(counts).size).toBe(4);
  });

  test('low: an hour before; all day: in the morning', () => {
    expect(local(remindersFor({ day: '2026-11-20', start: 18 * 60, level: 'low' }))).toEqual(['hourBefore 2026-11-20 17:00']);
    expect(local(remindersFor({ day: '2026-11-20', start: null, level: 'low' }))).toEqual(['morning 2026-11-20 08:00']);
  });

  test('medium: the morning and an hour before; all day only once', () => {
    expect(local(remindersFor({ day: '2026-11-20', start: 18 * 60, level: 'medium' }))).toEqual([
      'morning 2026-11-20 08:00',
      'hourBefore 2026-11-20 17:00',
    ]);
    expect(local(remindersFor({ day: '2026-11-20', start: null, level: 'medium' }))).toEqual(['morning 2026-11-20 08:00']);
  });

  test('high: the evening before, the morning and an hour before', () => {
    expect(local(remindersFor({ day: '2026-11-20', start: 18 * 60, level: 'high' }))).toEqual([
      'dayBefore 2026-11-19 19:00',
      'morning 2026-11-20 08:00',
      'hourBefore 2026-11-20 17:00',
    ]);
  });

  test('critical: also two days before and 15 minutes before; the day before crosses a month end', () => {
    expect(local(remindersFor({ day: '2026-12-01', start: 18 * 60, level: 'critical' }))).toEqual([
      'twoDaysBefore 2026-11-29 19:00',
      'dayBefore 2026-11-30 19:00',
      'morning 2026-12-01 08:00',
      'hourBefore 2026-12-01 17:00',
      'quarterBefore 2026-12-01 17:45',
    ]);
    expect(local(remindersFor({ day: '2027-01-01', start: null, level: 'critical' }))).toEqual([
      'twoDaysBefore 2026-12-30 19:00',
      'dayBefore 2026-12-31 19:00',
      'morning 2027-01-01 08:00',
    ]);
  });

  test('never at or after the start: an early entry has no morning reminder', () => {
    expect(local(remindersFor({ day: '2026-11-20', start: 7 * 60 + 30, level: 'high' }))).toEqual([
      'dayBefore 2026-11-19 19:00',
      'hourBefore 2026-11-20 06:30',
    ]);
  });

  test('reminders closer than 30 minutes become the later one', () => {
    // 08:30: morning 08:00, an hour before 07:30, 15 min before 08:15 → 08:00 goes.
    expect(local(remindersFor({ day: '2026-11-20', start: 8 * 60 + 30, level: 'critical' }))).toEqual([
      'twoDaysBefore 2026-11-18 19:00',
      'dayBefore 2026-11-19 19:00',
      'hourBefore 2026-11-20 07:30',
      'quarterBefore 2026-11-20 08:15',
    ]);
  });

  test('an entry just after midnight is reminded before midnight', () => {
    expect(local(remindersFor({ day: '2026-11-20', start: 30, level: 'low' }))).toEqual(['hourBefore 2026-11-19 23:30']);
  });
});

describe('across DST changes', () => {
  test('the evening before stays 19:00 local and an hour before stays one hour (spring)', () => {
    const reminders = remindersFor({ day: '2026-03-29', start: 18 * 60, level: 'high' });
    expect(local(reminders)).toEqual([
      'dayBefore 2026-03-28 19:00',
      'morning 2026-03-29 08:00',
      'hourBefore 2026-03-29 17:00',
    ]);
    // The evening before is still winter time (UTC+1), the day itself summer time (UTC+2).
    expect(reminders.map((r) => r.at.toISOString())).toEqual([
      '2026-03-28T18:00:00.000Z',
      '2026-03-29T06:00:00.000Z',
      '2026-03-29T15:00:00.000Z',
    ]);
  });

  test('autumn: an entry at 02:30 on the change night is reminded one real hour before', () => {
    const [r] = remindersFor({ day: '2026-10-25', start: 2 * 60 + 30, level: 'low' });
    expect(r!.at.getTime()).toBe(new Date(2026, 9, 25, 2, 30).getTime() - 3_600_000);
  });

  test('a time skipped in spring still gets its reminder before the real start', () => {
    const [r] = remindersFor({ day: '2026-03-29', start: 2 * 60 + 30, level: 'low' });
    expect(r!.at.getTime()).toBeLessThan(new Date(2026, 2, 29, 3, 30).getTime());
  });
});
