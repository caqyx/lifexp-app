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
  await page.route(/\/games\/test\/index\.html(?:\?.*)?$/, (route) =>
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

/**
 * The host is on screen *and* its effects ran: the play clock starts in an effect, which
 * Preact runs after paint, so a region that is merely visible may not be counting yet, and
 * a fastForward then would be lost (the session comes out under 30 s and writes nothing).
 * The host focuses the frame in an effect declared after the clock's, in the same flush.
 */
async function hostMounted(host) {
  await expect(host).toBeVisible();
  await expect(host.locator('iframe')).toBeFocused();
}

async function openGame(page, account) {
  await serveTestGame(page);
  await page.clock.install();
  await openSignedIn(page, account, '#/games/test');
  const host = page.getByRole('region', { name: GAME });
  await hostMounted(host);
  await expect(host.frameLocator('iframe').locator('#state')).toHaveText('record 1');
  return host;
}

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the list: five games, each with a line, its time today and "Graj"', async ({ page, account }) => {
    await openSignedIn(page, account, '#/today');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByLabel('Nawigacja').getByRole('link', { name: 'Gry' }).click();
    await expect(page).toHaveURL(/#\/games$/);

    const cards = page.getByRole('list', { name: 'Gry' }).getByRole('listitem');
    await expect(cards).toHaveCount(5);
    await expect(cards.getByRole('heading')).toHaveText(['Flappy Bird', 'Wartime', 'Gridlock', 'Szybkie liczenie', 'Wave Rush']);
    for (const card of await cards.all()) await expect(card.getByText('Dziś jeszcze nie grano')).toBeVisible();
    // All are in (g-2, g-3, g-4, w-1): nothing is "Wkrótce" any more.
    for (const name of ['Flappy Bird', 'Wartime', 'Gridlock', 'Szybkie liczenie', 'Wave Rush']) {
      await expect(page.getByRole('link', { name: `Graj: ${name}` })).toBeVisible();
    }
    await expect(page.getByText('Wkrótce')).toHaveCount(0);
    // The test game exists only by address, never in the list.
    await expect(page.getByText(GAME)).toHaveCount(0);
    // Nothing sticks out at 360 px.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width);

    // An address that is no game says so and leads back.
    await page.goto(page.url().replace('#/games', '#/games/no-such-game'));
    await expect(page.getByText('Nie ma takiej gry.')).toBeVisible();
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
    await hostMounted(page.getByRole('region', { name: GAME }));
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
      // v1 adds the session, then the day's minutes: wait for both before closing v1.
      const v1Day = (await gamingState(account.uid)).sessions.find((s) => s.game === 'Minecraft').date;
      if (v1Day === v2Session.date) {
        await expect.poll(async () => (await gamingState(account.uid)).days[v1Day]?.gamingMinutes).toBe(7);
      }
    } finally {
      await v1Context.close();
    }
    const v1Session = (await gamingState(account.uid)).sessions.find((s) => s.game === 'Minecraft');

    const shape = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v?.constructor?.name ?? typeof v]));
    expect(shape(v2Session)).toEqual(shape(v1Session));
    expect(shape(v2Session)).toEqual({ game: 'String', duration: 'Number', date: 'String', timestamp: 'Timestamp' });
    if (v1Session.date === v2Session.date) {
      expect((await gamingState(account.uid)).days[v2Session.date]).toEqual({ pointsEarned: 0, gamingMinutes: 7 });
    }
  });
});

// ── The vendored games (stage g-2): they play inside the host, offline-safe and sealed ──

/**
 * Collects what a game must never do: a request off this origin (the context aborts it
 * anyway), a CSP violation (reported from inside every frame), an error in the console
 * or an uncaught exception. Chrome's warning about the sandbox flags is a warning, not
 * an error.
 */
async function watchProblems(page) {
  const problems = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      problems.push(`external request: ${request.url()}`);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
  return problems;
}

async function playFromList(page, account, name) {
  await openSignedIn(page, account, '#/games');
  await page.getByRole('link', { name: `Graj: ${name}` }).click();
  const host = page.getByRole('region', { name });
  await hostMounted(host);
  return { host, game: host.frameLocator('iframe') };
}

