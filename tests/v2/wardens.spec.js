// Strażnicy Doliny (docs/v2/PLAN.md 9.1, stage td-1): LifeXP's own tower defense in
// GameHost's frame, on the Firebase emulators. Opened from Gry; the test switches
// (?test=1 with speed=, waves=, lives=) make a map short and fast, and the stage carries
// the game's state in data-* for the test to read. The balance itself is tested headless
// in v2/tests/wardens-balance.test.ts.
const { test, expect, openSignedIn, waitForServiceWorker } = require('../support/v2');
const { db } = require('../support/emulator');

const NAME = 'Strażnicy Doliny';
const PIXEL_7 = { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 };

/** A request off this origin, a CSP violation, a console error or an exception. */
async function watchProblems(page) {
  const problems = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`));
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(url.hostname)) problems.push(`external request: ${request.url()}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
  return problems;
}

/** Gry → "Graj: Strażnicy Doliny"; waits for the host's play clock (it focuses the frame). */
async function openFromList(page, account) {
  await openSignedIn(page, account, '#/games');
  await page.getByRole('link', { name: `Graj: ${NAME}` }).click();
  const host = page.getByRole('region', { name: NAME });
  await expect(host).toBeVisible();
  await expect(host.locator('iframe')).toBeFocused();
  return { host, game: host.frameLocator('iframe') };
}

/** Reopens the frame with test switches added to the host's ?lang=. */
async function reopenWith(page, host, query) {
  await host.locator('iframe').evaluate((frame, q) => {
    frame.src = `${frame.src.split('&')[0]}&${q}`;
  }, query);
  await expect.poll(() => page.frames().some((f) => f.url().endsWith(query))).toBe(true);
}

/** Taps a build pad, picks a tower and builds it. */
async function build(game, pad, tower) {
  await game.getByRole('button', { name: `Pole budowy ${pad}`, exact: true }).tap();
  await game.getByRole('radio', { name: new RegExp(`^${tower}`) }).tap();
  await game.getByRole('button', { name: /^Zbuduj wieżę ·/ }).tap();
  await expect(game.getByRole('button', { name: `${tower}, poziom 1 · Pole budowy ${pad}` })).toBeVisible();
}

const progressOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lifexp-wardens-progress') || 'null'));

async function sessionsOf(uid) {
  const snap = await db.collection('users').doc(uid).collection('gamingSessions').get();
  return snap.docs.map((d) => d.data());
}

