import { describe, expect, test } from 'vitest';
import type { Task } from '../tasks';
import type { CalendarCategory } from './events';
import { event } from './fixtures';
import {
  compareItems,
  importantToday,
  itemsByDay,
  itemSummary,
  taskImportance,
  taskItem,
  taskTitle,
  TODAY_ITEMS_MAX,
} from './items';

const TODAY = '2026-11-20';

const task = (patch: Partial<Task> = {}): Task => ({
  id: 't1',
  text: 'Wypracowanie',
  dueDate: TODAY,
  size: 'S',
  done: false,
  createdAt: null,
  penaltyApplied: false,
  ...patch,
});

const school: CalendarCategory = { id: 'c1', name: 'Szkoła', color: 'violet', importance: 4, createdAt: null };

describe('tasks weighed like entries', () => {
  test('S 2, M 4, L 6; overdue adds 2', () => {
    expect(taskImportance(task({ size: 'S' }), TODAY)).toBe(2);
    expect(taskImportance(task({ size: 'M' }), TODAY)).toBe(4);
    expect(taskImportance(task({ size: 'L' }), TODAY)).toBe(6);
    expect(taskImportance(task({ size: 'L', dueDate: '2026-11-19' }), TODAY)).toBe(8);
    // Done is not overdue (domain/tasks isOverdue).
    expect(taskImportance(task({ size: 'L', dueDate: '2026-11-19', done: true }), TODAY)).toBe(6);
  });

  test('a task item: level, state, overdue, all day', () => {
    expect(taskItem(task({ size: 'L', dueDate: '2026-11-18' }), TODAY)).toMatchObject({
      kind: 'task',
      key: 'task:t1',
      day: '2026-11-18',
      level: 'critical',
      state: 'open',
      overdue: true,
      start: null,
    });
    expect(taskItem(task({ done: true }), TODAY).state).toBe('done');
  });

  test('the title is the first line of the Markdown as plain text', () => {
    expect(taskTitle('## **Wypracowanie** z `historii`\nszczegóły')).toBe('Wypracowanie z historii');
    expect(taskTitle('\n\n- [ ] Kupić [mleko](https://example.com)')).toBe('Kupić mleko');
    expect(taskTitle('1. Pierwsze')).toBe('Pierwsze');
    expect(taskTitle('')).toBe('');
  });
});

describe('one list for a day', () => {
  test('entries and tasks by day, the most important first, done last', () => {
    const days = itemsByDay(
      [
        event({ id: 'walk', title: 'Spacer', start: 18 * 60, repeat: { kind: 'daily', weekdays: [], until: null } }),
        event({ id: 'exam', title: 'Sprawdzian', categoryId: 'c1', extraImportance: 3 }),
      ],
      [school],
      [
        task({ id: 'a', text: 'Lektura', size: 'M' }),
        task({ id: 'b', text: 'Zrobione', size: 'L', done: true }),
        task({ id: 'c', text: 'Jutro', dueDate: '2026-11-21' }),
        task({ id: 'd', text: 'Za tydzień', dueDate: '2026-11-27' }),
      ],
      TODAY,
      '2026-11-21',
      TODAY,
    );
    expect([...days.keys()]).toEqual([TODAY, '2026-11-21']);
    expect(days.get(TODAY)!.map((i) => i.key)).toEqual(['event:exam@2026-11-20', 'task:a', 'event:walk@2026-11-20', 'task:b']);
    expect(days.get('2026-11-21')!.map((i) => i.key)).toEqual(['task:c', 'event:walk@2026-11-21']);
  });

  test('without tasks (module data not given) only entries', () => {
    const days = itemsByDay([event()], [], null, TODAY, TODAY, TODAY);
    expect(days.get(TODAY)!.map((i) => i.kind)).toEqual(['event']);
  });

  test('a day cell: marks of the most important, skipped left out', () => {
    const items = itemsByDay(
      [event({ id: 'x', marks: { [TODAY]: 'skipped' } }), event({ id: 'y', extraImportance: 1 })],
      [],
      [task({ size: 'L' }), task({ id: 't2', size: 'M' }), task({ id: 't3', size: 'S', done: true })],
      TODAY,
      TODAY,
      TODAY,
    ).get(TODAY)!;
    const summary = itemSummary(items);
    expect(summary.marks.map((i) => i.key)).toEqual(['task:t1', 'task:t2', 'event:y@2026-11-20']);
    expect(summary).toMatchObject({ more: 1, top: 'high', total: 4 });
  });

  test('compareItems is a total order', () => {
    const a = taskItem(task(), TODAY);
    expect(compareItems(a, a)).toBe(0);
  });
});

describe('"Ważne dzisiaj"', () => {
  test("today's open entries and tasks, overdue tasks too, the most important first", () => {
    const result = importantToday(
      [
        event({ id: 'walk', title: 'Spacer', start: 18 * 60, repeat: { kind: 'daily', weekdays: [], until: null } }),
        event({ id: 'exam', title: 'Sprawdzian', categoryId: 'c1', extraImportance: 5 }),
        event({ id: 'done', title: 'Telefon', marks: { [TODAY]: 'done' } }),
        event({ id: 'other', title: 'Jutro', date: '2026-11-21' }),
      ],
      [school],
      [
        task({ id: 'late', text: 'Zaległe', size: 'S', dueDate: '2026-11-15' }),
        task({ id: 'today', text: 'Dziś', size: 'S' }),
        task({ id: 'finished', text: 'Gotowe', done: true }),
        task({ id: 'oldDone', text: 'Dawno', done: true, dueDate: '2026-11-01' }),
        task({ id: 'future', text: 'Później', dueDate: '2026-11-25' }),
      ],
      TODAY,
    );
    expect(result.items.map((i) => i.key)).toEqual(['event:exam@2026-11-20', 'task:late', 'task:today', 'event:walk@2026-11-20']);
    expect(result.items[1]).toMatchObject({ day: TODAY, overdue: true, importance: 4 });
    expect(result).toMatchObject({ more: 0, settled: 2 });
  });

  test(`at most ${TODAY_ITEMS_MAX} listed, the rest counted`, () => {
    const many = Array.from({ length: TODAY_ITEMS_MAX + 2 }, (_, i) => event({ id: `e${i}`, title: `E${i}` }));
    const result = importantToday(many, [], [], TODAY);
    expect(result.items).toHaveLength(TODAY_ITEMS_MAX);
    expect(result.more).toBe(2);
  });
});
