// Turning the phone on ordinary screens (the reader's spread has its own tests): the
// app shell and a game page follow the new size, nothing keeps the upright width.
const { test, expect, openSignedIn } = require('../support/v2');

test.use({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });

async function turn(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => dispatchEvent(new Event('orientationchange')));
}

async function fills(page, selector, width) {
  await expect.poll(async () => Math.round((await page.locator(selector).boundingBox()).width)).toBe(width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test('Today follows the phone both ways', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  await fills(page, '.shell', 393);
  await turn(page, 851, 393);
  await fills(page, '.shell', 851);
  await turn(page, 393, 851);
  await fills(page, '.shell', 393);
  await expect(page.locator('.tabbar')).toBeVisible();
});

test('a game page follows the phone both ways', async ({ page, account }) => {
  await openSignedIn(page, account, '#/games/flappy-bird');
  const frame = page.locator('iframe');
  await expect(frame).toBeVisible();
  await turn(page, 851, 393);
  await expect.poll(async () => Math.round((await frame.boundingBox()).width)).toBeGreaterThan(700);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(851);
  await turn(page, 393, 851);
  await expect.poll(async () => Math.round((await frame.boundingBox()).width)).toBeLessThanOrEqual(393);
});
