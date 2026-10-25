// Collects what the stores hold into the Ex-us context snapshot (domain/exus/context,
// docs/v2/PLAN.md 6.7). No reads of its own: the Ex-us screen already runs the
// listeners (tasks, Today, Money, notes for the modules that are on); a source
// that has not delivered within CONTEXT_WAIT_MS, or failed, is left out.
//
// One builder fed by the stores rather than a `FeatureDef.exusContext` per module:
// the stores are not split by module (Today holds chores and activity types, Money
// holds loans and categories), FeatureDef lives in the app layer, and the size cap
// has to trim across all sections at once. A module that is off is left out by
// buildContext from the profile, as a per-module hook would.
import {
  buildContext,
  type BuiltContext,
  type PendingCard,
  type RecentAction,
} from '@/domain/exus/context';
import { resolveAction, type AiAction } from '@/domain/exus/aiAction';
import type { CommandSpec } from '@/domain/exus/commands';
import { isModuleOn } from '@/domain/modules';
import type { Language, Profile } from '@/domain/profile';
import { t } from '@/i18n';
import { money } from '@/stores/money';
import { notes } from '@/stores/notes';
import { tasks } from '@/stores/tasks';
import { today as todaySources } from '@/stores/today';
import { waitFor } from './loaded';

/** How long a message waits for a store that has not delivered yet. */
export const CONTEXT_WAIT_MS = 1500;

const soon = <T,>(pick: () => T | undefined, failed: () => boolean): Promise<T | undefined> =>
  waitFor(pick, failed, CONTEXT_WAIT_MS).catch(() => undefined);

const todayPart = <K extends 'days' | 'activityDefs' | 'choreDefs' | 'choreEntries'>(key: K) =>
  soon(
    () => todaySources.value[key] ?? undefined,
    () => todaySources.value.failed,
  );

const moneyPart = <K extends 'txs' | 'categories' | 'limit' | 'loans' | 'balance'>(key: K) =>
  soon(
    () => (money.value[key] === undefined ? undefined : money.value[key]),
    () => money.value.failed,
  );

export interface ContextExtras {
  recentActions?: readonly RecentAction[];
  pendingActions?: readonly PendingCard[];
}

export async function exusContext(profile: Profile, lang: Language, extras: ContextExtras = {}, now = new Date()): Promise<BuiltContext> {
  const moneyOn = isModuleOn('money', profile);
  const notesOn = isModuleOn('notes', profile);
  const [days, activityDefs, choreDefs, choreEntries, taskList, noteList, balance, txs, monthlyLimit, categories, loans] = await Promise.all([
    todayPart('days'),
    todayPart('activityDefs'),
    todayPart('choreDefs'),
    todayPart('choreEntries'),
    soon(
      () => tasks.value.list,
      () => tasks.value.failed,
    ),
    notesOn
      ? soon(
          () => notes.value.list,
          () => notes.value.failed,
        )
      : undefined,
    moneyOn ? moneyPart('balance') : undefined,
    moneyOn ? moneyPart('txs') : undefined,
    moneyOn ? moneyPart('limit') : undefined,
    moneyOn ? moneyPart('categories') : undefined,
    moneyOn ? moneyPart('loans') : undefined,
  ]);
  return buildContext({
    now,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang,
    profile,
    days,
    activityDefs,
    choreDefs,
    choreEntries,
    tasks: taskList,
    notes: noteList,
    balance: balance ?? todaySources.value.balance,
    txs,
    monthlyLimit,
    categories,
    loans,
    recentActions: extras.recentActions,
    pendingActions: extras.pendingActions,
  });
}

/** An AI action's args for the pipeline, or the chat's answer when its ref is not one Ex-us gave. */
export function aiActionArgs(
  action: AiAction,
  built: BuiltContext,
  spec: CommandSpec,
  today: string,
): { ok: true; args: Record<string, unknown>; missing: string[] } | { ok: false; reply: string } {
  const resolved = resolveAction(action, built.refs, spec, today);
  if (!resolved.ok) return { ok: false, reply: t('exus.ai.unknownRef') };
  return { ok: true, args: resolved.args, missing: resolved.missing };
}
