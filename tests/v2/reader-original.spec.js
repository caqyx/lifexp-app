// Oryginał (docs/v2/PLAN.md 9.1, row r-6): a PDF book's real pages from its kept file,
// with the reader's light on the page itself. Portrait: one page; landscape: two pages,
// the spine and the page turn; full screen; zoom by hand. The place is shared with the
// text view. A PDF added before r-6 gets its file again with "Przetwórz ponownie".
const { createUser } = require('../support/emulator');
const { test, expect, openSignedIn } = require('../support/v2');
const { elementsPdf, storeKeys, makeBooksOld, bookRow, seeToast, shot } = require('../support/reader-books');

test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

const status = (page) => page.locator('.reader__foot .reader__status').first();

/** The page's canvas has drawn something (not only white paper). */
function pageDrawn(page, n) {
  return page.locator(`[data-testid="orig-page"][data-page="${n}"] canvas`).evaluate((c) => {
    if (!c.width) return false;
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    for (let k = 0; k < data.length; k += 4 * 97) if (data[k] < 200) return true;
    return false;
  });
}

/** How much of the text-layer span with `text` the light covers (0–1 of its width; 0 if off its line). */
function lightOver(page, text, testid = 'orig-mark') {
  return page.evaluate(
    ([want, id]) => {
      const span = [...document.querySelectorAll('.orig__text span')].find((s) => s.textContent === want);
      if (!span) return -1;
      const r = span.getBoundingClientRect();
      let covered = 0;
      for (const m of document.querySelectorAll(`[data-testid="${id}"]`)) {
        const b = m.getBoundingClientRect();
        const midY = b.top + b.height / 2;
        if (midY < r.top || midY > r.bottom) continue;
        covered += Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left));
      }
      return covered / r.width;
    },
    [text, testid],
  );
}

