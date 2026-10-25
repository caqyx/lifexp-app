// Parent view and weekly report (PLAN 9.1, 6-1 / 6-3). "v1:" cases match v1's
// parent.html or send-weekly-report.js; "Różnica" cases are the deliberate
// differences listed in PLAN row 6-1.
import { describe, expect, test } from 'vitest';
import type { Activity, DayLog } from './activity';
import type { ChoreEntry, ChorePayout } from './chores';
import type { Goal } from './goals';
import type { MoneyTx } from './money';
import {
  PARENT_PAYOUT_COUNT,
  PARENT_RECENT_COUNT,
  parentSummary,
  reportRecipient,
  reportWeekStart,
  weeklyReport,
  type ParentInput,
  type ParentProfile,
  type Purchase,
  type ReportMoneyInput,
} from './parent';

const NOW = new Date('2026-10-25T12:00:00Z'); // Sunday; UTC day 2026-10-25
const WEEK_START = '2026-10-19'; // Monday of that week

function logs(entries: Record<string, [number, number]>): Map<string, DayLog> {
  return new Map(Object.entries(entries).map(([k, [pointsEarned, gamingMinutes]]) => [k, { pointsEarned, gamingMinutes }]));
}

let n = 0;
const activity = (type: string, at: string, extra: Partial<Activity> = {}): Activity => ({
  id: `a${(n += 1)}`,
  type,
  typeName: null,
  desc: '',
  duration: 30,
  points: 10,
  at: new Date(at),
  ...extra,
});

const purchase = (at: string | null, grosze: number, pointsCost = 10): Purchase => ({
  id: `p${(n += 1)}`,
  description: 'Gra',
  grosze,
  pointsCost,
  at: at ? new Date(at) : null,
});

const entry = (points: number, dateISO = '2026-10-20'): ChoreEntry => ({
  id: `c${(n += 1)}`,
  choreId: 'dishes',
  name: 'Zmywanie',
  emoji: '🍽️',
  points,
  dateISO,
  monthKey: dateISO.slice(0, 7),
  createdAt: null,
});

const payout = (createdAt: string): ChorePayout => ({
  id: `y${(n += 1)}`,
  points: 10,
  grosze: 450,
  fromISO: null,
  toISO: null,
  createdAt: new Date(createdAt),
});

const tx = (type: MoneyTx['type'], grosze: number, date: string, category = 'jedzenie'): MoneyTx => ({
  id: `t${(n += 1)}`,
  type,
  grosze,
  category,
  note: '',
  date,
  source: 'manual',
  pointsCost: 0,
  createdAt: null,
});

const MONEY_GOAL: Goal = { id: 'g1', name: 'Rower', type: 'money', target: 100_00, saved: 25_00, celebrated: false };
const POINTS_GOAL: Goal = { id: 'g2', name: 'Gra', type: 'points', target: 200, saved: 0, celebrated: false };

function profile(over: Partial<ParentProfile> = {}): ParentProfile {
  return {
    name: 'Ola',
    points: { total: 120, earnedAllTime: 620, spentAllTime: 50 },
    rateGeneral: { zloty: null, points: null },
    rateChores: { zloty: null, points: null },
    streakFreezeLastUsed: null,
    goals: [],
    ...over,
  };
}

function input(over: Partial<ParentInput> = {}): ParentInput {
  return {
    profile: profile(),
    days: new Map(),
    activities: [],
    activityNames: new Map([['learning', 'Nauka']]),
    choreEntries: [],
    chorePayouts: [],
    purchases: [],
    moneyBalance: null,
    ...over,
  };
}

const money = (over: Partial<ReportMoneyInput> = {}): ReportMoneyInput => ({ transactions: [], monthlyLimit: 200_00, ...over });

