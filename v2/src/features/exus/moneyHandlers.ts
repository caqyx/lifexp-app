// The money commands (docs/v2/PLAN.md 6.5, "Money"): /wplyw, /wydatek, /saldo,
// /kategoria, /usun-transakcje. They go through the same services as the Money
// screen (services/money), so its rules hold: the balance never goes below zero,
// an expense costs points at the general rate, an income counts in
// moneyIncomeAllTime, a deleted transaction gives everything back. The limits
// are the services' transactions, never the snapshot in the store. A command
// typed before the Money listeners delivered waits for them.
import { effect } from '@preact/signals';
import { findTransaction, splitCategoryNote } from '@/domain/exus/money';
import { savedInGoals } from '@/domain/goals';
import {
  CATEGORY_NAME_MAX,
  TX_NOTE_MAX,
  limitStatus,
  resolveCategory,
  txProblem,
  type MoneyTx,
  type TxDraft,
  type TxProblem,
  type TxType,
} from '@/domain/money';
import { generalRate } from '@/domain/points';
import { locale, t } from '@/i18n';
import { formatDayMonth, utcDayKey } from '@/lib/dates';
import { formatInteger } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import {
  createCategory,
  prepareMoney,
  removeCreatedCategory,
  removeTransaction,
  removeTransactionById,
  saveMonthlyLimit,
  saveTransaction,
} from '@/services/money';
import { money, type MoneyState } from '@/stores/money';
import type { CommandHandler, HandlerContext, HandlerResult } from './handlers';

type Part = 'txs' | 'categories' | 'limit' | 'balance' | 'loans';

/** The Money data once the listeners have the parts asked for; rejects when it cannot be read. */
export function loadedMoney(...parts: Part[]): Promise<MoneyState> {
  return new Promise((resolve, reject) => {
    const stop = effect(() => {
      const state = money.value;
      const have = parts.every((p) => state[p] !== undefined);
      if (!have && !state.failed) return;
      queueMicrotask(() => stop());
      if (have) resolve(state);
      else reject(new Error('money'));
    });
  });
}

/** The listeners' data needs the account prepared (documents, starting categories, M2), as opening Money does. */
export const prepared = ({ uid, profile }: HandlerContext) => prepareMoney(uid, profile.moneyIncomeAllTime !== null);

const PROBLEM_KEY: Record<TxProblem, 'money.needAmount' | 'money.amountTooLarge' | 'money.needCategory' | 'money.notEnough'> = {
  amountRequired: 'money.needAmount',
  amountTooLarge: 'money.amountTooLarge',
  categoryRequired: 'money.needCategory',
  notEnoughBalance: 'money.notEnough',
};

/** The Money screen's own wording when the service cannot reach the server. */
const unreachable = (): HandlerResult => ({ reply: t('money.saveFailed') });

/** The write is done when the service resolved, so `saved` is already settled. */
const done = (toast: string): NonNullable<HandlerResult['write']> => ({ saved: Promise.resolve(), toast, failed: t('money.saveFailed') });

const label = (tx: Pick<MoneyTx, 'category' | 'note'>) => (tx.note ? `${tx.category}, ${tx.note}` : tx.category);

