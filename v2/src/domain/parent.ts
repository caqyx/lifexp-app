// The parent's view and the weekly report (docs/v2/PLAN.md 9.1, rows 6-1 and 6-3):
// what v1's parent.html and scripts/send-weekly-report.js show, computed from data
// the converters already read, with the same functions the child's screens use.
// Deliberate differences from v1 are listed in PLAN row 6-1 ("Różnice wobec v1"),
// each with a test in parent.test.ts.
//
// Money is in grosze, points are integers; formatting is the caller's job.
// Transactions (moneyTransactions) are not part of the parent's summary: v1's
// parent.html does not show them and the Firestore rules give them to the owner
// only. The weekly report runs on the server and has them, like v1's script.
import { utcDayKey, weekOf, zonedDayKey } from '@/lib/dates';
import { activityName, type Activity, type DayLog } from './activity';
import { choresRate, payoutHistory, unpaidChores, type ChoreEntry, type ChorePayout } from './chores';
import { goalProgress, type Goal, type GoalProgress } from './goals';
import { monthFlow, txsInMonth, type MoneyTx } from './money';
import { generalRate, levelOf, pointsToGrosze, type Level } from './points';
import type { Profile } from './profile';
import { statsWeeks, sumGaming, sumPoints, topActivities, type StatsDay } from './stats';
import { streakOf } from './streak';

/** v1 parent.html lists the 10 newest activities and the 10 newest purchases. */
export const PARENT_RECENT_COUNT = 10;
/** v1 parent.html lists the 12 newest chore payouts. */
export const PARENT_PAYOUT_COUNT = 12;
/** The top activities of the week shown to the parent. */
export const PARENT_TOP_COUNT = 3;
/** v1's report lists the three biggest expense categories. */
export const REPORT_TOP_CATEGORIES = 3;
/** The weekly report's calendar (owner's decision 2026-10-25: onSchedule, Europe/Warsaw). */
export const REPORT_TIME_ZONE = 'Europe/Warsaw';
/** v1's report: a transaction without a category counts as "inne". */
export const REPORT_OTHER_CATEGORY = 'inne';

/**
 * users/{uid}/purchases/{id}: v1's old shop (B14). Nothing writes it any more;
 * the parent and the report still show it (owner's decision 2026-10-25).
 */
export interface Purchase {
  id: string;
  description: string;
  /** v1 amount (złoty, int or float), in grosze. */
  grosze: number;
  pointsCost: number;
  at: Date | null;
}

/** The profile fields the parent's view and the report read. */
export type ParentProfile = Pick<
  Profile,
  'name' | 'points' | 'rateGeneral' | 'rateChores' | 'streakFreezeLastUsed' | 'goals'
>;

/** Everything about one child, as the converters read it. */
export interface ParentInput {
  profile: ParentProfile;
  /** dailyLog by UTC day key (G13). */
  days: ReadonlyMap<string, DayLog>;
  /** Activities in any order; the summary sorts them. */
  activities: readonly Activity[];
  /** activityDefs id → name. */
  activityNames: ReadonlyMap<string, string>;
  /** Unpaid chore entries (every entry that exists is unpaid, G8). */
  choreEntries: readonly ChoreEntry[];
  chorePayouts: readonly ChorePayout[];
  purchases: readonly Purchase[];
  /** money/balance.current in grosze; null when the document does not exist. */
  moneyBalance: number | null;
}

export interface NamedActivity {
  activity: Activity;
  name: string;
}

export interface TopWeekActivity {
  type: string;
  name: string;
  count: number;
  points: number;
}

export interface GoalRow {
  goal: Goal;
  progress: GoalProgress;
}

export interface ParentSummary {
  name: string;
  points: {
    total: number;
    /** total at the profile's general rate. */
    totalGrosze: number;
    spentAllTime: number;
    spentAllTimeGrosze: number;
    today: number;
  };
  level: Level;
  streakDays: number;
  /** today − 6 … today (UTC days, as v1 parent.html), oldest first: points and gaming per day. */
  week: StatsDay[];
  weekPoints: number;
  gaming: { todayMinutes: number; weekMinutes: number };
  /** Newest first, at most PARENT_RECENT_COUNT. */
  recentPurchases: Purchase[];
  /** Newest first, at most PARENT_RECENT_COUNT, named from activityDefs. */
  recentActivities: NamedActivity[];
  /** The most frequent activities of the 7 days (UTC days of their time). */
  topThisWeek: TopWeekActivity[];
  goals: GoalRow[];
  chores: {
    unpaidPoints: number;
    /** unpaidPoints at the profile's chores rate (G8.7: the current rate). */
    unpaidGrosze: number;
    /** Newest first, at most PARENT_PAYOUT_COUNT. */
    payouts: ChorePayout[];
  };
  moneyBalance: number | null;
}

