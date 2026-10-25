// Push reminders on the emulators (docs/v2/PLAN.md 9.1, row 6-7), without a browser:
// sendMyPushNow on the Functions emulator, called over HTTP as the signed-in account,
// reads its v1 tokens (users/{uid}/fcmTokens) and hands the payload to the fake FCM
// (emulatorPush/{uid}). The hourly pushReminders runs the same code per account
// (unit tests in functions/src/push); the emulator does not run schedules.
const { createUser, db } = require('../support/emulator');
const { test, expect } = require('../support/v2');

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo';
const CALL = 'http://127.0.0.1:5001/demo-lifexp/europe-west1/sendMyPushNow';
const APP = 'https://szymonrogalski098-collab.github.io/lifexp-app/app.html';

async function call(request, account, data) {
  const auth = await request.post(AUTH, { data: { email: account.email, password: account.password, returnSecureToken: true } });
  const token = (await auth.json()).idToken;
  const res = await request.post(CALL, { headers: { Authorization: `Bearer ${token}` }, data: { data }, timeout: 30000 });
  return { status: res.status(), body: await res.json() };
}

test('sendMyPushNow: a dry run shows the payload v1\'s sw.js shows; a real one reaches the devices and drops dead tokens', async ({ request }) => {
  test.setTimeout(60000);
  const account = await createUser({ tag: 'push-now' });
  const tokens = db.collection(`users/${account.uid}/fcmTokens`);
  await tokens.doc('tok-phone').set({ token: 'tok-phone', createdAt: new Date(), ua: 'test' });
  await tokens.doc('dead-laptop').set({ token: 'dead-laptop', createdAt: new Date(), ua: 'test' });

  const dry = await call(request, account, { dryRun: true });
  expect(dry.status).toBe(200);
  expect(dry.body.result).toEqual({
    dryRun: true,
    devices: 2,
    payload: {
      notification: { title: 'LifeXP', body: 'Powiadomienie testowe: przypomnienia docierają na to urządzenie.' },
      webpush: { fcmOptions: { link: APP } },
    },
  });
  expect((await db.doc(`emulatorPush/${account.uid}`).get()).exists).toBe(false);

  const real = await call(request, account, {});
  expect(real.body.result).toEqual({ dryRun: false, devices: 2, delivered: 1, removedTokens: 1 });
  expect((await db.doc(`emulatorPush/${account.uid}`).get()).data().tokens).toEqual(['dead-laptop', 'tok-phone']);
  expect((await tokens.get()).docs.map((d) => d.id)).toEqual(['tok-phone']);
});

test('sendMyPushNow without notifications turned on says so', async ({ request }) => {
  const account = await createUser({ tag: 'push-none' });
  const res = await call(request, account, { dryRun: true });
  expect(res.status).toBe(400);
  expect(res.body.error.details.reason).toBe('noTokens');
});
