// The LifeXP snapshot sent with an Ex-us message to the AI (docs/v2/PLAN.md 6.7).
// Pure: built from what the stores already hold, no reads of its own.
//
// - Only modules that are on get a section; data that has not loaded is left out.
// - Things get short refs (g1 goals, t1 tasks, c1 chore types, a1 activity types,
//   l1 loans, n1 notes) instead of Firestore ids; `refs` maps each back to the id
//   and the name the commands match by (resolveAction). No id, uid or e-mail ever
//   goes into the context.
// - Money is PLN as a number (312.5), not grosze: the model reads it as people
//   write it. Everything else in v2 stays in grosze.
// - Budget ~1-2k tokens: texts cut to 80 characters, lists capped (v1's 3 goals
//   and 30 tasks), and a hard cap on the serialized size (MAX_CONTEXT_BYTES, under
//   the backend's 16 KB) that drops list items in TRIM_ORDER until it fits.
import { unpaidChores, choresRate, type ChoreDef, type ChoreEntry } from '../chores';
import type { ActivityDef, DayLog } from '../activity';
import type { Goal } from '../goals';
import { outstanding, type Loan } from '../loans';
import { isModuleOn } from '../modules';
import { limitStatus, sortCategories, type MoneyCategory, type MoneyTx } from '../money';
import type { Note } from '../notes';
import { DAILY_LIMIT_DEFAULT, levelOf } from '../points';
import type { Language, Profile } from '../profile';
import type { Task } from '../tasks';
import { utcDayKey, zonedIsoMinutes } from '@/lib/dates';

export const TEXT_MAX = 80;
export const GOALS_MAX = 3;
export const TASKS_MAX_IN_CONTEXT = 30;
export const CHORE_DEFS_MAX = 20;
export const CATEGORIES_MAX = 20;
export const ACTIVITY_TYPES_MAX = 20;
export const LOANS_MAX = 10;
export const NOTES_MAX = 10;
export const RECENT_ACTIONS_MAX = 5;
export const PENDING_ACTIONS_MAX = 3;
/** The backend refuses more than 16 KB; this leaves room for the rest of the request. */
export const MAX_CONTEXT_BYTES = 12 * 1024;

export type RefKind = 'goal' | 'task' | 'chore' | 'activity' | 'loan' | 'note';
const PREFIX: Record<RefKind, string> = { goal: 'g', task: 't', chore: 'c', activity: 'a', loan: 'l', note: 'n' };

export interface RefTarget {
  kind: RefKind;
  /** The Firestore id (or the goal's id inside users.goals). Never sent. */
  id: string;
  /** What the command's entity slot matches by (matchEntity). */
  name: string;
}

export type ContextRefs = Record<string, RefTarget>;

export interface RecentAction {
  command: string;
  status: 'executed' | 'skipped' | 'failed';
}

export interface PendingCard {
  /** p1..p3, given by the chat to the cards still waiting. */
  ref: string;
  command: string;
  args: Record<string, unknown>;
}

/** What the stores hold; undefined = not loaded (left out). */
export interface ContextInput {
  now: Date;
  /** IANA zone of the device; `now` and the day for "overdue" are read in it. */
  timeZone: string;
  lang: Language;
  profile: Profile;
  /** dailyLog by UTC day (points earned today). */
  days?: ReadonlyMap<string, DayLog>;
  /** Grosze; null = no balance document. */
  balance?: number | null;
  txs?: readonly MoneyTx[];
  /** Grosze; 0 = no limit. */
  monthlyLimit?: number;
  categories?: readonly MoneyCategory[];
  loans?: readonly Loan[];
  tasks?: readonly Task[];
  choreDefs?: readonly ChoreDef[];
  choreEntries?: readonly ChoreEntry[];
  activityDefs?: readonly ActivityDef[];
  notes?: readonly Note[];
  recentActions?: readonly RecentAction[];
  pendingActions?: readonly PendingCard[];
}

interface WithRef {
  ref: string;
}

export interface ExusContext {
  now: string;
  tz: string;
  lang: Language;
  points: { total: number; today: number; dailyLimit: number; level: number };
  money?: { balance: number; monthSpent?: number; monthlyLimit?: number };
  goals: ({ name: string; type: 'points' | 'money'; amount: number; saved?: number } & WithRef)[];
  tasks?: ({ text: string; due: string | null; size: string; overdue?: true } & WithRef)[];
  chores?: { defs?: ({ name: string; points: number } & WithRef)[]; unsettledPts?: number };
  activityTypes?: ({ name: string; ptsPerHour: number } & WithRef)[];
  categories?: string[];
  loans?: ({ person: string; direction: 'lent' | 'borrowed'; left: number } & WithRef)[];
  notes?: ({ title: string } & WithRef)[];
  recentActions?: RecentAction[];
  pendingActions?: { ref: string; command: string; args: Record<string, string | number | boolean> }[];
}

export interface BuiltContext {
  context: ExusContext;
  refs: ContextRefs;
}

/** Cut to TEXT_MAX characters (an ellipsis marks the cut). */
export function clip(text: string, max = TEXT_MAX): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/** Grosze → PLN as a number (31250 → 312.5). */
export const pln = (grosze: number): number => Math.round(grosze) / 100;

const byteSize = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

