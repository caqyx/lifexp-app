// Task commands, the pure part (docs/v2/PLAN.md 6.5, "Zadania"): which tasks
// "/zadania" lists and which task a name points at. The caller gives the tasks
// it has; nothing here reads a store.
import { isOverdue, type Task } from '../tasks';
import { matchEntity } from './entities';
import { oneOf } from './recognizers';

/** What "/zadania" lists: by default today's and the overdue ones. */
export type TasksScope = 'due' | 'today' | 'overdue' | 'all';

export const TASKS_SCOPE = oneOf<TasksScope>({
  dzis: 'today',
  dzisiaj: 'today',
  today: 'today',
  zalegle: 'overdue',
  overdue: 'overdue',
  wszystkie: 'all',
  all: 'all',
});

const byDue = (a: Task, b: Task) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '');

/** Open (not done) tasks only, soonest due date first: done ones are done, the list is for what is left to do. */
export function tasksInScope(tasks: readonly Task[], scope: TasksScope, today: string): Task[] {
  const open = tasks.filter((task) => !task.done);
  const picked = open.filter((task) => {
    switch (scope) {
      case 'today':
        return task.dueDate === today;
      case 'overdue':
        return isOverdue(task, today);
      case 'due':
        return task.dueDate !== null && task.dueDate <= today;
      case 'all':
        return true;
    }
  });
  return picked.sort(byDue);
}

export type TaskMatch = { kind: 'found'; item: Task } | { kind: 'ambiguous'; items: Task[] } | { kind: 'none' };

/** The task a name points at (PLAN.md 6.3, step 7): matched on its text, like a goal on its name. */
export function matchTask(query: string, tasks: readonly Task[]): TaskMatch {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const match = matchEntity(query, tasks.map((task) => ({ id: task.id, name: task.text })));
  if (match.kind === 'found') return { kind: 'found', item: byId.get(match.item.id)! };
  if (match.kind === 'ambiguous') return { kind: 'ambiguous', items: match.items.map((item) => byId.get(item.id)!) };
  return { kind: 'none' };
}
