// Liquid glass in the iOS theme (ui/glass, docs/v2/PLAN.md 4.9): floating chrome
// (tab bar, top bar, sheets, toasts) gets a lens in Chromium (SVG filter in
// backdrop-filter), the same material without the lens where url() is not drawn,
// and opaque surfaces with "Increase contrast". Other themes stay as they were.
const { devices } = require('@playwright/test');
const { createUser } = require('../support/emulator');
const { test, expect, openSignedIn, screenSettled } = require('../support/v2');

const { defaultBrowserType, ...pixel7 } = devices['Pixel 7'];
test.use({ ...pixel7 });

function useTheme(page, family, mode) {
  return page.addInitScript(([f, m]) => localStorage.setItem('lifexp-v2-theme', JSON.stringify({ family: f, mode: m })), [family, mode]);
}

const backdrop = (locator) => locator.evaluate((el) => getComputedStyle(el).backdropFilter);
const filterIdOf = (value) => value.match(/url\("?#([^")]+)"?\)/)?.[1] ?? null;

async function expectLens(page, locator) {
  await expect.poll(() => backdrop(locator).then(filterIdOf)).not.toBeNull();
  const id = filterIdOf(await backdrop(locator));
  const filter = page.locator(`svg.ui-glass-defs filter[id="${id}"]`);
  await expect(filter).toHaveCount(1);
  // The map is the element's own size, and the backdrop is bent by it.
  const box = await locator.evaluate((el) => [el.offsetWidth, el.offsetHeight]);
  await expect(filter).toHaveAttribute('width', String(box[0]));
  await expect(filter).toHaveAttribute('height', String(box[1]));
  await expect(filter.locator('feImage')).toHaveAttribute('href', /^data:image\/png;base64,/);
  expect(await filter.locator('feDisplacementMap').count()).toBeGreaterThan(0);
  expect(await backdrop(locator)).toMatch(/blur\(.+saturate/);
}

test('iOS in Chromium: tab bar, top bar, sheet and toast are refracting glass', async ({ page, account }) => {
  await useTheme(page, 'ios', 'light');
  await openSignedIn(page, account, '#/ui');
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'refract');
  await expect(page.locator('svg.ui-glass-defs')).toHaveCount(1);
  for (const selector of ['.tabbar', '.topbar']) {
    await expect(page.locator(selector)).toHaveClass(/\bui-glass\b/);
    await expectLens(page, page.locator(selector));
  }
  // The top bar is glued to the top: one filter per distinct shape, the bar's lens is its lower edge only.
  expect(filterIdOf(await backdrop(page.locator('.topbar')))).toMatch(/-e4-/);

  await page.getByRole('button', { name: 'Pokaż błąd' }).click();
  await expectLens(page, page.locator('.ui-toast'));

  await page.getByRole('button', { name: 'Otwórz arkusz' }).click();
  const sheet = page.locator('dialog.ui-sheet[open]');
  await expect(sheet).toHaveClass(/\bui-glass\b/);
  await expectLens(page, sheet);
  // iOS 26: the sheet floats inside the screen edges with large corners.
  const box = await sheet.boundingBox();
  expect(box.x).toBeGreaterThan(0);
  expect(box.x + box.width).toBeLessThan(412);
  expect(await sheet.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe('28px');
  await page.getByRole('button', { name: 'Zamknij', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  // A closed layer gives its filter back: one filter per distinct shape still on screen.
  const shown = () =>
    page.evaluate(() => {
      const ids = [...document.querySelectorAll('.ui-glass')].map((el) => el.style.getPropertyValue('--glass-refract')).filter(Boolean);
      return [new Set(ids).size, document.querySelectorAll('svg.ui-glass-defs filter').length];
    });
  const closed = page.locator('dialog.ui-sheet', { hasText: 'Nowy wydatek' });
  await expect.poll(() => closed.evaluate((el) => el.style.getPropertyValue('--glass-refract'))).toBe('');
  await expect.poll(async () => { const [used, mounted] = await shown(); return used === mounted; }).toBe(true);
});

test('content cards stay solid; the tab bar floats as a capsule', async ({ page, account }) => {
  await useTheme(page, 'ios', 'dark');
  await openSignedIn(page, account, '#/today');
  await screenSettled(page);
  const card = page.locator('.ui-card').first();
  await expect(card).toBeVisible();
  expect(await backdrop(card)).toBe('none');
  const bar = await page.locator('.tabbar').boundingBox();
  expect(bar.x).toBeGreaterThan(0);
  expect(bar.y + bar.height).toBeLessThan(915);
  expect(await page.locator('.tabbar').evaluate((el) => getComputedStyle(el).borderRadius)).not.toBe('0px');
});

test('where url() in backdrop-filter is not drawn: the same glass with blur, no lens', async ({ page, account }) => {
  // Safari and Firefox: no Chromium brand; also CSS.supports says no to url().
  await page.addInitScript(() => {
    const supports = CSS.supports.bind(CSS);
    CSS.supports = (property, value) => (String(value ?? property).includes('url(') ? false : supports(property, value));
  });
  await useTheme(page, 'ios', 'light');
  await openSignedIn(page, account, '#/today');
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'blur');
  const tabbar = page.locator('.tabbar');
  await expect.poll(() => backdrop(tabbar)).toMatch(/^blur\(20px\) saturate/);
  expect(await backdrop(page.locator('.topbar'))).not.toContain('url(');
  await expect(page.locator('svg.ui-glass-defs')).toHaveCount(0);
  // Same capsule, tint and specular rim as with the lens.
  expect(await tabbar.evaluate((el) => getComputedStyle(el).boxShadow)).toContain('inset');
});

test('Increase contrast makes the glass opaque', async ({ page, account }) => {
  await page.emulateMedia({ contrast: 'more' });
  await useTheme(page, 'ios', 'light');
  await openSignedIn(page, account, '#/today');
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'solid');
  await expect.poll(() => backdrop(page.locator('.tabbar'))).toBe('none');
  expect(await page.locator('.tabbar').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(249, 249, 249)');
});

test('other themes are unaffected, and switching away removes the glass', async ({ page, account }) => {
  await useTheme(page, 'lifexp', 'dark');
  await openSignedIn(page, account, '#/ui');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-glass', /.*/);
  expect(await backdrop(page.locator('.tabbar'))).toBe('saturate(1.8) blur(20px)');
  await expect(page.locator('svg.ui-glass-defs')).toHaveCount(0);

  await page.getByRole('radio', { name: 'iOS' }).check();
  await expect(html).toHaveAttribute('data-glass', 'refract');
  await expectLens(page, page.locator('.tabbar'));

  await page.getByRole('radio', { name: 'Gold' }).check();
  await expect(html).not.toHaveAttribute('data-glass', /.*/);
  await expect.poll(() => backdrop(page.locator('.tabbar'))).toBe('saturate(1.8) blur(20px)');
  await expect(page.locator('svg.ui-glass-defs')).toHaveCount(0);
});

test('iOS dark: true black base, grouped surfaces, accessible blues', async ({ page, account }) => {
  await useTheme(page, 'ios', 'system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await openSignedIn(page, account, '#/today');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  const tokens = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    const v = (name) => s.getPropertyValue(name).trim();
    return {
      surface: v('--color-surface'),
      raised: v('--color-surface-raised'),
      thumb: v('--color-thumb'),
      accent: v('--color-accent'),
      accentText: v('--color-accent-text'),
      body: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(tokens).toEqual({
    surface: '#1c1c1e',
    raised: '#2c2c2e',
    thumb: '#636366',
    accent: '#0071e3',
    accentText: '#409cff',
    body: 'rgb(0, 0, 0)',
  });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#000(000)?$/);
  // "Jak system" follows the system live.
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim())).toBe('#f2f2f7');
});

for (const mode of ['light', 'dark']) {
  test(`screenshots: iOS ${mode} (Today, sheet)`, async ({ page, account }, testInfo) => {
    await useTheme(page, 'ios', mode);
    await openSignedIn(page, account, '#/today');
    await screenSettled(page);
    await expectLens(page, page.locator('.tabbar'));
    await testInfo.attach(`ios-${mode}-today`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByRole('button', { name: 'Dodaj' }).click();
    const sheet = page.locator('dialog.ui-sheet[open]');
    await expect(sheet).toBeVisible();
    await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    await testInfo.attach(`ios-${mode}-sheet`, { body: await page.screenshot(), contentType: 'image/png' });
  });
}
