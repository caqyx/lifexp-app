import { describe, expect, test } from 'vitest';
import {
  CATEGORIES_MAX,
  categoryProblem,
  categoryValues,
  emptyCategoryDraft,
  emptyEventDraft,
  eventDraft,
  eventProblem,
  eventValues,
  occurrenceDays,
  occursOn,
  type CalendarCategory,
  type EventDraft,
} from './events';
import { event, repeat } from './fixtures';

const draft = (patch: Partial<EventDraft> = {}): EventDraft => ({ ...emptyEventDraft('2026-11-20'), title: 'Spacer', ...patch });

describe('the entry sheet', () => {
  test('a title and a day are needed', () => {
    expect(eventProblem(draft({ title: '  ' }))).toBe('titleRequired');
    expect(eventProblem(draft({ date: '' }))).toBe('dateRequired');
    expect(eventProblem(draft())).toBeNull();
  });

  test('a timed entry needs its start; the end is optional but after the start', () => {
    expect(eventProblem(draft({ allDay: false, start: '' }))).toBe('startRequired');
    expect(eventProblem(draft({ allDay: false, start: '18:00' }))).toBeNull();
    expect(eventProblem(draft({ allDay: false, start: '18:00', end: '19:00' }))).toBeNull();
    expect(eventProblem(draft({ allDay: false, start: '18:00', end: '18:00' }))).toBe('endBeforeStart');
    expect(eventProblem(draft({ allDay: false, start: '18:00', end: '17:30' }))).toBe('endBeforeStart');
    // Times of an all-day entry are ignored.
    expect(eventProblem(draft({ allDay: true, start: 'x', end: 'y' }))).toBeNull();
  });

  test('weekly needs a weekday; an end of the repetition is not before the first day', () => {
    expect(eventProblem(draft({ repeat: 'weekly', weekdays: [] }))).toBe('weekdaysRequired');
    expect(eventProblem(draft({ repeat: 'daily', until: '2026-11-19' }))).toBe('untilBeforeDate');
    expect(eventProblem(draft({ repeat: 'daily', until: '2026-11-20' }))).toBeNull();
    expect(eventProblem(draft({ repeat: 'none', until: '2026-01-01' }))).toBeNull();
  });

  test('values: trimmed, times in minutes, weekdays only for weekly, sorted and unique', () => {
    expect(
      eventValues(
        draft({
          title: '  Spacer ',
          allDay: false,
          start: '18:00',
          end: '19:15',
          repeat: 'weekly',
          weekdays: [5, 1, 3, 1],
          until: '',
          extraImportance: 9,
        }),
      ),
    ).toEqual({
      title: 'Spacer',
      categoryId: null,
      extraImportance: 5,
      date: '2026-11-20',
      start: 1080,
      end: 1155,
      repeat: { kind: 'weekly', weekdays: [1, 3, 5], until: null },
    });
    expect(eventValues(draft({ allDay: true, start: '18:00', repeat: 'daily', weekdays: [1], until: '2026-12-01' }))).toMatchObject({
      start: null,
      end: null,
      repeat: { kind: 'daily', weekdays: [], until: '2026-12-01' },
    });
  });

  test('a new entry is all day, once, on the weekday of its day; an existing one round-trips', () => {
    expect(emptyEventDraft('2026-11-20')).toMatchObject({ allDay: true, repeat: 'none', weekdays: [5] });
    const e = event({ start: 1080, end: 1140, repeat: repeat({ kind: 'weekly', weekdays: [1, 3, 5] }) });
    expect(eventDraft(e)).toMatchObject({ allDay: false, start: '18:00', end: '19:00', weekdays: [1, 3, 5] });
    const { title, categoryId, extraImportance, date, start, end, repeat: r } = e;
    expect(eventValues(eventDraft(e))).toEqual({ title, categoryId, extraImportance, date, start, end, repeat: r });
  });
});