describe('parentSummary: points, level, streak (v1 parent.html, G2, G3)', () => {
  test('v1: at the default rates the balance is 10 pkt = 1 zł, as parent.html shows it', () => {
    const s = parentSummary(input(), NOW);
    expect(s.points).toEqual({ total: 120, totalGrosze: 12_00, spentAllTime: 50, spentAllTimeGrosze: 5_00, today: 0 });
  });

  test('Różnica 1: points are worth the profile rate, not a fixed 10 pkt = 1 zł (B10)', () => {
    const s = parentSummary(input({ profile: profile({ rateGeneral: { zloty: 1, points: 5 } }) }), NOW);
    expect(s.points.totalGrosze).toBe(24_00); // v1: 12,00 zł
    expect(s.points.spentAllTimeGrosze).toBe(10_00); // v1: 5,00 zł
  });

  test.each([
    [0, 1, 0],
    [499, 1, 499],
    [620, 2, 120],
    [5000, 11, 0],
  ])('G2: earnedAllTime %i → level %i, %i into it', (earnedAllTime, level, intoLevel) => {
    const s = parentSummary(input({ profile: profile({ points: { total: 0, earnedAllTime, spentAllTime: 0 } }) }), NOW);
    expect(s.level).toEqual({ level, intoLevel });
  });

  test('G3.1: three active days in a row, today included', () => {
    const days = logs({ '2026-10-25': [10, 0], '2026-10-24': [10, 0], '2026-10-23': [10, 0], '2026-10-21': [10, 0] });
    const freezeUsed = '2026-10-22'; // freeze not available: the gap on 22.10 ends the streak
    expect(parentSummary(input({ days, profile: profile({ streakFreezeLastUsed: freezeUsed }) }), NOW).streakDays).toBe(3);
  });

  test('points today come from the UTC day', () => {
    const days = logs({ '2026-10-25': [42, 15] });
    const s = parentSummary(input({ days }), new Date('2026-10-25T23:30:00Z')); // already 26.10 in Warsaw
    expect(s.points.today).toBe(42);
    expect(s.gaming.todayMinutes).toBe(15);
  });
});

