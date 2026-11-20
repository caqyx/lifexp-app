import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  addDays,
  addMonths,
  clockValue,
  daysInMonth,
  formatClock,
  formatDayKey,
  formatDayMonth,
  formatDayShort,
  formatMonthKey,
  formatMonthShort,
  formatWeekdayLong,
  formatWeekdayShort,
  isoWeekday,
  localDayKey,
  localInstant,
  monthKeyOfDay,
  parseClock,
  utcDayKey,
  weekOf,
  zonedDayKey,
  zonedIsoMinutes,
} from './dates';

describe('day keys', () => {
  test('the UTC day is v1 todayStr: after 22:00 UTC it is already tomorrow in Poland, not in UTC', () => {
    expect(utcDayKey(new Date('2026-09-29T23:30:00Z'))).toBe('2026-09-29');
  });

  test('the local day follows the device', () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  test('adding days crosses months, years and leap days', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28'); // DST change in Europe: still one day
  });

  test('a week runs Monday to Sunday', () => {
    expect(weekOf('2026-09-29')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(weekOf('2026-10-04')[0]).toBe('2026-09-28'); // Sunday belongs to the week before
  });

  test('weekday names do not depend on the time zone', () => {
    expect(formatWeekdayShort('2026-09-28', 'en-GB')).toBe('Mon');
  });
});

describe('day key labels', () => {
  test('the calendar day of the key, whatever the device time zone', () => {
    expect(formatWeekdayLong('2026-09-30', 'pl-PL')).toBe('środa');
    expect(formatWeekdayLong('2026-09-30', 'en-GB')).toBe('Wednesday');
    expect(formatDayKey('2026-09-29', 'pl-PL')).toBe('wtorek, 29 września');
  });
});

describe('day and month labels', () => {
  test('the key\'s own calendar, whatever the time zone', () => {
    expect(formatDayMonth('2026-09-29', 'pl-PL')).toBe('29 września');
    expect(formatMonthKey('2026-09', 'pl-PL')).toBe('wrzesień 2026');
    expect(formatMonthKey('2027-01', 'en-GB')).toBe('January 2027');
  });
});

describe('zonedIsoMinutes', () => {
  test('reads the time in the given zone, to the minute', () => {
    expect(zonedIsoMinutes(new Date('2026-10-25T17:40:59Z'), 'Europe/Warsaw')).toBe('2026-10-25T18:40');
    expect(zonedIsoMinutes(new Date('2026-07-01T22:30:00Z'), 'Europe/Warsaw')).toBe('2026-07-02T00:30');
    expect(zonedIsoMinutes(new Date('2026-07-01T22:30:00Z'), 'UTC')).toBe('2026-07-01T22:30');
  });
});

describe('zonedDayKey', () => {
  test('the calendar day in the zone: after 22:00 UTC in summer it is already the next day in Warsaw', () => {
    expect(zonedDayKey(new Date('2026-07-05T21:59:00Z'), 'Europe/Warsaw')).toBe('2026-07-05');
    expect(zonedDayKey(new Date('2026-07-05T22:00:00Z'), 'Europe/Warsaw')).toBe('2026-07-06');
    expect(zonedDayKey(new Date('2026-12-06T23:00:00Z'), 'Europe/Warsaw')).toBe('2026-12-07');
  });
});

describe('calendar helpers', () => {
  test('ISO weekdays run Monday 1 to Sunday 7', () => {
    expect(isoWeekday('2026-11-16')).toBe(1);
    expect(isoWeekday('2026-11-20')).toBe(5);
    expect(isoWeekday('2026-11-22')).toBe(7);
  });

  test('months add across years, and know their length (leap years too)', () => {
    expect(monthKeyOfDay('2026-11-20')).toBe('2026-11');
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-03', -15)).toBe('2024-12');
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-04')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
  });

  test('wall-clock times parse strictly and print in the language', () => {
    expect(parseClock('18:00')).toBe(1080);
    expect(parseClock('00:00')).toBe(0);
    expect(parseClock('23:59')).toBe(1439);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('7:00')).toBeNull();
    expect(parseClock('')).toBeNull();
    expect(clockValue(1080)).toBe('18:00');
    expect(clockValue(65)).toBe('01:05');
    expect(formatClock(1080, 'pl-PL')).toBe('18:00');
    expect(formatClock(1080, 'en-GB')).toBe('18:00');
    expect(formatMonthShort('2026-11', 'pl-PL')).toBe('lis');
    expect(formatDayShort('2026-11-20', 'en-GB')).toBe('20 Nov');
  });

  describe('in Europe/Warsaw', () => {
    const zone = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = 'Europe/Warsaw';
    });
    afterAll(() => {
      process.env.TZ = zone;
    });

    test('a wall-clock time is the same local hour on both sides of a DST change', () => {
      // Summer time starts on 2026-03-29 and ends on 2026-10-25.
      expect(localInstant('2026-03-28', 18 * 60).toISOString()).toBe('2026-03-28T17:00:00.000Z');
      expect(localInstant('2026-03-29', 18 * 60).toISOString()).toBe('2026-03-29T16:00:00.000Z');
      expect(localInstant('2026-10-25', 18 * 60).toISOString()).toBe('2026-10-25T17:00:00.000Z');
      expect(localDayKey(localInstant('2026-03-29', 18 * 60))).toBe('2026-03-29');
    });

    test('a time skipped by the spring change moves on to the next valid one', () => {
      expect(localInstant('2026-03-29', 2 * 60 + 30).getHours()).toBe(3);
    });
  });
});
