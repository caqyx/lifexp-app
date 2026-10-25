import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { HttpsError } from 'firebase-functions/https';
import { fakeFirestore } from '../test/fakeFirestore';
import { codeMatches, hashCode, maskEmail, newCode } from './code';
import { CODES, CODE_TTL_MS, DAY_LIMIT, EMAILJS, MAX_ATTEMPTS, SHORT_LIMIT, SHORT_WINDOW_MS } from './config';
import { createSendHandler, createVerifyHandler } from './handlers';
import { EmailJsMailer, FAKE_MAILBOX, createFakeMailer, selectMailer, type CodeMail, type Mailer } from './mailer';

const UID = 'kid';
const EMAIL = 'mama@poczta.pl';
const CODE = '482913';
const T0 = Date.parse('2026-10-25T12:00:00Z');

function setup(opts: { user?: Record<string, unknown> | null; failMail?: boolean; codes?: string[] } = {}) {
  const docs: Record<string, Record<string, unknown>> = {};
  if (opts.user !== null) docs[`users/${UID}`] = opts.user ?? { name: 'Ola', parentEmail: '' };
  const store = fakeFirestore(docs);
  const sent: CodeMail[] = [];
  const mailer: Mailer = {
    async sendCode(mail) {
      if (opts.failMail) throw new Error('EmailJS 400');
      sent.push(mail);
    },
  };
  let clock = T0;
  const codes = [...(opts.codes ?? [])];
  const logs: string[] = [];
  const deps = {
    db: () => store.db,
    mailer: () => mailer,
    now: () => clock,
    code: () => codes.shift() ?? CODE,
    log: (event: string, data: Record<string, unknown>) => logs.push(`${event} ${JSON.stringify(data)}`),
  };
  const send = createSendHandler(deps);
  const verify = createVerifyHandler(deps);
  const auth = (uid: string | null) => (uid ? ({ uid, token: {} } as never) : undefined);
  return {
    store,
    sent,
    logs,
    tick: (ms: number) => (clock += ms),
    send: (data: unknown = { email: EMAIL, lang: 'pl' }, uid: string | null = UID) => send({ auth: auth(uid), data }),
    verify: (code: unknown = CODE, uid: string | null = UID) => verify({ auth: auth(uid), data: { code, lang: 'pl' } }),
    user: () => store.docs.get(`users/${UID}`),
    codeDoc: () => store.docs.get(`${CODES}/${UID}`),
  };
}

async function rejects(promise: Promise<unknown>, code: string, reason?: string): Promise<HttpsError> {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof HttpsError, `expected HttpsError, got ${String(err)}`);
    assert.equal(err.code, code);
    if (reason) assert.equal((err.details as { reason?: string }).reason, reason);
    return err;
  }
  assert.fail(`expected ${code}`);
}

