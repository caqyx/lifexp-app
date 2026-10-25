import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { HttpsError } from 'firebase-functions/https';
import { Timestamp } from 'firebase-admin/firestore';
import { fakeFirestore } from '../test/fakeFirestore';
import type { ReportMail, ReportMailer } from '../parent/mailer';
import { weeklyReport } from '../v2/domain/parent';
import { MANUAL_DAILY_LIMIT } from './config';
import { reportOne, runWeeklyReports } from './job';
import { createSendMyReportHandler } from './manual';
import { reportParams } from './params';

// Sunday 25 October 2026, 9:00 in Warsaw (CET from that day): the week of Monday the 19th.
const NOW = new Date('2026-10-25T08:00:00Z');
const WEEK = '2026-10-19';

const VERIFIED = { autoReport: true, parentEmailVerifiedAt: '2026-10-01T10:00:00Z' };

/** Ola: every section of the template has something in it. */
function seed() {
  const ola = 'uid-ola';
  return {
    [`users/${ola}`]: {
      name: 'Ola',
      ...VERIFIED,
      parentEmail: 'mama@poczta.pl',
      points: { total: 120, earnedAllTime: 620, spentAllTime: 50 },
      pointsRateGeneralZl: 1,
      pointsRateGeneralPts: 5,
      goals: [
        { id: 'g1', name: 'Rower', type: 'money', amount: 100, saved: 25, celebrated: false },
        { id: 'g2', name: 'Klocki', type: 'points', amount: 200, celebrated: false },
      ],
    },
    [`users/${ola}/dailyLog/2026-10-18`]: { pointsEarned: 99, gamingMinutes: 99 }, // the week before
    [`users/${ola}/dailyLog/2026-10-19`]: { pointsEarned: 30, gamingMinutes: 60 },
    [`users/${ola}/dailyLog/2026-10-25`]: { pointsEarned: 12, gamingMinutes: 5 },
    [`users/${ola}/purchases/p1`]: { description: 'Gra', amount: 8.5, pointsCost: 85, timestamp: Timestamp.fromDate(new Date('2026-10-20T10:00:00Z')) },
    [`users/${ola}/purchases/p2`]: { description: 'Stara', amount: 50, pointsCost: 500, timestamp: Timestamp.fromDate(new Date('2026-10-10T10:00:00Z')) },
    [`users/${ola}/money/balance`]: { current: 39 },
    [`users/${ola}/money/settings`]: { monthlyLimit: 50 },
    [`users/${ola}/moneyTransactions/t1`]: { type: 'income', amount: 100, category: 'kieszonkowe', date: '2026-10-02' },
    [`users/${ola}/moneyTransactions/t2`]: { type: 'expense', amount: 30, category: 'gry', date: '2026-10-05' },
    [`users/${ola}/moneyTransactions/t3`]: { type: 'expense', amount: 25.5, category: '', date: '2026-10-20' },
    [`users/${ola}/moneyTransactions/t4`]: { type: 'expense', amount: 77, category: 'gry', date: '2026-09-30' },
    // Not eligible: the address was never verified (v1 would have sent anyway).
    'users/uid-unverified': { name: 'Bartek', autoReport: true, parentEmail: 'tata@poczta.pl' },
    // Not eligible: the report is off.
    'users/uid-off': { name: 'Celina', autoReport: false, parentEmail: 'ciocia@poczta.pl', parentEmailVerifiedAt: '2026-10-01T10:00:00Z' },
    // Eligible, but the mail fails.
    'users/uid-fails': { name: 'Darek', ...VERIFIED, parentEmail: 'fail@poczta.pl' },
  } as Record<string, Record<string, unknown>>;
}

