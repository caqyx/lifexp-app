import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { HttpsError } from 'firebase-functions/https';
import { fakeFirestore } from '../test/fakeFirestore';
import { APP_URL, MANUAL_DAILY_LIMIT } from './config';
import { runPushReminders } from './job';
import { createSendMyPushHandler } from './manual';
import { DEAD_TOKEN_CODES, FAKE_PUSHBOX, FcmMessenger, createFakeMessenger, selectMessenger, type Messenger, type PushPayload } from './messaging';

// Tuesday 27 October 2026, 19:00 in Warsaw (CET): 4 days left in the month.
const AT_19 = new Date('2026-10-27T18:00:00Z');
const AT_20 = new Date('2026-10-27T19:00:00Z');
const AT_21 = new Date('2026-10-27T20:00:00Z');

const streakDays = (uid: string) => ({
  [`users/${uid}/dailyLog/2026-10-25`]: { pointsEarned: 10, gamingMinutes: 0 },
  [`users/${uid}/dailyLog/2026-10-26`]: { pointsEarned: 10, gamingMinutes: 0 },
});
const token = (uid: string, t: string) => ({ [`users/${uid}/fcmTokens/${t}`]: { token: t, ua: 'test' } });

function seed(): Record<string, Record<string, unknown>> {
  return {
    // Ola: a 2-day streak, nothing today, no freeze left (used 3 days ago); one live and one dead token.
    'users/ola': { name: 'Ola', lang: 'pl', notifHours: [19], streakFreezeLastUsed: '2026-10-24' },
    ...streakDays('ola'),
    ...token('ola', 'tok-ola'),
    ...token('ola', 'dead-ola'),
    // Bartek: the hour is his, but he never turned notifications on (no tokens).
    'users/bartek': { name: 'Bartek', notifHours: [19], streakFreezeLastUsed: '2026-10-24' },
    ...streakDays('bartek'),
    // Celina: not this hour.
    'users/celina': { name: 'Celina', notifHours: [20], streakFreezeLastUsed: '2026-10-24' },
    ...streakDays('celina'),
    ...token('celina', 'tok-celina'),
    // Darek: points today, no chores: nothing due.
    'users/darek': { name: 'Darek', notifHours: [19], streakFreezeLastUsed: '2026-10-24' },
    ...streakDays('darek'),
    'users/darek/dailyLog/2026-10-27': { pointsEarned: 5, gamingMinutes: 0 },
    ...token('darek', 'tok-darek'),
    // Ewa (English): no streak, chores defined, none logged lately, end of the month.
    'users/ewa': { name: 'Ewa', lang: 'en', notifHours: [19] },
    'users/ewa/choreDefs/dishes': { name: 'Dishes', points: 5, order: 0 },
    'users/ewa/chores/e1': { choreId: 'dishes', points: 5, dateISO: '2026-10-20', monthKey: '2026-10' },
    ...token('ewa', 'tok-ewa'),
  };
}

function setup(docs = seed(), opts: { throwOn?: string } = {}) {
  const store = fakeFirestore(docs);
  const sent: { uid: string; payload: PushPayload; tokens: readonly string[] }[] = [];
  const messenger: Messenger = {
    async send(uid, payload, tokens) {
      if (opts.throwOn === uid) throw new Error(`FCM down for ${uid}`);
      sent.push({ uid, payload, tokens });
      return tokens.map((t) => (t.startsWith('dead') ? { ok: false, code: DEAD_TOKEN_CODES[0] } : { ok: true }));
    },
  };
  const logs: string[] = [];
  const deps = (at: Date) => ({
    db: () => store.db,
    messenger: () => messenger,
    now: () => at,
    log: (e: string, d: Record<string, unknown>) => logs.push(`${e} ${JSON.stringify(d)}`),
  });
  return { store, sent, logs, deps };
}