describe('sendParentEmailCode', () => {
  it('requires sign-in', async () => {
    const t = setup();
    await rejects(t.send(undefined, null), 'unauthenticated');
    assert.equal(t.sent.length, 0);
  });

  it('refuses an address that is not one (v1 regex), in the account language', async () => {
    const t = setup();
    for (const email of ['mama@poczta', '', 'x'.repeat(250) + '@a.pl', 42]) {
      await rejects(t.send({ email, lang: 'pl' }), 'invalid-argument', 'invalid');
    }
    const err = await rejects(t.send({ email: 'nope', lang: 'en' }), 'invalid-argument', 'invalid');
    assert.equal(err.message, 'Enter a valid e-mail address.');
    assert.equal(t.sent.length, 0);
    assert.equal(t.codeDoc(), undefined);
  });

  it('sends the code, keeps only a salted hash, marks the address pending, returns it masked', async () => {
    const t = setup({ user: { name: 'Ola', parentEmailCode: '111111', parentEmailCodeExpiry: 1 } });
    const result = await t.send({ email: ` ${EMAIL} `, lang: 'pl' });
    assert.deepEqual(result, { sentTo: 'm***@poczta.pl', expiresAt: T0 + CODE_TTL_MS });
    assert.deepEqual(t.sent, [{ uid: UID, to: EMAIL, userName: 'Ola', code: CODE }]);
    const stored = t.codeDoc()!;
    assert.equal(stored.email, EMAIL);
    assert.equal(stored.attempts, 0);
    assert.equal(stored.expiresAt, T0 + CODE_TTL_MS);
    assert.ok(codeMatches(CODE, stored.salt as string, stored.hash as string));
    // The plain code is nowhere in the database, nor in the logs; the address is not logged either.
    const everything = JSON.stringify([...t.store.docs.entries()]);
    assert.ok(!everything.includes(CODE));
    assert.ok(!t.logs.join('\n').includes(CODE));
    assert.ok(!t.logs.join('\n').includes('poczta'));
    // v1's client-side code is removed; the pending address is what v1 and v2 show.
    assert.deepEqual(t.user(), { name: 'Ola', pendingParentEmail: EMAIL });
  });

  it(`limits sends: ${SHORT_LIMIT} per 15 minutes and ${DAY_LIMIT} per day`, async () => {
    const t = setup();
    for (let i = 0; i < SHORT_LIMIT; i++) await t.send();
    await rejects(t.send(), 'resource-exhausted', 'rateLimited');
    assert.equal(t.sent.length, SHORT_LIMIT);
    let sent = SHORT_LIMIT;
    while (sent < DAY_LIMIT) {
      t.tick(SHORT_WINDOW_MS);
      for (let i = 0; i < SHORT_LIMIT && sent < DAY_LIMIT; i++, sent++) await t.send();
    }
    t.tick(SHORT_WINDOW_MS);
    await rejects(t.send(), 'resource-exhausted', 'rateLimited');
    assert.equal(t.sent.length, DAY_LIMIT);
    t.tick(24 * 60 * 60 * 1000);
    await t.send();
    assert.equal(t.sent.length, DAY_LIMIT + 1);
  });

  it('a send that EmailJS refuses counts, leaves no code and says so', async () => {
    const t = setup({ failMail: true });
    await rejects(t.send(), 'unavailable', 'sendFailed');
    const stored = t.codeDoc()!;
    assert.equal(stored.hash, undefined);
    assert.equal((stored.sends as number[]).length, 1);
    assert.equal(t.user()?.pendingParentEmail, undefined);
  });

  it('refuses an account without a profile', async () => {
    const t = setup({ user: null });
    await rejects(t.send(), 'not-found', 'noAccount');
  });
});

describe('verifyParentEmailCode', () => {
  it('requires sign-in', async () => {
    const t = setup();
    await t.send();
    await rejects(t.verify(CODE, null), 'unauthenticated');
  });

  it('the right code writes exactly v1\'s fields and removes the code', async () => {
    const t = setup();
    await t.send();
    t.tick(60_000);
    assert.deepEqual(await t.verify(` ${CODE} `), { verified: true });
    assert.deepEqual(t.user(), {
      name: 'Ola',
      parentEmail: EMAIL,
      parentEmailVerifiedAt: new Date(T0 + 60_000).toISOString(),
    });
    assert.equal(t.codeDoc(), undefined);
    await rejects(t.verify(), 'failed-precondition', 'noPending');
  });

  it('no code sent → noPending', async () => {
    const t = setup();
    await rejects(t.verify(), 'failed-precondition', 'noPending');
  });

  it('a wrong code counts; the fifth ends the code and the pending address', async () => {
    const t = setup();
    await t.send();
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      const err = await rejects(t.verify('000000'), 'invalid-argument', 'wrongCode');
      assert.equal((err.details as { attemptsLeft: number }).attemptsLeft, MAX_ATTEMPTS - i);
    }
    await rejects(t.verify('12ab'), 'resource-exhausted', 'locked');
    // Even the right code is no good now.
    await rejects(t.verify(CODE), 'failed-precondition', 'noPending');
    assert.equal(t.codeDoc()?.hash, undefined);
    assert.equal(t.user()?.pendingParentEmail, undefined);
    assert.equal(t.user()?.parentEmail, '');
  });

  it('an expired code is refused and dropped', async () => {
    const t = setup();
    await t.send();
    t.tick(CODE_TTL_MS + 1);
    await rejects(t.verify(), 'deadline-exceeded', 'expired');
    assert.equal(t.codeDoc()?.hash, undefined);
    assert.equal(t.user()?.parentEmail, '');
  });

  it('a code for an address that was cancelled, or replaced in v1, no longer counts', async () => {
    const t = setup();
    await t.send();
    t.store.docs.set(`users/${UID}`, { name: 'Ola', parentEmail: '' });
    await rejects(t.verify(), 'failed-precondition', 'noPending');
    await t.send({ email: 'tata@poczta.pl', lang: 'pl' });
    t.store.docs.set(`users/${UID}`, { name: 'Ola', pendingParentEmail: 'inny@poczta.pl' });
    await rejects(t.verify(), 'failed-precondition', 'noPending');
  });

  it('a new code replaces the old one', async () => {
    const t = setup({ codes: ['111111', '222222'] });
    await t.send();
    await t.send();
    await rejects(t.verify('111111'), 'invalid-argument', 'wrongCode');
    assert.deepEqual(await t.verify('222222'), { verified: true });
  });
});

