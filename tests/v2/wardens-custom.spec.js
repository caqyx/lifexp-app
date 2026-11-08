// Strażnicy Doliny's custom mode (docs/v2/PLAN.md 9.1, td-5): it opens once every campaign
// map is won (here: the last one won with the test switches), the map editor paints a road
// and build spots and the map plays, infinite gold never runs out, the chosen enemies are
// the only ones that come; the setup and the editor fit phones and computers. The game page
// is opened on its own (built, v2/dist); no account.
const { test, expect } = require('@playwright/test');

const PAGE = '/v2/dist/games/wardens/index.html';
const PROGRESS = 'lifexp-wardens-progress';

/** Saved progress before the page loads. @param {import('@playwright/test').Page} page @param {object} stars */
async function seed(page, stars) {
  // Only into an empty store: a reload keeps what the game saved since.
  await page.addInitScript(([key, value]) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
  }, [PROGRESS, JSON.stringify({ stars, endlessBest: 0 })]);
}

/** Paints a road with the mouse (one stroke) and build spots (clicks) on the editor's grid. */
async function paintMap(page) {
  const box = await page.locator('#editor-grid').boundingBox();
  const at = (c, r) => [box.x + (c + 0.5) * (box.width / 9), box.y + (r + 0.5) * (box.height / 15)];
  const cells = [];
  for (let r = 0; r <= 5; r++) cells.push([2, r]);
  for (let c = 3; c <= 6; c++) cells.push([c, 5]);
  for (let r = 6; r <= 14; r++) cells.push([6, r]);
  await page.mouse.move(...at(...cells[0]));
  await page.mouse.down();
  for (const cell of cells.slice(1)) await page.mouse.move(...at(...cell), { steps: 2 });
  await page.mouse.up();
  await page.getByRole('radio', { name: 'Pola budowy' }).click();
  for (const [c, r] of [[3, 2], [1, 4], [4, 6], [5, 8], [7, 10], [5, 12]]) await page.mouse.click(...at(c, r));
}