async function endAndExpectSession(page, account, name) {
  await page.clock.fastForward('01:00');
  await page.getByRole('button', { name: 'Zakończ' }).click();
  await expect(page).toHaveURL(/#\/games$/);
  await expect.poll(async () => (await gamingState(account.uid)).sessions.map((s) => s.game)).toEqual([name]);
}

/**
 * After a Wartime turn the game can ask things (a world event, a diplomatic proposal) in a
 * dialog that cannot be dismissed, and opens the next one 150 ms after the last closes:
 * answer each with its first choice, as a player would, until none comes for a moment.
 */
async function answerWartimeDialogs(page, game) {
  const dialog = game.locator('#modal-root .modal-backdrop');
  for (let quiet = 0; quiet < 3; ) {
    if (await dialog.count()) {
      quiet = 0;
      await dialog.locator('.event-opt, .modal-foot .btn').first().click();
    } else {
      quiet += 1;
      await page.waitForTimeout(250);
    }
  }
}

test.describe('Wartime', () => {
  test('sideways: a new game, the map, one turn, a save that survives a reload, and Zakończ records the time', async ({ page, account }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 800, height: 360 });
    const problems = await watchProblems(page);
    await page.clock.install();
    const { host, game } = await playFromList(page, account, 'Wartime');
    // Held sideways, the host bar is a rail on the left and the game has the full height.
    await host.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const frame = await host.locator('iframe').boundingBox();
    expect(frame.height).toBe(360);
    expect(frame.width).toBeGreaterThan(680);
    await expect(host.getByRole('note')).toBeHidden(); // no "turn your phone" while sideways

    await game.locator('#start-search').fill('Polska');
    await game.locator('#start-results .country-item[data-cc="POL"]').click();
    await game.locator('#btn-start').click();
    await expect(game.locator('#topbar')).toBeVisible({ timeout: 30000 });
    await expect(game.locator('#tb-name')).toHaveText('Polska');
    // A first game opens the tutorial over the map; skip it, as a player would.
    await game.locator('#tut-skip').click();
    await expect(game.locator('#tutorial')).toHaveCount(0);
    const firstWeek = await game.locator('#tb-date').textContent();
    await game.locator('#btn-endturn').click();
    await expect(game.locator('#tb-date')).not.toHaveText(firstWeek, { timeout: 30000 });
    await answerWartimeDialogs(page, game);
    const savedWeek = await game.locator('#tb-date').textContent();

    // Menu → save into slot 1 (localStorage, shared with nothing of LifeXP's).
    await game.locator('#btn-more').click();
    await game.locator('#btn-menu').click();
    await game.locator('#menu [data-act="save"]').click();
    await game.locator('[data-save="1"]').click();
    expect(await page.evaluate(() => localStorage.getItem('wartime2026_slot_1'))).toBeTruthy();
    // The save can also be exported as a file (the frame allows downloads for Wartime only).
    const [download] = await Promise.all([page.waitForEvent('download'), game.locator('#sv-export').click()]);
    expect(download.suggestedFilename()).toMatch(/^wartime2026_.*\.json$/);

    await page.reload();
    await expect(game.locator('#btn-load')).toBeVisible({ timeout: 30000 });
    await game.locator('#btn-load').click();
    await game.locator('[data-load="1"]').click();
    await expect(game.locator('#tb-date')).toHaveText(savedWeek, { timeout: 30000 });
    await expect(game.locator('#tb-name')).toHaveText('Polska');

    await endAndExpectSession(page, account, 'Wartime');
    expect(problems).toEqual([]);
  });

  test.describe('on a touch phone held upright', () => {
    test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

    test('asks to turn the phone, and a tap on the map picks a country', async ({ page, account }) => {
      const problems = await watchProblems(page);
      const { host, game } = await playFromList(page, account, 'Wartime');
      const hint = host.getByRole('note');
      await expect(hint).toContainText('Obróć telefon');
      await expect(game.locator('#start-card')).toHaveClass(/empty/, { timeout: 30000 });

      // A tap on the map (the game's touch control) picks the country under it.
      const map = await host.locator('iframe').boundingBox();
      const card = game.locator('#start-card');
      // The map is still settling after the start screen opens; tap until it takes it.
      await expect
        .poll(async () => {
          await page.touchscreen.tap(map.x + map.width * 0.5, map.y + 80);
          return card.getAttribute('class');
        }, { timeout: 15000 })
        .not.toContain('empty');

      await hint.getByRole('button', { name: 'OK' }).click();
      await expect(hint).toBeHidden();
      expect(problems).toEqual([]);
    });
  });
});