const newestFirst = <T extends { at: Date | null }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));

function typeName(type: string, activities: readonly Activity[], names: ReadonlyMap<string, string>): string {
  const sample = activities.find((a) => a.type === type);
  return sample ? activityName(sample, names) : (names.get(type) ?? type);
}

function goalRows(goals: readonly Goal[], pointsTotal: number): GoalRow[] {
  return goals.map((goal) => ({ goal, progress: goalProgress(goal, pointsTotal) }));
}

/** The parent's view of one child on `now` (days are UTC days, as everywhere dailyLog is read, G13). */
export function parentSummary(input: ParentInput, now: Date): ParentSummary {
  const { profile } = input;
  const today = utcDayKey(now);
  const rate = generalRate(profile.rateGeneral.zloty, profile.rateGeneral.points);
  const week = statsWeeks(input.days, today).thisWeek;
  const weekStart = week[0]?.key ?? today;
  const todayLog = input.days.get(today);
  const unpaid = unpaidChores(input.choreEntries, choresRate(profile.rateChores.zloty, profile.rateChores.points));

  const recent = newestFirst(input.activities);
  const inWeek = recent.filter((a) => {
    const day = utcDayKey(a.at);
    return day >= weekStart && day <= today;
  });

  return {
    name: profile.name,
    points: {
      total: profile.points.total,
      totalGrosze: pointsToGrosze(profile.points.total, rate),
      spentAllTime: profile.points.spentAllTime,
      spentAllTimeGrosze: pointsToGrosze(profile.points.spentAllTime, rate),
      today: todayLog?.pointsEarned ?? 0,
    },
    level: levelOf(profile.points.earnedAllTime),
    streakDays: streakOf(profile.streakFreezeLastUsed, input.days, today, now).streak.days,
    week,
    weekPoints: sumPoints(week),
    gaming: { todayMinutes: todayLog?.gamingMinutes ?? 0, weekMinutes: sumGaming(week) },
    recentPurchases: newestFirst(input.purchases).slice(0, PARENT_RECENT_COUNT),
    recentActivities: recent
      .slice(0, PARENT_RECENT_COUNT)
      .map((activity) => ({ activity, name: activityName(activity, input.activityNames) })),
    topThisWeek: topActivities(inWeek)
      .slice(0, PARENT_TOP_COUNT)
      .map((top) => ({ ...top, name: typeName(top.type, inWeek, input.activityNames) })),
    goals: goalRows(profile.goals, profile.points.total),
    chores: {
      unpaidPoints: unpaid.points,
      unpaidGrosze: unpaid.grosze,
      payouts: payoutHistory(input.chorePayouts).slice(0, PARENT_PAYOUT_COUNT),
    },
    moneyBalance: input.moneyBalance,
  };
}

// ── The weekly report (v1 send-weekly-report.js + email-templates/weekly-report.html) ──

/** What only the server reads for the report's Money section. */
export interface ReportMoneyInput {
  transactions: readonly MoneyTx[];
  /** money/settings.monthlyLimit in grosze (domain/money MONEY_LIMIT_DEFAULT when absent; 0 = no limit). */
  monthlyLimit: number;
}

export interface CategorySum {
  category: string;
  grosze: number;
}

export interface WeeklyReport {
  name: string;
  /** Monday … Sunday ("YYYY-MM-DD", Europe/Warsaw calendar). */
  days: string[];
  /** Points per day of the week, read from dailyLog under the same day keys. */
  pointsByDay: number[];
  /** Template points_earned. */
  points: number;
  /** Template balance_pln: points.total at the profile's general rate. */
  balanceGrosze: number;
  /** Template gaming_time. */
  gamingMinutes: number;
  /** Template purchases: purchases made during the week (Warsaw days of their time). */
  purchases: { count: number; grosze: number; points: number };
  money: {
    /** "YYYY-MM": the month of the week's Sunday, counted up to that Sunday. */
    monthKey: string;
    /** Template money_balance_pln (v1: 0 when Money was never opened). */
    balance: number;
    income: number;
    expenses: number;
    limit: number;
    /** limit > 0 and expenses above it (v1 money_limit_info / money_limit_color). */
    exceeded: boolean;
    /** The biggest expense categories, at most REPORT_TOP_CATEGORIES. */
    topCategories: CategorySum[];
    /** Template money_goals_status: users.goals with progress (money goals from saved). */
    goals: GoalRow[];
  };
}

