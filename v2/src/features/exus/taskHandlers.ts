// The task commands (docs/v2/PLAN.md 6.5, "Zadania"): /zrobione, /zadania,
// /edytuj-zadanie, /usun-zadanie. They go through the same services as the Tasks
// screen (services/tasks), so the same rules hold: pieces of the PC build only
// when done on time, a due date never in the past, and every task counts toward
// the limit of 30. They wait for the task list instead of answering from nothing.
import { findCommand } from '@/domain/exus/commands';
import { matchTask, tasksInScope, type TasksScope } from '@/domain/exus/tasks';
import { noteExcerpt } from '@/domain/notes';
import { isOverdue, taskProblem, TASKS_MAX, type Task, type TaskDraft, type TaskSize } from '@/domain/tasks';
import { locale, t } from '@/i18n';
import { formatDayMonth } from '@/lib/dates';
import { completeTask, deleteTask, updateTask } from '@/services/tasks';
import { tasks } from '@/stores/tasks';
import type { CommandHandler, HandlerResult } from './handlers';
import { loadedTasks } from './loaded';
import { syntax } from './syntax';

/** A task in a reply is its first words. */
const SHORT = 60;

const shortText = (task: Task) => noteExcerpt(task.text, SHORT);

type Found = { task: Task } | { reply: string };

/** The task the text names among `among`, or what to answer when there is no single one. */
function findTask(args: Record<string, unknown>, among: readonly Task[]): Found {
  const name = String(args.task);
  const match = matchTask(name, among);
  if (match.kind === 'found') return { task: match.item };
  if (match.kind === 'ambiguous') return { reply: t('exus.task.ambiguous', { names: match.items.map((x) => `„${shortText(x)}”`).join(', ') }) };
  return { reply: t('exus.task.none', { name }) };
}

const open = (list: readonly Task[]) => list.filter((task) => !task.done);

/** When a task is due, as the Tasks screen words it. */
function dueWords(task: Task, today: string): string {
  if (task.dueDate === null) return '—';
  const date = formatDayMonth(task.dueDate, locale());
  if (isOverdue(task, today)) return t('exus.task.overdueSince', { date });
  return task.dueDate === today ? t('tasks.dueToday') : t('tasks.dueOn', { date });
}

export const TASK_HANDLERS = {
  'complete-task': {
    run: async (args, { uid, today }) => {
      const list = await loadedTasks().catch(() => null);
      if (!list) return { reply: t('tasks.loadFailed') };
      const found = findTask(args, open(list));
      if ('reply' in found) return found;
      const { task } = found;
      let pieces: number;
      try {
        // The screen's own transaction: done is final, the pieces go to the build only when it is in time.
        pieces = await completeTask(uid, task.id, today);
      } catch {
        return { reply: t('tasks.completeFailed') };
      }
      const earned = pieces > 0 ? t('tasks.piecesEarned', { count: pieces }) : t('tasks.lateNoPieces');
      // No undo: done is final in v1 and the services have no way back (the pieces would stay in the build).
      return {
        reply: `${t('exus.task.completed', { text: shortText(task) })} ${earned}`,
        write: { saved: Promise.resolve(), ...(pieces > 0 ? { toast: earned } : {}), failed: t('tasks.completeFailed') },
      };
    },
  },

  tasks: {
    run: async (args, { today }) => {
      const list = await loadedTasks().catch(() => null);
      if (!list) return { reply: t('tasks.loadFailed') };
      const scope = (args.scope as TasksScope | undefined) ?? 'due';
      const shown = tasksInScope(list, scope, today);
      if (shown.length === 0) return { reply: t(`exus.task.empty.${scope}`) };
      const lines = shown.map((task) => t('exus.task.line', { text: shortText(task), due: dueWords(task, today), size: task.size }));
      return { reply: [t(`exus.task.header.${scope}`, { count: shown.length }), ...lines].join('\n') };
    },
  },

  'edit-task': {
    run: async (args, { uid, today, commands }) => {
      const list = await loadedTasks().catch(() => null);
      if (!list) return { reply: t('tasks.loadFailed') };
      const found = findTask(args, open(list));
      if ('reply' in found) return found;
      const { task } = found;
      if (args.text === undefined && args.due === undefined && args.size === undefined) {
        const spec = findCommand('edit-task', commands);
        return { reply: t('exus.task.nothingToEdit', { syntax: spec ? syntax(spec) : '' }) };
      }
      const before: TaskDraft = { text: task.text, dueDate: task.dueDate ?? '', size: task.size };
      const draft: TaskDraft = {
        text: typeof args.text === 'string' ? args.text : before.text,
        dueDate: typeof args.due === 'string' ? args.due : before.dueDate,
        size: (args.size as TaskSize | undefined) ?? before.size,
      };
      // The screen's checks, on the whole task: an overdue task needs a new due date, as it does in the sheet.
      const result = updateTask(uid, task.id, draft, today);
      if (!result.ok) {
        if (result.problem === 'dueInPast' && args.due === undefined) return { reply: t('exus.task.editOverdue') };
        return { reply: result.problem === 'limit' ? t('tasks.maxTasks', { max: TASKS_MAX }) : t(`exus.taskProblem.${result.problem}`) };
      }
      const restorable = taskProblem(before, today) === null;
      return {
        reply: t('exus.task.edited', {
          text: shortText({ ...task, text: draft.text.trim() }),
          date: formatDayMonth(draft.dueDate, locale()),
          size: draft.size,
        }),
        write: { saved: result.saved, toast: t('tasks.saved'), failed: t('tasks.saveFailed') },
        // Back to the old values by the same service; not when the old due date has passed, which the service refuses.
        undo: restorable
          ? {
              what: t('exus.undoWhat.edit-task', { text: shortText(task) }),
              run: async () => {
                const back = updateTask(uid, task.id, before, today);
                if (!back.ok) throw new Error(back.problem);
                await back.saved;
              },
            }
          : undefined,
      };
    },
  },

  'delete-task': {
    ready: async () => void (await loadedTasks()),
    check: (args) => {
      const found = findTask(args, tasks.value.list ?? []);
      return 'reply' in found ? found.reply : null;
    },
    effect: (args) => {
      const found = findTask(args, tasks.value.list ?? []);
      return 'reply' in found ? found.reply : t('exus.task.deleteEffect', { text: shortText(found.task) });
    },
    run: async (args, { uid }) => {
      const list = await loadedTasks().catch(() => null);
      if (!list) return { reply: t('tasks.loadFailed') };
      // The task is read again: the list may have changed while the dialog was open.
      const found = findTask(args, list);
      if ('reply' in found) return found;
      const { task } = found;
      // No undo, though the service has one: a destructive command asked first and does not go on the stack (PLAN.md 6.6).
      const { saved } = deleteTask(uid, task);
      return {
        reply: t('exus.task.deleted', { text: shortText(task) }),
        write: { saved, toast: t('tasks.deleted'), failed: t('tasks.saveFailed') },
      } satisfies HandlerResult;
    },
  },
} satisfies Record<string, CommandHandler>;