test.describe('custom mode', () => {
  test.use({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, hasTouch: true });

  test('locked until every map is won; winning the last map opens it (old saves with all three open it at once)', async ({ page }) => {
    await seed(page, { meadow: 3, canyon: 2 });
    await page.goto(`${PAGE}?lang=pl&test=1&waves=1&speed=30&gold=3000`);
    const card = page.getByRole('button', { name: /^Tryb własny/ });
    await expect(card).toBeDisabled();
    await page.getByRole('button', { name: /^Mokradła/ }).click();
    for (const n of [1, 3, 4, 6, 8]) {
      await page.getByRole('button', { name: `Pole budowy ${n}`, exact: true }).click();
      await page.getByRole('radio', { name: /^Snajper/ }).click();
      await page.getByRole('button', { name: /^Zbuduj wieżę ·/ }).click();
    }
    await page.getByRole('button', { name: /^Start fali/ }).click();
    await expect(page.getByRole('region', { name: 'Dolina obroniona!' })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Wybór mapy' }).click();
    await expect(page.getByRole('button', { name: /^Tryb własny/ })).toBeEnabled();

    await page.reload();
    await expect(page.getByRole('button', { name: /^Tryb własny/ })).toBeEnabled();
  });

  test('the editor paints a whole map, saves it, and it plays with infinite gold', async ({ page }) => {
    await seed(page, { meadow: 3, canyon: 2, marsh: 1 });
    await page.goto(`${PAGE}?lang=pl&test=1`);
    await page.getByRole('button', { name: /^Tryb własny/ }).click();
    await page.getByRole('button', { name: 'Nowa mapa' }).click();
    await expect(page.getByRole('button', { name: 'Zapisz' })).toBeDisabled();
    await paintMap(page);
    await page.getByRole('radio', { name: 'Kanion' }).click();
    await page.getByRole('textbox').fill('Wąwóz');
    await expect(page.getByText('Mapa gotowa: zapisz ją.')).toBeVisible();
    await page.getByRole('button', { name: 'Zapisz' }).click();

    // Back on the setup: the new map is chosen; it survives a reload.
    await expect(page.getByRole('radio', { name: 'Wąwóz' })).toHaveAttribute('aria-checked', 'true');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lifexp-wardens-custom') || 'null'));
    expect(saved.maps).toHaveLength(1);
    expect(saved.maps[0].look).toBe('canyon');

    await page.getByRole('radio', { name: 'Bez końca' }).click();
    await page.getByRole('button', { name: 'Graj' }).click();
    await expect(page.locator('#app')).toHaveAttribute('data-screen', 'play');
    await expect(page.locator('#play-map')).toHaveText('Gra własna · Wąwóz');
    await expect(page.locator('#app')).toHaveAttribute('data-map', 'canyon');
    await expect(page.locator('.pad')).toHaveCount(6);
    const gold = await page.locator('#stage').getAttribute('data-gold');
    for (let n = 1; n <= 6; n++) {
      await page.getByRole('button', { name: `Pole budowy ${n}`, exact: true }).click();
      await page.getByRole('radio', { name: /^Balista/ }).click();
      await page.getByRole('button', { name: /^Zbuduj wieżę ·/ }).click();
    }
    await expect(page.locator('#stage')).toHaveAttribute('data-towers', '6');
    await expect(page.locator('#stage')).toHaveAttribute('data-gold', gold);
    await expect(page.locator('#gold')).toHaveText('bez końca');
    await page.getByRole('button', { name: /^Start fali/ }).click();
    await expect.poll(async () => Number(await page.locator('#stage').getAttribute('data-enemies'))).toBeGreaterThan(0);
  });

  test('chosen enemies only: the waves bring bats and nothing else', async ({ page }) => {
    await seed(page, { meadow: 3, canyon: 2, marsh: 1 });
    await page.goto(`${PAGE}?lang=pl&test=1&speed=20`);
    await page.getByRole('button', { name: /^Tryb własny/ }).click();
    await page.getByRole('radio', { name: 'Wybrani' }).click();
    // Only the bat: uncheck the others chosen by default.
    const checked = page.getByRole('checkbox', { checked: true });
    while ((await checked.count()) > 0) await checked.first().click();
    await expect(page.getByRole('button', { name: 'Graj' })).toBeDisabled();
    await expect(page.getByText('Wybierz choć jednego wroga.')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Nietoperz' }).click();
    await page.getByRole('button', { name: 'Graj' }).click();
    await expect(page.locator('#play-map')).toHaveText('Gra własna · Łąka');
    // Two waves (fast clock): before each, the preview lists bats only; each passes.
    for (let wave = 1; wave <= 2; wave++) {
      const items = page.locator('#wave-preview .preview__item');
      await expect(items).toHaveCount(1);
      await expect(items.first()).toContainText('Nietoperz');
      await page.getByRole('button', { name: /^(Start fali|Wezwij falę)/ }).click();
      await expect(page.locator('#stage')).toHaveAttribute('data-cleared', String(wave), { timeout: 20000 });
    }
  });
});

// The setup and the editor fit: phones upright and sideways, a small phone, computers; Polish
// and English; nothing wider than the screen, every control at least 44 px tall.
const SCREENS = [
  { name: 'Pixel 7 upright', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, mobile: true },
  { name: 'Pixel 7 sideways', viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, mobile: true },
  { name: 'small phone upright', viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, mobile: true },
  { name: 'desktop 1366×768', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, mobile: false },
  { name: 'desktop 1920×1080 at 125 %', viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25, mobile: false },
];
for (const screen of SCREENS) {
  for (const lang of ['pl', 'en']) {
    test.describe(`${screen.name}, ${lang}: the custom screens fit`, () => {
      test.use({ viewport: screen.viewport, deviceScaleFactor: screen.deviceScaleFactor, isMobile: screen.mobile, hasTouch: true });

      test('setup and editor: no sideways overflow, controls at least 44 px', async ({ page }) => {
        await seed(page, { meadow: 3, canyon: 2, marsh: 1 });
        await page.goto(`${PAGE}?lang=${lang}&test=1`);
        await page.getByRole('button', { name: lang === 'pl' ? /^Tryb własny/ : /^Custom mode/ }).click();
        await page.locator('[data-enemies="pick"]').click();
        await page.locator('[data-gold="custom"]').click();
        const check = async (sel) => {
          const overflow = await page.locator(sel).evaluate((el) => el.scrollWidth - el.clientWidth);
          expect(overflow, `${sel} scrolls sideways`).toBeLessThanOrEqual(0);
          for (const el of await page.locator(`${sel} button`).all()) {
            if (!(await el.isVisible())) continue;
            const box = await el.boundingBox();
            expect(box.height, `${await el.textContent()} height`).toBeGreaterThanOrEqual(43.9);
            expect(box.x).toBeGreaterThanOrEqual(-1);
            expect(box.x + box.width).toBeLessThanOrEqual(screen.viewport.width + 1);
            const words = el.locator('.pt-canvas');
            if ((await words.count()) === 1) {
              const w = await words.boundingBox();
              expect(w.x + w.width, `${await el.textContent()}: words inside`).toBeLessThanOrEqual(box.x + box.width + 1);
            }
          }
        };
        await check('#custom');
        await page.locator('#custom-new').click();
        await check('#editor');
        const grid = await page.locator('#editor-grid').boundingBox();
        expect(grid.width).toBeGreaterThanOrEqual(9 * 16);
        expect(grid.x + grid.width).toBeLessThanOrEqual(screen.viewport.width + 1);
      });
    });
  }
}