test.describe('on a Pixel 7 held upright', () => {
  test.use(PIXEL_7);

  test('from Gry: the Meadow, two towers, an upgrade, two waves won with three stars; the next map opens and survives a reload; Zakończ records the time', async ({ page, account }) => {
    test.setTimeout(90000);
    const problems = await watchProblems(page);
    await page.clock.install();
    const { host, game } = await openFromList(page, account);
    await reopenWith(page, host, 'test=1&speed=30&waves=2');
    await expect(game.getByRole('heading', { name: NAME })).toBeVisible(); // ?lang=pl from the host
    await expect(game.getByRole('button', { name: /^Kanion/ })).toBeDisabled();
    await game.getByRole('button', { name: /^Łąka/ }).tap();

    // The HUD: every value in words.
    await expect(game.locator('#hud-gold')).toHaveText(/Złoto\s+130/);
    await expect(game.locator('#hud-lives')).toHaveText(/Życia\s+20/);
    await expect(game.getByText('Fala 1/2')).toBeVisible();
    await expect(game.locator('#wave-preview')).toContainText('6× Pełzacz');

    // Every pad is a real button, about a tile big, inside the frame.
    const frameBox = await host.locator('iframe').boundingBox();
    const pads = game.locator('.pad');
    await expect(pads).toHaveCount(14);
    for (const pad of await pads.all()) {
      const box = await pad.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.x).toBeGreaterThanOrEqual(frameBox.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(frameBox.x + frameBox.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 1);
    }

    // Build: the sheet shows the five towers with prices; too dear ones say what is missing.
    await game.getByRole('button', { name: 'Pole budowy 1', exact: true }).tap();
    await expect(game.getByRole('radio')).toHaveCount(5);
    await game.getByRole('radio', { name: /^Balista/ }).tap();
    await expect(game.getByText('Daleki, ciężki strzał przez pancerz.')).toBeVisible();
    await expect(game.getByRole('button', { name: 'Zbuduj wieżę · 95 złota' })).toBeEnabled();
    await game.getByRole('button', { name: 'Zamknij' }).tap();

    await build(game, 5, 'Łucznik');
    await build(game, 3, 'Łucznik');
    await expect(game.locator('#hud-gold')).toHaveText(/Złoto\s+40/);

    // A tower: upgrade it when the gold is there, aim it, sell value in words.
    await game.getByRole('button', { name: 'Łucznik, poziom 1 · Pole budowy 5' }).tap();
    await expect(game.getByText('Poziom 1/3', { exact: false })).toBeVisible();
    await expect(game.getByRole('button', { name: 'Ulepsz · 40 złota' })).toBeEnabled();
    await game.getByRole('button', { name: 'Ulepsz · 40 złota' }).tap();
    await expect(game.getByText('Poziom 2/3', { exact: false })).toBeVisible();
    await game.getByRole('radio', { name: 'Najsilniejszy' }).tap();
    await expect(game.getByRole('radio', { name: 'Najsilniejszy' })).toHaveAttribute('aria-checked', 'true');
    await expect(game.getByRole('button', { name: /^Sprzedaj · \+59$/ })).toBeVisible(); // 70 % of 85
    await game.getByRole('button', { name: 'Zamknij' }).tap();

    await game.getByRole('button', { name: 'Start fali 1' }).tap();
    const stage = game.locator('#stage');
    await expect(stage).toHaveAttribute('data-phase', 'wave');
    await expect(game.getByText(/Fala 1 trwa · wrogów: \d+/)).toBeVisible();

    const end = game.getByRole('region', { name: 'Dolina obroniona!' });
    await expect(end).toBeVisible({ timeout: 45000 });
    await expect(end.getByText('Gwiazdki: 3/3')).toBeVisible();
    await expect(end.getByText('Życia: 20')).toBeVisible();
    await expect(end.getByText('Fale odparte: 2')).toBeVisible();
    await expect(end.getByText('Odblokowano: Kanion')).toBeVisible();
    await expect(end.getByRole('button', { name: 'Następna mapa' })).toBeFocused();
    expect(await progressOf(page)).toEqual({ stars: { meadow: 3 }, endlessBest: 0 });

    await page.reload();
    await expect(game.getByRole('button', { name: /^Kanion/ })).toBeEnabled();
    await expect(game.getByRole('button', { name: /^Łąka/ })).toContainText('Gwiazdki: 3/3');
    await expect(game.getByRole('button', { name: /^Mokradła/ })).toBeDisabled();

    await page.clock.fastForward('01:00');
    await page.getByRole('button', { name: 'Zakończ' }).click();
    await expect(page).toHaveURL(/#\/games$/);
    await expect.poll(async () => (await sessionsOf(account.uid)).map((s) => s.game)).toEqual([NAME]);
    expect(problems).toEqual([]);
  });
});

test.describe('on a Pixel 7 held sideways', () => {
  test.use({ ...PIXEL_7, viewport: { width: 915, height: 412 } });

  test('the board turned beside the side column; speed and pause; no defence loses, with no stars saved; Jeszcze raz', async ({ page, account }) => {
    test.setTimeout(90000);
    const problems = await watchProblems(page);
    const { host, game } = await openFromList(page, account);
    await reopenWith(page, host, 'test=1&speed=20&lives=3');
    await game.getByRole('button', { name: /^Łąka/ }).tap();
    await expect(game.locator('#app')).toHaveAttribute('data-rotated', 'true');

    // The board takes the frame's height; the pads, the side column and the buttons fit it.
    const frameBox = await host.locator('iframe').boundingBox();
    for (const el of [game.locator('.pad').first(), game.locator('.pad').last(), game.getByRole('button', { name: 'Start fali 1' })]) {
      const box = await el.boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(frameBox.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 1);
    }
    const stage = await game.locator('#stage').boundingBox();
    const side = await game.locator('.wavebar').boundingBox();
    expect(side.x + side.width).toBeLessThanOrEqual(stage.x);

    // Speed 2× is remembered.
    await game.getByRole('button', { name: 'Tempo 1×' }).tap();
    await expect(game.getByRole('button', { name: 'Tempo 2×' })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('lifexp-wardens-settings'))).toBe('{"speed":2}');

    // In the side column, the panel never covers the board.
    await game.getByRole('button', { name: 'Pole budowy 2', exact: true }).tap();
    const panel = await game.locator('#panel').boundingBox();
    expect(panel.x + panel.width).toBeLessThanOrEqual(stage.x + 1);
    await game.getByRole('button', { name: 'Zamknij' }).tap();

    // Pause holds everything still.
    const stageEl = game.locator('#stage');
    await game.getByRole('button', { name: 'Start fali 1' }).tap();
    await expect.poll(async () => Number(await stageEl.getAttribute('data-enemies'))).toBeGreaterThan(0);
    await game.getByRole('button', { name: 'Pauza' }).tap();
    await expect(game.getByRole('dialog', { name: 'Gra wstrzymana' })).toBeVisible();
    const lives = await stageEl.getAttribute('data-lives');
    const enemies = await stageEl.getAttribute('data-enemies');
    await page.waitForTimeout(800);
    expect(await stageEl.getAttribute('data-lives')).toBe(lives);
    expect(await stageEl.getAttribute('data-enemies')).toBe(enemies);
    await game.getByRole('button', { name: 'Wznów' }).tap();

    const end = game.getByRole('region', { name: 'Mury padły' });
    await expect(end).toBeVisible({ timeout: 45000 });
    await expect(end.getByText('Życia: 0')).toBeVisible();
    await expect(end.getByRole('button', { name: 'Następna mapa' })).toBeHidden();
    expect(await progressOf(page)).toBeNull();

    await end.getByRole('button', { name: 'Jeszcze raz' }).tap();
    await expect(game.locator('#app')).toHaveAttribute('data-screen', 'play');
    await expect(game.locator('#hud-lives')).toHaveText(/Życia\s+3/);
    expect(problems).toEqual([]);
  });
});

