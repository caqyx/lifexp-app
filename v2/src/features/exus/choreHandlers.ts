// The chore commands (docs/v2/PLAN.md 6.5, "Obowiązki"): /obowiazek, /obowiazki,
// /rozlicz. They go through the same services as the Chores screen and Today's
// card (services/chores), so an entry is the same document and the payout is the
// same atomic transaction. They read the live chore data and wait for it.
import { matchEntity } from '@/domain/exus/entities';
import { choreDayKey, choresOverview, type ChoreDay } from '@/domain/exus/chores';
import { choresRate, payoutPlan, type ChoreDef, type ChoreEntry } from '@/domain/chores';
import { locale, t } from '@/i18n';
import { formatDayMonth } from '@/lib/dates';
import { formatInteger } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { ensureChoreDefs, logChore, settleChores } from '@/services/chores';
import { today as todaySources } from '@/stores/today';
import type { CommandHandler, HandlerContext, HandlerResult } from './handlers';
import { loadedToday, seeded } from './loaded';

/** The chore list; an account without one gets v1's list first, as opening the Chores screen does. */
const loadedDefs = (uid: string) => seeded(loadedToday('choreDefs'), () => todaySources.value.choreDefs, () => ensureChoreDefs(uid));

const rateOf = ({ profile }: HandlerContext) => choresRate(profile.rateChores.zloty, profile.rateChores.points);

/** A list of names in a reply shows this many. */
const NAMES_SHOWN = 8;

const quoted = (names: readonly string[]) => names.slice(0, NAMES_SHOWN).map((n) => `„${n}”`).join(', ');

/** Unpaid entries now in the store: what a settle would pay (the transaction reads them again). */
const unpaidNow = (): readonly ChoreEntry[] => todaySources.value.choreEntries ?? [];

export const CHORE_HANDLERS = {
  'complete-chore': {
    run: async (args, { uid, today }) => {
      let defs: readonly ChoreDef[];
      try {
        defs = await loadedDefs(uid);
      } catch {
        return { reply: t('chores.loadFailed') };
      }
      const name = String(args.chore);
      const match = matchEntity(name, defs);
      if (match.kind === 'ambiguous') return { reply: t('exus.chore.ambiguous', { names: quoted(match.items.map((d) => d.name)) }) };
      if (match.kind === 'none') return { reply: t('exus.chore.none', { name }) };
      const def = match.item;
      const when = (args.when as ChoreDay | undefined) ?? 'today';
      const day = choreDayKey(when, today);
      // Written like on the screen: queued offline, a rejection shows the failure toast.
      const { saved, undo } = logChore(uid, def, day);
      const details = { name: def.name, points: def.points, date: formatDayMonth(day, locale()) };
      const lines = [t(when === 'yesterday' ? 'exus.chore.loggedYesterday' : 'exus.chore.loggedToday', details)];
      if (def.oneTime) lines.push(t('exus.chore.oneTimeGone'));
      return {
        reply: lines.join(' '),
        write: { saved, toast: t('chores.added', { name: def.name, points: def.points }), failed: t('chores.saveFailed') },
        // The entry goes (and a one-time chore comes back to the list), as the card's "Cofnij" does.
        undo: { what: t('exus.undoWhat.complete-chore', { name: def.name }), run: undo },
      };
    },
  },

  chores: {
    run: async (_args, ctx) => {
      let overview;
      try {
        const [defs, entries] = await Promise.all([loadedToday('choreDefs'), loadedToday('choreEntries')]);
        overview = choresOverview(defs, entries, ctx.today, rateOf(ctx));
      } catch {
        return { reply: t('chores.loadFailed') };
      }
      const lang = locale();
      const done = overview.done.map((row) => `${row.name}${row.doneToday > 1 ? ` ×${row.doneToday}` : ''} (+${row.points * row.doneToday} pkt)`);
      return {
        reply: [
          done.length > 0 ? t('exus.chore.doneToday', { list: done.join('; ') }) : t('exus.chore.noneToday'),
          t('exus.chore.unpaid', {
            points: formatInteger(overview.unpaid.points, lang),
            amount: formatMoney(overview.unpaid.grosze, lang),
            rate: formatMoney(Math.round(rateOf(ctx) * 100), lang),
          }),
          t('exus.chore.month', { count: overview.monthEntries }),
        ].join('\n'),
      };
    },
  },

  'settle-chores': {
    ready: async () => void (await loadedToday('choreEntries')),
    // Nothing to settle is answered before it asks for a "yes".
    check: (_args, ctx) => (payoutPlan(unpaidNow(), rateOf(ctx)) ? null : t('exus.chore.nothingToSettle')),
    effect: (_args, ctx) => {
      const plan = payoutPlan(unpaidNow(), rateOf(ctx));
      if (!plan) return t('exus.chore.nothingToSettle');
      const lang = locale();
      return t('exus.chore.settleEffect', {
        points: formatInteger(plan.points, lang),
        count: unpaidNow().length,
        amount: formatMoney(plan.grosze, lang),
        category: t('chores.incomeCategory'),
      });
    },
    run: async (_args, ctx) => {
      let entries: readonly ChoreEntry[];
      try {
        entries = await loadedToday('choreEntries');
      } catch {
        return { reply: t('chores.loadFailed') };
      }
      try {
        // One transaction: the payout record, the entries, the balance and the income together or not at all.
        const paid = await settleChores(ctx.uid, entries, rateOf(ctx), t('chores.incomeCategory'));
        if (!paid) return { reply: t('exus.chore.nothingToSettle') };
        const lang = locale();
        const amount = formatMoney(paid.grosze, lang);
        // No undo: nothing reverses a payout (PLAN.md 6.6).
        return {
          reply: t('exus.chore.settled', { points: formatInteger(paid.points, lang), amount }),
          write: { saved: Promise.resolve(), toast: t('chores.settled', { amount }), failed: t('chores.settleFailed') },
        };
      } catch {
        return { reply: t('chores.settleFailed') } satisfies HandlerResult;
      }
    },
  },
} satisfies Record<string, CommandHandler>;