describe('parentSummary: the 7 days, gaming (v1 parent.html, 6-3)', () => {
  test('v1: today − 6 … today (UTC days), oldest first; days without a log are 0; sums of points and gaming', () => {
    const days = logs({ '2026-10-19': [30, 60], '2026-10-25': [12, 45], '2026-10-18': [99, 99] });
    const s = parentSummary(input({ days }), NOW);
    expect(s.week.map((d) => d.key)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(s.week.map((d) => d.points)).toEqual([30, 0, 0, 0, 0, 0, 12]);
    expect(s.weekPoints).toBe(42);
    expect(s.gaming).toEqual({ todayMinutes: 45, weekMinutes: 105 });
  });
});

describe('parentSummary: purchases and activities', () => {
  test('v1: the newest purchases first, at most 10; one without a time goes last', () => {
    const many = Array.from({ length: 12 }, (_, i) => purchase(`2026-10-${String(10 + i).padStart(2, '0')}T10:00:00Z`, 100 * (i + 1)));
    const s = parentSummary(input({ purchases: [purchase(null, 1), ...many] }), NOW);
    expect(s.recentPurchases).toHaveLength(PARENT_RECENT_COUNT);
    expect(s.recentPurchases[0]?.grosze).toBe(1200);
    expect(s.recentPurchases.some((p) => p.at === null)).toBe(false);
  });

  test('v1: the 10 newest activities, newest first', () => {
    const list = Array.from({ length: 11 }, (_, i) => activity('learning', `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00Z`));
    const s = parentSummary(input({ activities: list }), NOW);
    expect(s.recentActivities).toHaveLength(PARENT_RECENT_COUNT);
    expect(s.recentActivities[0]?.activity.at.toISOString()).toBe('2026-10-20T10:00:00.000Z');
  });

  test('Różnica 7: names from activityDefs (saved name first, raw id last), not v1 parent.html\'s fixed list of five', () => {
    const list = [
      activity('learning', '2026-10-25T10:00:00Z'),
      activity('__generated__', '2026-10-25T09:00:00Z', { typeName: 'Origami' }),
      activity('deleted-type', '2026-10-25T08:00:00Z'),
    ];
    const s = parentSummary(input({ activities: list }), NOW);
    expect(s.recentActivities.map((r) => r.name)).toEqual(['Nauka', 'Origami', 'deleted-type']);
  });

  test('top activities of the 7 days: most entries first; older entries do not count', () => {
    const list = [
      activity('learning', '2026-10-25T10:00:00Z'),
      activity('sport', '2026-10-24T10:00:00Z', { points: 5 }),
      activity('sport', '2026-10-19T00:30:00Z', { points: 7 }),
      activity('learning', '2026-10-18T23:59:00Z'), // UTC 18.10: outside today − 6 … today
      activity('reading', '2026-10-20T10:00:00Z'),
    ];
    const s = parentSummary(input({ activities: list }), NOW);
    expect(s.topThisWeek).toEqual([
      { type: 'sport', name: 'sport', count: 2, points: 12 },
      { type: 'learning', name: 'Nauka', count: 1, points: 10 },
      { type: 'reading', name: 'reading', count: 1, points: 10 },
    ]);
  });
});

describe('parentSummary: goals, chores, Money', () => {
  test('Różnica 3: a money goal counts what was put aside (saved), not the Money balance', () => {
    const s = parentSummary(input({ profile: profile({ goals: [MONEY_GOAL, POINTS_GOAL] }), moneyBalance: 90_00 }), NOW);
    expect(s.goals.map((g) => g.progress)).toEqual([
      { current: 25_00, missing: 75_00, share: 0.25, reached: false }, // v1: 90,00 / 100,00 zł (90%)
      { current: 120, missing: 80, share: 0.6, reached: false }, // v1 the same: the spendable points
    ]);
  });

  test('v1 (G8.6): at the default chores rate 7 pkt are 3,15 zł', () => {
    const s = parentSummary(input({ choreEntries: [entry(3), entry(4)] }), NOW);
    expect(s.chores.unpaidPoints).toBe(7);
    expect(s.chores.unpaidGrosze).toBe(3_15);
  });

  test('Różnica 2: unpaid chores at the profile chores rate, not a fixed 0,45 zł', () => {
    const s = parentSummary(
      input({ choreEntries: [entry(10), entry(30)], profile: profile({ rateChores: { zloty: 1, points: 2 } }) }),
      NOW,
    );
    expect(s.chores.unpaidGrosze).toBe(20_00); // v1: 18,00 zł
  });

  test('v1: payouts newest first, at most 12', () => {
    const payouts = Array.from({ length: 14 }, (_, i) => payout(`2026-0${(i % 9) + 1}-01T10:00:00Z`));
    const s = parentSummary(input({ chorePayouts: payouts }), NOW);
    expect(s.chores.payouts).toHaveLength(PARENT_PAYOUT_COUNT);
    expect(s.chores.payouts[0]?.createdAt?.toISOString()).toBe('2026-09-01T10:00:00.000Z');
  });

  test('v1: the Money balance only, and none when the account never opened Money', () => {
    expect(parentSummary(input({ moneyBalance: 12_34 }), NOW).moneyBalance).toBe(12_34);
    expect(parentSummary(input(), NOW).moneyBalance).toBeNull();
  });
});

describe('reportWeekStart: the week in Europe/Warsaw', () => {
  test.each([
    ['2026-10-25T18:00:00Z', '2026-10-19'], // Sunday evening
    ['2026-10-25T22:59:00Z', '2026-10-19'], // 23:59 in Warsaw (CET after the change)
    ['2026-10-25T23:00:00Z', '2026-10-26'], // already Monday in Warsaw, still Sunday in UTC
    ['2026-07-05T22:00:00Z', '2026-07-06'], // summer: midnight in Warsaw is 22:00 UTC
  ])('%s → %s', (at, monday) => {
    expect(reportWeekStart(new Date(at))).toBe(monday);
  });
});

describe('weeklyReport (v1 send-weekly-report.js, fixed)', () => {
  const base = (over: Partial<ParentInput> = {}, m: Partial<ReportMoneyInput> = {}) => ({ ...input(over), ...money(m) });

  test('Różnica 5: Monday … Sunday of the given week, not the 7 days before the run', () => {
    const days = logs({ '2026-10-18': [50, 50], '2026-10-19': [10, 30], '2026-10-25': [5, 15], '2026-10-26': [70, 70] });
    const r = weeklyReport(base({ days }), WEEK_START);
    expect(r.days).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(r.pointsByDay).toEqual([10, 0, 0, 0, 0, 0, 5]);
    expect(r.points).toBe(15);
    expect(r.gamingMinutes).toBe(45);
  });

  test('v1 sections: name, balance at the default rate', () => {
    const r = weeklyReport(base(), WEEK_START);
    expect(r.name).toBe('Ola');
    expect(r.balanceGrosze).toBe(12_00); // v1 balance_pln: 120 / 10
  });

  test('Różnica 1: the points balance at the profile rate', () => {
    const r = weeklyReport(base({ profile: profile({ rateGeneral: { zloty: 3, points: 10 } }) }), WEEK_START);
    expect(r.balanceGrosze).toBe(36_00); // v1: 12,00 zł
  });

  test('Różnica 5: purchases of the week by their day in Warsaw, all of them (v1: the last 7 × 24 h among the 20 newest)', () => {
    const purchases = [
      purchase('2026-10-18T22:30:00Z', 1_00), // Monday 19.10, 00:30 in Warsaw: in
      purchase('2026-10-18T21:30:00Z', 2_00), // Sunday 18.10, 23:30 in Warsaw: out
      purchase('2026-10-25T22:30:00Z', 4_00), // Sunday 25.10, 23:30 in Warsaw (CET from that day): in
      purchase('2026-10-25T23:30:00Z', 32_00), // Monday 26.10, 00:30 in Warsaw: out
      purchase('2026-10-22T10:00:00Z', 8_50, 85),
      purchase(null, 16_00),
    ];
    const r = weeklyReport(base({ purchases }), WEEK_START);
    expect(r.purchases).toEqual({ count: 3, grosze: 13_50, points: 105 });
  });

  test('Money: the month of the Sunday up to that Sunday; income, expenses, top three categories, "inne" for none', () => {
    const transactions = [
      tx('income', 100_00, '2026-10-02'),
      tx('expense', 30_00, '2026-10-05', 'gry'),
      tx('expense', 10_00, '2026-10-06', 'jedzenie'),
      tx('expense', 15_00, '2026-10-07', 'jedzenie'),
      tx('expense', 5_00, '2026-10-08', ''),
      tx('expense', 1_00, '2026-10-09', 'szkoła'),
      tx('expense', 99_00, '2026-10-26', 'gry'), // after the week's Sunday
      tx('expense', 77_00, '2026-09-30', 'gry'), // previous month
    ];
    const r = weeklyReport(base({ moneyBalance: 39_00 }, { transactions }), WEEK_START);
    expect(r.money).toMatchObject({ monthKey: '2026-10', balance: 39_00, income: 100_00, expenses: 61_00 });
    expect(r.money.topCategories).toEqual([
      { category: 'gry', grosze: 30_00 },
      { category: 'jedzenie', grosze: 25_00 },
      { category: 'inne', grosze: 5_00 },
    ]);
  });

  test('a week across two months reports the month of its Sunday so far', () => {
    const transactions = [tx('expense', 10_00, '2026-09-30'), tx('expense', 4_00, '2026-10-04')];
    const r = weeklyReport(base({}, { transactions }), '2026-09-28');
    expect(r.money).toMatchObject({ monthKey: '2026-10', expenses: 4_00 });
  });

  test.each([
    [200_00, 250_00, true],
    [200_00, 200_00, false],
    [0, 999_00, false],
  ])('v1 limit: limit %i, expenses %i → exceeded %s (0 = no limit)', (monthlyLimit, spent, exceeded) => {
    const r = weeklyReport(base({}, { monthlyLimit, transactions: [tx('expense', spent, '2026-10-20')] }), WEEK_START);
    expect(r.money.exceeded).toBe(exceeded);
    expect(r.money.limit).toBe(monthlyLimit);
  });

  test('v1: Money balance 0 when Money was never opened', () => {
    expect(weeklyReport(base(), WEEK_START).money.balance).toBe(0);
  });

  test('Różnica 4: goals from users.goals (money goals from saved), not the legacy moneyGoals', () => {
    const r = weeklyReport(base({ profile: profile({ goals: [MONEY_GOAL, POINTS_GOAL] }) }), WEEK_START);
    expect(r.money.goals.map((g) => [g.goal.name, g.progress.current, g.progress.share])).toEqual([
      ['Rower', 25_00, 0.25],
      ['Gra', 120, 0.6],
    ]);
  });
});

describe('reportRecipient', () => {
  const who = (autoReport: boolean, parentEmail: string, parentEmailVerifiedAt: string | null) =>
    reportRecipient({ autoReport, parentEmail, parentEmailVerifiedAt });

  test('the report on and the address verified → that address', () => {
    expect(who(true, 'rodzic@example.com', '2026-10-01T10:00:00Z')).toBe('rodzic@example.com');
  });

  test('Różnica 6: no report to an unverified address (v1 sends to any parentEmail)', () => {
    expect(who(true, 'rodzic@example.com', null)).toBeNull();
  });

  test('v1: no report when it is off or there is no address', () => {
    expect(who(false, 'rodzic@example.com', '2026-10-01T10:00:00Z')).toBeNull();
    expect(who(true, '', '2026-10-01T10:00:00Z')).toBeNull();
  });
});