test('on a desktop keyboard: N calls the wave, F the speed, Esc closes the panel and then pauses (English)', async ({ page, account }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const problems = await watchProblems(page);
  const { host, game } = await openFromList(page, account);
  await host.locator('iframe').evaluate((frame) => {
    frame.src = frame.src.replace('lang=pl', 'lang=en');
  });
  await expect(game.getByRole('heading', { name: 'Valley Wardens' })).toBeVisible();
  await game.getByRole('button', { name: /^Meadow/ }).click();
  await game.getByRole('button', { name: 'Build spot 4', exact: true }).click();
  await expect(game.getByRole('heading', { name: /Build a tower/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(game.locator('#panel')).toBeHidden();
  await expect(game.getByRole('button', { name: 'Build spot 4', exact: true })).toBeFocused();
  await page.keyboard.press('n');
  await expect(game.getByText(/Wave 1 · enemies: \d+/)).toBeVisible();
  await page.keyboard.press('f');
  await expect(game.getByRole('button', { name: 'Speed 2×' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(game.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await game.getByRole('button', { name: 'Resume' }).click();
  await expect(game.getByRole('dialog', { name: 'Paused' })).toBeHidden();
  expect(problems).toEqual([]);
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow', viewport: { width: 412, height: 915 } });

  test('once played, the game opens and plays offline (the worker caches games/)', async ({ page, context, account }) => {
    await openSignedIn(page, account, '#/today');
    await waitForServiceWorker(page);
    const { host, game } = await openFromList(page, account);
    await game.getByRole('button', { name: /^Łąka/ }).click();
    await expect(game.locator('.pad')).toHaveCount(14);

    await context.setOffline(true);
    await host.locator('iframe').evaluate((frame) => frame.contentWindow.location.reload());
    await expect(game.getByRole('heading', { name: NAME })).toBeVisible();
    await game.getByRole('button', { name: /^Łąka/ }).click();
    await expect(game.locator('.pad')).toHaveCount(14);
    await game.getByRole('button', { name: 'Start fali 1' }).click();
    await expect(game.getByText(/Fala 1 trwa/)).toBeVisible();
    await context.setOffline(false);
  });
});
