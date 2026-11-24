// Liquid glass in the iOS theme (ui/glass, docs/v2/PLAN.md 4.9, rows ios-1 and ios-2):
// floating chrome (tab bar, top bar, sheets, dialogs, toasts, banners, the reader's
// full-screen exit) gets a lens in Chromium (SVG filter in backdrop-filter), shared by
// size bucket and capped; controls on glass (bell, segmented thumb, sheet buttons) get
// the material without a filter. The same material without the lens where url() is
// not drawn or the device is weak, opaque surfaces with "Increase contrast". Other
// themes stay as they were.
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

/** Most filters alive at once (ui/glass/registry.ts MAX_FILTERS). */
const MAX_FILTERS = 8;

async function expectLens(page, locator) {
  await expect.poll(() => backdrop(locator).then(filterIdOf)).not.toBeNull();
  const id = filterIdOf(await backdrop(locator));
  const filter = page.locator(`svg.ui-glass-defs filter[id="${id}"]`);
  await expect(filter).toHaveCount(1);
  // One filter per size bucket, in the element's own box: the map is stretched over it
  // by a few per cent at most.
  await expect(filter).toHaveAttribute('filterUnits', 'objectBoundingBox');
  const [w, h] = id.match(/-(\d+)x(\d+)-/).slice(1).map(Number);
  const box = await locator.evaluate((el) => [el.offsetWidth, el.offsetHeight]);
  expect(Math.abs(w - box[0])).toBeLessThanOrEqual(Math.max(4, box[0] * 0.035));
  expect(Math.abs(h - box[1])).toBeLessThanOrEqual(Math.max(4, box[1] * 0.035));
  await expect(filter.locator('feImage')).toHaveAttribute('href', /^data:image\/png;base64,/);
  expect(await filter.locator('feDisplacementMap').count()).toBeGreaterThan(0);
  expect(await backdrop(locator)).toMatch(/blur\(.+saturate/);
}

/** The material of a control on glass: specular rim, no backdrop filter of its own. */
async function expectGlassControl(locator) {
  const style = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { shadow: s.boxShadow, backdrop: s.backdropFilter, image: s.backgroundImage };
  });
  expect(style.shadow).toContain('inset');
  expect(style.image).toContain('linear-gradient');
  expect(style.backdrop).toBe('none');
}

const mountedFilters = (page) => page.locator('svg.ui-glass-defs filter').count();

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
  // A closed layer gives its filter back (a few stay mounted for the next opening).
  const shown = () =>
    page.evaluate(() => {
      const ids = [...document.querySelectorAll('.ui-glass')].map((el) => el.style.getPropertyValue('--glass-refract')).filter(Boolean);
      return [new Set(ids).size, document.querySelectorAll('svg.ui-glass-defs filter').length];
    });
  const closed = page.locator('dialog.ui-sheet', { hasText: 'Nowy wydatek' });
  await expect.poll(() => closed.evaluate((el) => el.style.getPropertyValue('--glass-refract'))).toBe('');
  const [used, mounted] = await shown();
  expect(mounted).toBeGreaterThanOrEqual(used);
  expect(mounted).toBeLessThanOrEqual(used + 3);
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

