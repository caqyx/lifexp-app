// Motion (docs/v2/PLAN.md 7.1): state changes animate instead of jumping — screens
// rise in and their cards and rows after them, a removed row fades while the rest
// close the gap, numbers roll, the tab bar's mark slides, the menu and sheets bring
// their parts in, the segmented control's thumb slides, toasts fade out — using only
// transform and opacity; with the system's "reduce motion" nothing animates.
const { db } = require('../support/emulator');
const { test, expect, openSignedIn, screenSettled } = require('../support/v2');

test.use({ viewport: { width: 390, height: 844 } });

/**
 * Records every screen rise-in (ui/motion.ts playEnter, a Web Animation on
 * .shell__main) with the properties it moves. Counting started animations instead of
 * sampling running ones keeps the check right on a slow machine, where a 250 ms
 * animation can be over before the test looks.
 */
function recordScreenEntries(page) {
  return page.addInitScript(() => {
    window.__entries = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.classList.contains('shell__main')) {
        const frames = Array.isArray(keyframes) ? keyframes : [keyframes];
        const props = frames.flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite'].includes(p)));
        window.__entries.push([...new Set(props)].sort());
      }
      return animate.call(this, keyframes, options);
    };
  });
}

const entries = (page) => page.evaluate(() => window.__entries);

/** Animations running on the element (CSS and Web Animations alike), by the properties they change. */
function animatedProperties(locator) {
  return locator.evaluate((el) =>
    el.getAnimations().flatMap((a) =>
      a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))),
    ),
  );
}

test('a new screen rises in, moving only transform and opacity', async ({ page, account }) => {
  await recordScreenEntries(page);
  await openSignedIn(page, account, '#/today');
  const before = (await entries(page)).length;
  await page.locator('.tabbar').getByRole('link', { name: 'Pieniądze' }).click();
  await expect.poll(async () => (await entries(page)).slice(before)).toEqual([['opacity', 'transform']]);
});

test('the segmented control slides one thumb to the choice', async ({ page, account }) => {
  await openSignedIn(page, account, '#/ui');
  const mode = page.getByRole('group', { name: 'Tryb' });
  const thumb = mode.locator('.ui-segmented__thumb');
  await mode.getByRole('radio', { name: 'Ciemny' }).check();
  const before = await thumb.boundingBox();
  await mode.getByRole('radio', { name: 'Jasny' }).check();
  // It moves over time (a transition on transform), then rests under the new choice.
  await expect(thumb).toHaveCSS('transition-property', 'transform');
  await expect.poll(async () => (await thumb.boundingBox()).x).toBeGreaterThan(before.x + 20);
  const target = await mode.getByText('Jasny', { exact: true }).boundingBox();
  await expect.poll(async () => Math.abs((await thumb.boundingBox()).x - target.x)).toBeLessThan(3);
});

test('a toast fades out before the next state', async ({ page, account }) => {
  await openSignedIn(page, account, '#/ui');
  await page.getByRole('button', { name: 'Pokaż błąd' }).click();
  const toast = page.locator('.ui-toast');
  await expect(toast).toBeVisible();
  await toast.locator('.ui-toast__message').click();
  await expect(toast).toHaveClass(/ui-toast--leaving/);
  await expect(toast).toHaveCount(0);
});

test.describe('with reduced motion', () => {
  test('screens do not animate', async ({ page, account }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSignedIn(page, account, '#/today');
    await page.locator('.tabbar').getByRole('link', { name: 'Pieniądze' }).click();
    expect(await animatedProperties(page.locator('.shell__main'))).toEqual([]);
    // The build may shorten the token ("0ms" → "0s"); either way it is zero.
    const enter = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--duration-enter'));
    expect(parseFloat(enter)).toBe(0);
  });
});

