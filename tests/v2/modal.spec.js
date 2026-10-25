// Modal layers on a phone (ui/components/useModal.ts), after the owner's report that
// buttons sometimes stopped working until a reload (2026-10-02).
const { devices } = require('@playwright/test');
const { test, expect, openSignedIn, screenSettled } = require('../support/v2');

const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
test.use({ ...pixel, serviceWorkers: 'block' });

test('a sheet the browser closes by itself (Android Back) opens again', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  const plus = page.locator('.tabbar').getByRole('button', { name: 'Dodaj' });
  const sheet = page.getByRole('dialog', { name: 'Dodaj' });
  await plus.tap();
  await expect(sheet).toBeVisible();
  // What Chrome's close watcher does on Back when the page may not stop it.
  await sheet.evaluate((dialog) => dialog.close());
  await expect(sheet).toBeHidden();
  await plus.tap();
  await expect(sheet).toBeVisible();
  // Its history entry went with it: one Back closes the sheet, the next leaves Today.
  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/#\/today$/);
});

test('a tap during the exit animation does not land on the sheet sliding away', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  const plus = page.locator('.tabbar').getByRole('button', { name: 'Dodaj' });
  const sheet = page.getByRole('dialog', { name: 'Dodaj' });
  await plus.tap();
  await expect(sheet).toBeVisible();
  const box = await plus.boundingBox();
  await sheet.getByRole('button', { name: 'Zamknij' }).tap();
  // Where "+" is, the sheet's "Dodaj w obecnej wersji" link was still passing by.
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/v2\/dist\/index\.html.*#\/today$/);
  await plus.tap();
  await expect(sheet).toBeVisible();
});

test('the next screen takes taps after a sheet opened and closed', async ({ page, account }) => {
  await openSignedIn(page, account, '#/money');
  await expect(page.getByRole('button', { name: 'Dodaj transakcję' })).toBeVisible();
  await page.locator('.tabbar').getByRole('link', { name: 'Dziś' }).tap();
  await expect(page.getByTestId('today-points')).toBeVisible();
  await screenSettled(page);
  const sheet = page.getByRole('dialog', { name: 'Nowa aktywność' });
  await page.getByRole('button', { name: 'Zapisz aktywność' }).tap();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Zamknij' }).tap();
  await expect(sheet).toBeHidden();
  // Chrome brought Money in with the style kept from while the sheet was open: inert.
  await page.locator('.tabbar').getByRole('link', { name: 'Pieniądze' }).tap();
  await page.getByRole('button', { name: 'Dodaj transakcję' }).tap();
  await expect(page.getByRole('dialog', { name: 'Nowa transakcja' })).toBeVisible();
});

test('a layer opened right after another closed stays open, however late the Back of the first lands', async ({ page, account }) => {
  // The Back that takes a closed layer's history entry off is asynchronous; on a slow runner it
  // landed after the next layer had pushed its entry and closed that one at once.
  await page.addInitScript(() => {
    const back = history.back.bind(history);
    history.back = () => void setTimeout(back, 400);
  });
  await openSignedIn(page, account, '#/today');
  const plus = page.locator('.tabbar').getByRole('button', { name: 'Dodaj' });
  const sheet = page.getByRole('dialog', { name: 'Dodaj' });
  await plus.tap();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Zamknij' }).tap();
  await expect(sheet).toBeHidden();
  await plus.tap();
  await expect(sheet).toBeVisible();
  // Past the late Back: still open, and one Back (the system's) closes it.
  await page.waitForTimeout(1000);
  await expect(sheet).toBeVisible();
  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/#\/today$/);
});

test('a layer opened right after another closed stays open when the Back of the first lands after more than a second', async ({ page, account }) => {
  // CI (2026-10-25): under load the Back of a cancelled Ex-us confirmation landed more than a
  // second late. The wait for it gave up after 1 s, the next layer pushed its entry, and the
  // late Back then popped that entry and closed the new layer before it could be used.
  await page.addInitScript(() => {
    const back = history.back.bind(history);
    history.back = () => void setTimeout(back, 1800);
  });
  await openSignedIn(page, account, '#/today');
  const plus = page.locator('.tabbar').getByRole('button', { name: 'Dodaj' });
  const sheet = page.getByRole('dialog', { name: 'Dodaj' });
  await plus.tap();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Zamknij' }).tap();
  await expect(sheet).toBeHidden();
  await plus.tap();
  await expect(sheet).toBeVisible();
  // Past the late Back (and past the old 1 s give-up): still open, and one Back closes it.
  await page.waitForTimeout(2500);
  await expect(sheet).toBeVisible();
  await page.goBack();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/#\/today$/);
});