function setup(docs = seed()) {
  const store = fakeFirestore(docs);
  const sent: ReportMail[] = [];
  const mailer: ReportMailer = {
    async sendReport(mail) {
      if (mail.params.to_email.startsWith('fail@')) throw new Error('EmailJS 400 for fail@poczta.pl');
      sent.push(mail);
    },
  };
  const logs: string[] = [];
  const deps = { db: () => store.db, mailer: () => mailer, now: () => NOW, log: (e: string, d: Record<string, unknown>) => logs.push(`${e} ${JSON.stringify(d)}`) };
  return { store, sent, logs, deps };
}

describe('weeklyParentReport', () => {
  it('sends only to accounts with the report on and a verified address; counts each outcome', async () => {
    const t = setup();
    const counts = await runWeeklyReports(t.deps);
    assert.deepEqual(counts, { sent: 1, skipped: 1, alreadySent: 0, failed: 1 });
    assert.deepEqual(t.sent.map((m) => [m.uid, m.params.to_email]), [['uid-ola', 'mama@poczta.pl']]);
  });

  it('the numbers are v2 weeklyReport\'s for the Warsaw week, in v1\'s template formats', async () => {
    const t = setup();
    await runWeeklyReports(t.deps);
    const params = t.sent[0]!.params;
    assert.deepEqual(params, {
      to_email: 'mama@poczta.pl',
      user_name: 'Ola',
      points_earned: '42',
      balance_pln: '24.00 zł', // 120 pkt at 1 zł = 5 pkt (v1: a fixed /10)
      gaming_time: '1h 5m',
      purchases: '8.50',
      money_balance_pln: '39.00 zł',
      money_income_pln: '100.00 zł',
      money_expenses_pln: '55.50 zł',
      money_limit_info: '⚠️ 55.50 / 50.00 zł',
      money_limit_color: '#ff6b6b',
      money_top_categories: '1. gry: 30.00 zł\n2. inne: 25.50 zł',
      money_goals_status: '• Rower: zebrano 25.00 / 100.00 zł (25%)\n• Klocki: 120 / 200 pkt (60%)',
    });
    // The same as the shared domain function on the same data, called directly.
    const direct = weeklyReport(
      {
        profile: {
          name: 'Ola',
          points: { total: 120, earnedAllTime: 620, spentAllTime: 50 },
          rateGeneral: { zloty: 1, points: 5 },
          rateChores: { zloty: null, points: null },
          streakFreezeLastUsed: null,
          goals: [
            { id: 'g1', name: 'Rower', type: 'money', target: 100_00, saved: 25_00, celebrated: false },
            { id: 'g2', name: 'Klocki', type: 'points', target: 200, saved: 0, celebrated: false },
          ],
        },
        days: new Map([
          ['2026-10-19', { pointsEarned: 30, gamingMinutes: 60 }],
          ['2026-10-25', { pointsEarned: 12, gamingMinutes: 5 }],
        ]),
        activities: [],
        activityNames: new Map(),
        choreEntries: [],
        chorePayouts: [],
        purchases: [{ id: 'p1', description: 'Gra', grosze: 8_50, pointsCost: 85, at: new Date('2026-10-20T10:00:00Z') }],
        moneyBalance: 39_00,
        transactions: [
          { id: 't1', type: 'income', grosze: 100_00, category: 'kieszonkowe', note: '', date: '2026-10-02', source: 'manual', pointsCost: 0, createdAt: null },
          { id: 't2', type: 'expense', grosze: 30_00, category: 'gry', note: '', date: '2026-10-05', source: 'manual', pointsCost: 0, createdAt: null },
          { id: 't3', type: 'expense', grosze: 25_50, category: '', note: '', date: '2026-10-20', source: 'manual', pointsCost: 0, createdAt: null },
        ],
        monthlyLimit: 50_00,
      },
      WEEK,
    );
    assert.deepEqual(params, reportParams(direct, 'mama@poczta.pl'));
  });

  it('fills every variable of v1\'s template (email-templates/weekly-report.html), plus to_email', async () => {
    const t = setup();
    await runWeeklyReports(t.deps);
    const html = readFileSync(resolve(__dirname, '../../../email-templates/weekly-report.html'), 'utf8');
    const variables = [...new Set([...html.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))].sort();
    assert.ok(variables.length >= 12);
    assert.deepEqual(Object.keys(t.sent[0]!.params).sort(), [...variables, 'to_email'].sort());
  });

  it('once per week: a second run (or a retry) sends nothing; next week it sends again', async () => {
    const t = setup();
    await runWeeklyReports(t.deps);
    assert.equal(t.store.docs.get('users/uid-ola')?.lastReportSent, '2026-10-25');
    const again = await runWeeklyReports(t.deps);
    assert.deepEqual(again, { sent: 0, skipped: 1, alreadySent: 1, failed: 1 });
    assert.equal(t.sent.length, 1);
    const nextWeek = await runWeeklyReports({ ...t.deps, now: () => new Date('2026-11-01T08:00:00Z') });
    assert.equal(nextWeek.sent, 1);
    assert.equal(t.store.docs.get('users/uid-ola')?.lastReportSent, '2026-11-01');
  });

  it('a failed mail does not stop the others and leaves the week open for a retry', async () => {
    const docs = seed();
    docs['users/uid-fails']!.lastReportSent = '2026-10-11';
    const t = setup(docs);
    await runWeeklyReports(t.deps);
    assert.equal(t.sent.length, 1);
    assert.equal(t.store.docs.get('users/uid-fails')?.lastReportSent, '2026-10-11');
    assert.equal(await reportOne(t.deps, 'uid-fails', NOW), 'failed');
  });

  it('logs counts only: no names, addresses or uids', async () => {
    const t = setup();
    await runWeeklyReports(t.deps);
    const all = t.logs.join('\n');
    assert.match(all, /"sent":1/);
    for (const pii of ['Ola', 'Darek', 'Bartek', 'poczta', 'uid-']) assert.ok(!all.includes(pii), pii);
  });
});

