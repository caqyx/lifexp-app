// Performance guards (docs/v2/PERF.md) on the Firebase emulators, phone-sized. They
// count things that do not depend on the machine's speed: Firestore listeners, chunks
// fetched, layout reads and DOM changes. Timings are measured by hand (PERF.md).
const { createUser, db } = require('../support/emulator');
const { test, expect, openSignedIn, screenSettled } = require('../support/v2');

test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

/**
 * Today's live Firestore listeners: the profile, the six sources of Today
 * (stores/today), broadcasts, the tasks (Today's task card, q-ui-2) and, with the
 * calendar on, its two collections. A new listener on the start screen is a
 * decision: raise this with a line in PERF.md.
 */
const TODAY_LISTENERS = 9;
const TODAY_LISTENERS_WITH_CALENDAR = 11;

/** Counts Listen targets the page adds and removes (the bodies of Firestore's WebChannel requests). */
function countListens(page) {
  const counts = { added: 0, removed: 0 };
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().includes('/Listen/channel')) return;
    let body = request.postData() ?? '';
    try {
      body = decodeURIComponent(body.replace(/\+/g, ' '));
    } catch {
      // Not URL-encoded: count in the raw body.
    }
    counts.added += (body.match(/"addTarget"/g) ?? []).length;
    counts.removed += (body.match(/"removeTarget"/g) ?? []).length;
  });
  return { live: () => counts.added - counts.removed, counts };
}

async function seedActivities(uid, n) {
  const batch = db.batch();
  batch.set(db.doc(`users/${uid}/activityDefs/study`), { name: 'Nauka', points: 60, order: 1 });
  for (let i = 0; i < n; i++) {
    batch.set(db.collection(`users/${uid}/activities`).doc(), {
      type: 'study',
      typeName: 'Nauka',
      desc: `Aktywność ${i}`,
      duration: 30,
      points: 10,
      timestamp: new Date(Date.now() - i * 3600_000),
    });
  }
  await batch.commit();
}

/** Waits until no Listen request has gone out for a while (the listeners have settled). */
async function listenersSettled(page, listens) {
  let last = -1;
  await expect
    .poll(
      () => {
        const now = listens.live();
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [1000], timeout: 15000 },
    )
    .toBe(true);
}

const TOUR = [
  ['#/tasks', 'Zadania'],
  ['#/money', 'Pieniądze'],
  ['#/notes', 'Notatki'],
  ['#/chores', 'Obowiązki'],
  ['#/goals', 'Cele'],
  ['#/stats', 'Statystyki'],
  ['#/settings', 'Ustawienia'],
  ['#/today', 'Dziś'],
];

async function tour(page) {
  for (const [hash, title] of TOUR) {
    await page.evaluate((h) => (location.hash = h), hash);
    await expect(page.locator('.topbar__title')).toHaveText(title);
    // The screen's data is in, so its listeners are registered (they start after a dynamic import).
    await expect(page.locator('.shell__main .ui-skeleton')).toHaveCount(0, { timeout: 15000 });
    await screenSettled(page);
  }
}

test('Today starts a fixed number of listeners; screens visited again reuse theirs and none are left behind', async ({ page, account }) => {
  test.setTimeout(120000);
  await seedActivities(account.uid, 1);
  const listens = countListens(page);
  await openSignedIn(page, account, '#/today');
  await expect(page.getByTestId('points-total')).toBeVisible();
  await listenersSettled(page, listens);
  expect(listens.live()).toBe(TODAY_LISTENERS);

  await tour(page);
  await listenersSettled(page, listens);
  const added = listens.counts.added;
  // The same tour again within the grace (stores/shared.ts): no query is registered anew.
  await tour(page);
  await listenersSettled(page, listens);
  expect(listens.counts.added).toBe(added);

  // Once the grace is over, every screen has stopped what it started; Today's stay.
  await page.waitForTimeout(31_000);
  await expect.poll(() => listens.live(), { timeout: 10000 }).toBe(TODAY_LISTENERS);
});

test('with the calendar on, Today adds only its entries, categories and tasks', async ({ page }) => {
  const account = await createUser({ tag: 'perf-cal', profile: { optInModules: ['calendar'] } });
  const listens = countListens(page);
  await openSignedIn(page, account, '#/today');
  await expect(page.getByTestId('points-total')).toBeVisible();
  await listenersSettled(page, listens);
  expect(listens.live()).toBe(TODAY_LISTENERS_WITH_CALENDAR);
});

test('a Polish start does not download the English dictionary; English loads it and shows English', async ({ page, browser }) => {
  const account = await createUser({ tag: 'perf-pl' });
  const english = [];
  page.on('request', (request) => {
    if (/\/assets\/en-[\w-]+\.js$/.test(request.url())) english.push(request.url());
  });
  await openSignedIn(page, account, '#/today');
  await expect(page.locator('.topbar__title')).toHaveText('Dziś');
  await screenSettled(page);
  expect(english).toEqual([]);

  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
  const enPage = await context.newPage();
  const enAccount = await createUser({ tag: 'perf-en', profile: { lang: 'en' } });
  const enRequests = [];
  enPage.on('request', (request) => {
    if (/\/assets\/en-[\w-]+\.js$/.test(request.url())) enRequests.push(request.url());
  });
  await openSignedIn(enPage, enAccount, '#/today');
  await expect(enPage.locator('.topbar__title')).toHaveText('Today');
  await expect(enPage.locator('html')).toHaveAttribute('lang', 'en');
  expect(enRequests).toHaveLength(1);
  // The next start already knows the language (stored on the device): English from the first paint.
  await enPage.reload();
  await expect(enPage.locator('.topbar__title')).toHaveText('Today');
  await context.close();
});

test('opening the drawer does not read the layout of list rows', async ({ page, account }) => {
  await seedActivities(account.uid, 5);
  // Counts reads of a list row's place (ui/listMotion.ts), which force a layout mid-render.
  await page.addInitScript(() => {
    const proto = HTMLElement.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, 'offsetTop');
    window.__rowReads = 0;
    Object.defineProperty(proto, 'offsetTop', {
      configurable: true,
      get() {
        if (this.parentElement?.classList.contains('ui-motion-list')) window.__rowReads += 1;
        return original.get.call(this);
      },
    });
  });
  await openSignedIn(page, account, '#/today');
  await expect(page.locator('.ui-motion-list > *').first()).toBeVisible();
  await screenSettled(page);
  await page.evaluate(() => (window.__rowReads = 0));

  const menu = page.getByRole('navigation', { name: 'Na skróty' }).getByRole('button', { name: 'Menu' });
  for (let i = 0; i < 2; i++) {
    await menu.click();
    await expect(page.locator('.shell')).toHaveAttribute('data-drawer', 'open');
    await page.keyboard.press('Escape');
    await expect(page.locator('.shell')).toHaveAttribute('data-drawer', 'closed');
  }
  expect(await page.evaluate(() => window.__rowReads)).toBe(0);
});

test('an idle Today changes nothing on the page', async ({ page, account }) => {
  await seedActivities(account.uid, 5);
  await openSignedIn(page, account, '#/today');
  await expect(page.getByTestId('points-total')).toBeVisible();
  await screenSettled(page);
  await page.waitForTimeout(1500);
  const changes = await page.evaluate(async () => {
    let n = 0;
    const observer = new MutationObserver((records) => (n += records.length));
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    await new Promise((resolve) => setTimeout(resolve, 5000));
    observer.disconnect();
    return n;
  });
  // No timer re-renders the screen while nothing happens.
  expect(changes).toBe(0);
});
