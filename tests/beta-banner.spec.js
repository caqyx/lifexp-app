// Pasek „Nowa wersja LifeXP (beta)” (beta-banner.js) w prawdziwym app.html.
//
// Bez sieci (tests/support/hermetic.js) moduł core.js nie startuje, bo importuje
// Firebase z gstatic — więc test robi to, co core.js po zalogowaniu: chowa ekran
// ładowania i woła showBetaBanner(). Pełna ścieżka z logowaniem (core.js sam
// pokazuje pasek) jest w tests/emulator/beta-banner.spec.js.
const { test, expect } = require('./support/hermetic');

const PHONE = { width: 390, height: 844 };
const KEY = 'lifexp-beta-banner-dismissed-until';
const DAY = 24 * 60 * 60 * 1000;

async function openSignedInApp(page, { lang = 'pl', theme } = {}) {
  await page.addInitScript(([lang, theme]) => {
    try {
      localStorage.setItem('lifexp-lang', lang);
      if (theme) localStorage.setItem('lifexp-theme', theme);
    } catch { /* ignore */ }
  }, [lang, theme]);
  await page.goto('/app.html');
  await page.evaluate(async () => {
    document.getElementById('boot-overlay').hidden = true;
    const { showBetaBanner } = await import('/beta-banner.js');
    showBetaBanner();
  });
}

const banner = (page) => page.getByRole('region', { name: 'Nowa wersja LifeXP' });

