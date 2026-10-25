// v2's Service Worker and manifest (docs/v2/PLAN.md 4.8, stage 1f): installed with
// its own scope, v2 starts offline from the precache with the data Firestore
// cached, and v1's Service Worker leaves v2's caches alone.
const { createUser, db, serveCdnFromNpm } = require('../support/emulator');
const { test, expect, appUrl, openSignedIn } = require('../support/v2');

test.use({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });

/**
 * Wait until v2's worker is active and controls this page (it claims clients on first
 * install). Polled: page.waitForFunction does not await an async predicate (the
 * Promise itself is truthy), so it would return while the precache is still filling.
 */
async function waitForServiceWorker(page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state === 'activated' && navigator.serviceWorker.controller !== null;
        }),
      { timeout: 20000 },
    )
    .toBe(true);
}

test('the worker installs with the /v2/ scope and precaches the app', async ({ page, account }) => {
  await openSignedIn(page, account, '#/today');
  await waitForServiceWorker(page);

  const info = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const names = await caches.keys();
    const precache = names.find((n) => n.startsWith('lifexp-v2-precache'));
    const urls = precache ? (await (await caches.open(precache)).keys()).map((r) => new URL(r.url).pathname) : [];
    return { scope: new URL(registration.scope).pathname, names, urls };
  });
  expect(info.scope).toBe('/v2/dist/');
  expect(info.urls.some((u) => u.endsWith('/v2/dist/index.html'))).toBe(true);
  expect(info.urls.some((u) => /\/assets\/firebase-[\w-]+\.js$/.test(u))).toBe(true);
  expect(info.urls.some((u) => u.endsWith('.map'))).toBe(false);

  // The manifest is linked and names the icons that ship with v2.
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    return (await fetch(href)).json();
  });
  expect(manifest).toMatchObject({ name: 'LifeXP v2', display: 'standalone', start_url: './', scope: './' });
  expect(manifest.icons.map((i) => i.sizes)).toEqual(['192x192', '512x512']);
});

test('offline, v2 starts from the precache and shows Today from cached data', async ({ page, context }) => {
  const account = await createUser({ tag: 'offline', profile: { points: { total: 777, earnedAllTime: 777, spentAllTime: 0 } } });
  await openSignedIn(page, account, '#/today');
  await expect(page.getByTestId('points-total')).toHaveText('777');
  await waitForServiceWorker(page);
  // Let Firestore persist what it has read.
  await page.waitForTimeout(500);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.topbar__title')).toHaveText('Dziś');
  await expect(page.getByTestId('points-total')).toHaveText('777');
  await context.setOffline(false);
});

test("v1's worker updating does not delete v2's caches", async ({ page, context, account }) => {
  await openSignedIn(page, account, '#/today');
  await waitForServiceWorker(page);

  // v1's pages register sw.js with scope / (its activation used to delete every other
  // cache). Registered here from a plain v1 file, because v1's pages redirect a
  // signed-in person — and the session is shared with v2.
  await serveCdnFromNpm(context);
  const v1 = await context.newPage();
  await v1.goto('/manifest.json');
  const v1State = await v1.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const worker = registration.installing || registration.waiting || registration.active;
    if (worker.state !== 'activated') {
      await new Promise((resolve) => {
        worker.addEventListener('statechange', () => worker.state === 'activated' && resolve());
        setTimeout(resolve, 15000);
      });
    }
    return worker.state;
  });
  expect(v1State).toBe('activated');

  const names = await page.evaluate(() => caches.keys());
  expect(names.some((n) => n.startsWith('lifexp-v2-precache'))).toBe(true);
  expect(names.some((n) => n.startsWith('lifexp-shell-'))).toBe(true);

  await context.setOffline(true);
  await page.goto(appUrl('#/today'));
  await expect(page.locator('.topbar__title')).toHaveText('Dziś');
  await context.setOffline(false);
});

test('a push shows the reminder with v2\'s icon; its link stays on our origin (6-8)', async ({ page, context, account }) => {
  await context.grantPermissions(['notifications']);
  await openSignedIn(page, account, '#/today');
  await waitForServiceWorker(page);

  // DevTools' "Push" button: deliver a message to v2's registration without a subscription (v2 has none before the cutover).
  const cdp = await context.newCDPSession(page);
  const registrations = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations: list }) => registrations.push(...list));
  await cdp.send('ServiceWorker.enable');
  await expect.poll(() => registrations.find((r) => r.scopeURL.endsWith('/v2/dist/') && !r.isDeleted)?.registrationId).toBeTruthy();
  const registration = registrations.find((r) => r.scopeURL.endsWith('/v2/dist/') && !r.isDeleted);
  const origin = new URL(registration.scopeURL).origin;

  const send = (payload) =>
    cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId: registration.registrationId, data: JSON.stringify(payload) });
  const shown = () =>
    page.evaluate(async () =>
      (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, icon: n.icon, url: n.data?.url })),
    );

  await send({ notification: { title: '🔥 Seria: 2 dni', body: 'Dziś jeszcze nic nie ma.' }, fcmOptions: { link: '#/today' } });
  await expect.poll(shown).toContainEqual({
    title: '🔥 Seria: 2 dni',
    body: 'Dziś jeszcze nic nie ma.',
    icon: `${registration.scopeURL}icon-192.png`,
    url: `${registration.scopeURL}#/today`,
  });

  // A link to another site is never kept: a tap would open v2's start instead.
  await send({ notification: { title: 'Obcy link', body: '' }, fcmOptions: { link: 'https://evil.example/' } });
  await expect.poll(async () => (await shown()).find((n) => n.title === 'Obcy link')?.url).toBe(registration.scopeURL);
});