/** Overdue first, then the soonest; no due day last. */
function taskOrder(a: Task, b: Task): number {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** What is dropped first when the snapshot is too big (one item at a time, from the end). */
export const TRIM_ORDER = ['notes', 'loans', 'categories', 'chores', 'activityTypes', 'recentActions', 'tasks', 'goals'] as const;

function trimOne(ctx: ExusContext, part: (typeof TRIM_ORDER)[number]): boolean {
  if (part === 'chores') return ctx.chores?.defs?.pop() !== undefined;
  const list = ctx[part];
  return Array.isArray(list) && list.pop() !== undefined;
}

export function buildContext(input: ContextInput, maxBytes = MAX_CONTEXT_BYTES): BuiltContext {
  const { profile } = input;
  const on = (module: 'money' | 'chores' | 'notes') => isModuleOn(module, profile);
  const now = zonedIsoMinutes(input.now, input.timeZone);
  // The person's calendar day (tasks are due on local days).
  const today = now.slice(0, 10);
  const all: ContextRefs = {};
  const counters: Record<RefKind, number> = { goal: 0, task: 0, chore: 0, activity: 0, loan: 0, note: 0 };
  const ref = (kind: RefKind, id: string, name: string): string => {
    const r = `${PREFIX[kind]}${++counters[kind]}`;
    all[r] = { kind, id, name };
    return r;
  };

  const context: ExusContext = {
    now,
    tz: input.timeZone,
    lang: input.lang,
    points: {
      total: profile.points.total,
      today: input.days?.get(utcDayKey(input.now))?.pointsEarned ?? 0,
      dailyLimit: profile.dailyLimit || DAILY_LIMIT_DEFAULT,
      level: levelOf(profile.points.earnedAllTime).level,
    },
    // Money goals are part of Money, but v1 shows every goal on the dashboard; a
    // money goal without the Money module is still the person's goal.
    goals: profile.goals.slice(0, GOALS_MAX).map((g: Goal) => ({
      ref: ref('goal', g.id, g.name),
      name: clip(g.name),
      type: g.type,
      amount: g.type === 'money' ? pln(g.target) : g.target,
      ...(g.type === 'money' ? { saved: pln(g.saved) } : {}),
    })),
  };

  if (on('money') && typeof input.balance === 'number') {
    context.money = { balance: pln(input.balance) };
    if (input.txs && input.monthlyLimit !== undefined) {
      const status = limitStatus(input.txs, today.slice(0, 7), input.monthlyLimit);
      context.money.monthSpent = pln(status.spent);
      if (status.limit > 0) context.money.monthlyLimit = pln(status.limit);
    }
  }

  if (input.tasks) {
    context.tasks = input.tasks
      .filter((t) => !t.done)
      .sort(taskOrder)
      .slice(0, TASKS_MAX_IN_CONTEXT)
      .map((t) => ({
        ref: ref('task', t.id, t.text),
        text: clip(t.text),
        due: t.dueDate,
        size: t.size,
        ...(t.dueDate !== null && t.dueDate < today ? { overdue: true as const } : {}),
      }));
  }

  if (on('chores') && (input.choreDefs || input.choreEntries)) {
    context.chores = {};
    if (input.choreDefs) {
      context.chores.defs = [...input.choreDefs]
        .sort((a, b) => a.order - b.order)
        .slice(0, CHORE_DEFS_MAX)
        .map((d) => ({ ref: ref('chore', d.id, d.name), name: clip(d.name), points: d.points }));
    }
    if (input.choreEntries) {
      const rate = choresRate(profile.rateChores.zloty, profile.rateChores.points);
      context.chores.unsettledPts = unpaidChores(input.choreEntries, rate).points;
    }
  }

  if (input.activityDefs) {
    context.activityTypes = [...input.activityDefs]
      .sort((a, b) => a.order - b.order)
      .slice(0, ACTIVITY_TYPES_MAX)
      .map((d) => ({ ref: ref('activity', d.id, d.name), name: clip(d.name), ptsPerHour: d.points }));
  }

  if (on('money') && input.categories) {
    context.categories = sortCategories(input.categories)
      .slice(0, CATEGORIES_MAX)
      .map((c) => clip(c.name));
  }

  if (on('money') && input.loans) {
    context.loans = input.loans
      .filter((l) => outstanding(l) > 0)
      .slice(0, LOANS_MAX)
      .map((l) => ({ ref: ref('loan', l.id, l.person), person: clip(l.person), direction: l.direction, left: pln(outstanding(l)) }));
  }

  if (on('notes') && input.notes) {
    context.notes = input.notes
      .filter((n) => !n.archived)
      .slice(0, NOTES_MAX)
      .map((n) => ({ ref: ref('note', n.id, n.title), title: clip(n.title) }));
  }

  if (input.recentActions?.length) context.recentActions = input.recentActions.slice(-RECENT_ACTIONS_MAX).map((a) => ({ ...a }));

  if (input.pendingActions?.length) {
    context.pendingActions = input.pendingActions.slice(0, PENDING_ACTIONS_MAX).map((p) => ({
      ref: p.ref,
      command: p.command,
      args: Object.fromEntries(
        Object.entries(p.args).flatMap(([k, v]): [string, string | number | boolean][] =>
          typeof v === 'string' ? [[k, clip(v)]] : typeof v === 'number' || typeof v === 'boolean' ? [[k, v]] : [],
        ),
      ),
    }));
  }

  // Over the cap: drop list items in a fixed order until it fits.
  for (const part of TRIM_ORDER) {
    while (byteSize(context) > maxBytes && trimOne(context, part));
  }

  // Only refs that are still in the snapshot can be used.
  const kept = new Set(JSON.stringify(context).match(/"ref":"[a-z]\d+"/g)?.map((m) => m.slice(7, -1)) ?? []);
  const refs: ContextRefs = Object.fromEntries(Object.entries(all).filter(([r]) => kept.has(r)));
  return { context, refs };
}