describe('pushReminders', () => {
  it('reminds only the accounts of this Warsaw hour that have tokens and something due', async () => {
    const t = setup();
    const counts = await runPushReminders(t.deps(AT_19));
    assert.deepEqual(counts, { sent: 2, nothingDue: 1, noTokens: 1, alreadySent: 0, failed: 0, deadTokens: 1 });
    assert.deepEqual(t.sent.map((s) => s.uid).sort(), ['ewa', 'ola']);
    const ola = t.sent.find((s) => s.uid === 'ola')!;
    assert.deepEqual(ola.payload, {
      notification: { title: '🔥 Seria: 2 dni', body: 'Dziś jeszcze nic nie ma. Zaloguj coś, żeby jej nie stracić.' },
      webpush: { fcmOptions: { link: APP_URL } },
    });
    assert.deepEqual(t.sent.find((s) => s.uid === 'ewa')!.payload.notification, {
      title: '🧹 Chores',
      body: '4 days left this month. Anything from your chore list?',
    });
  });

  it('deletes the tokens FCM reports as dead, and only those', async () => {
    const t = setup();
    await runPushReminders(t.deps(AT_19));
    assert.equal(t.store.docs.has('users/ola/fcmTokens/dead-ola'), false);
    assert.equal(t.store.docs.has('users/ola/fcmTokens/tok-ola'), true);
  });

  it('a second run of the same hour sends nothing again', async () => {
    const t = setup();
    await runPushReminders(t.deps(AT_19));
    await runPushReminders(t.deps(AT_19));
    assert.equal(t.sent.length, 2);
  });

  it('at most one per hour and two per day: streak, then chores, then nothing', async () => {
    const docs = seed();
    docs['users/ola']!.notifHours = [19, 20, 21];
    Object.assign(docs, { 'users/ola/choreDefs/x': { name: 'X', points: 1, order: 0 } });
    const t = setup(docs);
    for (const at of [AT_19, AT_20, AT_21]) await runPushReminders(t.deps(at));
    assert.deepEqual(
      t.sent.filter((s) => s.uid === 'ola').map((s) => s.payload.notification.title),
      ['🔥 Seria: 2 dni', '🧹 Obowiązki'],
    );
    assert.deepEqual(t.store.docs.get('pushLog/ola_2026-10-27'), { kinds: ['streak', 'chores'], hours: [19, 20] });
  });

  it('chores at most every second day', async () => {
    const t = setup();
    await runPushReminders(t.deps(AT_19));
    await runPushReminders(t.deps(new Date('2026-10-28T18:00:00Z')));
    await runPushReminders(t.deps(new Date('2026-10-29T18:00:00Z')));
    assert.deepEqual(t.sent.filter((s) => s.uid === 'ewa').length, 2);
  });

  it('one account failing does not stop the others, and frees its hour for a retry', async () => {
    const t = setup(seed(), { throwOn: 'ola' });
    const counts = await runPushReminders(t.deps(AT_19));
    assert.equal(counts.failed, 1);
    assert.equal(counts.sent, 1);
    assert.deepEqual(t.store.docs.get('pushLog/ola_2026-10-27'), { kinds: [], hours: [] });
  });

  it('logs counts only: no names, uids or tokens', async () => {
    const t = setup();
    await runPushReminders(t.deps(AT_19));
    const all = t.logs.join('\n');
    assert.match(all, /"sent":2/);
    for (const pii of ['ola', 'Ola', 'ewa', 'tok-', 'dead-']) assert.ok(!all.includes(pii), pii);
  });

  it('the payload is what v1\'s sw.js shows and opens', () => {
    const sw = readFileSync(resolve(__dirname, '../../../sw.js'), 'utf8');
    // onBackgroundMessage shows payload.notification's title and body.
    assert.match(sw, /const n = payload\.notification \|\| \{\};/);
    assert.match(sw, /n\.title/);
    assert.match(sw, /n\.body/);
    // A tap opens v1's app (sw.js notificationclick) — the link FCM uses points there too.
    assert.match(sw, /openWindow\('app\.html'\)/);
    assert.ok(APP_URL.endsWith('/app.html'));
  });
});

describe('messaging', () => {
  it('the fake messenger cannot exist outside the Functions emulator', () => {
    assert.throws(() => createFakeMessenger(() => fakeFirestore().db, {}), /only in the Functions emulator/);
    assert.ok(selectMessenger({}, () => fakeFirestore().db) instanceof FcmMessenger);
  });

  it('in the emulator the fake keeps the payload and answers "not registered" for dead tokens', async () => {
    const store = fakeFirestore();
    const fake = selectMessenger({ FUNCTIONS_EMULATOR: 'true' }, () => store.db);
    const payload = { notification: { title: 't', body: 'b' }, webpush: { fcmOptions: { link: APP_URL } } };
    const results = await fake.send('u1', payload, ['tok', 'dead-x']);
    assert.deepEqual(results, [{ ok: true }, { ok: false, code: 'messaging/registration-token-not-registered' }]);
    assert.deepEqual(store.docs.get(`${FAKE_PUSHBOX}/u1`)?.payload, payload);
  });
});

describe('sendMyPushNow', () => {
  const call = (t: ReturnType<typeof setup>, uid: string | null, data?: unknown) =>
    createSendMyPushHandler(t.deps(AT_19))({ auth: uid ? ({ uid, token: {} } as never) : undefined, data });

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

  it('requires sign-in and tokens', async () => {
    const t = setup();
    await rejects(call(t, null), 'unauthenticated');
    await rejects(call(t, 'bartek'), 'failed-precondition', 'noTokens');
  });

  it('a dry run returns the payload and sends nothing', async () => {
    const t = setup();
    assert.deepEqual(await call(t, 'ewa', { dryRun: true }), {
      dryRun: true,
      devices: 1,
      payload: { notification: { title: 'LifeXP', body: 'Test notification: reminders reach this device.' }, webpush: { fcmOptions: { link: APP_URL } } },
    });
    assert.equal(t.sent.length, 0);
  });

  it(`sends to the own devices, at most ${MANUAL_DAILY_LIMIT} a day, removing dead tokens`, async () => {
    const t = setup();
    assert.deepEqual(await call(t, 'ola'), { dryRun: false, devices: 2, delivered: 1, removedTokens: 1 });
    for (let i = 1; i < MANUAL_DAILY_LIMIT; i++) await call(t, 'ola');
    await rejects(call(t, 'ola'), 'resource-exhausted', 'rateLimited');
    // The tests do not use up the day's reminders.
    assert.equal((await runPushReminders(t.deps(AT_19))).sent, 2);
  });
});
