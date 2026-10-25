// The parent's e-mail verified on the server (docs/v2/PLAN.md 9.1, row 6-4):
// sendParentEmailCode / verifyParentEmailCode on the Functions emulator, whose fake
// mailer keeps the code in emulatorMail/{uid} (never in production). The browser
// never talks to EmailJS and never sees the code; the profile never holds it.
const { createUser, db, openApp, serveCdnFromNpm } = require('../support/emulator');
const { test, expect: baseExpect, openSignedIn } = require('../support/v2');

// The Functions emulator starts a worker on its first call.
const expect = baseExpect.configure({ timeout: 15000 });

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

const EMAILJS = 'https://api.emailjs.com/api/v1.0/email/send';
const supervised = (tag, profile = {}) => createUser({ tag, profile: { name: 'Ola', accountMode: 'supervised', ...profile } });
const profileOf = async (uid) => (await db.doc(`users/${uid}`).get()).data();
const mailOf = async (uid) => (await db.doc(`emulatorMail/${uid}`).get()).data();
const codeDocOf = async (uid) => (await db.doc(`parentEmailCodes/${uid}`).get()).data();

/** Any request to EmailJS from the page is a failure of this flow. */
async function noBrowserEmailJs(page) {
  const calls = [];
  await page.route(EMAILJS, (route) => {
    calls.push(route.request().url());
    return route.abort();
  });
  return calls;
}

async function sendCode(page, address) {
  await page.getByLabel('Adres rodzica').fill(address);
  await page.getByRole('button', { name: 'Wyślij kod' }).click();
}

const confirm = async (page, code) => {
  await page.getByLabel('Kod z e-maila').fill(code);
  await page.getByRole('button', { name: 'Potwierdź' }).click();
};

test('the code comes from the server, only its hash is kept, and the right code verifies the address', async ({ page }) => {
  const account = await supervised('server-code');
  const browserMail = await noBrowserEmailJs(page);
  await openSignedIn(page, account, '#/settings/account');

  await sendCode(page, ' mama@poczta.pl ');
  await expect(page.getByText('Kod poszedł na mama@poczta.pl. Jest ważny 10 minut.')).toBeVisible();
  const mail = await mailOf(account.uid);
  expect(mail).toMatchObject({ to: 'mama@poczta.pl', userName: 'Ola' });
  expect(mail.code).toMatch(/^\d{6}$/);
  // The profile has the pending address (v1 shows it) and no code; the server keeps a hash only.
  const pending = await profileOf(account.uid);
  expect(pending.pendingParentEmail).toBe('mama@poczta.pl');
  expect(pending).not.toHaveProperty('parentEmailCode');
  const stored = await codeDocOf(account.uid);
  expect(stored).toMatchObject({ email: 'mama@poczta.pl', attempts: 0 });
  expect(JSON.stringify(stored)).not.toContain(mail.code);

  await confirm(page, mail.code === '123456' ? '654321' : '123456');
  await expect(page.getByText('To nie ten kod.')).toBeVisible();
  await confirm(page, mail.code);
  await expect(page.getByText('Potwierdzony adres: mama@poczta.pl')).toBeVisible();
  const verified = await profileOf(account.uid);
  expect(verified.parentEmail).toBe('mama@poczta.pl');
  expect(typeof verified.parentEmailVerifiedAt).toBe('string');
  for (const gone of ['pendingParentEmail', 'parentEmailCode', 'parentEmailCodeExpiry']) expect(verified).not.toHaveProperty(gone);
  expect(await codeDocOf(account.uid)).toBeUndefined();
  expect(browserMail).toEqual([]);
});

test('five wrong codes end the code: the address has to be sent again', async ({ page }) => {
  const account = await supervised('server-locked');
  await openSignedIn(page, account, '#/settings/account');
  await sendCode(page, 'tata@poczta.pl');
  await expect(page.getByLabel('Kod z e-maila')).toBeVisible();
  const { code } = await mailOf(account.uid);
  const wrong = code === '111111' ? '222222' : '111111';
  for (let i = 0; i < 4; i++) {
    await confirm(page, wrong);
    await expect(page.getByText('To nie ten kod.')).toBeVisible();
    await expect.poll(async () => (await codeDocOf(account.uid)).attempts).toBe(i + 1);
  }
  await confirm(page, wrong);
  // The pending address is gone, so the screen is back at "send a code".
  await expect(page.getByLabel('Adres rodzica')).toBeVisible();
  const profile = await profileOf(account.uid);
  expect(profile).not.toHaveProperty('pendingParentEmail');
  expect(profile.parentEmail).toBe('');
  expect((await codeDocOf(account.uid)).hash).toBeUndefined();
});

test('a send the mailer refuses leaves no pending address and says so', async ({ page }) => {
  const account = await supervised('server-send-fails');
  await openSignedIn(page, account, '#/settings/account');
  await sendCode(page, 'fail@poczta.pl');
  await expect(page.getByText('Nie udało się wysłać kodu. Sprawdź połączenie i spróbuj ponownie.')).toBeVisible();
  expect(await profileOf(account.uid)).not.toHaveProperty('pendingParentEmail');
});

test('more than three codes in a quarter of an hour are refused', async ({ page }) => {
  const account = await supervised('server-rate');
  await openSignedIn(page, account, '#/settings/account');
  for (let i = 0; i < 3; i++) {
    await sendCode(page, `mama${i}@poczta.pl`);
    await expect(page.getByLabel('Kod z e-maila')).toBeVisible();
    await page.getByRole('button', { name: 'Anuluj' }).click();
    await expect(page.getByLabel('Adres rodzica')).toBeVisible();
  }
  await sendCode(page, 'mama@poczta.pl');
  await expect(page.getByText('Za dużo kodów naraz. Spróbuj za kwadrans.')).toBeVisible();
  expect((await mailOf(account.uid)).to).toBe('mama2@poczta.pl');
});

test.describe('v1 on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('v1 shows an address verified on the server as verified', async ({ page, context }) => {
    const account = await supervised('server-to-v1');
    await openSignedIn(page, account, '#/settings/account');
    await sendCode(page, 'mama@poczta.pl');
    await expect(page.getByLabel('Kod z e-maila')).toBeVisible();
    await confirm(page, (await mailOf(account.uid)).code);
    await expect(page.getByText('Potwierdzony adres: mama@poczta.pl')).toBeVisible();

    await serveCdnFromNpm(context);
    await openApp(page);
    await page.click('.sidebar .nav-item[data-page="settings"]');
    await expect(page.locator('#parent-email-verified-addr')).toHaveText('mama@poczta.pl');
    await expect(page.locator('#parent-email-verified-row')).not.toHaveCSS('display', 'none');
  });
});
