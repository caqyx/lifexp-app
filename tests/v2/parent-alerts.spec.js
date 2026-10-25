// Alerts to the parent (docs/v2/PLAN.md 9.1, row 6-3b) on the emulators: the Firestore
// triggers run in the Functions emulator and hand the e-mail to the fake mailer
// (emulatorMail/{uid}_alert_{kind}); the switch in Settings turns them off.
const { Timestamp } = require('firebase-admin/firestore');
const { createUser, db, todayUtcKey } = require('../support/emulator');
const { test, expect: baseExpect, openSignedIn } = require('../support/v2');

// Triggers run after the write, and the emulator starts a worker on the first one.
const expect = baseExpect.configure({ timeout: 20000 });

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

const verifiedChild = (tag, profile = {}) =>
  createUser({
    tag,
    profile: { name: 'Ola', accountMode: 'supervised', parentEmail: 'mama@poczta.pl', parentEmailVerifiedAt: new Date().toISOString(), ...profile },
  });
const mail = async (uid, kind) => (await db.doc(`emulatorMail/${uid}_alert_${kind}`).get()).data();

test('61 minutes of gaming in a day and a purchase each send one e-mail to the verified parent', async () => {
  const child = await verifiedChild('alert-on');
  const day = db.doc(`users/${child.uid}/dailyLog/${todayUtcKey()}`);
  await day.set({ pointsEarned: 0, gamingMinutes: 30 });
  await day.set({ pointsEarned: 0, gamingMinutes: 61 });
  await expect.poll(() => mail(child.uid, 'gaming').then((m) => m?.params)).toMatchObject({
    to_email: 'mama@poczta.pl',
    user_name: 'Ola',
    alert_subject: 'Ola: dziś już 1 h 1 min grania',
  });

  await db.collection(`users/${child.uid}/purchases`).add({ description: 'Gra', amount: 8.5, pointsCost: 85, timestamp: Timestamp.now() });
  await expect.poll(() => mail(child.uid, 'purchase').then((m) => m?.params.alert_body)).toBe('Zakup: Gra, 8,50 zł (85 pkt).');
  const log = (await db.collection('parentAlertLog').where('kinds', 'array-contains', 'gaming').get()).docs.find((d) => d.id.startsWith(child.uid));
  expect(log?.data().kinds.sort()).toEqual(['gaming', 'purchase']);
});

test('with alerts turned off in Settings nothing is sent', async ({ page }) => {
  const child = await verifiedChild('alert-off');
  await openSignedIn(page, child, '#/settings/account');
  const toggle = page.getByRole('switch', { name: 'Powiadomienia dla rodzica' });
  await expect(toggle).toBeChecked();
  await expect(page.getByText('E-mail na mama@poczta.pl, gdy grasz ponad godzinę dziennie albo coś kupisz.', { exact: false })).toBeVisible();
  await toggle.uncheck();
  await expect.poll(async () => (await db.doc(`users/${child.uid}`).get()).data().parentAlerts).toBe(false);

  await db.doc(`users/${child.uid}/dailyLog/${todayUtcKey()}`).set({ pointsEarned: 0, gamingMinutes: 90 });
  // A control account written after it gets its e-mail, so the trigger for this one has run too.
  const control = await verifiedChild('alert-control');
  await db.doc(`users/${control.uid}/dailyLog/${todayUtcKey()}`).set({ pointsEarned: 0, gamingMinutes: 90 });
  await expect.poll(() => mail(control.uid, 'gaming')).toBeTruthy();
  expect(await mail(child.uid, 'gaming')).toBeUndefined();
});