describe('sendMyReportNow', () => {
  const call = (t: ReturnType<typeof setup>, uid: string | null, data?: unknown) =>
    createSendMyReportHandler(t.deps)({ auth: uid ? ({ uid, token: {} } as never) : undefined, data });

  async function rejects(p: Promise<unknown>, code: string, reason?: string) {
    try {
      await p;
    } catch (err) {
      assert.ok(err instanceof HttpsError);
      assert.equal(err.code, code);
      if (reason) assert.equal((err.details as { reason: string }).reason, reason);
      return;
    }
    assert.fail(`expected ${code}`);
  }

  it('requires sign-in and a verified address with the report on', async () => {
    const t = setup();
    await rejects(call(t, null), 'unauthenticated');
    await rejects(call(t, 'uid-unverified'), 'failed-precondition', 'noRecipient');
    await rejects(call(t, 'uid-off'), 'failed-precondition', 'noRecipient');
  });

  it('a dry run returns the params and sends nothing', async () => {
    const t = setup();
    const result = await call(t, 'uid-ola', { dryRun: true });
    assert.equal(result.dryRun, true);
    assert.equal(result.dryRun && result.params.points_earned, '42');
    assert.equal(t.sent.length, 0);
  });

  it(`sends now to the own parent's address, at most ${MANUAL_DAILY_LIMIT} a day, without using up Sunday's report`, async () => {
    const t = setup();
    for (let i = 0; i < MANUAL_DAILY_LIMIT; i++) assert.deepEqual(await call(t, 'uid-ola'), { dryRun: false, sentTo: 'm***@poczta.pl' });
    await rejects(call(t, 'uid-ola'), 'resource-exhausted', 'rateLimited');
    assert.equal(t.sent.length, MANUAL_DAILY_LIMIT);
    assert.equal(t.store.docs.get('users/uid-ola')?.lastReportSent, undefined);
    assert.equal((await runWeeklyReports(t.deps)).sent, 1);
  });
});
