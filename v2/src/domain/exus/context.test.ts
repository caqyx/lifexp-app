import { describe, expect, it } from 'vitest';
import type { ChoreDef, ChoreEntry } from '@/domain/chores';
import type { ActivityDef } from '@/domain/activity';
import type { Goal } from '@/domain/goals';
import type { Loan } from '@/domain/loans';
import type { MoneyCategory, MoneyTx } from '@/domain/money';
import type { Note } from '@/domain/notes';
import type { Profile } from '@/domain/profile';
import type { Task } from '@/domain/tasks';
import {
  CATEGORIES_MAX,
  CHORE_DEFS_MAX,
  MAX_CONTEXT_BYTES,
  TASKS_MAX_IN_CONTEXT,
  TEXT_MAX,
  buildContext,
  clip,
  pln,
  type ContextInput,
} from './context';

// Ids and addresses that must never reach the context.
const SECRET = 'SECRETID';
const id = (n: string) => `${SECRET}-${n}`;
const EMAIL = 'kid@example.invalid';
const PARENT = 'parent@example.invalid';

const goal = (n: number, over: Partial<Goal> = {}): Goal => ({
  id: id(`goal${n}`),
  name: `Cel ${n}`,
  type: 'points',
  target: 1000,
  saved: 0,
  celebrated: false,
  ...over,
});

const profile = (over: Partial<Profile> = {}): Profile => ({
  name: 'Ala',
  email: EMAIL,
  emailVerified: true,
  accountModeChosen: true,
  accountMode: 'supervised',
  parentEmail: PARENT,
  parentEmailVerifiedAt: null,
  pendingParentEmail: PARENT,
  autoReport: true,
  modulesChosen: true,
  enabledModules: null,
  disabledModules: null,
  lang: 'pl',
  points: { total: 1240, earnedAllTime: 1100, spentAllTime: 0 },
  dailyLimit: null,
  rateGeneral: { zloty: null, points: null },
  rateChores: { zloty: 1, points: 10 },
  streakFreezeLastUsed: null,
  pcBuild: null,
  goals: [goal(1, { type: 'money', target: 150000, saved: 12050, name: 'Rower' }), goal(2)],
  moneyIncomeAllTime: null,
  choresCard: { mode: 'random', ids: [] },
  achievements: [],
  lastBugReportAt: null,
  ...over,
});

const task = (n: number, due: string | null, over: Partial<Task> = {}): Task => ({
  id: id(`task${n}`),
  text: `Zadanie ${n}`,
  dueDate: due,
  size: 'M',
  done: false,
  createdAt: null,
  penaltyApplied: false,
  ...over,
});
const choreDef = (n: number): ChoreDef => ({ id: id(`chore${n}`), name: `Obowiązek ${n}`, desc: '', emoji: '', points: n, oneTime: false, order: n });
const entry = (n: number, points: number): ChoreEntry => ({
  id: id(`entry${n}`),
  choreId: id('chore1'),
  name: 'Obowiązek 1',
  emoji: '',
  points,
  dateISO: '2026-10-24',
  monthKey: '2026-10',
  createdAt: null,
});
const activity = (n: number): ActivityDef => ({ id: id(`act${n}`), name: `Rodzaj ${n}`, points: 10 * n, order: n, icon: null, color: null });
const category = (n: number, name = `kategoria ${String(n).padStart(2, '0')}`): MoneyCategory => ({ id: id(`cat${n}`), name, color: '#000000' });
const expense = (grosze: number, date: string): MoneyTx => ({
  id: id(`tx${date}`),
  type: 'expense',
  grosze,
  category: 'jedzenie',
  note: '',
  date,
  source: 'manual',
  pointsCost: 0,
  createdAt: null,
});
const loan = (n: number, grosze: number, repaid: number): Loan => ({
  id: id(`loan${n}`),
  person: `Osoba ${n}`,
  direction: n % 2 ? 'lent' : 'borrowed',
  grosze,
  repaid,
  note: '',
  date: '2026-10-01',
  createdAt: null,
  completedAt: null,
});
const note = (n: number, archived = false): Note => ({
  id: id(`note${n}`),
  title: `Notatka ${n}`,
  content: 'treść',
  icon: '',
  color: '',
  createdAt: null,
  archived,
});

// 18:40 in Warsaw on 25 October 2026 (CET, UTC+1).
const NOW = new Date('2026-10-25T17:40:00Z');