test.describe('Gridlock', () => {
  test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

  test('starts, a dash moves the cube, a round completes, coins stay after a reload, Zakończ records the time', async ({ page, account }) => {
    test.setTimeout(60000);
    const problems = await watchProblems(page);
    await page.clock.install();
    const { game } = await playFromList(page, account, 'Gridlock');
    // The first start opens the tutorial; skip it into a normal game.
    await game.locator('#tut-skip').click();
    await game.locator('#btn-start').click();
    await expect(game.locator('#hud-info')).toContainText('Round 1');

    // A dash: tap a cell two to the right of the cube (start 8,8 on the 16×16 board).
    const cells = game.locator('#board .cell');
    await expect(cells).toHaveCount(256);
    const dashes = game.locator('#hud-dash');
    const before = await dashes.textContent();
    await cells.nth(8 * 16 + 10).tap();
    await expect(dashes).not.toHaveText(before);

    // A round completes and pays. Every round fires a laser along the cube's row or
    // column, so standing still loses: a small autopilot inside the game's frame dodges
    // the way a player does (press a highlighted cell, release), and a run that still
    // ends early is played again, up to a few times.
    const frame = page.frames().find((f) => f.url().includes('/games/gridlock/'));
    await frame.evaluate(() => {
      setInterval(() => {
        /* global alive, lasers, cube */
        if (!alive) return;
        const hit = lasers.some((l) => l.state === 'charge' && (l.type === 'row' ? l.idx === cube.y : l.idx === cube.x));
        if (!hit) return;
        const safe = document.querySelector('#board .cell.dashable:not(.block-charge)');
        if (!safe) return;
        safe.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        window.dispatchEvent(new PointerEvent('pointerup'));
      }, 100);
    });
    const info = game.locator('#hud-info');
    const dead = game.locator('#death-overlay.show');
    for (let run = 0; run < 6; run++) {
      await expect(info.filter({ hasText: /Round [2-9]/ }).or(dead)).toBeVisible({ timeout: 20000 });
      if (/Round [2-9]/.test(await info.textContent())) break;
      await game.locator('#btn-retry').click();
      await expect(dead).toBeHidden();
    }
    await expect(info).toContainText(/Round [2-9]/);
    await expect.poll(() => page.evaluate(() => Number(localStorage.getItem('cm_coins') || 0)), { timeout: 20000 }).toBeGreaterThan(0);
    const coins = await page.evaluate(() => Number(localStorage.getItem('cm_coins')));

    await page.reload();
    await expect(game.locator('#menu-coins')).toContainText(String(coins), { timeout: 20000 });

    await endAndExpectSession(page, account, 'Gridlock');
    expect(problems).toEqual([]);
  });
});

// ── Flappy Bird (stage g-3): LifeXP's own game, in the same frame and CSP ──

/**
 * Reopens the game's frame with a seed (?seed=, test only): the same pipes every run,
 * and the bird's and the next gap's positions on the stage for the autopilot.
 */
async function seedFlappy(page, host, seed = 7) {
  return reopenFrameWith(page, host, `seed=${seed}`);
}

/** Reopens the game's frame with test-only query switches added (e.g. "seed=5&round=10"). */
async function reopenFrameWith(page, host, query) {
  await host.locator('iframe').evaluate((frame, q) => {
    frame.src = `${frame.src}&${q}`;
  }, query);
  await expect.poll(() => page.frames().some((f) => f.url().endsWith(query))).toBe(true);
  return page.frames().find((f) => f.url().endsWith(query));
}

/**
 * Flies like a player: flaps whenever the bird is falling below the next gap's centre.
 * Returns a function that lets go of the controls.
 */
async function startAutopilot(frame) {
  const id = await frame.evaluate(() => {
    const stage = document.getElementById('stage');
    return setInterval(() => {
      const y = Number(stage.dataset.debugBirdY);
      const vy = Number(stage.dataset.debugVy);
      const gap = Number(stage.dataset.debugGapY || 300);
      if (stage.dataset.state === 'playing' && y > gap + 14 && vy > 0) {
        stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      }
    }, 8);
  });
  return () => frame.evaluate((i) => clearInterval(i), id);
}