test('controls on glass: the bell, the segmented thumb and the sheet and dialog buttons', async ({ page }) => {
  const account = await createUser({ tag: 'glass-controls', profile: { optInModules: ['calendar'] } });
  await useTheme(page, 'ios', 'light');
  await openSignedIn(page, account, '#/money');
  await screenSettled(page);
  // iOS 26 bar button on the glass top bar.
  const bell = page.locator('.topbar .notice-bell');
  await expect(bell).toBeVisible();
  await expectGlassControl(bell);
  // The view switch: a capsule whose thumb is a piece of glass.
  const thumb = page.locator('.ui-view-switch__thumb').first();
  await expectGlassControl(thumb);
  expect(await page.locator('.ui-view-switch').first().evaluate((el) => getComputedStyle(el).borderRadius)).toBe('999px');

  await openSignedIn(page, account, '#/ui');
  await page.getByRole('button', { name: 'Otwórz arkusz' }).click();
  const save = page.locator('dialog.ui-sheet[open] .ui-sheet__footer .ui-button');
  await expectGlassControl(save);
  expect(await save.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('999px');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Usuń notatkę' }).click();
  const dialog = page.getByRole('alertdialog');
  await expectLens(page, dialog);
  await expectGlassControl(dialog.getByRole('button', { name: 'Anuluj' }));
  await dialog.getByRole('button', { name: 'Anuluj' }).click();
});

test('filters stay few after many screens, sheets and toasts: shared by size, capped', async ({ page }) => {
  const account = await createUser({ tag: 'glass-many', profile: { optInModules: ['calendar'] } });
  await useTheme(page, 'ios', 'light');
  await openSignedIn(page, account, '#/today');
  for (const hash of ['#/chores', '#/money', '#/money/loans', '#/notes', '#/stats', '#/calendar', '#/settings', '#/ui', '#/today']) {
    await page.evaluate((h) => (location.hash = h), hash);
    await screenSettled(page);
    await page.locator('.tabbar').getByRole('button', { name: 'Dodaj' }).click();
    await expect(page.locator('dialog.ui-sheet[open]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.ui-sheet[open]')).toHaveCount(0);
    expect(await mountedFilters(page)).toBeLessThanOrEqual(MAX_FILTERS);
  }
  await openSignedIn(page, account, '#/ui');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Pokaż błąd' }).click();
    await expectLens(page, page.locator('.ui-toast').first());
  }
  // Top bar, tab bar, toast and the "+" sheet kept for its next opening; never past the cap.
  const mounted = await mountedFilters(page);
  expect(mounted).toBeGreaterThanOrEqual(3);
  expect(mounted).toBeLessThanOrEqual(MAX_FILTERS);
  // Every element that shows a lens points at a filter that exists.
  const dangling = await page.evaluate(() =>
    [...document.querySelectorAll('.ui-glass')]
      .map((el) => el.style.getPropertyValue('--glass-refract').match(/#([^)]+)/)?.[1])
      .filter((id) => id && !document.getElementById(id)),
  );
  expect(dangling).toEqual([]);
});

test('the reader\'s full-screen exit floats over the book as glass tinted with the page', async ({ page }) => {
  const account = await createUser({ tag: 'glass-reader', profile: { optInModules: ['reader'] } });
  await useTheme(page, 'ios', 'dark');
  await openSignedIn(page, account, '#/reader');
  const text = Array.from({ length: 20 }, (_, i) => `Akapit ${i + 1}. Był wczesny ranek, kiedy pociąg zatrzymał się na małej stacji.`).join('\n\n');
  await page.locator('input[type="file"]').setInputFiles([{ name: 'Szkło.txt', mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') }]);
  await page.locator('.reader-lib__open').click();
  await page.getByRole('button', { name: 'Pełny ekran' }).click();
  const exit = page.getByRole('button', { name: 'Wyjdź z pełnego ekranu' });
  await expect(exit).toHaveClass(/\bui-glass\b/);
  await expectLens(page, exit);
  expect(Number(await exit.evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
  await exit.click();
  // Gone with full screen: its filter is given back (kept for reuse, within the cap).
  expect(await mountedFilters(page)).toBeLessThanOrEqual(MAX_FILTERS);
});

test('a low-end device gets the material over a blur, and never downloads the lens', async ({ page, account }) => {
  const lens = [];
  page.on('request', (r) => /\/lens-[^/]+\.js$/.test(r.url()) && lens.push(r.url()));
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 1 }));
  await useTheme(page, 'ios', 'light');
  await openSignedIn(page, account, '#/today');
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'blur');
  await expect.poll(() => backdrop(page.locator('.tabbar'))).toMatch(/^blur\(20px\) saturate/);
  await expect(page.locator('svg.ui-glass-defs')).toHaveCount(0);
  expect(lens).toEqual([]);
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
  const lens = [];
  page.on('request', (r) => /\/lens-[^/]+\.js$/.test(r.url()) && lens.push(r.url()));
  await useTheme(page, 'lifexp', 'dark');
  await openSignedIn(page, account, '#/ui');
  expect(lens).toEqual([]); // the refracting code is not part of other themes
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-glass', /.*/);
  expect(await backdrop(page.locator('.tabbar'))).toBe('saturate(1.8) blur(20px)');
  await expect(page.locator('svg.ui-glass-defs')).toHaveCount(0);

  // Segmented controls keep their own look.
  expect(await page.locator('.ui-segmented__thumb').first().evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');

  await page.getByRole('radio', { name: 'iOS' }).check();
  await expect(html).toHaveAttribute('data-glass', 'refract');
  await expectLens(page, page.locator('.tabbar'));
  expect(lens).toHaveLength(1); // loaded on demand

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

/** Contrast of a text color over a stack of (translucent) layers, bottom layer last. */
function contrastOver(page, fg, layers) {
  return page.evaluate(
    ([fgVar, stack]) => {
      const probe = document.createElement('div');
      document.body.append(probe);
      const rgba = (v) => {
        probe.style.color = `var(${v})`;
        const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
        return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 };
      };
      const over = (top, under) => ({
        r: top.r * top.a + under.r * (1 - top.a),
        g: top.g * top.a + under.g * (1 - top.a),
        b: top.b * top.a + under.b * (1 - top.a),
        a: 1,
      });
      const lum = ({ r, g, b }) => {
        const c = [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      };
      const back = stack.map(rgba).reduceRight((under, top) => over(top, under), { r: 0, g: 0, b: 0, a: 1 });
      const front = over(rgba(fgVar), back);
      probe.remove();
      const [hi, lo] = [lum(front), lum(back)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    },
    [fg, layers],
  );
}

for (const mode of ['light', 'dark']) {
  test(`text on glass holds WCAG AA over the page (iOS ${mode})`, async ({ page, account }) => {
    await useTheme(page, 'ios', mode);
    await openSignedIn(page, account, '#/today');
    const cases = [
      // Bell label: a glass capsule on the top bar.
      ['--color-text-secondary', ['--glass-control', '--glass-tint-bar', '--color-bg']],
      // Tab labels on the capsule, the selected one on its lens.
      ['--color-text', ['--glass-tint', '--color-bg']],
      ['--color-accent-text', ['--glass-selected', '--glass-tint', '--color-bg']],
      // Sheets, dialogs, toasts, banners: text and secondary text on the panel tint.
      ['--color-text-secondary', ['--glass-tint-panel', '--color-bg']],
      ['--color-accent-text', ['--glass-tint-panel', '--color-bg']],
      // A secondary button on a panel.
      ['--color-text', ['--glass-control', '--glass-tint-panel', '--color-bg']],
    ];
    for (const [fg, layers] of cases) {
      expect(await contrastOver(page, fg, layers), `${fg} on ${layers.join(' / ')}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

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
