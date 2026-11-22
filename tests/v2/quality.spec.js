// UI quality guards (docs/v2/QUALITY.md, q-ui-*): text colors that hold WCAG AA in
// every theme, 44 px targets for section actions, the drawer's dialog around a real
// navigation landmark, red destructive text actions and charts that say when they
// are empty. Runs against the built app (v2/dist) on the Firebase emulators.
const { test, expect, openSignedIn, screenSettled } = require('../support/v2');

test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

const THEMES = [
  ['lifexp', 'dark'],
  ['lifexp', 'light'],
  ['ios', 'light'],
  ['ios', 'dark'],
  ['gold', 'dark'],
];

function useTheme(page, family, mode) {
  return page.addInitScript(([f, m]) => localStorage.setItem('lifexp-v2-theme', JSON.stringify({ family: f, mode: m })), [family, mode]);
}

/**
 * Contrast of token pairs as the page resolves them: each foreground is composited
 * over its background (iOS uses translucent text colors), a translucent background
 * over `base` (default: the page background). Returns [pair, ratio] for every pair.
 */
function tokenContrasts(page, pairs) {
  return page.evaluate((list) => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const rgba = (value) => {
      probe.style.color = value;
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
      const c = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const page = rgba('var(--color-bg)');
    const out = list.map(([fg, bg, base = '--color-bg']) => {
      const back = over(over(rgba(`var(${bg})`), over(rgba(`var(${base})`), page)), page);
      const front = over(rgba(`var(${fg})`), back);
      const [hi, lo] = [lum(front), lum(back)].sort((x, y) => y - x);
      return [`${fg} on ${bg}`, Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100];
    });
    probe.remove();
    return out;
  }, pairs);
}

for (const [family, mode] of THEMES) {
  test(`text tokens hold 4.5:1 on their surfaces: ${family} ${mode}`, async ({ page, account }) => {
    await useTheme(page, family, mode);
    await openSignedIn(page, account, '#/settings');
    await expect(page.locator('html')).toHaveAttribute('data-theme', family);
    const pairs = [];
    // Text and labels sit on the page, on cards and on fields / segmented tracks.
    for (const fg of ['--color-text', '--color-text-secondary', '--color-accent-text']) {
      for (const bg of ['--color-bg', '--color-surface', '--color-surface-raised']) pairs.push([fg, bg]);
    }
    // Red text: errors and destructive actions on the page and on cards.
    pairs.push(['--color-negative', '--color-bg'], ['--color-negative', '--color-surface']);
    // Selected rows, badges and today's marks put the accent text on its soft tint, on a card.
    pairs.push(['--color-accent-text', '--color-accent-soft', '--color-surface']);
    // …and on the page itself (the calendar's "Dziś" tag in the week).
    pairs.push(['--color-accent-text', '--color-accent-soft', '--color-bg']);
    const low = (await tokenContrasts(page, pairs)).filter(([, ratio]) => ratio < 4.5);
    expect(low).toEqual([]);
  });
}

test('section actions are 44 px targets that do not grow the title row', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  await screenSettled(page);
  const section = page.locator('.ui-section', { has: page.getByRole('heading', { name: 'Cele' }) });
  const link = section.getByRole('link', { name: 'Wszystkie' });
  const box = await link.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  const row = await section.locator('.ui-section__header').boundingBox();
  expect(row.height).toBeLessThanOrEqual(24);
  // The text still lines up with the card's right edge below.
  const card = await section.locator('.ui-card').boundingBox();
  const text = await link.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().right;
  });
  expect(Math.abs(card.x + card.width - text)).toBeLessThanOrEqual(8);
});

test('the open drawer is a dialog around the navigation landmark', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  await page.locator('.tabbar').getByRole('button', { name: 'Menu' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nawigacja' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('navigation', { name: 'Nawigacja' })).toBeVisible();
  // A <nav> never carries the dialog role itself.
  expect(await page.locator('nav[role="dialog"]').count()).toBe(0);
});

test('"Usuń" next to other actions is red, not the accent of the safe ones', async ({ page, account }) => {
  await openSignedIn(page, account, '#/ui');
  const quietDanger = page.getByRole('button', { name: 'Usuń w wierszu' });
  const quiet = page.locator('.ui-button--quiet').first();
  const colors = await Promise.all([quietDanger, quiet].map((b) => b.evaluate((el) => getComputedStyle(el).color)));
  const negative = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-negative)';
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  });
  expect(colors[0]).toBe(negative);
  expect(colors[0]).not.toBe(colors[1]);
});

test('a week without points says so instead of an empty chart', async ({ page, account }) => {
  await openSignedIn(page, account, '#/stats');
  const section = page.locator('.ui-section', { has: page.getByRole('heading', { name: /Punkty/ }) }).first();
  await expect(section.getByText('Brak punktów w tych dniach.')).toBeVisible();
});

test('a filter that names itself keeps its label for screen readers only', async ({ page, account }) => {
  await openSignedIn(page, account, '#/notes');
  const group = page.getByRole('group', { name: 'Widok notatek' });
  await expect(group).toBeVisible();
  await expect(group.locator('legend')).toHaveClass(/visually-hidden/);
});