/** The Monday of the week the report covers when it runs at `now` (the week that contains today in Warsaw). */
export function reportWeekStart(now: Date): string {
  return weekOf(zonedDayKey(now, REPORT_TIME_ZONE))[0] as string;
}

/**
 * The report goes only to a parent whose address was verified, and only when the
 * child turned the report on (PLAN 6-5). Returns the address or null.
 */
export function reportRecipient(profile: Pick<Profile, 'autoReport' | 'parentEmail' | 'parentEmailVerifiedAt'>): string | null {
  return profile.autoReport && profile.parentEmail && profile.parentEmailVerifiedAt ? profile.parentEmail : null;
}

// ── Alerts to the parent (PLAN 6-3b; owner's decision 2026-10-25: e-mail, at most one per day per kind) ──

/** Gaming in one day that the parent hears about (owner: 60 minutes). */
export const GAMING_ALERT_MINUTES = 60;

export type ParentAlertKind = 'gaming' | 'purchase';

/**
 * Where an alert goes: the verified parent address, unless the account is solo or the
 * child turned alerts off (parentAlerts, on by default). No autoReport needed.
 */
export function alertRecipient(
  profile: Pick<Profile, 'accountMode' | 'parentEmail' | 'parentEmailVerifiedAt' | 'parentAlerts'>,
): string | null {
  if (profile.accountMode === 'solo' || !profile.parentAlerts) return null;
  return profile.parentEmail && profile.parentEmailVerifiedAt ? profile.parentEmail : null;
}

/** A day's gaming that just reached the threshold (not one that was already over it). */
export function gamingCrossed(before: number, after: number): boolean {
  return before < GAMING_ALERT_MINUTES && after >= GAMING_ALERT_MINUTES;
}

function topExpenseCategories(transactions: readonly MoneyTx[], monthKey: string, lastDay: string): CategorySum[] {
  const sums = new Map<string, number>();
  for (const t of txsInMonth(transactions, monthKey)) {
    if (t.type !== 'expense' || t.date > lastDay) continue;
    const category = t.category || REPORT_OTHER_CATEGORY;
    sums.set(category, (sums.get(category) ?? 0) + t.grosze);
  }
  return [...sums]
    .map(([category, grosze]) => ({ category, grosze }))
    .sort((a, b) => b.grosze - a.grosze)
    .slice(0, REPORT_TOP_CATEGORIES);
}

/** The numbers of the weekly e-mail for the week that starts on Monday `weekStart`. */
export function weeklyReport(input: ParentInput & ReportMoneyInput, weekStart: string): WeeklyReport {
  const { profile } = input;
  const days = weekOf(weekStart);
  const sunday = days[6] as string;
  const pointsByDay = days.map((day) => input.days.get(day)?.pointsEarned ?? 0);
  const gamingMinutes = days.reduce((sum, day) => sum + (input.days.get(day)?.gamingMinutes ?? 0), 0);

  const bought = input.purchases.filter((p) => {
    if (!p.at) return false;
    const day = zonedDayKey(p.at, REPORT_TIME_ZONE);
    return day >= weekStart && day <= sunday;
  });

  const monthKey = sunday.slice(0, 7);
  const flow = monthFlow(input.transactions, monthKey, Number(sunday.slice(8, 10)));
  const rate = generalRate(profile.rateGeneral.zloty, profile.rateGeneral.points);

  return {
    name: profile.name,
    days,
    pointsByDay,
    points: pointsByDay.reduce((sum, p) => sum + p, 0),
    balanceGrosze: pointsToGrosze(profile.points.total, rate),
    gamingMinutes,
    purchases: {
      count: bought.length,
      grosze: bought.reduce((sum, p) => sum + p.grosze, 0),
      points: bought.reduce((sum, p) => sum + p.pointsCost, 0),
    },
    money: {
      monthKey,
      balance: input.moneyBalance ?? 0,
      income: flow.income,
      expenses: flow.expense,
      limit: input.monthlyLimit,
      exceeded: input.monthlyLimit > 0 && flow.expense > input.monthlyLimit,
      topCategories: topExpenseCategories(input.transactions, monthKey, sunday),
      goals: goalRows(profile.goals, profile.points.total),
    },
  };
}