function addTransaction(type: TxType) {
  return async (args: Record<string, unknown>, ctx: HandlerContext): Promise<HandlerResult> => {
    const { uid, profile } = ctx;
    const lang = locale();
    let categories;
    try {
      await prepared(ctx);
      categories = (await loadedMoney('categories')).categories ?? [];
    } catch {
      return unreachable();
    }
    // `kategoria=nazwa` is explicit (an existing one or a new one); otherwise the words decide.
    const explicit = typeof args.category === 'string' ? args.category.trim() : null;
    const words = typeof args.rest === 'string' ? args.rest.split(/\s+/).filter(Boolean) : [];
    let category = '';
    let note = words.join(' ');
    if (explicit === null) {
      const split = splitCategoryNote(words, categories);
      if (split.kind === 'ambiguous') return { reply: t('exus.money.categoryAmbiguous', { names: split.names.map((n) => `„${n}”`).join(', ') }) };
      if (split.kind === 'found') ({ category, note } = split);
      else note = split.note;
    }
    if (explicit === null && !category) {
      const names = categories.map((c) => c.name).join(', ');
      return { reply: t(names ? 'exus.money.needCategory' : 'exus.money.needCategoryNone', { names }) };
    }
    if ((explicit ?? category).length > CATEGORY_NAME_MAX) return { reply: t('exus.money.categoryTooLong', { max: CATEGORY_NAME_MAX }) };
    if (note.length > TX_NOTE_MAX) return { reply: t('exus.money.noteTooLong', { max: TX_NOTE_MAX }) };

    const draft: TxDraft = {
      type,
      grosze: args.amount as number,
      category: explicit === null ? category : '',
      newCategory: explicit,
      note,
      date: typeof args.date === 'string' ? args.date : '',
    };
    const problem = txProblem(draft);
    if (problem) return { reply: t(PROBLEM_KEY[problem]) };
    const resolved = resolveCategory(draft, categories);
    const rate = generalRate(profile.rateGeneral.zloty, profile.rateGeneral.points);
    try {
      const result = await saveTransaction(uid, draft, categories, rate);
      if (!result.ok) return { reply: t(PROBLEM_KEY[result.problem]) };
      const { id, pointsCost } = result;
      const points = pointsCost > 0 ? formatInteger(pointsCost, lang) : null;
      const details = {
        amount: formatMoney(draft.grosze ?? 0, lang),
        category: resolved.name,
        note,
        date: formatDayMonth(draft.date || utcDayKey(new Date()), lang),
      };
      const lines = [t(`exus.money.${type}Saved${note ? 'Note' : ''}`, details)];
      if (resolved.create) lines.push(t('exus.money.categoryCreated', { name: resolved.name }));
      if (points) lines.push(t('exus.money.pointsLine', { points }));
      return {
        reply: lines.join(' '),
        write: done(points ? t('money.savedWithPoints', { points }) : t('money.saved')),
        // The delete service reverses balance, points and income exactly; it refuses an income whose
        // removal would take the balance below zero (the money was spent since), and then nothing changes.
        undo: {
          what: t(`exus.undoWhat.${type === 'income' ? 'add-money' : 'remove-money'}`, { amount: details.amount, category: resolved.name }),
          run: async () => {
            const undone = await removeTransactionById(uid, id);
            if (!undone.ok) throw new Error('balance');
          },
        },
      };
    } catch {
      return unreachable();
    }
  };
}

/** The transaction a /usun-transakcje names, or what to answer when there is no single one. */
function findTx(args: Record<string, unknown>, txs: readonly MoneyTx[], lang: string): { tx: MoneyTx } | { reply: string } {
  const ref = typeof args.ref === 'string' ? args.ref : undefined;
  const match = findTransaction(ref, txs);
  if (match.kind === 'found') return { tx: match.tx };
  if (match.kind === 'none') return { reply: ref && !/^(ostatni|last|latest)/i.test(ref.trim()) ? t('exus.money.txNone', { name: ref }) : t('exus.money.noTransactions') };
  const shown = match.txs.slice(0, 5).map((tx) => `• ${describeTx(tx, lang)}`);
  return { reply: [t('exus.money.txAmbiguous'), ...shown].join('\n') };
}

function describeTx(tx: MoneyTx, lang: string): string {
  const what = t(tx.type === 'income' ? 'exus.money.kindIncome' : 'exus.money.kindExpense');
  const date = tx.date ? ` · ${formatDayMonth(tx.date, lang)}` : '';
  return `${what} ${formatMoney(tx.grosze, lang)} (${label(tx)})${date}`;
}

