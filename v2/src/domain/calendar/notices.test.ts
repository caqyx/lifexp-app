import { afterAll, describe, expect, test } from 'vitest';
import type { Task } from '../tasks';
import type { CalendarCategory } from './events';
import { event, repeat } from './fixtures';
import {
  DELIVERED_KEEP_MS,
  MISSED_WINDOW_MS,
  dueNotices,
  eventNotices,
  nextNoticeAt,
  pruneDelivered,
  scheduleNotices,
  taskNotices,
} from './notices';

// Wall-clock times as in Poland (summer time starts on 2026-03-29). Set before the
// describe blocks run, since they compute schedules while being collected.
const zone = process.env.TZ;
process.env.TZ = 'Europe/Warsaw';
afterAll(() => {
  process.env.TZ = zone;
});

const at = (day: string, hh: number, mm = 0) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hh, mm).getTime();
};
const MIN = 60_000;

const task = (patch: Partial<Task> = {}): Task => ({
  id: 't1',
  text: '**Wypracowanie**\nszczegóły',
  dueDate: '2026-11-20',
  size: 'S',
  done: false,
  createdAt: null,
  penaltyApplied: false,
  ...patch,
});

const sport: CalendarCategory = { id: 'c1', name: 'Sport', color: 'green', importance: 2, createdAt: null };

describe('entry reminders', () => {
  test('by importance, with stable ids, expiring at the start', () => {
    const notices = eventNotices(
      [event({ id: 'walk', title: 'Spacer', categoryId: 'c1', extraImportance: 3, start: 18 * 60, end: 19 * 60 })],
      [sport],
      '2026-11-19',
      '2026-11-21',
    );
    expect(notices.map((n) => [n.id, n.at, n.kind])).toEqual([
      ['e:walk@2026-11-20:dayBefore', at('2026-11-19', 19), 'dayBefore'],
      ['e:walk@2026-11-20:morning', at('2026-11-20', 8), 'morning'],
      ['e:walk@2026-11-20:hourBefore', at('2026-11-20', 17), 'hourBefore'],
    ]);
    expect(notices[0]).toMatchObject({
      title: 'Spacer',
      level: 'high',
      target: { type: 'event', eventId: 'walk', day: '2026-11-20' },
      expiresAt: at('2026-11-20', 18),
      start: 1080,
      end: 1140,
    });
  });

  test('all day: expires when the day ends; a ticked or skipped day has none', () => {
    const [n] = eventNotices([event({ id: 'b' })], [], '2026-11-20', '2026-11-20');
    expect(n).toMatchObject({ kind: 'morning', at: at('2026-11-20', 8), expiresAt: at('2026-11-21', 0) });
    const daily = event({ id: 'd', start: 600, repeat: repeat({ kind: 'daily' }), marks: { '2026-11-20': 'done', '2026-11-21': 'skipped' } });
    expect(eventNotices([daily], [], '2026-11-20', '2026-11-22').map((x) => x.day)).toEqual(['2026-11-22']);
  });
});

describe('task reminders', () => {
  test('S: the morning of the due day, then "overdue" the morning after, both more important once late', () => {
    const notices = taskNotices([task()]);
    expect(notices.map((n) => [n.id, n.at, n.level])).toEqual([
      ['t:t1@2026-11-20:morning', at('2026-11-20', 8), 'medium'],
      ['t:t1@2026-11-20:overdue', at('2026-11-21', 8), 'medium'],
    ]);
    expect(notices[0]).toMatchObject({ title: 'Wypracowanie', target: { type: 'task', taskId: 't1' }, expiresAt: at('2026-11-21', 0) });
    expect(notices[1]!.expiresAt).toBe(at('2026-11-22', 0));
  });

  test('L: also the evening before; overdue L is critical', () => {
    const notices = taskNotices([task({ size: 'L' })]);
    expect(notices.map((n) => [n.kind, n.level])).toEqual([
      ['dayBefore', 'high'],
      ['morning', 'high'],
      ['overdue', 'critical'],
    ]);
  });

  test('done tasks and tasks without a date remind of nothing; a new due date gives new ids', () => {
    expect(taskNotices([task({ done: true }), task({ id: 'x', dueDate: null })])).toEqual([]);
    expect(taskNotices([task({ dueDate: '2026-11-25' })])[0]!.id).toBe('t:t1@2026-11-25:morning');
  });
});