test.describe('Flappy Bird', () => {
  test.describe('on a touch phone held upright', () => {
    test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

    test('a tap starts, a passed pipe scores, a fall ends it, the best survives a reload, Zakończ records the time', async ({ page, account }) => {
      test.setTimeout(60000);
      const problems = await watchProblems(page);
      await page.clock.install();
      const { host, game } = await playFromList(page, account, 'Flappy Bird');
      // Upright is the game's own shape: no "turn your phone", and the world fills the frame's width.
      await expect(host.getByRole('note')).toHaveCount(0);
      const frame = await seedFlappy(page, host);
      const stage = game.locator('#stage');
      await expect(stage).toHaveAttribute('data-state', 'ready');
      await expect(game.getByText('Stuknij, żeby zacząć')).toBeVisible(); // ?lang=pl from the host
      const frameBox = await host.locator('iframe').boundingBox();
      const stageBox = await stage.boundingBox();
      expect(Math.abs(stageBox.width - frameBox.width)).toBeLessThan(2);

      await stage.tap();
      await expect(stage).toHaveAttribute('data-state', 'playing');
      const release = await startAutopilot(frame);
      await expect(game.locator('#score')).toHaveText(/^[1-9]\d*$/, { timeout: 20000 });
      const scored = Number(await game.locator('#score').textContent());
      expect(scored).toBeGreaterThan(0);

      // Hands off: the bird falls, and the game is over with the score and the record.
      await release();
      await expect(stage).toHaveAttribute('data-state', 'over', { timeout: 10000 });
      const over = game.getByRole('region', { name: 'Koniec gry' });
      await expect(over).toBeVisible();
      const score = Number(await game.locator('#over-score').textContent());
      expect(score).toBeGreaterThanOrEqual(scored);
      await expect(game.locator('#over-best')).toHaveText(String(score));
      await expect(over.getByText('Nowy rekord!')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('lifexp-flappy-best'))).toBe(String(score));

      // "Jeszcze raz" goes back to the ready screen.
      await over.getByRole('button', { name: 'Jeszcze raz' }).tap();
      await expect(stage).toHaveAttribute('data-state', 'ready');

      await page.reload();
      await expect(game.locator('#ready-best')).toHaveText(String(score));

      await endAndExpectSession(page, account, 'Flappy Bird');
      expect(problems).toEqual([]);
    });
  });

  test('sideways 800×360: letterboxed to the full height, Space flaps, and a pipe is passed', async ({ page, account }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 800, height: 360 });
    const problems = await watchProblems(page);
    const { host, game } = await playFromList(page, account, 'Flappy Bird');
    const frame = await seedFlappy(page, host, 11);
    const stage = game.locator('#stage');
    await expect(stage).toHaveAttribute('data-state', 'ready');
    const frameBox = await host.locator('iframe').boundingBox();
    const stageBox = await stage.boundingBox();
    expect(Math.abs(stageBox.height - frameBox.height)).toBeLessThan(2);
    expect(stageBox.width).toBeLessThan(frameBox.width);
    expect(stageBox.x).toBeGreaterThanOrEqual(frameBox.x);
    expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(frameBox.x + frameBox.width + 1);

    await host.locator('iframe').focus();
    await page.keyboard.press('Space');
    await expect(stage).toHaveAttribute('data-state', 'playing');
    const release = await startAutopilot(frame);
    await expect(game.locator('#score')).toHaveText(/^[1-9]\d*$/, { timeout: 20000 });
    await release();
    expect(problems).toEqual([]);
  });
});

// ── Szybkie liczenie (stage g-4): LifeXP's own game, in the same frame and CSP ──

/** The answer the game exposes with ?seed= (test only). */
const answerOf = (game) => game.locator('#app').getAttribute('data-debug-answer').then(Number);

/** Types a number on the game's keypad, by touch. */
async function tapNumber(game, value) {
  if (value < 0) await game.getByRole('button', { name: 'Minus' }).tap();
  for (const ch of String(Math.abs(value))) await game.getByRole('button', { name: ch, exact: true }).tap();
}

/** Answers the question on screen correctly and waits for the next one. */
async function answerRight(game, enter) {
  const question = game.locator('#question-text');
  const before = await question.textContent();
  await enter(await answerOf(game));
  await expect(question).not.toHaveText(before);
}

