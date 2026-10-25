// The weekly report to the parent (docs/v2/PLAN.md 9.1, rows 6-5/6-6), built by the
// v2 domain's weeklyReport (functions/src/v2 is a generated copy of v2/src) and sent
// with v1's EmailJS template. Per account: only with autoReport on and a verified
// parent address (reportRecipient); at most once per Warsaw week, claimed through
// v1's lastReportSent in a transaction before sending, so a retry or a second run
// does not send twice. One account's failure does not stop the others. Logs hold
// counts only: no names, addresses or uids.
import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { addDays, weekOf, zonedDayKey } from '../v2/lib/dates';
import { REPORT_TIME_ZONE, reportRecipient, reportWeekStart, weeklyReport, type ParentInput, type ReportMoneyInput } from '../v2/domain/parent';
import type { ReportMailer } from '../parent/mailer';
import { CONCURRENCY } from './config';
import { balanceOf, dayLogOf, monthlyLimitOf, purchaseOf, reportProfile, txOf, type ReportProfile } from './convert';
import { reportParams, type ReportParams } from './params';

export interface ReportDeps {
  db: () => Firestore;
  mailer: () => ReportMailer;
  now?: () => Date;
  log?: (event: string, data: Record<string, unknown>) => void;
}

export type Outcome = 'sent' | 'skipped' | 'alreadySent' | 'failed';

/** Everything weeklyReport needs about one account for the week starting `weekStart`. */
export async function loadReportInput(db: Firestore, uid: string, profile: ReportProfile, weekStart: string): Promise<ParentInput & ReportMoneyInput> {
  const user = (path: string) => db.doc(`users/${uid}/${path}`);
  const days = weekOf(weekStart);
  const sunday = days[6] as string;
  // A Warsaw day starts up to 2 h before its UTC day: a day earlier is enough.
  const since = new Date(`${addDays(weekStart, -1)}T00:00:00Z`);
  const [logs, purchases, txs, balance, settings] = await Promise.all([
    Promise.all(days.map((d) => user(`dailyLog/${d}`).get())),
    db.collection(`users/${uid}/purchases`).where('timestamp', '>=', since).get(),
    db.collection(`users/${uid}/moneyTransactions`).where('date', '>=', `${sunday.slice(0, 7)}-01`).where('date', '<=', sunday).get(),
    user('money/balance').get(),
    user('money/settings').get(),
  ]);
  return {
    profile,
    days: new Map(days.flatMap((d, i) => (logs[i]?.exists ? [[d, dayLogOf(logs[i]!.data())] as const] : []))),
    // Not in v1's template: the report reads none of these.
    activities: [],
    activityNames: new Map(),
    choreEntries: [],
    chorePayouts: [],
    purchases: purchases.docs.map((d) => purchaseOf(d.id, d.data())),
    moneyBalance: balance.exists ? balanceOf(balance.data()) : null,
    transactions: txs.docs.map((d) => txOf(d.id, d.data())),
    monthlyLimit: monthlyLimitOf(settings.exists ? settings.data() : undefined),
  };
}

/** The template params of one account's report for the week of `weekStart`, or null when it gets none. */
export async function buildReportParams(db: Firestore, uid: string, data: DocumentData, weekStart: string): Promise<ReportParams | null> {
  const profile = reportProfile(data);
  const to = reportRecipient(profile);
  if (!to) return null;
  const input = await loadReportInput(db, uid, profile, weekStart);
  return reportParams(weeklyReport(input, weekStart), to);
}

const sameWeek = (day: string | null, weekStart: string) => day !== null && weekOf(day)[0] === weekStart;

/** One account: claim the week, send, give the claim back if the mail fails. */
export async function reportOne(deps: ReportDeps, uid: string, at: Date): Promise<Outcome> {
  const db = deps.db();
  const ref = db.doc(`users/${uid}`);
  const weekStart = reportWeekStart(at);
  const today = zonedDayKey(at, REPORT_TIME_ZONE);
  const snap = await ref.get();
  if (!snap.exists) return 'skipped';
  const params = await buildReportParams(db, uid, snap.data() as DocumentData, weekStart);
  if (!params) return 'skipped';

  const claim = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    const previous = (fresh.data() as { lastReportSent?: unknown } | undefined)?.lastReportSent;
    if (typeof previous === 'string' && sameWeek(previous, weekStart)) return { claimed: false as const };
    tx.update(ref, { lastReportSent: today });
    return { claimed: true as const, previous };
  });
  if (!claim.claimed) return 'alreadySent';

  try {
    await deps.mailer().sendReport({ uid, params });
    return 'sent';
  } catch {
    // Not sent: the week is free again for the next run.
    await ref.update({ lastReportSent: claim.previous === undefined ? FieldValue.delete() : claim.previous }).catch(() => {});
    return 'failed';
  }
}

/** The Sunday run: every account with autoReport on, CONCURRENCY at a time. */
export async function runWeeklyReports(deps: ReportDeps): Promise<Record<Outcome, number>> {
  const at = (deps.now ?? (() => new Date()))();
  const log = deps.log ?? (() => {});
  const users = await deps.db().collection('users').where('autoReport', '==', true).get();
  const counts: Record<Outcome, number> = { sent: 0, skipped: 0, alreadySent: 0, failed: 0 };
  const ids = users.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const outcomes = await Promise.all(ids.slice(i, i + CONCURRENCY).map((uid) => reportOne(deps, uid, at).catch((): Outcome => 'failed')));
    for (const o of outcomes) counts[o] += 1;
  }
  log('weeklyParentReport', { accounts: ids.length, ...counts });
  return counts;
}