test('Oryginał in portrait: the real page, the light on its sentence and word, the same place as the text', async ({ page }) => {
  const account = await createUser({ tag: 'reader-original', profile: { optInModules: ['reader'] } });
  await openSignedIn(page, account, '#/reader');
  const pdf = elementsPdf(2);
  await page.locator('input[type="file"]').setInputFiles([pdf]);
  await seeToast(page, 'Dodano książkę.');
  // The file is kept on this device, and the library says how much it takes.
  await expect.poll(() => storeKeys(page, 'files')).toHaveLength(1);
  await expect(page.locator('.reader-lib__book').first()).toContainText('Oryginał PDF na urządzeniu: 0,1 MB');

  await bookRow(page, 'elementy').click();
  const view = page.getByRole('group', { name: 'Widok PDF' });
  await expect(view.getByRole('button', { name: 'Tekst' })).toHaveAttribute('aria-pressed', 'true');
  const easy = page.getByTestId('reader-easy-text');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(easy).toHaveText('Tekst po tabeli prowadzi do obrazka ponizej.');
  await expect(status(page)).toContainText('zdanie 3 z');

  // ── Oryginał: the same sentence, lit on page 1 ──
  await view.getByRole('button', { name: 'Oryginał' }).click();
  await expect(page.locator('[data-testid="orig-page"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="orig-page"]')).toHaveAttribute('data-page', '1');
  await expect(page.getByTestId('orig-folio')).toHaveText('Strona 1 z 4');
  await expect.poll(() => pageDrawn(page, 1)).toBe(true);
  await expect(status(page)).toContainText('zdanie 3 z');
  await expect.poll(() => lightOver(page, 'Tekst po tabeli prowadzi do obrazka ponizej.')).toBeGreaterThan(0.85);
  // Only that line: the line above it is not lit.
  expect(await lightOver(page, 'Drugie zdanie akapitu konczy go tutaj.')).toBe(0);
  // The camera comes close to the sentence (Przybliżaj do zdania is on by default).
  await expect.poll(() => page.getByTestId('orig-camera').evaluate((el) => Number(el.style.getPropertyValue('--cam-scale')))).toBeGreaterThan(1);
  await shot(page, 'rd6-original-portrait.png');

  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(status(page)).toContainText('zdanie 4 z');
  await expect.poll(() => lightOver(page, 'Akapit pod obrazkiem opisuje go krotko.')).toBeGreaterThan(0.85);
  // A tap shows the whole page; another goes close again.
  await page.getByTestId('orig-frame').click();
  await expect.poll(() => page.getByTestId('orig-camera').evaluate((el) => Number(el.style.getPropertyValue('--cam-scale')))).toBe(1);
  await shot(page, 'rd6-original-portrait-page.png');

  // ── Back to the text: the same place ──
  await view.getByRole('button', { name: 'Tekst' }).click();
  await expect(easy).toHaveText('Akapit pod obrazkiem opisuje go krotko.');

  // ── Normalny in Oryginał: the arrows turn pages; the place is the page's first sentence ──
  await view.getByRole('button', { name: 'Oryginał' }).click();
  await page.getByRole('button', { name: 'Normalny' }).click();
  await expect(page.getByTestId('orig-folio')).toHaveText('Strona 1 z 4');
  await expect(page.getByTestId('orig-mark')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByTestId('orig-folio')).toHaveText('Strona 2 z 4');
  await expect.poll(() => pageDrawn(page, 2)).toBe(true);
  await view.getByRole('button', { name: 'Tekst' }).click();
  await page.getByRole('button', { name: 'Prosta' }).click();
  await expect(easy).toHaveText('Druga strona ma zwykly tekst.');

  // ── Auto in Oryginał: the light walks the words on the page ──
  await view.getByRole('button', { name: 'Oryginał' }).click();
  await page.getByRole('button', { name: 'Auto' }).click();
  await expect(page.getByTestId('orig-folio')).toHaveText('Strona 2 z 4');
  await expect.poll(() => lightOver(page, 'Druga strona ma zwykly tekst.', 'orig-word')).toBeGreaterThan(0.1);
  // The first word, not the line.
  expect(await lightOver(page, 'Druga strona ma zwykly tekst.', 'orig-word')).toBeLessThan(0.4);
  await page.getByRole('slider', { name: 'Tempo czytania' }).fill('900');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByTestId('orig-folio')).toHaveText('Strona 3 z 4', { timeout: 15000 });
  await page.getByRole('button', { name: 'Pauza' }).click();

  // ── By hand: the wheel zooms, a double tap goes back to the whole page ──
  const frame = page.getByTestId('orig-frame');
  await frame.hover();
  await page.mouse.wheel(0, -400);
  await expect(frame).toHaveAttribute('data-zoomed', 'true');
  await frame.dblclick();
  await expect(frame).toHaveAttribute('data-zoomed', 'false');

  // ── Noc ──
  await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
  const settings = page.getByRole('dialog', { name: 'Ustawienia' });
  await settings.getByRole('button', { name: 'Noc' }).click();
  await page.locator('.reader__scrim').click();
  await expect(settings).toHaveCount(0);
  await expect(page.locator('.orig__page')).toHaveCSS('opacity', '0.9');
  await shot(page, 'rd6-original-night.png');

  // Oryginał is remembered (a reader setting); a reload opens it again on the same page.
  await page.reload();
  await expect(page.getByTestId('orig-folio')).toHaveText('Strona 3 z 4');

  // ── A PDF added before r-6 has no file: the library asks for it again ──
  await page.getByRole('button', { name: 'Biblioteka' }).click();
  await makeBooksOld(page);
  await page.reload();
  await expect(page.getByText('Ta książka nie ma jeszcze tabel, ilustracji ani Oryginału', { exact: false })).toBeVisible();
  await expect(page.locator('.reader-lib__book').first()).not.toContainText('Oryginał PDF na urządzeniu');
  await bookRow(page, 'elementy').click();
  // No file: no Oryginał switch, the text view.
  await expect(page.getByRole('group', { name: 'Widok PDF' })).toHaveCount(0);
  await expect(page.locator('.reader__scroller--auto, .reader__easy').first()).toBeVisible();
  await page.getByRole('button', { name: 'Biblioteka' }).click();
  await page.getByRole('button', { name: /Przetwórz ponownie książkę elementy/ }).click();
  await page.getByTestId('reader-reprocess-input').setInputFiles([pdf]);
  await seeToast(page, 'Dodano tabele i ilustracje do książki.');
  await expect(page.locator('.reader-lib__book').first()).toContainText('Oryginał PDF na urządzeniu: 0,1 MB');
  await bookRow(page, 'elementy').click();
  await expect(page.getByTestId('orig-folio')).toBeVisible();
});