describe('recurrence', () => {
  test('once: only its day', () => {
    const e = event();
    expect(occursOn(e, '2026-11-20')).toBe(true);
    expect(occursOn(e, '2026-11-21')).toBe(false);
    expect(occurrenceDays(e, '2026-11-01', '2026-11-30')).toEqual(['2026-11-20']);
    expect(occurrenceDays(e, '2026-11-21', '2026-11-30')).toEqual([]);
  });

  test('daily: from its first day to its last, never before', () => {
    const e = event({ repeat: repeat({ kind: 'daily', until: '2026-11-23' }) });
    expect(occurrenceDays(e, '2026-11-18', '2026-11-30')).toEqual(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']);
  });

  test('weekly on chosen weekdays (Spacer Mon/Wed/Fri), across a month end and a DST change', () => {
    const e = event({ date: '2026-10-19', repeat: repeat({ kind: 'weekly', weekdays: [1, 3, 5] }) });
    expect(occurrenceDays(e, '2026-10-24', '2026-11-04')).toEqual([
      '2026-10-26',
      '2026-10-28',
      '2026-10-30',
      '2026-11-02',
      '2026-11-04',
    ]);
  });

  test('weekly without weekdays (older data) falls back to the weekday of its first day', () => {
    const e = event({ date: '2026-11-20', repeat: repeat({ kind: 'weekly', weekdays: [] }) });
    expect(occurrenceDays(e, '2026-11-20', '2026-12-04')).toEqual(['2026-11-20', '2026-11-27', '2026-12-04']);
  });

  test('monthly keeps the day of the month and uses the last day of a shorter month', () => {
    const e = event({ date: '2026-01-31', repeat: repeat({ kind: 'monthly' }) });
    const days = occurrenceDays(e, '2026-01-01', '2026-06-30');
    expect(days).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30']);
    // In a leap year February has the 29th.
    expect(occurrenceDays(event({ date: '2028-01-30', repeat: repeat({ kind: 'monthly' }) }), '2028-02-01', '2028-02-29')).toEqual([
      '2028-02-29',
    ]);
    // The 15th stays the 15th.
    expect(occurrenceDays(event({ date: '2026-11-15', repeat: repeat({ kind: 'monthly' }) }), '2026-11-16', '2027-01-31')).toEqual([
      '2026-12-15',
      '2027-01-15',
    ]);
  });

  test('a year-end and a leap day are crossed day by day', () => {
    const e = event({ date: '2027-12-30', repeat: repeat({ kind: 'daily' }) });
    expect(occurrenceDays(e, '2027-12-29', '2028-01-02')).toEqual(['2027-12-30', '2027-12-31', '2028-01-01', '2028-01-02']);
    const leap = event({ date: '2028-02-27', repeat: repeat({ kind: 'daily', until: '2028-03-01' }) });
    expect(occurrenceDays(leap, '2028-02-01', '2028-03-31')).toEqual(['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01']);
  });
});

describe('categories', () => {
  const cat = (id: string, name: string, color: CalendarCategory['color'] = 'violet'): CalendarCategory => ({
    id,
    name,
    color,
    importance: 2,
    createdAt: null,
  });

  test('a name, unique regardless of case and spaces; editing keeps its own name', () => {
    const list = [cat('a', 'Aktywność fizyczna')];
    expect(categoryProblem({ name: ' ', color: 'blue', importance: 1 }, list)).toBe('nameRequired');
    expect(categoryProblem({ name: ' aktywność FIZYCZNA ', color: 'blue', importance: 1 }, list)).toBe('nameTaken');
    expect(categoryProblem({ name: 'Aktywność fizyczna', color: 'blue', importance: 3 }, list, 'a')).toBeNull();
    expect(categoryProblem({ name: 'Szkoła', color: 'blue', importance: 1 }, list)).toBeNull();
  });

  test('at most CATEGORIES_MAX', () => {
    const many = Array.from({ length: CATEGORIES_MAX }, (_, i) => cat(String(i), `K${i}`));
    expect(categoryProblem({ name: 'Nowa', color: 'blue', importance: 1 }, many)).toBe('limit');
    expect(categoryProblem({ name: 'Nowa', color: 'blue', importance: 1 }, many, '0')).toBeNull();
  });

  test('values are trimmed and the weight clamped to 0–5; a new one takes a free colour', () => {
    expect(categoryValues({ name: ' Szkoła ', color: 'red', importance: 7 })).toEqual({ name: 'Szkoła', color: 'red', importance: 5 });
    expect(categoryValues({ name: 'x', color: 'red', importance: -2 }).importance).toBe(0);
    expect(emptyCategoryDraft([cat('a', 'A', 'violet'), cat('b', 'B', 'blue')]).color).toBe('teal');
  });
});
