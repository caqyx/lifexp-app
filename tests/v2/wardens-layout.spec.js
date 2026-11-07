// Strażnicy Doliny's sheets fit the screen (docs/v2/PLAN.md 9.1, td-3 fix): on a Pixel 7
// and a small phone, upright and sideways, in Polish and English, every build card, the
// title, the hint and Zamknij/Close sit wholly inside the panel and the viewport (on a
// short screen the sheet's body scrolls to them, the head with Close stays), Close is at
// least 44 px and closes the sheet; the upgrade sheet fits too. The game page
// is opened on its own (built, v2/dist), the way GameHost's frame shows it; no account.
const { test, expect } = require('@playwright/test');

const PAGE = '/v2/dist/games/wardens/index.html';

const SCREENS = [
  { name: 'Pixel 7 upright', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625 },
  { name: 'Pixel 7 sideways', viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625 },
  { name: 'small phone upright', viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 },
  { name: 'small phone sideways', viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 },
  // A small phone sideways inside the app's frame (its bar takes some height).
  { name: 'small phone sideways in a frame', viewport: { width: 640, height: 300 }, deviceScaleFactor: 2 },
];

const TEXT = {
  pl: { map: 'Łąka', pad: (n) => `Pole budowy ${n}`, build: /^Zbuduj wieżę ·/, archer: /^Łucznik/, close: 'Zamknij', upgrade: /^Ulepsz/, sell: /^Sprzedaj/ },
  en: { map: 'Meadow', pad: (n) => `Build spot ${n}`, build: /^Build a tower ·/, archer: /^Archer/, close: 'Close', upgrade: /^Upgrade/, sell: /^Sell/ },
};

/** `inner` lies wholly inside `outer` (to a pixel). */
function expectInside(inner, outer, what) {
  expect(inner, `${what} is laid out`).not.toBeNull();
  expect(inner.x, `${what}: left`).toBeGreaterThanOrEqual(outer.x - 1);
  expect(inner.y, `${what}: top`).toBeGreaterThanOrEqual(outer.y - 1);
  expect(inner.x + inner.width, `${what}: right`).toBeLessThanOrEqual(outer.x + outer.width + 1);
  expect(inner.y + inner.height, `${what}: bottom`).toBeLessThanOrEqual(outer.y + outer.height + 1);
}

/** The panel's open sheet: head, the given elements and Close inside it and the viewport. */
async function expectSheetFits(page, viewport, elements, close) {
  const screen = { x: 0, y: 0, ...viewport };
  // Measured where the sheet comes to rest (after its slide in).
  await page.locator('#panel').evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  const panel = await page.locator('#panel').boundingBox();
  expectInside(panel, screen, 'panel');
  // Nothing in the panel is wider than it (no sideways scrolling, nothing cut off).
  for (const el of [page.locator('#panel'), page.locator('#panel .panel__body:not([hidden])')]) {
    const overflow = await el.evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(overflow, 'panel scrolls sideways').toBeLessThanOrEqual(0);
  }
  // Close first, before anything scrolls: the head never scrolls away.
  const closeBox = await close.boundingBox();
  expectInside(closeBox, panel, 'close');
  expectInside(closeBox, screen, 'close on screen');
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);
  // Every element fits across the panel; on a short screen the body scrolls to it, and
  // then it is wholly in view, below the head.
  const head = await page.locator('.panel__head').boundingBox();
  for (const [what, locator] of elements) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    expectInside(box, panel, what);
    expectInside(box, screen, `${what} on screen`);
    if (what !== 'title') expect(box.y, `${what} below the head`).toBeGreaterThanOrEqual(head.y + head.height - 1);
  }
  expect(await close.boundingBox(), 'close stays where it was').toEqual(closeBox);
}