test('switching views of one module slides the switch and brings in only the content below', async ({ page, account }) => {
  await recordScreenEntries(page);
  await openSignedIn(page, account, '#/stats');
  const views = page.getByRole('navigation', { name: 'Widok statystyk' });
  const thumb = views.locator('.ui-view-switch__thumb');
  await screenSettled(page);
  const before = await thumb.boundingBox();

  const entered = (await entries(page)).length;
  await views.getByRole('link', { name: 'Historia' }).click();
  // The screen stays put (no rise-in hiding the switch) ...
  expect(await animatedProperties(page.locator('.shell__main'))).toEqual([]);
  // ... the thumb slides to the new view ...
  await expect.poll(async () => (await thumb.boundingBox()).x).toBeGreaterThan(before.x + 20);
  // ... and the new view's content comes in on its own, with transform and opacity only.
  const panel = page.locator('.ui-view-panel').first();
  expect([...new Set(await animatedProperties(panel))].sort()).toEqual(['opacity', 'transform']);

  expect((await entries(page)).length).toBe(entered);

  // Another module is a new screen: that one still rises in.
  await page.locator('.tabbar').getByRole('link', { name: 'Pieniądze' }).click();
  await expect.poll(async () => (await entries(page)).length).toBe(entered + 1);
});

/** The properties a CSS @keyframes rule moves (searched in every stylesheet, @media included). */
function keyframeProperties(page, name) {
  return page.evaluate((name) => {
    const props = new Set();
    const visit = (rules) => {
      for (const rule of rules) {
        if (rule instanceof CSSKeyframesRule && rule.name === name) {
          for (const frame of rule.cssRules) for (const prop of frame.style) props.add(prop);
        } else if (rule.cssRules) visit(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) visit(sheet.cssRules);
    return [...props].sort();
  }, name);
}

/** Each element's CSS animation: its name and delay in ms. */
function cssAnimations(locator) {
  return locator.evaluateAll((els) =>
    els.map((el) => {
      const style = getComputedStyle(el);
      return { name: style.animationName, delay: Math.round(parseFloat(style.animationDelay) * 1000) };
    }),
  );
}

/** Records every Web Animation started on an element: its classes and the properties it moves. */
function recordAnimations(page) {
  return page.addInitScript(() => {
    window.__animated = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const frames = Array.isArray(keyframes) ? keyframes : [keyframes];
      const props = frames.flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite'].includes(p)));
      window.__animated.push({ classes: [...this.classList], props: [...new Set(props)].sort() });
      return animate.call(this, keyframes, options);
    };
  });
}

const animated = (page) => page.evaluate(() => window.__animated);

/** v1 dateISOLocal(): tasks use the device's calendar (G13). */
function localDay(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seedTask(uid, text, offset) {
  return db.collection(`users/${uid}/todos`).add({
    text,
    dueDate: localDay(offset),
    size: 'S',
    done: false,
    createdAt: new Date().toISOString(),
    penaltyApplied: false,
  });
}

const centreX = async (locator) => {
  const box = await locator.boundingBox();
  return box.x + box.width / 2;
};

test('a screen’s cards arrive one after another, rising with transform and opacity only', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  // Today's left column: the points, the Ex-us field, today's tasks, the day, the chores.
  const cards = page.locator('.shell__main .today-columns > .ui-stack.ui-stagger').first().locator(':scope > *');
  await expect.poll(() => cards.count()).toBeGreaterThan(3);
  const arrivals = (await cssAnimations(cards)).slice(0, 4);
  expect(arrivals.map((a) => a.name)).toEqual(['ui-rise-in', 'ui-rise-in', 'ui-rise-in', 'ui-rise-in']);
  // --stagger-step (30 ms) apart.
  expect(arrivals.map((a) => a.delay)).toEqual([0, 30, 60, 90]);
  expect(await keyframeProperties(page, 'ui-rise-in')).toEqual(['opacity', 'transform']);
});

test('a removed row fades out where it was while the row below glides up', async ({ page, account }) => {
  await seedTask(account.uid, 'Pierwsze', 1);
  const second = await seedTask(account.uid, 'Drugie', 0);
  await recordAnimations(page);
  await openSignedIn(page, account, '#/tasks');
  const rows = page.locator('.tasks-list > .tasks-row:not(.ui-motion-ghost)');
  await expect(rows).toHaveCount(2);
  await screenSettled(page);
  // Today's task is listed first; removing it moves "Pierwsze" up into its place.
  await expect(rows.first()).toContainText('Drugie');
  const before = (await animated(page)).length;
  await second.delete();
  await expect(rows).toHaveCount(1);
  await expect
    .poll(async () => (await animated(page)).slice(before))
    .toEqual(
      expect.arrayContaining([
        { classes: expect.arrayContaining(['tasks-row', 'ui-motion-ghost']), props: ['opacity', 'transform'] },
        { classes: expect.arrayContaining(['tasks-row']), props: ['transform'] },
      ]),
    );
  // The fading copy is only for the eye, and goes once it has faded.
  await expect(page.locator('.ui-motion-ghost')).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: 'Drugie' })).toHaveCount(0);
});

