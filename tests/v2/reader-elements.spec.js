// The reader's book elements (docs/v2/PLAN.md 9.1, row r-5): a PDF made here with a
// ruled table, a painted image, a framed box and running text shows the table as a
// table, the image as a picture and the box as a frame (ramka), in every view; sentence
// stepping goes past them. An EPUB keeps its <img> and <table>. A book added before
// r-5 can be read again from its file (Przetwórz ponownie). Generated files only.
const { createUser } = require('../support/emulator');
const { test, expect, openSignedIn } = require('../support/v2');
const { elementsPdf, elementsEpub, storeKeys, makeBooksOld, bookRow, seeToast, shot } = require('../support/reader-books');

test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

test('a PDF keeps its table, picture and frame in every view; stepping goes past them', async ({ page }) => {
  const account = await createUser({ tag: 'reader-elements', profile: { optInModules: ['reader'] } });
  await openSignedIn(page, account, '#/reader');
  const started = Date.now();
  await page.locator('input[type="file"]').setInputFiles([elementsPdf()]);
  await seeToast(page, 'Dodano książkę.');
  test.info().annotations.push({ type: 'import-ms', description: String(Date.now() - started) });
  // One picture (the image), stored on this device only.
  await expect.poll(() => storeKeys(page, 'assets')).toHaveLength(1);

  await bookRow(page, 'elementy').click();
  await page.getByRole('button', { name: 'Normalny' }).click();
  const full = page.locator('.reader__scroller--normal .reader__full');
  // In the order of the page: text, table, text, picture, text, frame, text.
  await expect(full.locator(':scope > *')).toHaveText([
    'Tekst przed tabela jest pierwszym akapitem tej strony. Drugie zdanie akapitu konczy go tutaj.',
    /MiastoRokWynik.*Lodz.*Krakow/,
    'Tekst po tabeli prowadzi do obrazka ponizej.',
    '',
    'Akapit pod obrazkiem opisuje go krotko.',
    'Uwaga: to jest ramka z waznym zdaniem.',
    'Koniec pierwszej strony jest tutaj.',
    'Druga strona ma zwykly tekst. I jeszcze jedno zdanie na koniec.',
  ]);
  const table = full.getByTestId('reader-el-table');
  await expect(table.locator('th')).toHaveText(['Miasto', 'Rok', 'Wynik']);
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.locator('tbody tr').first().locator('td')).toHaveText(['Lodz', '2021', '12']);
  const picture = full.getByTestId('reader-el-image').locator('img');
  await expect(picture).toHaveAttribute('alt', 'Ilustracja');
  await expect.poll(() => picture.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  // The picture fits the column.
  const [colW, picW] = await Promise.all([full.evaluate((el) => el.clientWidth), picture.evaluate((el) => el.getBoundingClientRect().width)]);
  expect(picW).toBeLessThanOrEqual(colW + 0.5);
  const frame = full.locator('.reader-framed');
  await expect(frame).toHaveText('Uwaga: to jest ramka z waznym zdaniem.');
  await expect(frame).toHaveClass(/reader-framed--first/);
  await expect(frame).toHaveClass(/reader-framed--last/);
  await shot(page, 'rd5-text-normal.png');

  // A tap opens the picture on the whole screen; the wheel zooms it; Esc closes.
  await picture.click();
  const zoom = page.getByRole('dialog', { name: 'Element w pełnym ekranie' });
  await expect(zoom).toBeVisible();
  await zoom.locator('.reader-zoom__stage').hover();
  await page.mouse.wheel(0, -300);
  await expect.poll(() => zoom.locator('.reader-zoom__stage').evaluate((el) => Number(el.style.getPropertyValue('--zoom-scale')))).toBeGreaterThan(1);
  await page.keyboard.press('Escape');
  await expect(zoom).toHaveCount(0);
  // The table opens the same way.
  await table.click();
  await expect(zoom.locator('th')).toHaveText(['Miasto', 'Rok', 'Wynik']);
  await zoom.getByRole('button', { name: 'Zamknij' }).click();
  await expect(zoom).toHaveCount(0);

  // ── Prosta: sentence by sentence, past the elements; each shows with the sentence after it. ──
  await page.getByRole('button', { name: 'Prosta' }).click();
  await page.getByRole('slider', { name: 'Pozycja w książce' }).fill('0');
  const easy = page.getByTestId('reader-easy-text');
  const next = page.getByRole('button', { name: 'Dalej' });
  const seen = [];
  for (let k = 0; k < 6; k++) {
    seen.push(await easy.textContent());
    await next.click();
  }
  expect(seen).toEqual([
    'Tekst przed tabela jest pierwszym akapitem tej strony.',
    'Drugie zdanie akapitu konczy go tutaj.',
    'Tekst po tabeli prowadzi do obrazka ponizej.',
    'Akapit pod obrazkiem opisuje go krotko.',
    'Uwaga: to jest ramka z waznym zdaniem.',
    'Koniec pierwszej strony jest tutaj.',
  ]);
  await page.getByRole('button', { name: 'Wstecz' }).click();
  await page.getByRole('button', { name: 'Wstecz' }).click();
  await page.getByRole('button', { name: 'Wstecz' }).click();
  await expect(easy).toHaveText('Akapit pod obrazkiem opisuje go krotko.');
  await expect(page.locator('.reader__easy-els').getByTestId('reader-el-image')).toBeVisible();
  await page.getByRole('button', { name: 'Wstecz' }).click();
  await expect(page.locator('.reader__easy-els').getByTestId('reader-el-table')).toBeVisible();

  // ── Cała strona and Auto: the same elements around the lit sentences. ──
  await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
  const settings = page.getByRole('dialog', { name: 'Ustawienia' });
  await settings.getByRole('button', { name: 'Cała strona' }).click();
  await page.locator('.reader__scrim').click();
  const pageView = page.locator('.reader__scroller--page');
  await expect(pageView.getByTestId('reader-el-table')).toBeVisible();
  await expect(pageView.locator('.reader__sent.is-on')).toHaveText(['Tekst po tabeli prowadzi do obrazka ponizej.']);
  await page.getByRole('button', { name: 'Auto' }).click();
  const auto = page.locator('.reader__scroller--auto');
  await expect(auto.getByTestId('reader-el-image')).toHaveCount(1);
  await expect(auto.locator('.reader-framed')).toHaveCount(1);
  await page.getByRole('slider', { name: 'Tempo czytania' }).fill('900');
  await page.getByRole('button', { name: 'Start' }).click();
  // The light walks the text around the elements to the end; no word of it is in an element.
  await expect(page.getByText('To koniec książki.')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.reader__w.is-now')).toHaveText('koniec.');
  await expect(auto.locator('.reader-el .reader__w')).toHaveCount(0);

  // ── Noc: the table takes the theme's colours, the picture keeps its own (a little dimmed). ──
  await page.getByRole('button', { name: 'Normalny' }).click();
  await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
  await settings.getByRole('button', { name: 'Noc' }).click();
  await page.locator('.reader__scrim').click();
  await expect(page.locator('.reader')).toHaveAttribute('data-theme', 'night');
  await expect(settings).toHaveCount(0);
  const th = page.locator('.reader__scroller--normal th').first();
  await expect(th).toHaveCSS('color', 'rgb(244, 239, 228)');
  await expect(page.locator('.reader__scroller--normal .reader-el__img')).toHaveCSS('opacity', '0.9');
  await page.locator('.reader__scroller--normal').evaluate((el) => (el.scrollTop = 0));
  await shot(page, 'rd5-text-night.png');
});

test('landscape spread: the elements are on the pages, fit the column, and turn with them', async ({ page }) => {
  const account = await createUser({ tag: 'reader-elements-spread', profile: { optInModules: ['reader'] } });
  await page.setViewportSize({ width: 915, height: 412 });
  await openSignedIn(page, account, '#/reader');
  await page.locator('input[type="file"]').setInputFiles([elementsPdf(6)]);
  await seeToast(page, 'Dodano książkę.');
  await bookRow(page, 'elementy').click();
  const columns = page.getByTestId('spread-columns');
  await expect(columns.getByTestId('reader-el-table')).toHaveCount(1);
  const fig = columns.getByTestId('reader-el-image');
  await expect(fig).toHaveCount(1);
  await expect.poll(() => fig.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  const fit = await columns.evaluate((el) => {
    const colW = parseFloat(getComputedStyle(el).columnWidth);
    const colH = el.clientHeight;
    return [...el.querySelectorAll('.reader-el')].map((f) => {
      const r = f.getBoundingClientRect();
      return { w: r.width <= colW + 1, h: r.height <= colH + 1 };
    });
  });
  expect(fit.every((f) => f.w && f.h)).toBe(true);
  await expect(columns.locator('.reader-framed')).toHaveText('Uwaga: to jest ramka z waznym zdaniem.');
  await shot(page, 'rd5-spread.png');
  // The page turns (Normalny: a step is a spread): the elements turn with their page and are there when it comes back.
  await page.getByRole('button', { name: 'Normalny' }).click();
  const folio = page.getByTestId('folio-left');
  const first = await folio.textContent();
  await page.getByRole('button', { name: 'Dalej' }).first().click();
  await expect(folio).not.toHaveText(first ?? '');
  await page.getByRole('button', { name: 'Wstecz' }).first().click();
  await expect(folio).toHaveText(first ?? '');
  await expect(columns.getByTestId('reader-el-table')).toBeVisible();
});

test('an EPUB keeps its img and table; a book added before r-5 is read again from its file', async ({ page }) => {
  const account = await createUser({ tag: 'reader-elements-epub', profile: { optInModules: ['reader'] } });
  await openSignedIn(page, account, '#/reader');
  const epub = await elementsEpub();
  await page.locator('input[type="file"]').setInputFiles([epub]);
  await seeToast(page, 'Dodano książkę.');
  await bookRow(page, 'Ksiazka z obrazkiem').click();
  await page.getByRole('button', { name: 'Normalny' }).click();
  const full = page.locator('.reader__scroller--normal .reader__full');
  const img = full.getByTestId('reader-el-image').locator('img');
  await expect(img).toHaveAttribute('alt', 'Rudy kot');
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  const table = full.getByTestId('reader-el-table');
  await expect(table.locator('th')).toHaveText(['Imię', 'Wiek']);
  await expect(table.locator('td')).toHaveText(['Ala', '7', 'Razem dwoje']);
  await expect(table.locator('td').last()).toHaveAttribute('colspan', '2');
  await page.getByRole('button', { name: 'Biblioteka' }).click();

  // Before r-5 a book had no elements and no parser version: the library offers to read it again.
  await makeBooksOld(page);
  await page.reload();
  const again = page.getByRole('button', { name: /Przetwórz ponownie książkę Ksiazka z obrazkiem/ });
  await expect(again).toBeVisible();
  await expect(page.getByText('Ta książka nie ma jeszcze tabel ani ilustracji.', { exact: false })).toBeVisible();
  // The wrong kind of file is refused.
  await again.click();
  await page.getByTestId('reader-reprocess-input').setInputFiles([elementsPdf()]);
  await seeToast(page, 'To inny format niż książka. Wybierz ten sam plik.');
  await again.click();
  await page.getByTestId('reader-reprocess-input').setInputFiles([epub]);
  await seeToast(page, 'Dodano tabele i ilustracje do książki.');
  await expect(again).toHaveCount(0);
  await expect.poll(() => storeKeys(page, 'assets')).toHaveLength(1);
  await bookRow(page, 'Ksiazka z obrazkiem').click();
  await expect(page.locator('.reader__scroller--normal').getByTestId('reader-el-image').locator('img')).toHaveAttribute('alt', 'Rudy kot');
});
