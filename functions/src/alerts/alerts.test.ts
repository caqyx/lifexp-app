import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fakeFirestore } from '../test/fakeFirestore';
import type { AlertMail, AlertMailer } from '../parent/mailer';
import { PARENT_ALERT_TEMPLATE_ID } from './config';
import { createAlertHandlers } from './handlers';

const NOW = new Date('2026-10-25T15:00:00Z');
const VERIFIED = { parentEmail: 'mama@poczta.pl', parentEmailVerifiedAt: '2026-10-01T10:00:00Z' };

function seed(): Record<string, Record<string, unknown>> {
  return {
    'users/ola': { name: 'Ola', accountMode: 'supervised', ...VERIFIED },
    'users/solo': { name: 'Sam', accountMode: 'solo', ...VERIFIED },
    'users/unverified': { name: 'Ula', accountMode: 'supervised', parentEmail: 'tata@poczta.pl' },
    'users/off': { name: 'Olek', accountMode: 'supervised', parentAlerts: false, ...VERIFIED },
    'users/fails': { name: 'Fred', accountMode: 'supervised', parentEmail: 'fail@poczta.pl', parentEmailVerifiedAt: '2026-10-01T10:00:00Z' },
  };
}

function setup(opts: { templateId?: string | null; at?: () => Date } = {}) {
  const store = fakeFirestore(seed());
  const sent: AlertMail[] = [];
  const mailer: AlertMailer = {
    async sendAlert(mail) {
      if (mail.params.to_email.startsWith('fail@')) throw new Error('EmailJS 400 fail@poczta.pl');
      sent.push(mail);
    },
  };
  const logs: string[] = [];
  const handlers = createAlertHandlers({
    db: () => store.db,
    mailer: () => mailer,
    templateId: () => (opts.templateId === undefined ? 'template_test' : opts.templateId),
    now: opts.at ?? (() => NOW),
    log: (e, d) => logs.push(`${e} ${JSON.stringify(d)}`),
  });
  return { store, sent, logs, handlers };
}

describe('gaming alert', () => {
  it('crossing 60 minutes sends once; staying above does not resend; the next day sends again', async () => {
    const t = setup();
    assert.equal(await t.handlers.gaming('ola', '2026-10-25', 30, 45), 'notCrossed');
    assert.equal(await t.handlers.gaming('ola', '2026-10-25', 45, 65), 'sent');
    assert.equal(await t.handlers.gaming('ola', '2026-10-25', 65, 120), 'notCrossed');
    // A write that drops and climbs again the same day is still one e-mail.
    assert.equal(await t.handlers.gaming('ola', '2026-10-25', 30, 70), 'alreadySent');
    assert.equal(await t.handlers.gaming('ola', '2026-10-26', 0, 60), 'sent');
    assert.equal(t.sent.length, 2);
    assert.deepEqual(t.sent[0], {
      uid: 'ola',
      kind: 'gaming',
      templateId: 'template_test',
      params: {
        to_email: 'mama@poczta.pl',
        user_name: 'Ola',
        alert_subject: 'Ola: dziś już 1 h 5 min grania',
        alert_body: 'Czas grania tego dnia przekroczył 60 min i wynosi teraz 1 h 5 min.',
        alert_day: 'niedziela, 25 października',
      },
    });
  });
});

describe('purchase alert', () => {
  it('a purchase always notifies, but at most once a (Warsaw) day', async () => {
    const t = setup();
    assert.equal(await t.handlers.purchase('ola', { description: 'Gra', amount: 8.5, pointsCost: 85 }), 'sent');
    assert.equal(await t.handlers.purchase('ola', { description: 'Druga', amount: 2, pointsCost: 20 }), 'alreadySent');
    assert.equal(t.sent[0]?.params.alert_body, 'Zakup: Gra, 8,50 zł (85 pkt).');
    assert.equal(t.sent[0]?.params.alert_subject, 'Ola coś kupił(a)');
    const tomorrow = setup({ at: () => new Date('2026-10-25T23:30:00Z') }); // already the 26th in Warsaw
    tomorrow.store.docs.set('parentAlertLog/ola_2026-10-25', { kinds: ['purchase'] });
    assert.equal(await tomorrow.handlers.purchase('ola', { description: 'Trzecia', amount: 1, pointsCost: 10 }), 'sent');
  });

  it('gaming and purchase are counted apart', async () => {
    const t = setup();
    await t.handlers.purchase('ola', { amount: 1 });
    assert.equal(await t.handlers.gaming('ola', '2026-10-25', 0, 60), 'sent');
    assert.deepEqual(t.store.docs.get('parentAlertLog/ola_2026-10-25'), { kinds: ['purchase', 'gaming'] });
  });
});

describe('who gets it', () => {
  it('nobody for a solo account, an unverified address, or alerts turned off', async () => {
    const t = setup();
    for (const uid of ['solo', 'unverified', 'off', 'nobody']) {
      assert.equal(await t.handlers.gaming(uid, '2026-10-25', 0, 61), 'noRecipient', uid);
      assert.equal(await t.handlers.purchase(uid, { amount: 1 }), 'noRecipient', uid);
    }
    assert.equal(t.sent.length, 0);
  });

  it('nothing is sent until the owner sets up the EmailJS template', async () => {
    assert.equal(PARENT_ALERT_TEMPLATE_ID, null, 'set once the owner created the template; then update this test');
    const t = setup({ templateId: null });
    assert.equal(await t.handlers.gaming('ola', '2026-10-25', 0, 61), 'templateMissing');
    assert.equal(t.sent.length, 0);
    assert.equal(t.store.docs.has('parentAlertLog/ola_2026-10-25'), false);
  });

  it('a failed mail frees the day for a retry and is not fatal', async () => {
    const t = setup();
    assert.equal(await t.handlers.gaming('fails', '2026-10-25', 0, 61), 'failed');
    assert.deepEqual(t.store.docs.get('parentAlertLog/fails_2026-10-25'), { kinds: [] });
  });
});

describe('logs and template', () => {
  it('logs the kind and outcome only: no names, addresses, uids or purchases', async () => {
    const t = setup();
    await t.handlers.gaming('ola', '2026-10-25', 0, 61);
    await t.handlers.purchase('ola', { description: 'Gra', amount: 8.5 });
    await t.handlers.gaming('fails', '2026-10-25', 0, 61);
    const all = t.logs.join('\n');
    assert.match(all, /"kind":"gaming","outcome":"sent"/);
    for (const pii of ['Ola', 'ola', 'poczta', 'Gra', 'fails', 'Fred']) assert.ok(!all.includes(pii), pii);
  });

  it('the params fill exactly the variables of email-templates/parent-alert.html', async () => {
    const t = setup();
    await t.handlers.gaming('ola', '2026-10-25', 0, 61);
    const html = readFileSync(resolve(__dirname, '../../../email-templates/parent-alert.html'), 'utf8');
    // The variables used in the body, plus those the header comment names for the template settings.
    const body = html.slice(html.indexOf('-->'));
    const used = new Set([...body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]));
    used.add('to_email');
    assert.deepEqual(Object.keys(t.sent[0]!.params).sort(), [...used].sort());
    const declared = html.match(/Zmienne \(wszystkie tekstowe\):\s*([\w, ]+)/)?.[1]?.split(',').map((v) => v.trim());
    assert.deepEqual(declared?.sort(), [...used].sort());
  });
});
