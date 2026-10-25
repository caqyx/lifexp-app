// Push in v2's Service Worker (docs/v2/PLAN.md 9.1, row 6-8): a message delivered
// through DevTools (CDP) is shown as a notification, and its link stays on our origin.
//
// Its own file because it needs Chromium's new headless mode (channel 'chromium'):
// the default headless shell that CI runs denies the notification permission outright
// (Notification.permission stays "denied" even when granted), so showNotification
// rejects there and nothing is shown. The channel is worker-scoped, hence top level.
const { test, expect, openSignedIn, waitForServiceWorker } = require('../support/v2');

test.use({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 }, channel: 'chromium' });

test('a push shows the reminder with v2\'s icon; its link stays on our origin (6-8)', async ({ page, context, account }) => {
  await openSignedIn(page, account, '#/today');
  await context.grantPermissions(['notifications'], { origin: new URL(page.url()).origin });
  // Fails clearly (instead of an empty notification list) where the browser cannot grant it.
  expect(await page.evaluate(() => Notification.permission)).toBe('granted');
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
