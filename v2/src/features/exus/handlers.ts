// What each Ex-us command does (docs/v2/PLAN.md 6.4–6.6). The registry in
// domain/exus says what a command is; here each CommandId gets one handler with
// the same shape, run by the pipeline (pipeline.ts). A new command = a spec in
// domain/exus/commands.ts + a handler here (+ its i18n texts), nothing else.
// Writes go through the same services as the screens, so the same limits hold.
import { effect } from '@preact/signals';
import type { CommandId, CommandSpec } from '@/domain/exus/commands';
import { findCommand } from '@/domain/exus/commands';
import { DAILY_LIMIT_DEFAULT } from '@/domain/points';
import { isModuleOn } from '@/domain/modules';
import type { Profile } from '@/domain/profile';
import { TASKS_MAX, type Task, type TaskSize } from '@/domain/tasks';
import { locale, t } from '@/i18n';
import { formatDayMonth, utcDayKey } from '@/lib/dates';
import { formatInteger } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { createTask, removeCreatedTask } from '@/services/tasks';
import { tasks } from '@/stores/tasks';
import { today as todaySources } from '@/stores/today';
import { syntax } from './syntax';
import type { Undo, UndoStack } from './undo';

export interface HandlerContext {
  uid: string;
  profile: Profile;
  /** Local day key (lib/dates localDayKey) the command was read on. */
  today: string;
  /** The commands of the modules that are on. */
  commands: readonly CommandSpec[];
  /** This Ex-us session's undo stack (only /cofnij reads it; the pipeline fills it). */
  undo: UndoStack;
}

export interface HandlerResult {
  /** Ex-us's answer in the chat. */
  reply: string;
  /** A write: resolves once the server has it. The pipeline shows `toast` now and `failed` on a rejection. */
  write?: { saved: Promise<void>; toast?: string; failed: string };
  /** How to take the write back; the pipeline puts it on the undo stack and on the toast. */
  undo?: Undo;
}

export interface CommandHandler {
  run: (args: Record<string, unknown>, ctx: HandlerContext) => Promise<HandlerResult>;
  /** Destructive commands: the effect, spelled out in the confirmation dialog. */
  effect?: (args: Record<string, unknown>, ctx: HandlerContext) => string;
}

/** The task list once the listener has it; rejects when it cannot be read. */
function loadedTasks(): Promise<readonly Task[]> {
  return new Promise((resolve, reject) => {
    const stop = effect(() => {
      const { list, failed } = tasks.value;
      if (!list && !failed) return;
      queueMicrotask(() => stop());
      if (list) resolve(list);
      else reject(new Error('tasks'));
    });
  });
}

function helpText(commands: readonly CommandSpec[], about: string | undefined): string {
  if (about) {
    const name = about.replace(/^\//, '');
    const spec = findCommand(name, commands);
    if (!spec) return t('exus.unknown', { name });
    return `${t(`exus.commands.${spec.id}`)}\n${syntax(spec)}`;
  }
  return [t('exus.helpIntro'), ...commands.map((c) => `${syntax(c)} — ${t(`exus.commands.${c.id}`)}`)].join('\n');
}

function summary({ profile, today }: HandlerContext): string {
  const lang = locale();
  const earned = todaySources.value.days?.get(utcDayKey(new Date()))?.pointsEarned ?? 0;
  const lines = [
    t('exus.today.points', {
      total: formatInteger(profile.points.total, lang),
      earned: formatInteger(earned, lang),
      limit: formatInteger(profile.dailyLimit ?? DAILY_LIMIT_DEFAULT, lang),
    }),
  ];
  const balance = todaySources.value.balance;
  if (isModuleOn('money', profile) && typeof balance === 'number') lines.push(t('exus.today.balance', { amount: formatMoney(balance, lang) }));
  const list = tasks.value.list;
  if (list) {
    const due = list.filter((task) => !task.done && task.dueDate !== null && task.dueDate <= today).length;
    lines.push(t('exus.today.tasks', { count: due }));
  }
  return lines.join('\n');
}

export const HANDLERS: Record<CommandId, CommandHandler> = {
  help: {
    run: async (args, ctx) => ({ reply: helpText(ctx.commands, args.command as string | undefined) }),
  },

  today: {
    run: async (_args, ctx) => ({ reply: summary(ctx) }),
  },

  undo: {
    run: async (_args, ctx) => {
      const entry = ctx.undo.pop();
      if (!entry) return { reply: t('exus.nothingToUndo') };
      return {
        reply: t('exus.undoneWhat', { what: entry.what }),
        write: { saved: entry.run(), failed: t('exus.undoFailed') },
      };
    },
  },

  'create-task': {
    run: async (args, { uid, profile, today }) => {
      // A command typed before the list arrived waits for it instead of asking to try again.
      const list = await loadedTasks().catch(() => null);
      if (!list) return { reply: t('exus.tasksFailed') };
      const text = String(args.text);
      const dueDate = String(args.due);
      const size = (args.size as TaskSize | undefined) ?? 'M';
      const result = createTask(uid, { text, dueDate, size }, list, profile.pcBuild !== null, today);
      if (!result.ok) {
        return { reply: result.problem === 'limit' ? t('tasks.maxTasks', { max: TASKS_MAX }) : t(`exus.taskProblem.${result.problem}`) };
      }
      return {
        reply: t('exus.taskCreated', { text, date: formatDayMonth(dueDate, locale()), size }),
        write: { saved: result.saved, toast: t('tasks.saved'), failed: t('tasks.saveFailed') },
        undo: { what: t('exus.undoWhat.create-task', { text }), run: () => removeCreatedTask(uid, result.id) },
      };
    },
  },
};