for (const screen of SCREENS) {
  for (const lang of ['pl', 'en']) {
    test.describe(`${screen.name}, ${lang}`, () => {
      test.use({ viewport: screen.viewport, deviceScaleFactor: screen.deviceScaleFactor, isMobile: true, hasTouch: true });

      test('the build and upgrade sheets fit: every card, the title, the hint and Close; Close closes', async ({ page }) => {
        const t = TEXT[lang];
        await page.goto(`${PAGE}?lang=${lang}&test=1&gold=5000`);
        await page.getByRole('button', { name: new RegExp(`^${t.map}`) }).tap();
        await expect(page.locator('#app')).toHaveAttribute('data-screen', 'play');
        const pads = await page.locator('.pad').count();

        // The first and the last pad: upright, the sheet opens below or above the board.
        for (const n of [1, pads]) {
          await page.getByRole('button', { name: t.pad(n), exact: true }).tap();
          const close = page.getByRole('button', { name: t.close });
          await expect(close).toBeVisible();
          const cards = page.locator('#tower-options .option');
          await expect(cards).toHaveCount(5);
          const elements = [
            ['title', page.locator('#panel-title .pt-canvas')],
            ['hint', page.locator('#option-role .pt-canvas')],
          ];
          for (let i = 0; i < 5; i++) elements.push([`card ${i + 1}`, cards.nth(i)]);
          await expectSheetFits(page, screen.viewport, elements, close);
          await close.tap();
          await expect(page.locator('#panel')).toBeHidden();
        }

        // Build an archer on the last pad, then its upgrade sheet fits as well.
        await page.getByRole('button', { name: t.pad(pads), exact: true }).tap();
        await page.getByRole('radio', { name: t.archer }).tap();
        await page.getByRole('button', { name: t.build }).tap();
        await page.getByRole('button', { name: new RegExp(`${t.pad(pads)}$`) }).tap();
        const upgrade = page.getByRole('button', { name: t.upgrade });
        await expect(upgrade).toBeVisible();
        await upgrade.scrollIntoViewIfNeeded();
        // Close stays in the head even when the body has scrolled to the actions.
        const close = page.getByRole('button', { name: t.close });
        await expectSheetFits(
          page,
          screen.viewport,
          [
            ['title', page.locator('#panel-title .pt-canvas')],
            ['preview', page.locator('#tower-preview')],
          ],
          close,
        );
        // The actions fit across the panel (sideways it may scroll to them).
        const panel = await page.locator('#panel').boundingBox();
        for (const [what, el] of [['upgrade', upgrade], ['sell', page.getByRole('button', { name: t.sell })]]) {
          await el.scrollIntoViewIfNeeded();
          const box = await el.boundingBox();
          expect(box.x, `${what}: left`).toBeGreaterThanOrEqual(panel.x - 1);
          expect(box.x + box.width, `${what}: right`).toBeLessThanOrEqual(panel.x + panel.width + 1);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
        await close.tap();
        await expect(page.locator('#panel')).toBeHidden();
      });
    });
  }
}

// Every tower stands on its own slab: towers built on every pad of every map, upright and
// sideways; on the canvases, each pad has its slab on the ground (nothing drawn over it)
// and a tower whose foundation covers exactly that tile (its edges at the tile's edges,
// nothing of it beyond them where no neighbour stands).
const MAPS = ['Łąka', 'Kanion', 'Mokradła'];
for (const screen of [SCREENS[0], SCREENS[1], SCREENS[3]]) {
  test.describe(`${screen.name}: towers on their slabs`, () => {
    test.use({ viewport: screen.viewport, deviceScaleFactor: screen.deviceScaleFactor, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });

    test('every pad of every map: the slab is there and the tower covers exactly its tile', async ({ page }) => {
      test.setTimeout(90000);
      await page.addInitScript(() => localStorage.setItem('lifexp-wardens-progress', '{"stars":{"meadow":3,"canyon":3,"marsh":3},"endlessBest":0}'));
      for (const map of MAPS) {
        await page.goto(`${PAGE}?lang=pl&test=1&gold=99999`);
        await page.getByRole('button', { name: new RegExp(`^${map}`) }).tap();
        const pads = await page.locator('.pad').count();
        for (let i = 1; i <= pads; i++) {
          await page.getByRole('button', { name: `Pole budowy ${i}`, exact: true }).tap();
          await page.getByRole('radio', { name: /^Łucznik/ }).tap();
          await page.getByRole('button', { name: /^Zbuduj wieżę ·/ }).tap();
        }
        await expect(page.locator('#stage')).toHaveAttribute('data-towers', String(pads));
        // Nothing chosen (no gold frame or range ring over the board).
        if (await page.locator('#panel').isVisible()) await page.getByRole('button', { name: 'Zamknij' }).tap();
        await expect(page.locator('#panel')).toBeHidden();
        await page.waitForTimeout(200);
        const wrong = await page.evaluate(() => {
          const board = /** @type {HTMLCanvasElement} */ (document.getElementById('board'));
          const ground = /** @type {HTMLCanvasElement} */ (document.getElementById('ground'));
          const px = parseFloat(board.style.width) / board.width;
          const bd = board.getContext('2d').getImageData(0, 0, board.width, board.height).data;
          const gd = ground.getContext('2d').getImageData(0, 0, ground.width, ground.height).data;
          const solid = (x, y) => x >= 0 && x < board.width && (bd[(y * board.width + x) * 4 + 3] ?? 0) > 200;
          const slab = (x, y) => {
            const i = (y * ground.width + x) * 4;
            return `${gd[i]},${gd[i + 1]},${gd[i + 2]}` === '110,106,124';
          };
          const centres = [...document.querySelectorAll('.pad')].map((b) => {
            const el = /** @type {HTMLElement} */ (b);
            return [Math.round((parseFloat(el.style.left) + parseFloat(el.style.width) / 2) / px), Math.round((parseFloat(el.style.top) + parseFloat(el.style.height) / 2) / px)];
          });
          const has = (x, y) => centres.some(([a, b]) => a === x && b === y);
          const out = [];
          for (const [cx, cy] of centres) {
            // The slab's stone, left and right of the middle (the tile is 16: cx - 8 .. cx + 7).
            if (![[-5, -1], [4, -1], [-1, -5], [-1, 4]].every(([dx, dy]) => slab(cx + dx, cy + dy))) out.push(`${cx},${cy}: no slab`);
            // A column of the foundation's height (a mote of the map's air is a pixel or two).
            const column = (x) => [1, 2, 3, 4, 5, 6].every((dy) => solid(x, cy + dy));
            if (!column(cx - 8) || !column(cx + 7)) out.push(`${cx},${cy}: the foundation does not reach the tile's edges`);
            // (A tower on the tile below and beside is drawn later and reaches up into this row.)
            if (!has(cx - 16, cy) && !has(cx - 16, cy + 16) && column(cx - 10)) out.push(`${cx},${cy}: the foundation goes past the tile's left edge`);
            if (!has(cx + 16, cy) && !has(cx + 16, cy + 16) && column(cx + 9)) out.push(`${cx},${cy}: the foundation goes past the tile's right edge`);
          }
          return out;
        });
        expect(wrong, map).toEqual([]);
      }
    });
  });
}