test('a changed balance rolls: the old value slides away as the new one rises in', async ({ page, account }) => {
  const balance = db.doc(`users/${account.uid}/money/balance`);
  await balance.set({ current: 50 });
  await openSignedIn(page, account, '#/money');
  const value = page.getByTestId('money-balance');
  await expect(value).toHaveText('50,00 zł');
  await balance.set({ current: 80 });
  // The text is always just the current value; the old one is only drawn (::after).
  await expect(value).toHaveText('80,00 zł');
  const roll = value.locator('.ui-roll--rolling');
  await expect(roll).toHaveAttribute('data-prev', /^50,00\szł$/);
  expect(await roll.locator('.ui-roll__value').evaluate((el) => getComputedStyle(el).animationName)).toBe('ui-roll-in');
  expect(await roll.evaluate((el) => getComputedStyle(el, '::after').animationName)).toBe('ui-roll-out');
  for (const name of ['ui-roll-in', 'ui-roll-out', 'ui-roll-in-down', 'ui-roll-out-down']) {
    expect(await keyframeProperties(page, name), name).toEqual(['opacity', 'transform']);
  }
  // A smaller number rolls the other way.
  await balance.set({ current: 20 });
  await expect(value).toHaveText('20,00 zł');
  await expect(value.locator('.ui-roll--rolling')).toHaveClass(/ui-roll--down/);
});

test('the tab bar’s mark slides to the current tab', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  const tabbar = page.locator('.tabbar');
  const mark = tabbar.locator('.tabbar__indicator');
  const today = tabbar.getByRole('link', { name: 'Dziś' });
  await expect.poll(async () => Math.abs((await centreX(mark)) - (await centreX(today)))).toBeLessThan(2);
  await expect(mark).toHaveCSS('transition-property', 'transform, opacity');
  const money = tabbar.getByRole('link', { name: 'Pieniądze' });
  await money.click();
  const target = await centreX(money);
  await expect.poll(async () => Math.abs((await centreX(mark)) - target)).toBeLessThan(2);
  // The current tab's icon lands with a spring.
  expect(await money.locator('.tabbar__icon').evaluate((el) => getComputedStyle(el).animationName)).toBe('ui-pop-in');
  expect(await keyframeProperties(page, 'ui-pop-in')).toEqual(['opacity', 'transform']);
  // A screen without a tab fades the mark out where it was.
  await tabbar.getByRole('button', { name: 'Menu' }).click();
  await page.locator('#app-nav').getByRole('link', { name: 'Notatki' }).click();
  await expect(mark).toHaveAttribute('data-shown', 'false');
  await expect(mark).toHaveCSS('opacity', '0');
  // (once the card has slid back from the closing menu)
  await expect.poll(async () => Math.abs((await centreX(mark)) - target)).toBeLessThan(2);
});

