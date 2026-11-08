// The reader's full screen (docs/v2/PLAN.md 9.1 row r-4): only the book and its arrows,
// plus a small exit button; the browser's own full screen is asked for too. Upright and
// sideways, through a rotation, in Prosta and Auto, and left by the exit button, Esc or
// the system (fullscreenchange).
const { createUser } = require('../support/emulator');
const { test, expect, openSignedIn } = require('../support/v2');

test.use({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

const prose = (n) =>
  `Akapit ${n}. Był wczesny ranek, kiedy pociąg zatrzymał się na małej stacji, a mgła wisiała nad torami. ` +
  'Przyszedł m.in. dr Nowak, który — jak zwykle — spóźnił się o kilka minut. Na peronie stała kobieta w szarym płaszczu i patrzyła w stronę lasu.';
const BOOK = {
  name: 'Pociąg.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from(Array.from({ length: 30 }, (_, i) => prose(i + 1)).join('\n\n'), 'utf8'),
};

const reader = (page) => page.locator('.reader');
const exit = (page) => page.getByRole('button', { name: 'Wyjdź z pełnego ekranu' });
const systemFullscreen = (page) => page.evaluate(() => document.fullscreenElement !== null);

async function openBook(page, tag) {
  const account = await createUser({ tag, profile: { optInModules: ['reader'] } });
  await openSignedIn(page, account, '#/reader');
  await page.locator('input[type="file"]').setInputFiles([BOOK]);
  await page.locator('.reader-lib__open').click();
  await expect(page.getByTestId('reader-easy-text')).toHaveText('Akapit 1.');
}

/** Only the book and its arrows: no top bar, no modes, no crumb or status. */
async function expectChromeHidden(page) {
  await expect(reader(page)).toHaveAttribute('data-fullscreen', 'true');
  await expect(page.locator('.reader__top')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Prosta' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Spis', exact: true })).toHaveCount(0);
  await expect(page.locator('.reader__crumb')).toHaveCount(0);
  await expect(page.locator('.reader__seek')).toHaveCount(0);
  await expect(page.locator('.tabbar')).toHaveCount(0);
  // The exit button: small to look at, a full 44 px to tap, in the top corner.
  const box = await exit(page).boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y).toBeLessThan(60);
  expect(Number(await exit(page).evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(0.8);
}

test('upright: full screen shows the book and the arrows, which work; the exit button and the system both leave it', async ({ page }) => {
  await openBook(page, 'fs-portrait');
  await page.getByRole('button', { name: 'Pełny ekran' }).click();
  await expectChromeHidden(page);
  // The browser's own full screen was granted too.
  await expect.poll(() => systemFullscreen(page)).toBe(true);
  const text = page.getByTestId('reader-easy-text');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(text).toHaveText('Był wczesny ranek, kiedy pociąg zatrzymał się na małej stacji, a mgła wisiała nad torami.');
  await page.getByRole('button', { name: 'Wstecz' }).click();
  await expect(text).toHaveText('Akapit 1.');

  // The exit button leaves both.
  await exit(page).click();
  await expect(reader(page)).toHaveAttribute('data-fullscreen', 'false');
  await expect(page.locator('.reader__top')).toBeVisible();
  await expect.poll(() => systemFullscreen(page)).toBe(false);

  // Left by the system (Back gesture, Esc in the browser): the reader follows.
  await page.getByRole('button', { name: 'Pełny ekran' }).click();
  await expect.poll(() => systemFullscreen(page)).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect(reader(page)).toHaveAttribute('data-fullscreen', 'false');
  await expect(page.locator('.reader__top')).toBeVisible();
});

test('Esc leaves the in-app full screen even without the browser\'s', async ({ page }) => {
  // A browser without the Fullscreen API (iOS Safari): the reader still hides its controls.
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = function () {
      return Promise.reject(new Error('not allowed'));
    };
  });
  await openBook(page, 'fs-esc');
  await page.getByRole('button', { name: 'Pełny ekran' }).click();
  await expectChromeHidden(page);
  expect(await systemFullscreen(page)).toBe(false);
  await page.keyboard.press('Escape');
  await expect(reader(page)).toHaveAttribute('data-fullscreen', 'false');
});

test('turning the phone keeps full screen: the spread and its side buttons, then upright again', async ({ page }) => {
  // Playwright cannot resize a window in the browser's full screen; the reader's own full
  // screen is what has to survive the rotation (the system's survives it by itself).
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = function () {
      return Promise.reject(new Error('not in this test'));
    };
  });
  await openBook(page, 'fs-rotate');
  await page.getByRole('button', { name: 'Pełny ekran' }).click();
  await expectChromeHidden(page);

  await page.setViewportSize({ width: 851, height: 393 });
  await expect(page.locator('.spread__frame')).toBeVisible();
  await expectChromeHidden(page);
  const exitBox = await exit(page).boundingBox();
  for (const name of ['Dalej', 'Wstecz']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(851);
    expect(box.y + box.height).toBeLessThanOrEqual(393);
    // The exit button never covers an arrow.
    const overlap = box.x < exitBox.x + exitBox.width && exitBox.x < box.x + box.width && box.y < exitBox.y + exitBox.height && exitBox.y < box.y + box.height;
    expect(overlap).toBe(false);
  }
  // The spread fills the screen without the top bar.
  const frame = await page.locator('.spread__frame').boundingBox();
  expect(frame.height).toBeGreaterThan(330);
  const lit = page.locator('.spread__sent.is-on');
  await expect(lit).toHaveText('Akapit 1.');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(lit).toHaveText('Był wczesny ranek, kiedy pociąg zatrzymał się na małej stacji, a mgła wisiała nad torami.');

  await page.setViewportSize({ width: 393, height: 851 });
  await expect(page.locator('.spread')).toHaveCount(0);
  await expectChromeHidden(page);
  await expect(page.getByTestId('reader-easy-text')).toHaveText('Był wczesny ranek, kiedy pociąg zatrzymał się na małej stacji, a mgła wisiała nad torami.');
});

test('Auto in full screen: a tap on the pages plays and pauses', async ({ page }) => {
  await openBook(page, 'fs-auto');
  await page.setViewportSize({ width: 851, height: 393 });
  await page.getByRole('button', { name: 'Auto' }).click();
  await page.getByRole('button', { name: 'Pełny ekran' }).click();
  await expectChromeHidden(page);
  const lamp = page.getByTestId('spread-lamp');
  const word = await lamp.getAttribute('data-word');
  await page.locator('.spread__frame').click({ position: { x: 300, y: 150 } });
  await expect.poll(() => lamp.getAttribute('data-word')).not.toBe(word);
  await page.locator('.spread__frame').click({ position: { x: 300, y: 150 } });
  const paused = await lamp.getAttribute('data-word');
  await page.waitForTimeout(800);
  expect(await lamp.getAttribute('data-word')).toBe(paused);
});

test('the choice lasts for the session: a reload keeps full screen, leaving it is remembered too', async ({ page }) => {
  await openBook(page, 'fs-session');
  await page.getByRole('button', { name: 'Pełny ekran' }).click();
  await expectChromeHidden(page);
  await page.reload();
  await expect(reader(page)).toHaveAttribute('data-fullscreen', 'true');
  await exit(page).click();
  await page.reload();
  await expect(reader(page)).toHaveAttribute('data-fullscreen', 'false');
  await expect(page.locator('.reader__top')).toBeVisible();
});
