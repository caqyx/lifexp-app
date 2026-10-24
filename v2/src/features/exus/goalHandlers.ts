// The goal commands (docs/v2/PLAN.md 6.5, "Cele"): /cel, /wplac, /cele, /edytuj-cel,
// /usun-cel. They go through the same services as the Goals screen (services/goals),
// so the same limits hold: three goals, a deposit never takes the balance below
// zero, a deleted goal gives back what was put aside. Those services read the
// server (a transaction), so a command waits for them and says why when it
// cannot go through. Goals do not depend on a module, as on the Goals screen.
import { matchEntity } from '@/domain/exus/entities';
import { depositAmount, newGoalTarget, targetFor, type AmountProblem } from '@/domain/exus/goals';
import type { Amount } from '@/domain/exus/recognizers';
import { GOALS_MAX, GOAL_NAME_MAX, goalProgress, refundOnDelete, type Goal, type GoalProblem } from '@/domain/goals';
import { findCommand } from '@/domain/exus/commands';
import { locale, t } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { goalAmount } from '@/features/shared/goals';
import { depositGoal, removeGoal, saveGoal, type GoalSaveResult } from '@/services/goals';
import type { CommandHandler, HandlerContext, HandlerResult } from './handlers';
import { syntax } from './syntax';

type Found = { goal: Goal } | { reply: string };

/** The goal the text names (PLAN.md 6.3, step 7), or what to answer when there is no single one. */
function findGoal(args: Record<string, unknown>, { profile }: HandlerContext): Found {
  const name = String(args.goal);
  const match = matchEntity(name, profile.goals);
  if (match.kind === 'found') return { goal: match.item };
  if (match.kind === 'ambiguous') return { reply: t('exus.goal.ambiguous', { names: match.items.map((g) => `„${g.name}”`).join(', ') }) };
  return { reply: t('exus.goal.none', { name }) };
}

/** Why a goal cannot be saved, in words: the Goals screen's own texts where it has them. */
function saveProblem(problem: Extract<GoalSaveResult, { ok: false }>['problem']): string {
  switch (problem) {
    case 'nameRequired':
      return t('goals.needName');
    case 'targetRequired':
      return t('goals.needTarget');
    case 'targetTooLarge':
      return t('goals.targetTooLarge');
    case 'limit':
      return t('goals.maxReached');
    case 'notEnoughBalance':
      return t('goals.notEnough');
  }
}

function amountProblem(problem: AmountProblem, goal?: Goal): string {
  if (problem === 'unit') return t('exus.goal.needUnit');
  if (problem === 'notWhole') return t('exus.goal.notWhole');
  if (!goal) return t('exus.goal.depositUnit');
  return t(goal.type === 'money' ? 'exus.goal.wantsMoney' : 'exus.goal.wantsPoints', { name: goal.name });
}

const nameProblem = (name: string): string | null => (name.length > GOAL_NAME_MAX ? t('exus.goal.nameTooLong', { max: GOAL_NAME_MAX }) : null);

/** The write is done when the service resolved, so `saved` is already settled. */
const done = (toast: string): NonNullable<HandlerResult['write']> => ({ saved: Promise.resolve(), toast, failed: t('goals.saveFailed') });

/** A service that cannot reach the server answers with the Goals screen's text, not a stack trace. */
const unreachable = (): HandlerResult => ({ reply: t('goals.saveFailed') });

function goalLine(goal: Goal, pointsTotal: number, lang: string): string {
  const progress = goalProgress(goal, pointsTotal);
  const status = t('goals.progress', {
    current: goalAmount(goal.type, progress.current, lang),
    target: goalAmount(goal.type, goal.target, lang),
    percent: Math.floor(progress.share * 100),
  });
  return `• ${goal.name} — ${t(goal.type === 'money' ? 'goals.typeMoney' : 'goals.typePoints')}: ${status}${progress.reached ? ` (${t('goals.reached')})` : ''}`;
}

