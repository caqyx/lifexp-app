import { describe, expect, it } from 'vitest';
import type { Task } from '../tasks';
import { matchTask, tasksInScope, TASKS_SCOPE } from './tasks';

const TODAY = '2026-10-09';

let n = 0;
const task = (text: string, dueDate: string | null, done = false): Task => ({
  id: `t${(n += 1)}`,
  text,
  dueDate,
  size: 'M',
  done,
  createdAt: null,
  penaltyApplied: false,
});

const late = task('Zaległe', '2026-10-01');
const now = task('Na dziś', TODAY);
const soon = task('Na jutro', '2026-10-10');
const finished = task('Skończone', '2026-10-01', true);
const all = [soon, finished, now, late];

describe('the scope word', () => {
  it.each([
    ['dziś', 'today'],
    ['DZIS', 'today'],
    ['zaległe', 'overdue'],
    ['zalegle', 'overdue'],
    ['wszystkie', 'all'],
    ['all', 'all'],
  ])('%s', (word, scope) => {
    expect(TASKS_SCOPE(word)).toBe(scope);
  });

  it('leaves other words alone', () => {
    expect(TASKS_SCOPE('jutro')).toBeUndefined();
  });
});

describe('tasksInScope', () => {
  it.each([
    ['due', [late, now]],
    ['today', [now]],
    ['overdue', [late]],
    ['all', [late, now, soon]],
  ] as const)('%s: open tasks only, soonest first', (scope, expected) => {
    expect(tasksInScope(all, scope, TODAY)).toEqual(expected);
  });

  it('a task with a malformed due date shows only under all', () => {
    const odd = task('Bez terminu', null);
    expect(tasksInScope([odd], 'due', TODAY)).toEqual([]);
    expect(tasksInScope([odd], 'all', TODAY)).toEqual([odd]);
  });
});

describe('matchTask', () => {
  const list = [task('Kupić mleko', TODAY), task('Kupić chleb', TODAY), task('Wypracowanie', TODAY)];

  it('finds one by a fragment, in any case and without Polish letters', () => {
    expect(matchTask('mleko', list)).toEqual({ kind: 'found', item: list[0] });
    expect(matchTask('WYPRACOW', list)).toEqual({ kind: 'found', item: list[2] });
  });

  it('lists several fits and says none when nothing fits', () => {
    expect(matchTask('kupic', list)).toEqual({ kind: 'ambiguous', items: [list[0], list[1]] });
    expect(matchTask('rower', list)).toEqual({ kind: 'none' });
  });
});