test.describe('Szybkie liczenie', () => {
  test.describe('on a touch phone held upright', () => {
    test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

    test('a level, answers on the keypad, a mistake corrected, the end with stats, the best after a reload, Zakończ records the time', async ({ page, account }) => {
      test.setTimeout(60000);
      const problems = await watchProblems(page);
      await page.clock.install();
      const { host, game } = await playFromList(page, account, 'Szybkie liczenie');
      await expect(host.getByRole('note')).toHaveCount(0);
      await reopenFrameWith(page, host, 'seed=5&round=12');
      await expect(game.getByRole('heading', { name: 'Szybkie liczenie' })).toBeVisible(); // ?lang=pl from the host
      await game.getByRole('button', { name: /Średni/ }).tap();
      await expect(game.locator('#app')).toHaveAttribute('data-screen', 'play');

      // Keys are real buttons, at least 48 px, all on screen.
      const frameBox = await host.locator('iframe').boundingBox();
      for (const name of ['7', '0', 'Usuń', 'OK']) {
        const box = await game.getByRole('button', { name, exact: true }).boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(48);
        expect(box.y + box.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 1);
      }

      // Three right answers: taken as soon as typed (no OK), the combo reaches ×2.
      for (let i = 0; i < 3; i++) await answerRight(game, (n) => tapNumber(game, n));
      await expect(game.locator('#score')).toHaveText('60'); // 15 + 15 + 15×2
      await expect(game.locator('#combo-mult')).toHaveText('×2');

      // A wrong answer waits for OK, shows the right one and breaks the combo.
      const answer = await answerOf(game);
      const question = await game.locator('#question-text').textContent();
      await tapNumber(game, answer + 1);
      await game.getByRole('button', { name: 'OK' }).tap();
      await expect(game.getByRole('status')).toContainText(`Poprawnie: ${question} = ${answer}`);
      await expect(game.locator('#answer-wrong')).toHaveText(String(answer + 1));
      await expect(game.locator('#combo-mult')).toHaveText('×1');

      // The round runs out: the end screen with the stats and a new best.
      const end = game.getByRole('region', { name: 'Koniec czasu!' });
      await expect(end).toBeVisible({ timeout: 20000 });
      await expect(game.locator('#end-score')).toHaveText('60');
      await expect(game.locator('#end-accuracy')).toContainText('75%');
      await expect(game.locator('#end-accuracy')).toContainText('3/4');
      await expect(game.locator('#end-streak')).toHaveText('3');
      await expect(end.getByText('Nowy rekord!')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('lifexp-quickmath-best-medium'))).toBe('60');

      await page.reload();
      await expect(game.locator('#start [data-best="medium"]')).toHaveText('60');

      await endAndExpectSession(page, account, 'Szybkie liczenie');
      expect(problems).toEqual([]);
    });
  });

  test('on a desktop keyboard: 1 picks Łatwy, digits answer, Backspace fixes, Enter submits a wrong one', async ({ page, account }) => {
    const problems = await watchProblems(page);
    const { host, game } = await playFromList(page, account, 'Szybkie liczenie');
    await reopenFrameWith(page, host, 'seed=8');
    await expect(game.locator('#app')).toHaveAttribute('data-screen', 'start');
    await host.locator('iframe').focus();
    await page.keyboard.press('1');
    await expect(game.locator('#app')).toHaveAttribute('data-level', 'easy');
    await expect(game.locator('#app')).toHaveAttribute('data-screen', 'play');

    await answerRight(game, (n) => page.keyboard.type(String(n)));
    // A slip fixed with Backspace still counts as right.
    await answerRight(game, async (n) => {
      await page.keyboard.type(String((n + 1) % 10));
      await page.keyboard.press('Backspace');
      await page.keyboard.type(String(n));
    });
    await expect(game.locator('#score')).toHaveText('20');

    const answer = await answerOf(game);
    await page.keyboard.type(String(answer + 1));
    await expect(game.locator('#answer')).toHaveText(String(answer + 1)); // a wrong answer is not taken by itself
    await page.keyboard.press('Enter');
    await expect(game.getByRole('status')).toContainText(`= ${answer}`);
    await expect(game.locator('#combo-mult')).toHaveText('×1');
    expect(problems).toEqual([]);
  });

  test('sideways 800×360 by touch: Trudny with the minus key, practice without a clock and without a record', async ({ page, account }) => {
    await page.setViewportSize({ width: 800, height: 360 });
    const problems = await watchProblems(page);
    const { host, game } = await playFromList(page, account, 'Szybkie liczenie');
    await reopenFrameWith(page, host, 'seed=21');
    await game.getByRole('radio', { name: 'Trening' }).click();
    await expect(game.getByRole('radio', { name: 'Trening' })).toHaveAttribute('aria-checked', 'true');
    await game.getByRole('button', { name: /Trudny/ }).click();

    // Question beside the keypad; every key fits the height and is at least 48 px.
    const frameBox = await host.locator('iframe').boundingBox();
    for (const name of ['7', '0', 'Usuń', 'Minus', 'OK']) {
      const box = await game.getByRole('button', { name, exact: true }).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.y).toBeGreaterThanOrEqual(frameBox.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 1);
    }
    const card = await game.locator('#card').boundingBox();
    const keypad = await game.locator('#keypad').boundingBox();
    expect(card.x + card.width).toBeLessThanOrEqual(keypad.x);
    await expect(game.locator('#time')).toBeHidden(); // practice: no clock

    // Answer until one is negative (typed with the minus key) or a few are done.
    for (let i = 0; i < 6; i++) {
      await answerRight(game, async (n) => {
        for (const ch of (n < 0 ? ['Minus'] : []).concat([...String(Math.abs(n))])) {
          await game.getByRole('button', { name: ch, exact: true }).click();
        }
      });
    }
    await expect(game.locator('#score')).not.toHaveText('0');

    await game.getByRole('button', { name: 'Zakończ trening' }).click();
    await expect(game.getByRole('heading', { name: 'Koniec treningu' })).toBeVisible();
    await expect(game.locator('#end-accuracy')).toContainText('100%');
    expect(await page.evaluate(() => localStorage.getItem('lifexp-quickmath-best-hard'))).toBeNull();
    expect(problems).toEqual([]);
  });
});

