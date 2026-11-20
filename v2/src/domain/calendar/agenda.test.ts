import { describe, expect, test } from 'vitest';
import {
  byDay,
  compareOccurrences,
  dayAgenda,
  daySummary,
  layoutTimeline,
  monthGrid,
  occurrencesBetween,
  type Occurrence,
} from './agenda';
import type { CalendarCategory } from './events';
import { event } from './fixtures';
import { importanceLevel, totalImportance } from './importance';

const sport: CalendarCategory = { id: 'c1', name: 'Aktywność fizyczna', color: 'green', importance: 2, createdAt: null };

describe('importance', () => {
  test('category weight plus extra points, within 0–10', () => {
    expect(totalImportance({ extraImportance: 0 }, null)).toBe(0);
    expect(totalImportance({ extraImportance: 3 }, sport)).toBe(5);
    expect(totalImportance({ extraImportance: 5 }, { ...sport, importance: 9 })).toBe(10);
  });

  test('levels: 0–1 low, 2–4 medium, 5–7 high, 8–10 critical', () => {
    expect([0, 1, 2, 4, 5, 7, 8, 10].map(importanceLevel)).toEqual([
      'low',
      'low',
      'medium',
      'medium',
      'high',
      'high',
      'critical',
      'critical',
    ]);
  });
});

describe('occurrences', () => {
  const walk = event({ id: 'walk', title: 'Spacer', categoryId: 'c1', start: 18 * 60, repeat: { kind: 'daily', weekdays: [], until: null } });
  const exam = event({ id: 'exam', title: 'Sprawdzian', extraImportance: 5, date: '2026-11-21' });
  const call = event({ id: 'call', title: 'Telefon', start: 9 * 60, date: '2026-11-21', marks: { '2026-11-21': 'done' } });

  test('each day in list order: open before done, more important first, all day before timed', () => {
    const list = occurrencesBetween([walk, exam, call], [sport], '2026-11-20', '2026-11-21');
    expect(list.map((o) => o.key)).toEqual(['walk@2026-11-20', 'exam@2026-11-21', 'walk@2026-11-21', 'call@2026-11-21']);
    expect(list[1]).toMatchObject({ importance: 5, level: 'high', category: null });
    expect(list[0]).toMatchObject({ importance: 2, level: 'medium', category: sport });
    expect(list[3]!.mark).toBe('done');
    expect([...byDay(list).keys()]).toEqual(['2026-11-20', '2026-11-21']);
  });

  test('an entry whose category was deleted counts as one without a category', () => {
    const [o] = occurrencesBetween([walk], [], '2026-11-20', '2026-11-20');
    expect(o).toMatchObject({ category: null, importance: 0, level: 'low' });
  });

  test('a day splits into the all-day row and the timeline, the timeline by time', () => {
    const late = event({ id: 'late', title: 'A', start: 20 * 60, extraImportance: 5 });
    const early = event({ id: 'early', title: 'B', start: 7 * 60 });
    const allDay = event({ id: 'all', title: 'C' });
    const agenda = dayAgenda(occurrencesBetween([late, early, allDay], [], '2026-11-20', '2026-11-20'));
    expect(agenda.allDay.map((o) => o.event.id)).toEqual(['all']);
    expect(agenda.timed.map((o) => o.event.id)).toEqual(['early', 'late']);
  });

  test('equal importance: earlier first, then by title', () => {
    const a = occurrencesBetween([event({ id: 'x', title: 'B', start: 600 }), event({ id: 'y', title: 'A', start: 600 })], [], '2026-11-20', '2026-11-20');
    expect(a.map((o) => o.event.title)).toEqual(['A', 'B']);
    expect(compareOccurrences(a[0]!, a[0]!)).toBe(0);
  });
});

describe('month grid', () => {
  test('whole weeks from Monday; November 2026 starts on a Sunday', () => {
    const grid = monthGrid('2026-11');
    expect(grid.weeks).toHaveLength(6);
    expect(grid.weeks[0]![0]).toBe('2026-10-26');
    expect(grid.weeks[0]![6]).toBe('2026-11-01');
    expect(grid.weeks[5]![6]).toBe('2026-12-06');
    expect(grid.first).toBe('2026-11-01');
    expect(grid.last).toBe('2026-11-30');
  });

  test('February 2027 fills exactly four weeks; February 2028 has the 29th', () => {
    expect(monthGrid('2027-02').weeks).toHaveLength(4);
    expect(monthGrid('2028-02').last).toBe('2028-02-29');
  });

  test('a day shows its most important open entries, skipped ones not at all', () => {
    const list = occurrencesBetween(
      [
        event({ id: 'a', title: 'A' }),
        event({ id: 'b', title: 'B', extraImportance: 5 }),
        event({ id: 'c', title: 'C', extraImportance: 2 }),
        event({ id: 'd', title: 'D', extraImportance: 1 }),
        event({ id: 'e', title: 'E', marks: { '2026-11-20': 'skipped' } }),
      ],
      [],
      '2026-11-20',
      '2026-11-20',
    );
    const summary = daySummary(list);
    expect(summary.marks.map((o) => o.event.id)).toEqual(['b', 'c', 'd']);
    expect(summary).toMatchObject({ more: 1, top: 'high', total: 4 });
    expect(daySummary([]).top).toBeNull();
  });
});

describe('timeline', () => {
  const timed = (id: string, start: number, end: number | null): Occurrence =>
    occurrencesBetween([event({ id, title: id, start, end })], [], '2026-11-20', '2026-11-20')[0]!;

  test('separate blocks take the full width', () => {
    const blocks = layoutTimeline([timed('a', 480, 540), timed('b', 600, 660)]);
    expect(blocks.map((b) => [b.occurrence.event.id, b.column, b.columns])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ]);
  });

  test('overlapping blocks share it, reusing a column that is free again', () => {
    const blocks = layoutTimeline([timed('a', 480, 600), timed('b', 510, 540), timed('c', 550, 580), timed('d', 700, null)]);
    expect(blocks.map((b) => [b.occurrence.event.id, b.column, b.columns])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 1, 2],
      ['d', 0, 1],
    ]);
    // No end: an hour; very short ones still get MIN_BLOCK.
    expect(blocks[3]!.length).toBe(60);
    expect(layoutTimeline([timed('s', 600, 605)])[0]!.length).toBe(30);
  });

  test('a block never runs past midnight', () => {
    const [block] = layoutTimeline([timed('late', 23 * 60 + 30, null)]);
    expect(block!.top + block!.length).toBe(24 * 60);
  });
});