export const MONEY_HANDLERS = {
  'add-money': { run: addTransaction('income') },
  'remove-money': { run: addTransaction('expense') },

  balance: {
    run: async (_args, { profile, today }) => {
      let state;
      try {
        state = await loadedMoney('txs', 'limit', 'balance');
      } catch {
        return { reply: t('money.loadFailed') };
      }
      const lang = locale();
      const lines = [t('exus.today.balance', { amount: formatMoney(state.balance ?? 0, lang) })];
      const status = limitStatus(state.txs ?? [], today.slice(0, 7), state.limit ?? 0);
      const spent = formatMoney(status.spent, lang);
      lines.push(
        status.limit > 0
          ? t('exus.money.monthLimit', { spent, limit: formatMoney(status.limit, lang) }) + (status.exceeded ? ` ${t('exus.money.overLimit')}` : '')
          : t('exus.money.monthNoLimit', { spent }),
      );
      const aside = savedInGoals(profile.goals);
      if (aside > 0) lines.push(t('money.inGoals', { amount: formatMoney(aside, lang) }));
      return { reply: lines.join('\n') };
    },
  },

  'money-limit': {
    run: async (args, ctx) => {
      const lang = locale();
      let before: number;
      try {
        await prepared(ctx);
        before = (await loadedMoney('limit')).limit ?? 0;
      } catch {
        return unreachable();
      }
      const grosze = args.amount as number;
      const shown = (limit: number) => (limit > 0 ? formatMoney(limit, lang) : t('exus.money.noLimit'));
      // The same service as the Money settings screen: 0 turns the limit off, too much is refused.
      const result = saveMonthlyLimit(ctx.uid, grosze);
      if (!result.ok) return { reply: t('money.amountTooLarge') };
      const { limit } = result;
      if (limit === before) return { reply: t('exus.money.limitSame', { limit: shown(limit) }) };
      return {
        reply: t(limit > 0 ? 'exus.money.limitSet' : 'exus.money.limitOff', { amount: shown(limit), before: shown(before) }),
        write: {
          saved: result.saved,
          toast: limit > 0 ? t('money.limitSaved', { amount: formatMoney(limit, lang) }) : t('money.limitOff'),
          failed: t('money.settingsSaveFailed'),
        },
        // Back to the limit it was (0 = off stays off).
        undo: {
          what: t('exus.undoWhat.money-limit', { limit: shown(limit), before: shown(before) }),
          run: async () => {
            const back = saveMonthlyLimit(ctx.uid, before);
            if (!back.ok) throw new Error(back.problem);
            await back.saved;
          },
        },
      };
    },
  },

  'create-category': {
    run: async (args, ctx) => {
      const name = String(args.name).trim();
      if (name.length > CATEGORY_NAME_MAX) return { reply: t('exus.money.categoryTooLong', { max: CATEGORY_NAME_MAX }) };
      let categories;
      try {
        await prepared(ctx);
        categories = (await loadedMoney('categories')).categories ?? [];
      } catch {
        return unreachable();
      }
      const result = createCategory(ctx.uid, name, categories);
      if (!result.ok) return { reply: t(result.problem === 'categoryExists' ? 'money.categoryExists' : 'money.needCategoryName') };
      const { id } = result;
      return {
        reply: t('money.categoryAdded', { name }),
        // The category is written like on the screen (queued offline); a rejection shows the failure toast.
        write: { saved: result.saved, toast: t('money.categoryAdded', { name }), failed: t('money.settingsSaveFailed') },
        // Transactions keep category names, so removing it changes nothing else.
        undo: { what: t('exus.undoWhat.create-category', { name }), run: () => removeCreatedCategory(ctx.uid, id) },
      };
    },
  },

  'delete-transaction': {
    ready: async () => void (await loadedMoney('txs')),
    check: (args) => {
      const found = findTx(args, money.value.txs ?? [], locale());
      return 'reply' in found ? found.reply : null;
    },
    effect: (args) => {
      const lang = locale();
      const found = findTx(args, money.value.txs ?? [], lang);
      if ('reply' in found) return found.reply;
      const { tx } = found;
      const parts = [t('exus.money.deleteWhat', { what: describeTx(tx, lang) })];
      parts.push(
        t(tx.type === 'income' ? 'exus.money.deleteIncomeEffect' : 'exus.money.deleteExpenseEffect', { amount: formatMoney(tx.grosze, lang) }),
      );
      if (tx.pointsCost > 0) parts.push(t('exus.money.deletePoints', { points: formatInteger(tx.pointsCost, lang) }));
      return parts.join(' ');
    },
    run: async (args, ctx) => {
      let txs;
      try {
        txs = (await loadedMoney('txs')).txs ?? [];
      } catch {
        return unreachable();
      }
      // Read again: the list may have changed while the dialog was open.
      const found = findTx(args, txs, locale());
      if ('reply' in found) return found;
      const { tx } = found;
      try {
        const result = await removeTransaction(ctx.uid, tx);
        if (!result.ok) return { reply: t('money.deleteWouldGoNegative') };
        // No undo: nothing puts a deleted transaction back with its time, balance and points checks.
        return { reply: t('exus.money.deleted', { what: describeTx(tx, locale()) }), write: done(t('money.deleted')) };
      } catch {
        return unreachable();
      }
    },
  },
} satisfies Record<string, CommandHandler>;
