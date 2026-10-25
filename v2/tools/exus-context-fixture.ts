// A context snapshot built by v2 for a typical account (domain/exus/context),
// committed as functions/src/test/fixtures/exus-context.json so the backend's
// tests check that what v2 sends passes exusTurn's input validation.
// Made-up data only (the repo is public).
//
// Regenerate:   npm run gen:exus-schema --prefix v2   (writes this and schema.gen.json)
// Stale check:  tools/exus-schema.test.ts
import type { ChoreDef, ChoreEntry } from '@/domain/chores';
import { buildContext } from '@/domain/exus/context';
import type { ActivityDef } from '@/domain/activity';
import type { Loan } from '@/domain/loans';
import type { MoneyCategory, MoneyTx } from '@/domain/money';
import type { Note } from '@/domain/notes';
import type { Profile } from '@/domain/profile';
import type { Task } from '@/domain/tasks';

export const CONTEXT_FIXTURE_PATH = '../functions/src/test/fixtures/exus-context.json';

const profile: Profile = {
  name: 'Tester',
  email: 'tester@example.invalid',
  emailVerified: true,
  accountModeChosen: true,
  accountMode: 'supervised',
  parentEmail: 'parent@example.invalid',
  parentEmailVerifiedAt: null,
  pendingParentEmail: null,
  autoReport: false,
  parentAlerts: true,
  modulesChosen: true,
  enabledModules: ['chores', 'money', 'stats', 'notes', 'aichat'],
  disabledModules: null,
  lang: 'pl',
  points: { total: 1240, earnedAllTime: 1600, spentAllTime: 360 },
  dailyLimit: 150,
  rateGeneral: { zloty: null, points: null },
  rateChores: { zloty: null, points: null },
  streakFreezeLastUsed: null,
  pcBuild: null,
  goals: [
    { id: 'goal-id-1', name: 'Rower', type: 'money', target: 150000, saved: 12000, celebrated: false },
    { id: 'goal-id-2', name: 'Nowa gra', type: 'points', target: 2000, saved: 0, celebrated: false },
  ],
  moneyIncomeAllTime: 50000,
  choresCard: { mode: 'random', ids: [] },
  achievements: [],
  lastBugReportAt: null,
};

const task = (id: string, text: string, dueDate: string, size: Task['size'] = 'M'): Task => ({
  id,
  text,
  dueDate,
  size,
  done: false,
  createdAt: null,
  penaltyApplied: false,
});

const chore = (id: string, name: string, points: number, order: number): ChoreDef => ({ id, name, desc: '', emoji: '', points, oneTime: false, order });
const entry = (id: string, choreId: string, points: number): ChoreEntry => ({
  id,
  choreId,
  name: 'Zmywarka',
  emoji: '',
  points,
  dateISO: '2026-10-24',
  monthKey: '2026-10',
  createdAt: null,
});
const activity = (id: string, name: string, points: number, order: number): ActivityDef => ({ id, name, points, order, icon: null, color: null });
const category = (id: string, name: string): MoneyCategory => ({ id, name, color: '#888888' });
const tx = (id: string, grosze: number): MoneyTx => ({
  id,
  type: 'expense',
  grosze,
  category: 'jedzenie',
  note: '',
  date: '2026-10-20',
  source: 'manual',
  pointsCost: 0,
  createdAt: null,
});
const loan: Loan = {
  id: 'loan-id-1',
  person: 'Kuba',
  direction: 'lent',
  grosze: 2000,
  repaid: 500,
  note: '',
  date: '2026-10-01',
  createdAt: null,
  completedAt: null,
};
const note: Note = { id: 'note-id-1', title: 'Lista zakupów', content: 'mleko', icon: '', color: '', createdAt: null, archived: false };

export function typicalContext() {
  return buildContext({
    now: new Date('2026-10-25T16:40:00Z'),
    timeZone: 'Europe/Warsaw',
    lang: 'pl',
    profile,
    days: new Map([['2026-10-25', { pointsEarned: 90, gamingMinutes: 0 }]]),
    balance: 31250,
    txs: [tx('tx-id-1', 14000)],
    monthlyLimit: 20000,
    categories: [category('cat-id-1', 'jedzenie'), category('cat-id-2', 'gry'), category('cat-id-3', 'szkoła')],
    loans: [loan],
    tasks: [task('task-id-1', 'Wypracowanie', '2026-10-26'), task('task-id-2', 'Matma zad. 5', '2026-10-24', 'S')],
    choreDefs: [chore('chore-id-1', 'Zmywarka', 15, 0), chore('chore-id-2', 'Odkurzanie', 20, 1)],
    choreEntries: [entry('entry-id-1', 'chore-id-1', 15)],
    activityDefs: [activity('learning', 'Nauka (JS, Unity, C#)', 40, 0), activity('reading', 'Czytanie / kurs', 25, 1)],
    notes: [note],
    recentActions: [{ command: 'create-task', status: 'executed' }],
    pendingActions: [{ ref: 'p1', command: 'create-task', args: { text: 'Mleko', due: '2026-10-26' } }],
  });
}

export function serializeContextFixture(): string {
  return `${JSON.stringify(typicalContext().context, null, 2)}\n`;
}