export const GOAL_HANDLERS = {
  'create-goal': {
    run: async (args, { uid, profile }) => {
      const name = String(args.name).trim();
      const target = newGoalTarget(args.target as Amount);
      if (!target.ok) return { reply: amountProblem(target.problem) };
      const tooLong = nameProblem(name);
      if (tooLong) return { reply: tooLong };
      try {
        const result = await saveGoal(uid, { type: target.type, name, target: target.target }, profile.goals, null);
        if (!result.ok) return { reply: saveProblem(result.problem) };
        const { id } = result;
        return {
          reply: t('exus.goal.created', { name, target: goalAmount(target.type, target.target, locale()), count: profile.goals.length + 1, max: GOALS_MAX }),
          write: done(t('goals.added')),
          // A new goal has put aside nothing, so deleting it gives back nothing: no side effects.
          undo: { what: t('exus.undoWhat.create-goal', { name }), run: () => removeGoal(uid, { id }).then(() => undefined) },
        };
      } catch {
        return unreachable();
      }
    },
  },

  'deposit-goal': {
    run: async (args, ctx) => {
      const found = findGoal(args, ctx);
      if ('reply' in found) return found;
      const { goal } = found;
      if (goal.type !== 'money') return { reply: t('exus.goal.pointsDeposit', { name: goal.name }) };
      if (goalProgress(goal, ctx.profile.points.total).reached) return { reply: t('exus.goal.alreadyReached', { name: goal.name }) };
      const amount = depositAmount(args.amount as Amount);
      if (!amount.ok) return { reply: amountProblem(amount.problem) };
      try {
        const result = await depositGoal(ctx.uid, goal, amount.grosze);
        if (!result.ok) return { reply: saveProblem(result.problem) };
        // No undo: the services have no way to take a deposit back (a delete would also drop the goal).
        const message = t('goals.deposited', { amount: formatMoney(amount.grosze, locale()), name: goal.name });
        return { reply: message, write: done(message) };
      } catch {
        return unreachable();
      }
    },
  },

  goals: {
    run: async (_args, { profile }) => {
      if (profile.goals.length === 0) return { reply: `${t('goals.empty')}\n${t('goals.emptyBody')}` };
      const lang = locale();
      const lines = profile.goals.map((g) => goalLine(g, profile.points.total, lang));
      return { reply: [t('goals.count', { count: profile.goals.length, max: GOALS_MAX }), ...lines].join('\n') };
    },
  },

  'edit-goal': {
    run: async (args, ctx) => {
      const found = findGoal(args, ctx);
      if ('reply' in found) return found;
      const { goal } = found;
      const newName = typeof args.name === 'string' ? args.name.trim() : null;
      if (newName === null && args.target === undefined) {
        const spec = findCommand('edit-goal', ctx.commands);
        return { reply: t('exus.goal.nothingToEdit', { syntax: spec ? syntax(spec) : '' }) };
      }
      let target = goal.target;
      if (args.target !== undefined) {
        const resolved = targetFor(goal.type, args.target as Amount);
        if (!resolved.ok) return { reply: amountProblem(resolved.problem, goal) };
        target = resolved.target;
      }
      const name = newName ?? goal.name;
      const tooLong = nameProblem(name);
      if (tooLong) return { reply: tooLong };
      try {
        const result = await saveGoal(ctx.uid, { type: goal.type, name, target }, ctx.profile.goals, goal);
        if (!result.ok) return { reply: saveProblem(result.problem as GoalProblem) };
        return {
          reply: t('exus.goal.edited', { name, target: goalAmount(goal.type, target, locale()) }),
          write: done(t('goals.saved')),
        };
      } catch {
        return unreachable();
      }
    },
  },

  'delete-goal': {
    check: (args, ctx) => {
      const found = findGoal(args, ctx);
      return 'reply' in found ? found.reply : null;
    },
    effect: (args, ctx) => {
      const found = findGoal(args, ctx);
      if ('reply' in found) return found.reply;
      const refund = refundOnDelete(found.goal);
      return refund > 0
        ? t('exus.goal.deleteEffectRefund', { name: found.goal.name, amount: formatMoney(refund, locale()) })
        : t('exus.goal.deleteEffect', { name: found.goal.name });
    },
    run: async (args, ctx) => {
      // The goal is read again: the list may have changed while the dialog was open.
      const found = findGoal(args, ctx);
      if ('reply' in found) return found;
      const { goal } = found;
      const refund = refundOnDelete(goal);
      try {
        await removeGoal(ctx.uid, goal);
      } catch {
        return unreachable();
      }
      // No undo: putting the money back on a goal would mean a deposit the balance may no longer cover.
      return {
        reply:
          refund > 0
            ? t('exus.goal.deletedRefund', { name: goal.name, amount: formatMoney(refund, locale()) })
            : t('exus.goal.deleted', { name: goal.name }),
        write: done(t('goals.deleted')),
      };
    },
  },
} satisfies Record<string, CommandHandler>;