describe('what is due', () => {
  const now = at('2026-11-20', 17, 5);
  const notices = scheduleNotices({
    events: [
      event({ id: 'walk', title: 'Spacer', start: 18 * 60 }), // low: 17:00
      event({ id: 'late', title: 'Wczoraj', date: '2026-11-19', start: 20 * 60 }), // 19:00 yesterday: stale
      event({ id: 'soon', title: 'Za tydzień', date: '2026-11-27' }), // out of range
    ],
    categories: [],
    tasks: [task()], // 08:00 today: 9 h ago → stale
    now,
  });

  test('the schedule covers yesterday to three days ahead, by time', () => {
    expect(notices.map((n) => n.id)).toEqual([
      'e:late@2026-11-19:hourBefore',
      't:t1@2026-11-20:morning',
      'e:walk@2026-11-20:hourBefore',
      't:t1@2026-11-20:overdue',
    ]);
  });

  test('fresh: due, not shown, recent and not past its start; the rest stale', () => {
    const { fresh, stale } = dueNotices(notices, now, new Set());
    expect(fresh.map((n) => n.id)).toEqual(['e:walk@2026-11-20:hourBefore']);
    expect(stale.map((n) => n.id)).toEqual(['e:late@2026-11-19:hourBefore', 't:t1@2026-11-20:morning']);
    // Shown once: not again.
    expect(dueNotices(notices, now, new Set(['e:walk@2026-11-20:hourBefore'])).fresh).toEqual([]);
  });

  test('a reminder found after its entry started is stale, even within the window', () => {
    const { fresh, stale } = dueNotices(notices, at('2026-11-20', 18, 1), new Set());
    expect(fresh).toEqual([]);
    expect(stale.map((n) => n.id)).toContain('e:walk@2026-11-20:hourBefore');
  });

  test('back from the background: several waiting — the most important first, then the latest', () => {
    const list = scheduleNotices({
      events: [
        event({ id: 'a', title: 'A', start: 10 * 60 + 30 }), // low, 09:30
        event({ id: 'b', title: 'B', start: 11 * 60, extraImportance: 5 }), // high: 10:00
        event({ id: 'c', title: 'C', start: 10 * 60 + 50 }), // low, 09:50
      ],
      categories: [],
      tasks: [],
      now: at('2026-11-20', 10, 20),
    });
    const { fresh } = dueNotices(list, at('2026-11-20', 10, 20), new Set());
    expect(fresh.map((n) => n.id)).toEqual(['e:b@2026-11-20:hourBefore', 'e:c@2026-11-20:hourBefore', 'e:a@2026-11-20:hourBefore']);
  });

  test(`the window is ${MISSED_WINDOW_MS / 60 / MIN} h`, () => {
    const list = eventNotices([event({ id: 'x' })], [], '2026-11-20', '2026-11-20'); // 08:00, all day
    expect(dueNotices(list, at('2026-11-20', 10), new Set()).fresh).toHaveLength(1);
    expect(dueNotices(list, at('2026-11-20', 10) + MIN, new Set()).stale).toHaveLength(1);
  });

  test('the next one due, and forgetting after a week', () => {
    expect(nextNoticeAt(notices, now, new Set())).toBe(at('2026-11-21', 8));
    expect(nextNoticeAt([], now, new Set())).toBeNull();
    expect(pruneDelivered({ a: now - DELIVERED_KEEP_MS - 1, b: now - MIN }, now)).toEqual({ b: now - MIN });
  });

  test('across the spring DST change the evening before stays 19:00 local', () => {
    const list = eventNotices([event({ id: 'x', date: '2026-03-29', start: 18 * 60, extraImportance: 5 })], [], '2026-03-28', '2026-03-29');
    expect(list.map((n) => new Date(n.at).getHours())).toEqual([19, 8, 17]);
  });
});
