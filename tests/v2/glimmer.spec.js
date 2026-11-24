// Świetlik (docs/v2/PLAN.md 9.1, stage gl-1): LifeXP's own endless dodge game in
// GameHost's frame, on the Firebase emulators. Opened from Gry; the test switches
// (?test=1 with seed=, hp=, start=, speed=, and since gl-2 pattern=) make a run repeatable
// and short, and the stage carries the run's state in data-* for the test to read. The
// rules, the patterns' fairness and the pacing are tested headless in v2/tests/glimmer.test.ts
// and (the second set of obstacles, gl-2) v2/tests/glimmer-obstacles.test.ts.
const { devices } = require('@playwright/test');
const { test, expect, openSignedIn } = require('../support/v2');

const NAME = 'Świetlik';
const PIXEL_7 = { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 };
const PIXEL_7_SIDEWAYS = { viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 };
const { defaultBrowserType, ...PIXEL_7_LANDSCAPE } = devices['Pixel 7 landscape'];

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

/** Gry → "Graj: Świetlik"; the host focuses the frame. */
async function openFromList(page, account) {
  await openSignedIn(page, account, '#/games');
  await page.getByRole('link', { name: `Graj: ${NAME}` }).click();
  const host = page.getByRole('region', { name: NAME });
  await expect(host).toBeVisible();
  await expect(host.locator('iframe')).toBeFocused();
  return { host, game: host.frameLocator('iframe') };
}

/** Reopens the frame with test switches added to the host's ?lang=; returns its frame. */
async function reopenWith(page, host, query) {
  await host.locator('iframe').evaluate((frame, q) => {
    frame.src = `${frame.src.split('&')[0]}&${q}`;
  }, query);
  await expect.poll(() => page.frames().some((f) => f.url().endsWith(query))).toBe(true);
  return page.frames().find((f) => f.url().endsWith(query));
}