// ── Wave Rush (stage w-1): LifeXP's own game, in the same frame and CSP ──

/** The game's state (data-debug-*), as numbers where they are. */
const waveState = (game) =>
  game.locator('#stage').evaluate((el) => ({
    state: el.dataset.state,
    x: Number(el.dataset.debugX),
    sector: Number(el.dataset.debugSector),
    section: Number(el.dataset.debugSection),
    attempt: Number(el.dataset.debugAttempt),
    checkpoint: Number(el.dataset.debugCheckpoint),
    pilot: el.dataset.debugPilot === '1',
  }));

test.describe('Wave Rush', () => {
  test.describe('on a touch phone held upright', () => {
    test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

    test('skins (the last one locked) survive a reload; a run flies sections, a crash starts again at sector 1, Zakończ records the time', async ({ page, account }) => {
      test.setTimeout(90000);
      const problems = await watchProblems(page);
      await page.clock.install();
      const { host, game } = await playFromList(page, account, 'Wave Rush');
      // Better sideways: the host says so, and the game still plays upright.
      await expect(host.getByRole('note')).toBeVisible();
      const stage = game.locator('#stage');
      await expect(stage).toHaveAttribute('data-state', 'menu');
      await expect(game.getByRole('heading', { name: 'Wave Rush' })).toBeVisible();
      await expect(game.getByText('Wygodniej w poziomie')).toBeVisible(); // ?lang=pl from the host

      // Skins: pick one; the last is locked and cannot be picked.
      await game.getByRole('button', { name: 'Skórki' }).tap();
      const skins = game.locator('#skin-list');
      await expect(skins.getByRole('button')).toHaveCount(10);
      await expect(skins.getByRole('button', { name: /Klasyk/ })).toHaveAttribute('aria-pressed', 'true');
      const locked = skins.getByRole('button', { name: /Korona Demona/ });
      await expect(locked).toBeDisabled();
      await expect(locked).toContainText('Zablokowana');
      await locked.tap({ force: true });
      await expect(locked).toHaveAttribute('aria-pressed', 'false');
      await skins.getByRole('button', { name: /Turkus/ }).tap();
      await expect(skins.getByRole('button', { name: /Turkus/ })).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => localStorage.getItem('lifexp-waverush-skin'))).toBe('"teal"');
      await page.reload();
      await game.getByRole('button', { name: 'Skórki' }).tap();
      await expect(skins.getByRole('button', { name: /Turkus/ })).toHaveAttribute('aria-pressed', 'true');
      await game.getByRole('button', { name: 'Gotowe' }).tap();

      // A run from the start: the solver's path for the seed (?autopilot=2, test only) flies
      // sections 1 and 2 and lets go at the start of section 3.
      await reopenFrameWith(page, host, 'seed=7&autopilot=2');
      await game.getByRole('button', { name: 'Graj' }).tap();
      await expect(stage).toHaveAttribute('data-state', 'ready');
      await stage.tap();
      await expect(stage).toHaveAttribute('data-state', 'playing');
      await expect.poll(async () => (await waveState(game)).section, { timeout: 40000 }).toBeGreaterThanOrEqual(3);
      expect(await waveState(game)).toMatchObject({ sector: 1, attempt: 1 });

      // Hands off: the wave crashes, the result says where, and a tap starts again at sector 1.
      await expect(stage).toHaveAttribute('data-state', 'dead', { timeout: 10000 });
      const dead = game.getByRole('region', { name: 'Rozbity!' });
      await expect(dead).toContainText('Sektor 1, sekcja 3');
      await expect(dead.getByText('Nowy rekord!')).toBeVisible();
      const best = JSON.parse(await page.evaluate(() => localStorage.getItem('lifexp-waverush-best')));
      expect(best).toMatchObject({ sector: 1 });
      expect(best.section).toBeGreaterThanOrEqual(3);
      await page.waitForTimeout(600);
      await stage.tap();
      await expect.poll(async () => (await waveState(game)).attempt).toBe(2);
      expect(await waveState(game)).toMatchObject({ sector: 1, section: 1 });

      await endAndExpectSession(page, account, 'Wave Rush');
      expect(problems).toEqual([]);
    });
  });

  test('sideways 800×360: the full height, a jump to sector 2, a crash goes back to sector 1; Praktyka goes back to the sector’s checkpoint', async ({ page, account }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 800, height: 360 });
    const problems = await watchProblems(page);
    const { host, game } = await playFromList(page, account, 'Wave Rush');
    await expect(host.getByRole('note')).toBeHidden();
    await host.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const frameBox = await host.locator('iframe').boundingBox();
    expect(frameBox.height).toBe(360);
    const stage = game.locator('#stage');
    const stageBox = await stage.boundingBox();
    expect(Math.abs(stageBox.height - frameBox.height)).toBeLessThan(2);

    // Normal mode, jumped (test only) into sector 2: a crash still starts again at sector 1.
    await reopenFrameWith(page, host, 'seed=11&sector=2&section=3');
    await game.getByRole('button', { name: 'Graj' }).click();
    await host.locator('iframe').focus();
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    await expect(stage).toHaveAttribute('data-state', 'playing');
    expect((await waveState(game)).sector).toBe(2);
    await expect(stage).toHaveAttribute('data-state', 'dead', { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await waveState(game)).attempt).toBe(2);
    expect(await waveState(game)).toMatchObject({ sector: 1, section: 1 });
    // The jumped run kept no record (only the new run from the start may, once it gets anywhere).
    const kept = await page.evaluate(() => localStorage.getItem('lifexp-waverush-best'));
    expect(kept === null || JSON.parse(kept).sector === 1).toBe(true);

    // Praktyka from sector 2, section 3: the pilot flies that section, lets go in section 4,
    // the wave crashes, and a tap brings it back at sector 2's start.
    await reopenFrameWith(page, host, 'seed=12&sector=2&section=3&autopilot=1');
    await game.getByRole('button', { name: 'Praktyka' }).click();
    await stage.click();
    await expect(stage).toHaveAttribute('data-state', 'playing');
    await expect(game.locator('.hud__practice')).toBeVisible();
    const start = await waveState(game);
    await expect.poll(async () => (await waveState(game)).section, { timeout: 30000 }).toBeGreaterThanOrEqual(4);
    await expect(stage).toHaveAttribute('data-state', 'dead', { timeout: 10000 });
    expect((await waveState(game)).section).toBe(4);
    await expect(game.getByText('Stuknij, żeby wrócić do punktu kontrolnego')).toBeVisible();
    await page.waitForTimeout(600);
    await stage.click();
    await expect.poll(async () => (await waveState(game)).attempt).toBe(2);
    const after = await waveState(game);
    expect(after.checkpoint).toBe(start.checkpoint);
    expect(after.x).toBeLessThan(start.checkpoint + 2);
    expect(after.x).toBeLessThan(start.x);
    await expect.poll(async () => (await waveState(game)).sector).toBe(2);
    expect((await waveState(game)).section).toBeLessThanOrEqual(2);
    // Practice keeps no record.
    expect(await page.evaluate(() => localStorage.getItem('lifexp-waverush-best'))).toBe(kept);
    expect(problems).toEqual([]);
  });
});