describe('codes', () => {
  it('six digits from the CSPRNG; hashes differ by salt and match only the code', () => {
    for (let i = 0; i < 200; i++) assert.match(newCode(), /^[1-9]\d{5}$/);
    const a = hashCode(CODE, 'salt-a');
    assert.notEqual(a, hashCode(CODE, 'salt-b'));
    assert.ok(codeMatches(CODE, 'salt-a', a));
    assert.ok(!codeMatches('482914', 'salt-a', a));
    assert.equal(maskEmail(EMAIL), 'm***@poczta.pl');
  });
});

describe('mailer', () => {
  const PROD: NodeJS.ProcessEnv = {};
  const EMULATOR: NodeJS.ProcessEnv = { FUNCTIONS_EMULATOR: 'true' };

  it('the fake mailer cannot exist outside the Functions emulator', () => {
    assert.throws(() => createFakeMailer(() => fakeFirestore().db, PROD), /only in the Functions emulator/);
    assert.throws(() => createFakeMailer(() => fakeFirestore().db, { FUNCTIONS_EMULATOR: 'false' }), /only in the Functions emulator/);
    let keyRead = false;
    const real = selectMailer(PROD, () => fakeFirestore().db, () => ((keyRead = true), 'private'));
    assert.ok(real instanceof EmailJsMailer);
    assert.ok(keyRead);
  });

  it('in the emulator the fake keeps the mail where the tests read it, without the secret', async () => {
    const store = fakeFirestore();
    const mailer = selectMailer(EMULATOR, () => store.db, () => assert.fail('the secret is not read in the emulator'));
    await mailer.sendCode({ uid: UID, to: EMAIL, userName: 'Ola', code: CODE });
    assert.equal(store.docs.get(`${FAKE_MAILBOX}/${UID}`)?.code, CODE);
    await assert.rejects(mailer.sendCode({ uid: UID, to: 'fail@poczta.pl', userName: 'Ola', code: CODE }));
  });

  it('EmailJS gets v1\'s template with the private key as accessToken', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const mailer = new EmailJsMailer('the-private-key', async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200 };
    });
    await mailer.sendCode({ uid: UID, to: EMAIL, userName: 'Ola', code: CODE });
    assert.deepEqual(calls, [
      {
        url: EMAILJS.url,
        body: {
          service_id: 'service_417sg11',
          template_id: 'template_f2b4jeo',
          user_id: '1vFk29QDNKopU0RnJ',
          accessToken: 'the-private-key',
          template_params: { to_email: EMAIL, user_name: 'Ola', code: CODE },
        },
      },
    ]);
    const failing = new EmailJsMailer('k', async () => ({ ok: false, status: 403 }));
    await assert.rejects(failing.sendCode({ uid: UID, to: EMAIL, userName: 'Ola', code: CODE }), /EmailJS 403/);
  });
});
