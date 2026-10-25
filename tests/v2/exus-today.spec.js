// The Ex-us field on Today (docs/v2/PLAN.md 6.10, stage 5a-11b): what is typed there
// is sent by the Ex-us screen through the same engine, handed over in memory.
const { createUser, db } = require('../support/emulator');
const { test, expect: baseExpect, openSignedIn } = require('../support/v2');

// A plain-text message waits for exusTurn; the Functions emulator's first call of a run starts a worker.
const expect = baseExpect.configure({ timeout: 15000 });

test.use({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });

const field = (page) => page.getByLabel('Zapytaj Ex-us');
const log = (page) => page.getByRole('log', { name: 'Rozmowa z Ex-us' });

async function ask(page, text) {
  await field(page).fill(text);
  await page.getByRole('button', { name: 'Wyślij do Ex-us' }).click();
}

test('a command typed on Today opens Ex-us with its answer; the text stays out of the URL', async ({ page }) => {
  const account = await createUser({ tag: 'today-exus-cmd' });
  await openSignedIn(page, account, '#/today');
  await expect(field(page)).toHaveAttribute('placeholder', 'Napisz do Ex-us albo wpisz /');
  await expect(page.getByText('komendy zaczynają się od /')).toBeVisible();
  await ask(page, '/dzis');
  await expect(page).toHaveURL(/#\/exus$/);
  await expect(log(page)).toContainText('/dzis');
  await expect(log(page)).toContainText('Punkty');
  expect(page.url()).not.toContain('dzis');
  // Sent once: going back to Ex-us later does not send it again.
  await page.goBack();
  await expect(page).toHaveURL(/#\/today$/);
  await page.goForward();
  await expect(page.locator('.exus-msg--me')).toHaveCount(1);
});

test('plain text typed on Today gets the AI reply in Ex-us', async ({ page }) => {
  const account = await createUser({ tag: 'today-exus-ai' });
  await db.doc(`aiTestAccess/${account.uid}`).set({});
  await openSignedIn(page, account, '#/today');
  await ask(page, 'Cześć z ekranu Dziś');
  await expect(page).toHaveURL(/#\/exus$/);
  await expect(page.locator('.exus-msg--exus').last()).toHaveText('Ex-us (emulator): Cześć z ekranu Dziś');
});

test('with Ex-us turned off Today has no field', async ({ page }) => {
  const account = await createUser({ tag: 'today-exus-off', profile: { enabledModules: ['chores', 'money', 'stats', 'notes'] } });
  await openSignedIn(page, account, '#/today');
  await expect(page.locator('.today-greeting')).toBeVisible();
  await expect(field(page)).toHaveCount(0);
});

test('on a 360 px phone Today with the field does not scroll sideways', async ({ page }) => {
  const account = await createUser({ tag: 'today-exus-phone' });
  await openSignedIn(page, account, '#/today');
  await expect(field(page)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