test('Oryginał in landscape: two pages with the spine, the page turn, zoom to the sentence, full screen', async ({ page }) => {
  const account = await createUser({ tag: 'reader-original-spread', profile: { optInModules: ['reader'] } });
  await page.setViewportSize({ width: 915, height: 412 });
  await openSignedIn(page, account, '#/reader');
  await page.locator('input[type="file"]').setInputFiles([elementsPdf(4)]);
  await seeToast(page, 'Dodano książkę.');
  await bookRow(page, 'elementy').click();
  await page.getByRole('group', { name: 'Widok PDF' }).getByRole('button', { name: 'Oryginał' }).click();
  const pages = page.getByTestId('orig-page');
  await expect(pages).toHaveCount(2);
  await expect(pages.nth(0)).toHaveAttribute('data-page', '1');
  await expect(pages.nth(1)).toHaveAttribute('data-page', '2');
  await expect(page.getByTestId('orig-folio')).toHaveText('Strony 1–2 z 6');
  await expect.poll(() => pageDrawn(page, 1)).toBe(true);
  await expect.poll(() => pageDrawn(page, 2)).toBe(true);
  // Side by side, the same size, touching at the spine.
  const [a, b] = await Promise.all([pages.nth(0).boundingBox(), pages.nth(1).boundingBox()]);
  expect(Math.abs(a.x + a.width - b.x)).toBeLessThan(1.5);
  expect(Math.abs(a.height - b.height)).toBeLessThan(1);

  // Prosta: one sentence a step, lit, and the camera close to it.
  await expect.poll(() => lightOver(page, 'Tekst przed tabela jest pierwszym akapitem tej strony.')).toBeGreaterThan(0.85);
  await expect.poll(() => page.getByTestId('orig-camera').evaluate((el) => Number(el.style.getPropertyValue('--cam-scale')))).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect.poll(() => lightOver(page, 'Drugie zdanie akapitu konczy go tutaj.')).toBeGreaterThan(0.85);
  await shot(page, 'rd6-original-spread-zoom.png');

  // Normalny: a step is a spread, turned over the spine.
  await page.getByRole('button', { name: 'Normalny' }).click();
  await shot(page, 'rd6-original-spread.png');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByTestId('page-turn')).toHaveCount(1);
  await page.waitForTimeout(200);
  await shot(page, 'rd6-original-turn.png');
  await expect(page.getByTestId('page-turn')).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByTestId('orig-folio')).toHaveText('Strony 3–4 z 6');
  await expect.poll(() => pageDrawn(page, 3)).toBe(true);
  await page.getByRole('button', { name: 'Wstecz' }).click();
  await expect(page.getByTestId('page-turn')).toHaveCount(1);
  await expect(page.getByTestId('orig-folio')).toHaveText('Strony 1–2 z 6');

  // Full screen: only the pages and the arrows.
  await page.getByRole('button', { name: 'Pełny ekran' }).click();
  await expect(page.locator('.reader__top')).toHaveCount(0);
  await expect(pages).toHaveCount(2);
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByTestId('orig-folio')).toHaveText('Strony 3–4 z 6');
  // The leaf turns once the new pages are drawn (at the full screen's size here).
  await expect(page.getByTestId('page-turn')).toHaveCount(1);
  await expect(page.getByTestId('page-turn')).toHaveCount(0, { timeout: 3000 });
  await shot(page, 'rd6-original-fullscreen.png');
});