/** The run's state, from the stage's data-* (numbers as numbers). */
async function stateOf(game) {
  const data = await game.locator('#stage').evaluate((el) => ({ ...el.dataset }));
  const out = {};
  for (const [k, v] of Object.entries(data)) out[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
  return out;
}

/** The game's page says it is hidden (another tab, the phone locked). */
async function hide(frame) {
  await frame.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/**
 * The arena covers the frame: the canvas reaches past every edge of the game's page by less
 * than one art pixel (centred, cropped), so no empty band shows; its art pixels are whole
 * device pixels.
 */
async function expectArenaCovers(game, dpr) {
  const page = await game.locator('#stage').boundingBox();
  const canvas = await game.locator('#board').boundingBox();
  const artWidth = await game.locator('#board').evaluate((c) => c.width);
  const art = canvas.width / artWidth; // one art pixel in CSS pixels
  expect(art * dpr).toBeCloseTo(Math.round(art * dpr), 2);
  for (const [over, name] of [
    [page.x - canvas.x, 'left'],
    [page.y - canvas.y, 'top'],
    [canvas.x + canvas.width - (page.x + page.width), 'right'],
    [canvas.y + canvas.height - (page.y + page.height), 'bottom'],
  ]) {
    expect(over, name).toBeGreaterThanOrEqual(-0.01);
    expect(over, name).toBeLessThan(art);
  }
  return canvas;
}

const bestOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lifexp-glimmer-best') || 'null'));

test.describe('on a Pixel 7 held upright', () => {
  test.use(PIXEL_7);

  test('from Gry: the menu, a run moved by dragging anywhere, focus, a pause when hidden, and the arena fills the frame', async ({ page, account }) => {
    test.setTimeout(90000);
    const problems = await watchProblems(page);
    const { host, game } = await openFromList(page, account);
    await expect(game.getByRole('heading', { name: NAME })).toBeVisible(); // ?lang=pl from the host
    await expect(game.getByRole('button', { name: 'Graj' })).toBeVisible();
    await expect(game.getByText('Jeszcze bez rekordu')).toBeVisible();
    // The touch line, not the keyboard one.
    await expect(game.getByText(/^Telefon: przesuwaj palcem/)).toBeVisible();
    await expect(game.getByText(/^Komputer:/)).toBeHidden();

    const frame = await reopenWith(page, host, 'test=1&seed=5&hp=99');
    await game.getByRole('button', { name: 'Graj' }).tap();
    await expect(game.locator('#app')).toHaveAttribute('data-screen', 'play');
    await expect.poll(async () => (await stateOf(game)).phase).toBe('play');

    // The arena is the whole frame: the canvas, crisp, within an art pixel of it.
    const canvas = await expectArenaCovers(game, PIXEL_7.deviceScaleFactor);
    expect(await game.locator('#board').evaluate((c) => getComputedStyle(c).imageRendering)).toBe('pixelated');

    // A drag far from the wisp moves it by the drag (relative: the finger never covers it).
    const before = await stateOf(game);
    const start = { x: canvas.x + canvas.width * 0.2, y: canvas.y + canvas.height * 0.85 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(start.x + i * 15, start.y - i * 5);
    await page.mouse.up();
    await expect.poll(async () => (await stateOf(game)).x).toBeGreaterThan(before.x + 40);
    const after = await stateOf(game);
    expect(after.y).toBeLessThan(before.y - 10);

    // Focus: the button slows the wisp and shows its hitbox.
    const focus = game.getByRole('button', { name: 'Skupienie' });
    await expect(focus).toHaveAttribute('aria-pressed', 'false');
    await focus.tap();
    await expect(focus).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await stateOf(game)).focus).toBe('true');
    await focus.tap();

    // A few seconds of play: patterns come, the score grows.
    await expect.poll(async () => (await stateOf(game)).patterns, { timeout: 15000 }).toBeGreaterThan(1);
    await expect.poll(async () => (await stateOf(game)).score).toBeGreaterThan(20);

    // Hidden (another app): the run pauses and its clock stops.
    await hide(frame);
    await expect(game.getByRole('heading', { name: 'Pauza' })).toBeVisible();
    const paused = (await stateOf(game)).time;
    await page.waitForTimeout(600);
    expect((await stateOf(game)).time).toBeCloseTo(paused, 1);
    await game.getByRole('button', { name: 'Wznów' }).tap();
    await expect(game.getByRole('heading', { name: 'Pauza' })).toBeHidden();
    await expect.poll(async () => (await stateOf(game)).time).toBeGreaterThan(paused + 0.3);

    expect(problems).toEqual([]);
  });
});

// Two sideways shapes: a tall browser (915 × 412) and Playwright's own Pixel 7 landscape
// (its descriptor: a shorter viewport, as with the browser's bars).
for (const [label, phone] of [
  ['915 × 412', PIXEL_7_SIDEWAYS],
  ['Playwright descriptor', PIXEL_7_LANDSCAPE],
]) {
  test.describe(`on a Pixel 7 held sideways (${label})`, () => {
    test.use(phone);

    test('the menu fits the short screen and a run fills it', async ({ page, account }) => {
      const { host, game } = await openFromList(page, account);
      const frameBox = await host.locator('iframe').boundingBox();
      for (const id of ['#play-button', '.card--menu']) {
        const b = await game.locator(id).boundingBox();
        expect(b.y).toBeGreaterThanOrEqual(frameBox.y - 1);
        expect(b.y + b.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 1);
      }
      await reopenWith(page, host, 'test=1&seed=2&hp=99');
      await game.getByRole('button', { name: 'Graj' }).tap();
      await expect.poll(async () => (await stateOf(game)).phase).toBe('play');
      await expectArenaCovers(game, phone.deviceScaleFactor);
    });
  });
}

test.describe('on a computer', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('keys move and focus, P pauses; the last heart ends the run, the best is kept, "Jeszcze raz" plays again', async ({ page, account }) => {
    test.setTimeout(90000);
    const problems = await watchProblems(page);
    const { host, game } = await openFromList(page, account);
    await expect(game.getByText(/^Komputer: strzałki lub WASD/)).toBeVisible();
    // "Fewer effects" is kept on the device.
    await game.getByRole('button', { name: 'Mniej' }).first().click();
    await expect(game.getByRole('button', { name: 'Mniej' }).first()).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifexp-glimmer-settings') || 'null'))).toEqual({ calm: true });

    await reopenWith(page, host, 'test=1&seed=9&hp=99');
    await expect(game.getByRole('button', { name: 'Mniej' }).first()).toHaveAttribute('aria-pressed', 'true');
    await game.getByRole('button', { name: 'Graj' }).click();
    await expect.poll(async () => (await stateOf(game)).phase).toBe('play');
    // Focus by key only here: the touch button stays out of the way.
    await expect(game.getByRole('button', { name: 'Skupienie' })).toBeHidden();

    const before = await stateOf(game);
    await page.keyboard.down('ArrowLeft');
    await expect.poll(async () => (await stateOf(game)).x).toBeLessThan(before.x - 20);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.down('Shift');
    await expect.poll(async () => (await stateOf(game)).focus).toBe('true');
    await page.keyboard.up('Shift');
    await expect.poll(async () => (await stateOf(game)).focus).toBe('false');

    await page.keyboard.press('KeyP');
    await expect(game.getByRole('heading', { name: 'Pauza' })).toBeVisible();
    await page.keyboard.press('KeyP');
    await expect(game.getByRole('heading', { name: 'Pauza' })).toBeHidden();

    // One heart, a later minute, a fast clock: the run ends soon.
    await reopenWith(page, host, 'test=1&seed=3&hp=1&start=90&speed=6');
    expect(await bestOf(page)).toBeNull();
    await game.getByRole('button', { name: 'Graj' }).click();
    await expect(game.getByRole('heading', { name: 'Koniec!' })).toBeVisible({ timeout: 45000 });
    await expect(game.getByText('Nowy rekord!')).toBeVisible();
    const final = await stateOf(game);
    expect(final.phase).toBe('over');
    expect(final.hp).toBe(0);
    await expect(game.locator('#over-score')).toHaveText(`${final.score} pkt`);
    const best = await bestOf(page);
    expect(best.score).toBe(final.score);
    expect(best.score).toBeGreaterThan(0);

    // Again: a new run starts; the best stays.
    await game.getByRole('button', { name: 'Jeszcze raz' }).click();
    await expect.poll(async () => (await stateOf(game)).phase).toBe('play');
    await expect(game.getByRole('heading', { name: 'Koniec!' })).toBeHidden();
    await game.getByRole('button', { name: 'Pauza' }).click();
    await game.getByRole('region', { name: 'Pauza' }).getByRole('button', { name: 'Menu' }).click();
    await expect(game.locator('#menu-best')).toHaveText(new RegExp(`^Rekord: ${best.score} pkt`));
    await expect(game.locator('#menu-best')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('gl-2: the new obstacles come in the frame (zone, comet, mines by the test switch), with no errors', async ({ page, account }) => {
    test.setTimeout(60000);
    const problems = await watchProblems(page);
    const { host, game } = await openFromList(page, account);
    for (const id of ['zone', 'comet', 'mines']) {
      await reopenWith(page, host, `test=1&seed=4&hp=99&pattern=${id}`);
      await game.getByRole('button', { name: 'Graj' }).click();
      await expect.poll(async () => (await stateOf(game)).last, { timeout: 10000 }).toBe(id);
      if (id === 'zone') await expect.poll(async () => (await stateOf(game)).zones).toBe(1);
      else await expect.poll(async () => (await stateOf(game)).shots).toBeGreaterThan(5);
    }
    expect(problems).toEqual([]);
  });
});