test.describe('beta banner', () => {
  test.use({ viewport: PHONE });

  test('sits at the bottom, above the bottom nav, and pushes the page and FAB up', async ({ page }) => {
    await openSignedInApp(page);
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toContainText('Nowa wersja LifeXP (beta) jest gotowa do testów.');
    await expect(banner(page).getByRole('button', { name: 'Wypróbuj' })).toBeVisible();
    await expect(banner(page).getByRole('button', { name: 'Nie teraz' })).toBeVisible();
    // Let the banner's slide-in finish before measuring.
    await page.waitForFunction(() => document.getElementById('beta-banner').getAnimations().length === 0);

    const box = await banner(page).boundingBox();
    const nav = await page.locator('#bottom-nav').boundingBox();
    expect(nav.height).toBeGreaterThan(0);
    // Directly on top of the nav, never overlapping it.
    expect(box.y + box.height).toBeCloseTo(nav.y, 0);
    expect(box.x).toBe(0);
    expect(box.width).toBe(PHONE.width);

    // The page's bottom padding grows by the banner height, so the last content clears it.
    const padding = await page.locator('.main').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(padding).toBeGreaterThanOrEqual(PHONE.height - box.y);

    // A FAB (chores/notes) moves above the banner instead of hiding behind it.
    // (What showPage('notes') does to the pages; core.js is not running here.)
    await page.evaluate(() => {
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      document.getElementById('page-notes').classList.add('active');
    });
    await page.waitForFunction(() => document.getElementById('page-notes').getAnimations().every((a) => a.playState === 'finished'));
    const fab = await page.locator('#notes-fab').boundingBox();
    expect(fab.y + fab.height).toBeLessThanOrEqual(box.y);
  });

  test('"Wypróbuj" opens v2', async ({ page }) => {
    await openSignedInApp(page);
    await banner(page).getByRole('button', { name: 'Wypróbuj' }).click();
    await expect(page).toHaveURL(/\/v2\/$/);
  });

  test('"Nie teraz" hides it for 7 days, also after a reload', async ({ page }) => {
    await openSignedInApp(page);
    const before = Date.now();
    await banner(page).getByRole('button', { name: 'Nie teraz' }).click();
    await expect(banner(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.body.classList.contains('has-beta-banner'))).toBe(false);

    const until = Number(await page.evaluate((k) => localStorage.getItem(k), KEY));
    expect(until).toBeGreaterThanOrEqual(before + 7 * DAY);
    expect(until).toBeLessThanOrEqual(Date.now() + 7 * DAY);

    await page.reload();
    await page.evaluate(async () => {
      const { showBetaBanner } = await import('/beta-banner.js');
      showBetaBanner();
    });
    await expect(banner(page)).toHaveCount(0);
  });

  test('comes back once the 7 days are over', async ({ page }) => {
    await openSignedInApp(page);
    await banner(page).getByRole('button', { name: 'Nie teraz' }).click();
    await expect(banner(page)).toHaveCount(0);

    // Reopen the app with the clock moved forward (Date.now shifted before any script runs).
    const reopenAfter = async (days) => {
      await page.addInitScript((ms) => {
        const realNow = Date.now.bind(Date);
        Date.now = () => realNow() + ms;
      }, days * DAY);
      await page.reload();
      await page.evaluate(async () => {
        document.getElementById('boot-overlay').hidden = true;
        const { showBetaBanner } = await import('/beta-banner.js');
        showBetaBanner();
      });
    };
    await reopenAfter(6);
    await expect(banner(page)).toHaveCount(0);
    await reopenAfter(1.01); // init scripts stack: 7 days and a bit
    await expect(banner(page)).toBeVisible();
  });

  test('follows the v1 language setting', async ({ page }) => {
    await openSignedInApp(page, { lang: 'en' });
    const en = page.getByRole('region', { name: 'New LifeXP version' });
    await expect(en).toContainText('The new LifeXP (beta) is ready to test.');
    await expect(en.getByRole('button', { name: 'Try it' })).toBeVisible();
    await expect(en.getByRole('button', { name: 'Not now' })).toBeVisible();
  });

  test('buttons show a visible focus ring', async ({ page }) => {
    await openSignedInApp(page);
    const tryIt = banner(page).getByRole('button', { name: 'Wypróbuj' });
    await tryIt.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(tryIt).toBeFocused();
    expect(await tryIt.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  });

  for (const theme of [undefined, 'apple', 'gold']) {
    test(`fits 360 px without horizontal scroll (${theme || 'lifexp'} theme)`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 760 });
      await openSignedInApp(page, { theme });
      await expect(banner(page)).toBeVisible();
      const m = await page.evaluate(() => {
        const b = document.getElementById('beta-banner').getBoundingClientRect();
        const buttons = [...document.querySelectorAll('#beta-banner button')].map((el) => el.getBoundingClientRect());
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          right: b.right,
          buttonsRight: Math.max(...buttons.map((r) => r.right)),
          minButtonHeight: Math.min(...buttons.map((r) => r.height)),
        };
      });
      expect(m.overflow).toBe(0);
      expect(m.right).toBeLessThanOrEqual(360);
      expect(m.buttonsRight).toBeLessThanOrEqual(360);
      expect(m.minButtonHeight).toBeGreaterThanOrEqual(44);
    });
  }

  test('desktop: next to the sidebar, at the bottom edge', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openSignedInApp(page);
    await page.waitForFunction(() => document.getElementById('beta-banner').getAnimations().length === 0);
    const box = await banner(page).boundingBox();
    expect(box.x).toBe(220);
    expect(box.y + box.height).toBeCloseTo(800, 0);
  });
});

test('is not shown on parent.html, even if the module is called there', async ({ page }) => {
  await page.goto('/parent.html');
  await page.evaluate(async () => {
    const { showBetaBanner } = await import('/beta-banner.js');
    showBetaBanner();
  });
  await expect(page.locator('.beta-banner')).toHaveCount(0);
});

test('only app.html loads it: core.js imports and calls it, other pages do not reference it', async ({ request }) => {
  const core = await (await request.get('/core.js')).text();
  expect(core).toMatch(/import \{ showBetaBanner \} from "\.\/beta-banner\.js"/);
  expect(core).toMatch(/\n\s*showBetaBanner\(\);/);
  for (const page of ['parent.html', 'verify.html', 'index.html', 'fps.html']) {
    expect(await (await request.get('/' + page)).text(), page).not.toContain('beta-banner');
  }
});
