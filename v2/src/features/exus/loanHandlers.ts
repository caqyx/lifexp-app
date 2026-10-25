// The loan commands (docs/v2/PLAN.md 6.5, "Money"): /pozyczam, /pozyczam-od, /splata,
// /pozyczki. They go through the same services as the Loans view (services/loans:
// one transaction with the balance), so its rules hold: lending above the balance
// is refused, a repayment is capped at what is left. The balance is the transaction's
// to check, never the snapshot in the store. A command typed before the Money
// listeners delivered waits for them.
import { findLoan, loanLabel, loansByPerson } from '@/domain/exus/loans';
import { LOAN_NOTE_MAX, LOAN_PERSON_MAX, loanTotals, outstanding, type Loan, type LoanDirection } from '@/domain/loans';
import { locale, t } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { createLoan, removeLoan, repay } from '@/services/loans';
import type { CommandHandler, HandlerContext, HandlerResult } from './handlers';
import { loadedMoney, prepared } from './moneyHandlers';

/** The Money screen's own wording when the service cannot reach the server. */
const unreachable = (): HandlerResult => ({ reply: t('money.saveFailed') });

/** The write is done when the service resolved, so `saved` is already settled. */
const done = (toast: string): NonNullable<HandlerResult['write']> => ({ saved: Promise.resolve(), toast, failed: t('money.saveFailed') });

const PROBLEM_KEY = {
  personRequired: 'money.needPerson',
  amountRequired: 'money.needAmount',
  amountTooLarge: 'money.amountTooLarge',
  notEnoughBalance: 'money.notEnough',
} as const;

function newLoan(direction: LoanDirection) {
  return async (args: Record<string, unknown>, ctx: HandlerContext): Promise<HandlerResult> => {
    const person = String(args.person).trim();
    const note = typeof args.note === 'string' ? args.note.trim() : '';
    if (person.length > LOAN_PERSON_MAX) return { reply: t('exus.loan.personTooLong', { max: LOAN_PERSON_MAX }) };
    if (note.length > LOAN_NOTE_MAX) return { reply: t('exus.loan.noteTooLong', { max: LOAN_NOTE_MAX }) };
    const grosze = args.amount as number;
    try {
      await prepared(ctx);
      const result = await createLoan(ctx.uid, { direction, person, grosze, date: '', note });
      if (!result.ok) return { reply: t(PROBLEM_KEY[result.problem]) };
      const { id } = result;
      const amount = formatMoney(grosze, locale());
      const lines = [t(direction === 'lent' ? 'exus.loan.lent' : 'exus.loan.borrowed', { person, amount })];
      if (note) lines.push(t('exus.loan.noteLine', { note }));
      return {
        reply: lines.join(' '),
        write: done(t('money.loanAdded')),
        // Deleting the loan puts the balance back exactly (what is outstanding goes back, here all of it);
        // it is refused when borrowed money has been spent since, and then nothing changes.
        undo: {
          what: t(`exus.undoWhat.${direction === 'lent' ? 'lend' : 'borrow'}`, { person, amount }),
          run: async () => {
            const undone = await removeLoan(ctx.uid, { id });
            if (!undone.ok) throw new Error('balance');
          },
        },
      };
    } catch {
      return unreachable();
    }
  };
}

/** "Ola, na kino (15,00 zł)" for a list of loans that fit. */
const listed = (loans: readonly Loan[], lang: string) =>
  loans
    .slice(0, 5)
    .map((l) => `${loanLabel(l)} (${formatMoney(outstanding(l), lang)})`)
    .join('; ');

export const LOAN_HANDLERS = {
  lend: { run: newLoan('lent') },
  borrow: { run: newLoan('borrowed') },

  repay: {
    run: async (args, ctx) => {
      let loans: readonly Loan[];
      try {
        await prepared(ctx);
        loans = (await loadedMoney('loans')).loans ?? [];
      } catch {
        return unreachable();
      }
      const name = String(args.loan);
      const lang = locale();
      const found = findLoan(name, loans);
      if (found.kind === 'ambiguous') return { reply: t('exus.loan.ambiguous', { list: listed(found.loans, lang) }) };
      if (found.kind === 'none') return { reply: t('exus.loan.none', { name }) };
      const { loan } = found;
      const asked = args.amount as number;
      if (asked <= 0) return { reply: t('money.needAmount') };
      try {
        // Capped at what is left as the server has it, and the balance is checked in the same transaction.
        const result = await repay(ctx.uid, loan, asked);
        if (!result.ok) return { reply: t(PROBLEM_KEY[result.problem]) };
        if (result.grosze === 0) return { reply: t('exus.loan.nothingLeft', { person: loan.person }) };
        const lent = loan.direction === 'lent';
        const paid = formatMoney(result.grosze, lang);
        const lines = [
          result.settled
            ? t(lent ? 'exus.loan.settledLent' : 'exus.loan.settledBorrowed', { person: loan.person, amount: paid })
            : t(lent ? 'exus.loan.repaidLent' : 'exus.loan.repaidBorrowed', {
                person: loan.person,
                amount: paid,
                left: formatMoney(Math.max(0, outstanding(loan) - result.grosze), lang),
              }),
        ];
        if (result.grosze < asked) lines.push(t('exus.loan.capped'));
        // No undo: the services have no way to take a repayment back.
        return {
          reply: lines.join(' '),
          write: done(result.settled ? t('money.loanSettled', { person: loan.person }) : t('money.repaid', { amount: paid })),
        };
      } catch {
        return unreachable();
      }
    },
  },

  loans: {
    run: async (_args, ctx) => {
      let loans: readonly Loan[];
      try {
        await prepared(ctx);
        loans = (await loadedMoney('loans')).loans ?? [];
      } catch {
        return { reply: t('money.loadFailed') };
      }
      const lang = locale();
      const totals = loanTotals(loans);
      const people = loansByPerson(loans);
      if (people.lent.length === 0 && people.borrowed.length === 0) return { reply: t('money.noLoans') };
      const rows = (list: typeof people.lent) => list.map((p) => t('exus.loan.person', { person: p.person, amount: formatMoney(p.grosze, lang) }));
      return {
        reply: [
          t('exus.loan.owedToMe', { amount: formatMoney(totals.owedToMe, lang) }),
          ...rows(people.lent),
          t('exus.loan.iOwe', { amount: formatMoney(totals.iOwe, lang) }),
          ...rows(people.borrowed),
        ].join('\n'),
      };
    },
  },
} satisfies Record<string, CommandHandler>;
