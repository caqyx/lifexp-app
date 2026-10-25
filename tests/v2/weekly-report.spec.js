// The weekly report on the emulators (docs/v2/PLAN.md 9.1, rows 6-5/6-6), without a
// browser: sendMyReportNow on the Functions emulator, called over HTTP as the
// signed-in account, builds the report from Firestore with the shared v2 domain and
// hands it to the fake mailer (emulatorMail/{uid}_report). The Sunday schedule runs
// the same code per account (unit tests in functions/src/report).
const { Timestamp } = require('firebase-admin/firestore');
const { createUser, db } = require('../support/emulator');
const { test, expect } = require('../support/v2');

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo';
const CALL = 'http://127.0.0.1:5001/demo-lifexp/europe-west1/sendMyReportNow';
// The report's week is Warsaw's; today's dailyLog key is today's Warsaw date (always in that week).
const warsawToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());

async function idToken(request, { email, password }) {
  const res = await request.post(AUTH, { data: { email, password, returnSecureToken: true } });
  expect(res.ok()).toBe(true);
  return (await res.json()).idToken;
}

async function callReport(request, token, data) {
  const res = await request.post(CALL, { headers: { Authorization: `Bearer ${token}` }, data: { data }, timeout: 30000 });
  return { status: res.status(), body: await res.json() };
}

test('sendMyReportNow builds the report from Firestore and sends it to the verified parent address', async ({ request }) => {
  test.setTimeout(60000);
  const account = await createUser({
    tag: 'report-now',
    profile: {
      name: 'Ola',
      autoReport: true,
      parentEmail: 'mama@poczta.pl',
      parentEmailVerifiedAt: new Date().toISOString(),
      points: { total: 120, earnedAllTime: 620, spentAllTime: 50 },
      pointsRateGeneralZl: 1,
      pointsRateGeneralPts: 5,
    },
  });
  const user = db.doc(`users/${account.uid}`);
  await user.collection('dailyLog').doc(warsawToday()).set({ pointsEarned: 12, gamingMinutes: 65 });
  await user.collection('purchases').add({ description: 'Gra', amount: 8.5, pointsCost: 85, timestamp: Timestamp.now() });
  const token = await idToken(request, account);

  const dry = await callReport(request, token, { dryRun: true });
  expect(dry.status).toBe(200);
  expect(dry.body.result.params).toMatchObject({
    to_email: 'mama@poczta.pl',
    user_name: 'Ola',
    balance_pln: '24.00 zł',
    gaming_time: '1h 5m',
    purchases: '8.50',
  });
  expect((await db.doc(`emulatorMail/${account.uid}_report`).get()).exists).toBe(false);

  const sent = await callReport(request, token, {});
  expect(sent.status).toBe(200);
  expect(sent.body.result).toEqual({ dryRun: false, sentTo: 'm***@poczta.pl' });
  const mail = (await db.doc(`emulatorMail/${account.uid}_report`).get()).data();
  expect(mail.params).toEqual(dry.body.result.params);
  // A manual report does not use up Sunday's.
  expect((await user.get()).data()).not.toHaveProperty('lastReportSent');
});

test('sendMyReportNow refuses an account whose parent address is not verified', async ({ request }) => {
  const account = await createUser({ tag: 'report-unverified', profile: { autoReport: true, parentEmail: 'tata@poczta.pl' } });
  const res = await callReport(request, await idToken(request, account), {});
  expect(res.status).toBe(400);
  expect(res.body.error.details.reason).toBe('noRecipient');
});
