// Games (docs/v2/PLAN.md 9.1, stage g-1) on the Firebase emulators: the list at
// #/games, a game full screen at #/games/:id and its play time written the way v1
// logs gaming (gamingSessions + dailyLog.gamingMinutes, no points). The game is the
// emulator-only test game, whose page the test serves; the clock is Playwright's,
// so minutes pass in an instant. Parity (PLAN.md 8.3): v1 writes the same shape and
// shows the session v2 wrote.
const { test, expect, openSignedIn } = require('../support/v2');
const { createUser, db, serveCdnFromNpm, signInToApp } = require('../support/emulator');

const PHONE = { width: 360, height: 780 };
const GAME = 'Gra testowa';
const PENDING_KEY = 'lifexp-v2-gaming-pending';

/** The test game's page: proves it can keep a record in localStorage (same origin). */
const GAME_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Test</title></head><body>
<p id="state">loading</p>
<script>
  localStorage.setItem('test-game-record', String(Number(localStorage.getItem('test-game-record') || 0) + 1));
  document.getElementById('state').textContent = 'record ' + localStorage.getItem('test-game-record');
</script></body></html>`;

async function serveTestGame(page) {
  await page.route('**/games/test/index.html', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: GAME_PAGE }),
  );
}

async function gamingState(uid) {
  const user = db.collection('users').doc(uid);
  const [sessions, days, profile] = await Promise.all([
    user.collection('gamingSessions').get(),
    user.collection('dailyLog').get(),
    user.get(),
  ]);
  return {
    sessions: sessions.docs.map((d) => d.data()),
    days: Object.fromEntries(days.docs.map((d) => [d.id, d.data()])),
    points: profile.data().points,
  };
}

/** The page's own UTC day (its clock is Playwright's). */
const pageDay = (page) => page.evaluate(() => new Date().toISOString().slice(0, 10));

async function setVisibility(page, state) {
  await page.evaluate((s) => {
    Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

async function openGame(page, account) {
  await serveTestGame(page);
  await page.clock.install();
  await openSignedIn(page, account, '#/games/test');
  const host = page.getByRole('region', { name: GAME });
  await expect(host).toBeVisible();
  await expect(host.frameLocator('iframe').locator('#state')).toHaveText('record 1');
  return host;
}

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the list: four games, each with a line, its time today and "Wkrótce" until it is added', async ({ page, account }) => {
    await openSignedIn(page, account, '#/today');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByLabel('Nawigacja').getByRole('link', { name: 'Gry' }).click();
    await expect(page).toHaveURL(/#\/games$/);

    const cards = page.getByRole('list', { name: 'Gry' }).getByRole('listitem');
    await expect(cards).toHaveCount(4);
    await expect(cards.getByRole('heading')).toHaveText(['Flappy Bird', 'Wartime', 'Gridlock', 'Szybkie liczenie']);
    for (const card of await cards.all()) {
      await expect(card.getByText('Wkrótce')).toBeVisible();
      await expect(card.getByText('Dziś jeszcze nie grano')).toBeVisible();
    }
    // The test game exists only by address, never in the list.
    await expect(page.getByText(GAME)).toHaveCount(0);
    // Nothing sticks out at 360 px.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width);

    await page.goto(page.url().replace('#/games', '#/games/wartime'));
    await expect(page.getByText('Wkrótce. Ta gra pojawi się w jednej z kolejnych wersji.')).toBeVisible();
    await page.getByRole('link', { name: 'Wszystkie gry' }).click();
    await expect(page).toHaveURL(/#\/games$/);
  });

  test('play time counts only while visible and is written as v1 logs gaming, with no points', async ({ page, account }) => {
    const before = await gamingState(account.uid);
    const host = await openGame(page, account);
    // Full screen, with Zakończ in reach (measured once it has come in).
    await host.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const box = await host.boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: PHONE.width, height: PHONE.height });

    await page.clock.fastForward('02:10');
    await setVisibility(page, 'hidden');
    // Hidden: kept on the device in case the tab is killed, not counted while away.
    const held = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), PENDING_KEY));
    expect(held).toHaveLength(1);
    const [pending] = held;
    expect(pending).toMatchObject({ uid: account.uid, game: GAME });
    expect(pending.ms).toBeGreaterThanOrEqual(130_000);
    await page.clock.fastForward('05:00');
    await setVisibility(page, 'visible');
    expect(await page.evaluate((k) => localStorage.getItem(k), PENDING_KEY)).toBeNull();
    await page.clock.fastForward('00:40');

    await host.getByRole('button', { name: 'Zakończ' }).click();
    await expect(page).toHaveURL(/#\/games$/);
    await expect(page.getByText('Zapisano 3 min grania.')).toBeVisible();

    const day = await pageDay(page);
    await expect.poll(async () => (await gamingState(account.uid)).sessions.length).toBe(1);
    const after = await gamingState(account.uid);
    const [session] = after.sessions;
    // 2:50 of play (the 5 hidden minutes do not count) → 3 whole minutes, v1's fields and types.
    expect(Object.keys(session).sort()).toEqual(['date', 'duration', 'game', 'timestamp']);
    expect(session).toMatchObject({ game: GAME, duration: 3, date: day });
    expect(typeof session.timestamp.toDate).toBe('function');
    expect(after.days[day]).toEqual({ pointsEarned: 0, gamingMinutes: 3 });
    expect(after.points).toEqual(before.points);
  });

  test('a session under 30 seconds writes nothing', async ({ page, account }) => {
    const host = await openGame(page, account);
    await page.clock.fastForward('00:20');
    await host.getByRole('button', { name: 'Zakończ' }).click();
    await expect(page).toHaveURL(/#\/games$/);
    await expect(page.getByText('Dziś jeszcze nie grano').first()).toBeVisible();
    expect(await gamingState(account.uid)).toMatchObject({ sessions: [], days: {} });
  });

  test('leaving by Back writes the session onto a day that has points, keeping them', async ({ page }) => {
    const account = await createUser({ tag: 'games-day' });
    const day = new Date().toISOString().slice(0, 10);
    await db.doc(`users/${account.uid}/dailyLog/${day}`).set({ pointsEarned: 40, gamingMinutes: 10 });
    await page.goto('about:blank');
    await openSignedIn(page, account, '#/games');
    await page.getByRole('heading', { name: 'Wartime' }).waitFor();
    await serveTestGame(page);
    await page.clock.install();
    await page.evaluate(() => (location.hash = '#/games/test'));
    await expect(page.getByRole('region', { name: GAME })).toBeVisible();
    await page.clock.fastForward('01:00');
    await page.goBack();
    await expect(page).toHaveURL(/#\/games$/);
    const pageToday = await pageDay(page);
    await expect.poll(async () => (await gamingState(account.uid)).days[pageToday]).toEqual(
      pageToday === day ? { pointsEarned: 40, gamingMinutes: 11 } : { pointsEarned: 0, gamingMinutes: 1 },
    );
  });

  test('closing the tab: written at pagehide or on the next visit, once', async ({ page, context, account }) => {
    await openGame(page, account);
    await page.clock.fastForward('04:00');
    const day = await pageDay(page);
    await page.close({ runBeforeUnload: true });

    const next = await context.newPage();
    await openSignedIn(next, account, '#/games');
    await expect(next.getByRole('heading', { name: 'Wartime' })).toBeVisible();
    await expect.poll(async () => (await gamingState(account.uid)).sessions).toEqual([
      expect.objectContaining({ game: GAME, duration: 4, date: day }),
    ]);
    await expect.poll(() => next.evaluate((k) => localStorage.getItem(k), PENDING_KEY)).toBeNull();
    expect((await gamingState(account.uid)).days[day]).toEqual({ pointsEarned: 0, gamingMinutes: 4 });

    // Another visit writes nothing more.
    await next.reload();
    await expect(next.getByRole('heading', { name: 'Wartime' })).toBeVisible();
    expect((await gamingState(account.uid)).sessions).toHaveLength(1);
    expect((await gamingState(account.uid)).days[day]).toEqual({ pointsEarned: 0, gamingMinutes: 4 });
  });

  test('a session a killed tab left behind is written once, on the next visit', async ({ page, account }) => {
    await openSignedIn(page, account, '#/today');
    const endedAt = Date.now() - 60_000;
    const day = new Date(endedAt).toISOString().slice(0, 10);
    const killed = { id: 'killedtabsession01', uid: account.uid, game: GAME, ms: 7 * 60_000, endedAt, pageId: 'killed-tab' };
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [PENDING_KEY, JSON.stringify([killed])]);
    await page.reload();
    await page.evaluate(() => (location.hash = '#/games'));
    await expect(page.getByRole('heading', { name: 'Wartime' })).toBeVisible();
    await expect.poll(async () => (await gamingState(account.uid)).sessions).toEqual([
      expect.objectContaining({ game: GAME, duration: 7, date: day }),
    ]);
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), PENDING_KEY)).toBeNull();
    const doc = await db.doc(`users/${account.uid}/gamingSessions/${killed.id}`).get();
    expect(doc.exists).toBe(true);

    // The same record again (e.g. a second tab still had it): the server has it, nothing more is written.
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [PENDING_KEY, JSON.stringify([killed])]);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Wartime' })).toBeVisible();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), PENDING_KEY)).toBeNull();
    expect((await gamingState(account.uid)).sessions).toHaveLength(1);
    expect((await gamingState(account.uid)).days[day]).toEqual({ pointsEarned: 0, gamingMinutes: 7 });
  });
});

test.describe('v1 on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('parity: v1 writes the same shape, and its history shows the session v2 wrote', async ({ page, browser }) => {
    const account = await createUser({ tag: 'games-v1' });
    // v2 plays the test game for 2 minutes.
    await openGame(page, account);
    await page.clock.fastForward('02:00');
    await page.getByRole('button', { name: 'Zakończ' }).click();
    await expect.poll(async () => (await gamingState(account.uid)).sessions.length).toBe(1);
    const v2Session = (await gamingState(account.uid)).sessions[0];

    // v1, on its own clock, shows it and logs one by hand.
    const v1Context = await browser.newContext();
    try {
      const v1 = await v1Context.newPage();
      await serveCdnFromNpm(v1Context);
      await signInToApp(v1, account);
      await v1.evaluate(() => window.showPage('log-gaming'));
      await expect(v1.locator('#gaming-history-list')).toContainText(GAME);
      await expect(v1.locator('#gaming-history-list')).toContainText('2m');
      await v1.selectOption('#game-select', 'Minecraft');
      await v1.fill('#game-minutes', '5');
      await v1.click('#page-log-gaming button.btn-primary');
      await expect.poll(async () => (await gamingState(account.uid)).sessions.length).toBe(2);
    } finally {
      await v1Context.close();
    }
    const v1Session = (await gamingState(account.uid)).sessions.find((s) => s.game === 'Minecraft');

    const shape = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v?.constructor?.name ?? typeof v]));
    expect(shape(v2Session)).toEqual(shape(v1Session));
    expect(shape(v2Session)).toEqual({ game: 'String', duration: 'Number', date: 'String', timestamp: 'Timestamp' });
    const day = v2Session.date;
    if (v1Session.date === day) {
      await expect.poll(async () => (await gamingState(account.uid)).days[day]).toEqual({ pointsEarned: 0, gamingMinutes: 7 });
    }
  });
});