test('opening the menu with a tap brings its sections in one after another; closing replays nothing', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  await page.locator('.tabbar').getByRole('button', { name: 'Menu' }).click();
  await expect(page.locator('.shell')).toHaveAttribute('data-drawer', 'open');
  const sections = page.locator('#app-nav .nav > .nav__section');
  const parts = await cssAnimations(sections);
  expect(parts.map((p) => p.name)).toEqual(parts.map(() => 'nav-part-in'));
  for (let i = 1; i < parts.length; i++) expect(parts[i].delay).toBeGreaterThan(parts[i - 1].delay);
  expect(await keyframeProperties(page, 'nav-part-in')).toEqual(['opacity', 'transform']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.shell')).toHaveAttribute('data-drawer', 'closed');
  expect((await cssAnimations(sections)).map((p) => p.name)).toEqual(parts.map(() => 'none'));
});

test('a sheet’s content follows it up, part after part', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  await page.locator('.tabbar').getByRole('button', { name: 'Dodaj' }).click();
  const sheet = page.getByRole('dialog', { name: 'Dodaj' });
  await expect(sheet).toBeVisible();
  // The body's parts rise with the sheet; inside them (the Add sheet is one list), rows
  // follow one after another.
  const parts = await cssAnimations(sheet.locator('.ui-sheet__body > *'));
  expect(parts.map((p) => p.name)).toEqual(parts.map(() => 'ui-rise-in'));
  const rows = await cssAnimations(sheet.locator('.ui-list > li'));
  expect(rows.map((p) => p.name)).toEqual(rows.map(() => 'ui-rise-in'));
  expect(rows[1].delay).toBeGreaterThan(rows[0].delay);
});

test.describe('with reduced motion, nothing new moves either', () => {
  test('arrivals, the tab mark, the menu, rolls and removed rows take 0 ms', async ({ page, account }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await recordAnimations(page);
    const balance = db.doc(`users/${account.uid}/money/balance`);
    await balance.set({ current: 50 });
    const task = await seedTask(account.uid, 'Jedyne', 0);
    await openSignedIn(page, account, '#/today');
    const still = (locator) =>
      locator.evaluateAll((els) =>
        els.every((el) => {
          const style = getComputedStyle(el);
          return parseFloat(style.animationDuration) === 0 && parseFloat(style.animationDelay) === 0;
        }),
      );
    await expect.poll(() => page.locator('.shell__main .ui-stagger > *').count()).toBeGreaterThan(3);
    expect(await still(page.locator('.shell__main .ui-stagger > *'))).toBe(true);
    const step = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--stagger-step'));
    expect(parseFloat(step)).toBe(0);
    const markTransition = await page.locator('.tabbar__indicator').evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(markTransition.split(',').map(parseFloat)).toEqual([0, 0]);

    await page.locator('.tabbar').getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('.shell')).toHaveAttribute('data-drawer', 'open');
    expect(await still(page.locator('#app-nav .nav > *'))).toBe(true);
    await page.keyboard.press('Escape');

    await page.locator('.tabbar').getByRole('link', { name: 'Pieniądze' }).click();
    await expect(page.getByTestId('money-balance')).toHaveText('50,00 zł');
    await balance.set({ current: 80 });
    await expect(page.getByTestId('money-balance')).toHaveText('80,00 zł');
    expect(await still(page.getByTestId('money-balance').locator('.ui-roll__value'))).toBe(true);

    await page.locator('.tabbar').getByRole('button', { name: 'Menu' }).click();
    await page.locator('#app-nav').getByRole('link', { name: 'Zadania' }).click();
    await expect(page.locator('.tasks-row')).toHaveCount(1);
    await task.delete();
    await expect(page.locator('.tasks-row')).toHaveCount(0);
    // No fading copy and no glide: playEnter and the list motion both stand still.
    expect(await animated(page)).toEqual([]);
  });
});