const seeded = (over: Partial<ContextInput> = {}): ContextInput => ({
  now: NOW,
  timeZone: 'Europe/Warsaw',
  lang: 'pl',
  profile: profile(),
  days: new Map([['2026-10-25', { pointsEarned: 90, gamingMinutes: 0 }]]),
  balance: 31250,
  txs: [expense(14000, '2026-10-03'), expense(9999, '2026-09-30')],
  monthlyLimit: 20000,
  categories: [category(1, 'szkoła'), category(2, 'gry'), category(3, 'jedzenie')],
  loans: [loan(1, 2000, 500), loan(2, 1000, 1000)],
  tasks: [task(1, '2026-10-26'), task(2, '2026-10-20', { size: 'S' }), task(3, '2026-10-30', { done: true }), task(4, null)],
  choreDefs: [choreDef(2), choreDef(1)],
  choreEntries: [entry(1, 50), entry(2, 35)],
  activityDefs: [activity(1)],
  notes: [note(1), note(2, true)],
  recentActions: [{ command: 'create-task', status: 'executed' }],
  pendingActions: [{ ref: 'p1', command: 'create-task', args: { text: 'Mleko', due: '2026-10-26', amount: { grosze: 5 } } }],
  ...over,
});

describe('buildContext', () => {
  it('builds the PLAN 6.7 shape from the stores, money in PLN', () => {
    const { context, refs } = buildContext(seeded());
    expect(context).toEqual({
      now: '2026-10-25T18:40',
      tz: 'Europe/Warsaw',
      lang: 'pl',
      points: { total: 1240, today: 90, dailyLimit: 150, level: 3 },
      goals: [
        { ref: 'g1', name: 'Rower', type: 'money', amount: 1500, saved: 120.5 },
        { ref: 'g2', name: 'Cel 2', type: 'points', amount: 1000 },
      ],
      money: { balance: 312.5, monthSpent: 140, monthlyLimit: 200 },
      tasks: [
        { ref: 't1', text: 'Zadanie 2', due: '2026-10-20', size: 'S', overdue: true },
        { ref: 't2', text: 'Zadanie 1', due: '2026-10-26', size: 'M' },
        { ref: 't3', text: 'Zadanie 4', due: null, size: 'M' },
      ],
      chores: {
        defs: [
          { ref: 'c1', name: 'Obowiązek 1', points: 1 },
          { ref: 'c2', name: 'Obowiązek 2', points: 2 },
        ],
        unsettledPts: 85,
      },
      activityTypes: [{ ref: 'a1', name: 'Rodzaj 1', ptsPerHour: 10 }],
      categories: ['gry', 'jedzenie', 'szkoła'],
      loans: [{ ref: 'l1', person: 'Osoba 1', direction: 'lent', left: 15 }],
      notes: [{ ref: 'n1', title: 'Notatka 1' }],
      recentActions: [{ command: 'create-task', status: 'executed' }],
      pendingActions: [{ ref: 'p1', command: 'create-task', args: { text: 'Mleko', due: '2026-10-26' } }],
    });
    expect(refs.g1).toEqual({ kind: 'goal', id: id('goal1'), name: 'Rower' });
    expect(refs.t1).toEqual({ kind: 'task', id: id('task2'), name: 'Zadanie 2' });
    expect(refs.c1).toEqual({ kind: 'chore', id: id('chore1'), name: 'Obowiązek 1' });
    expect(refs.l1).toEqual({ kind: 'loan', id: id('loan1'), name: 'Osoba 1' });
    expect(Object.keys(refs).sort()).toEqual(['a1', 'c1', 'c2', 'g1', 'g2', 'l1', 'n1', 't1', 't2', 't3']);
  });

  it('never sends ids, uids or e-mail addresses', () => {
    const json = JSON.stringify(buildContext(seeded()).context);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain(EMAIL);
    expect(json).not.toContain(PARENT);
    expect(json).not.toMatch(/@/);
  });

  it('leaves out the sections of modules that are off', () => {
    const { context, refs } = buildContext(seeded({ profile: profile({ enabledModules: ['stats'] }) }));
    expect(context.money).toBeUndefined();
    expect(context.categories).toBeUndefined();
    expect(context.loans).toBeUndefined();
    expect(context.chores).toBeUndefined();
    expect(context.notes).toBeUndefined();
    // Always there: points, goals, tasks, activity types.
    expect(context.goals).toHaveLength(2);
    expect(context.tasks).toHaveLength(3);
    expect(context.activityTypes).toHaveLength(1);
    expect(Object.keys(refs).some((r) => /^[cln]/.test(r))).toBe(false);
  });

  it('leaves out what has not loaded', () => {
    const { context } = buildContext(seeded({ tasks: undefined, balance: undefined, choreDefs: undefined, notes: undefined }));
    expect(context.tasks).toBeUndefined();
    expect(context.money).toBeUndefined();
    expect(context.chores).toEqual({ unsettledPts: 85 });
    expect(context.notes).toBeUndefined();
  });

  it('shows the balance without a month line until the transactions arrive', () => {
    expect(buildContext(seeded({ txs: undefined })).context.money).toEqual({ balance: 312.5 });
    expect(buildContext(seeded({ monthlyLimit: 0 })).context.money).toEqual({ balance: 312.5, monthSpent: 140 });
  });

  it(`cuts texts to ${TEXT_MAX} characters`, () => {
    const long = 'Bardzo długie zadanie '.repeat(10);
    const { context, refs } = buildContext(seeded({ tasks: [task(1, '2026-10-26', { text: long })] }));
    const text = context.tasks![0]!.text;
    expect(text).toHaveLength(TEXT_MAX);
    expect(text.endsWith('…')).toBe(true);
    // The ref keeps the full name, which the command matches by.
    expect(refs.t1!.name).toBe(long);
    expect(clip('a\n  b')).toBe('a b');
  });

  it('caps the lists: 3 goals, 30 open tasks soonest first, 20 chores, 20 categories', () => {
    const tasks = Array.from({ length: 40 }, (_, i) => task(i, `2026-11-${String((i % 28) + 1).padStart(2, '0')}`));
    const { context } = buildContext(
      seeded({
        profile: profile({ goals: [goal(1), goal(2), goal(3), goal(4)] }),
        tasks,
        choreDefs: Array.from({ length: 25 }, (_, i) => choreDef(i)),
        categories: Array.from({ length: 25 }, (_, i) => category(i)),
      }),
    );
    expect(context.goals).toHaveLength(3);
    expect(context.tasks).toHaveLength(TASKS_MAX_IN_CONTEXT);
    const dues = context.tasks!.map((t) => t.due!);
    expect(dues).toEqual([...dues].sort());
    expect(context.chores?.defs).toHaveLength(CHORE_DEFS_MAX);
    expect(context.categories).toHaveLength(CATEGORIES_MAX);
    expect(context.categories![0]).toBe('kategoria 00');
  });

  it('stays under the byte cap by dropping list items in a fixed order', () => {
    const full = buildContext(seeded());
    const size = (c: unknown) => new TextEncoder().encode(JSON.stringify(c)).length;
    const total = size(full.context);
    expect(total).toBeLessThan(MAX_CONTEXT_BYTES);

    // Just too big for everything: the note goes first, then the loan.
    const noteBytes = total - size({ ...full.context, notes: [] });
    const lessNotes = buildContext(seeded(), total - 1);
    expect(lessNotes.context.notes).toEqual([]);
    expect(lessNotes.context.loans).toHaveLength(1);
    expect(lessNotes.refs.n1).toBeUndefined();
    const lessLoans = buildContext(seeded(), total - noteBytes - 1);
    expect(lessLoans.context.loans).toEqual([]);
    expect(lessLoans.context.categories).toHaveLength(3);

    // Far too small: every list in TRIM_ORDER is emptied; points, money and the
    // pending cards (at most 3, texts cut) are never dropped.
    const tiny = buildContext(seeded(), 100);
    expect(tiny.context.notes).toEqual([]);
    expect(tiny.context.loans).toEqual([]);
    expect(tiny.context.categories).toEqual([]);
    expect(tiny.context.chores?.defs).toEqual([]);
    expect(tiny.context.activityTypes).toEqual([]);
    expect(tiny.context.recentActions).toEqual([]);
    expect(tiny.context.tasks).toEqual([]);
    expect(tiny.context.goals).toEqual([]);
    expect(tiny.context.points.total).toBe(1240);
    expect(tiny.context.pendingActions).toHaveLength(1);
    expect(tiny.refs).toEqual({});

    // In between: the earlier lists are emptied before a later one is touched.
    const mid = buildContext(seeded(), size(tiny.context) + 120);
    expect(mid.context.notes).toEqual([]);
    expect(mid.context.goals!.length).toBeGreaterThan(0);
    for (const r of Object.keys(tiny.refs)) expect(JSON.stringify(tiny.context)).toContain(`"ref":"${r}"`);
  });

  it('keeps a typical account at about 1-2k tokens', () => {
    const tasks = Array.from({ length: 30 }, (_, i) => task(i, '2026-10-26', { text: `Zadanie domowe z przedmiotu numer ${i}` }));
    const bytes = new TextEncoder().encode(JSON.stringify(buildContext(seeded({ tasks })).context)).length;
    // ~4 bytes per token.
    expect(bytes).toBeLessThan(8000);
  });

  it('converts grosze to PLN', () => {
    expect(pln(31250)).toBe(312.5);
    expect(pln(1)).toBe(0.01);
  });
});
