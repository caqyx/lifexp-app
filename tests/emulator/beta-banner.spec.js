// The real v1 boot (core.js, signed in on the emulators) shows the v2 beta banner
// to an ordinary account: no allowlist, nothing read from or written to Firestore
// for it. Layout and dismissal are covered without a network in tests/beta-banner.spec.js.
const { test, expect } = require('@playwright/test');
const { serveCdnFromNpm, createUser, signInToApp } = require('../support/emulator');

test.beforeEach(async ({ context }) => {
  await serveCdnFromNpm(context);
});

test('a signed-in account sees the beta banner after boot, above the bottom nav', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const user = await createUser({ tag: 'beta' });
  await signInToApp(page, user);

  const banner = page.getByRole('region', { name: 'Nowa wersja LifeXP' });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Nowa wersja LifeXP (beta) jest gotowa do testów.');
  await page.waitForFunction(() => document.getElementById('beta-banner').getAnimations().length === 0);
  const box = await banner.boundingBox();
  const nav = await page.locator('#bottom-nav').boundingBox();
  expect(box.y + box.height).toBeCloseTo(nav.y, 0);

  await banner.getByRole('button', { name: 'Nie teraz' }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('boot-overlay')?.hidden === true);
  await expect(page.locator('#beta-banner')).toHaveCount(0);
});
