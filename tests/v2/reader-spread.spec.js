// The reader held sideways (docs/v2/PLAN.md 9.1 row r-2) and its handling of a book's
// own table of contents, on a phone: two pages with the gutter between them, the LEFT
// button forward and the RIGHT one back (the owner's layout; a setting swaps them),
// a sentence-by-sentence zoom that can be turned off, Auto's light and zoom following
// the text, a rotation keeping the place. The book (generated here) has a contents
// list before chapter 1: it is skipped on the first open, left out of the counts and
// reachable from the panel.
const path = require('path');
const { createUser } = require('../support/emulator');
const { test, expect, openSignedIn } = require('../support/v2');
// The reader's own EPUB library, from v2's dependencies: the root has no copy.
const JSZip = require(path.join(__dirname, '..', '..', 'v2', 'node_modules', 'jszip'));

const PIXEL7_LANDSCAPE = { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true };
test.use({ ...PIXEL7_LANDSCAPE, serviceWorkers: 'block' });

const prose = (n) =>
  `Akapit ${n}. Był wczesny ranek, kiedy pociąg zatrzymał się na małej stacji, a mgła wisiała nad torami. ` +
  'Przyszedł m.in. dr Nowak, który — jak zwykle — spóźnił się o kilka minut. Na peronie stała kobieta w szarym płaszczu i patrzyła w stronę lasu.';
const PARAGRAPHS = 30;
const BOOK = {
  name: 'Podróż.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from(
    [
      'Podróż',
      'Spis treści',
      'Rozdział 1. Początek ....... 3',
      'Rozdział 2. Dalej ....... 7',
      'Rozdział 3. Koniec ....... 12',
      'Rozdział 1. Początek',
      ...Array.from({ length: PARAGRAPHS }, (_, i) => prose(i + 1)),
    ].join('\n\n'),
    'utf8',
  ),
};
// Sentences: the title (1), "Rozdział 1." + "Początek" (2), 4 in each paragraph; the contents list is not counted.
const TOTAL = 1 + 2 + 4 * PARAGRAPHS;

/** Where the book's reading stands in this browser's IndexedDB (without the contents list). */
function storedProgress(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('lifexp-v2-reader');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('meta').objectStore('meta').getAll();
          req.onsuccess = () => {
            resolve(req.result[0]?.progress?.pos);
            open.result.close();
          };
        };
      }),
  );
}

const status = (page) => page.getByTestId('reader-status');
const camera = (page) => page.getByTestId('spread-camera');

/** The camera's scale once it has stopped moving. */
async function settledScale(page) {
  await page.waitForFunction(() => document.querySelector('[data-testid="spread-camera"]')?.getAnimations().length === 0);
  return camera(page).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
}

async function openBook(page, account) {
  await openSignedIn(page, account, '#/reader');
  await page.locator('input[type="file"]').setInputFiles([BOOK]);
  await expect(page.locator('.reader-lib__open')).toHaveCount(1);
  // The library counts the book without its contents list.
  await expect(page.locator('.reader-lib__open')).toContainText(`TXT · ${TOTAL} zdania · 0%`);
  await page.locator('.reader-lib__open').click();
  await expect(page.locator('.spread')).toBeVisible();
}

test('two pages with a gutter; the left button goes forward, the right one back; the zoom follows each sentence', async ({ page }) => {
  const account = await createUser({ tag: 'spread', profile: { optInModules: ['reader'] } });
  await openBook(page, account);

  // The first open starts at chapter 1, after the contents list, which is not counted.
  await expect(status(page)).toHaveText(`0% · zdanie 2 z ${TOTAL}`);
  await expect(page.locator('.spread__sent.is-on')).toHaveText('Rozdział 1.');

  // Two pages side by side, the gutter between them, numbered 1 and 2, the whole spread visible.
  const left = await page.locator('.spread__page--left').boundingBox();
  const right = await page.locator('.spread__page--right').boundingBox();
  const gutter = await page.locator('.spread__gutter').boundingBox();
  expect(left.width).toBeGreaterThan(250);
  expect(Math.abs(left.width - right.width)).toBeLessThan(2);
  expect(right.x).toBeGreaterThan(left.x + left.width - 2);
  expect(gutter.x).toBeGreaterThan(left.x + left.width - gutter.width);
  expect(gutter.x + gutter.width).toBeLessThan(right.x + gutter.width);
  await expect(page.getByTestId('folio-left')).toHaveText('1');
  await expect(page.getByTestId('folio-right')).toHaveText('2');
  expect(await settledScale(page)).toBe(1);
  // Nothing wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(915);

  // The buttons sit beside the pages: "Dalej" on the left, "Wstecz" on the right.
  const next = page.getByRole('button', { name: 'Dalej' });
  const back = page.getByRole('button', { name: 'Wstecz' });
  const nextBox = await next.boundingBox();
  const backBox = await back.boundingBox();
  expect(nextBox.x + nextBox.width).toBeLessThanOrEqual(left.x + 1);
  expect(backBox.x).toBeGreaterThanOrEqual(right.x + right.width - 1);
  expect(nextBox.height).toBeGreaterThan(200);

  // Left = one sentence forward, zoomed in on it; right = one back.
  await next.click();
  await expect(status(page)).toHaveText(`1% · zdanie 3 z ${TOTAL}`);
  await expect(page.locator('.spread__sent.is-on')).toHaveText('Początek');
  expect(await settledScale(page)).toBeGreaterThan(1.2);
  await next.click();
  await expect(page.locator('.spread__sent.is-on')).toHaveText('Akapit 1.');
  await back.click();
  await expect(status(page)).toHaveText(`1% · zdanie 3 z ${TOTAL}`);
  await expect(page.locator('.spread__sent.is-on')).toHaveText('Początek');

  // A tap on the pages shows the whole spread again, another tap zooms back in.
  await page.locator('.spread__frame').click({ position: { x: 300, y: 150 } });
  await expect.poll(() => settledScale(page)).toBe(1);
  await page.locator('.spread__frame').click({ position: { x: 300, y: 150 } });
  await expect.poll(() => settledScale(page)).toBeGreaterThan(1.2);

  // The keyboard follows the same direction: → forward.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.spread__sent.is-on')).toHaveText('Akapit 1.');
});

test('with the zoom off the arrows turn whole spreads; the swap setting puts Wstecz on the left', async ({ page }) => {
  const account = await createUser({ tag: 'spread-off', profile: { optInModules: ['reader'] } });
  await openBook(page, account);
  await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
  const settings = page.getByRole('dialog', { name: 'Ustawienia' });
  await settings.getByRole('switch', { name: 'Przybliżaj do zdania' }).click();
  await expect(settings.getByRole('switch', { name: 'Przybliżaj do zdania' })).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await expect(page.locator('.spread__sent.is-on')).toHaveCount(0);

  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByTestId('folio-left')).toHaveText('3');
  await expect(page.getByTestId('folio-right')).toHaveText('4');
  expect(await settledScale(page)).toBe(1);
  // The place is the first sentence starting on the new spread, and it is on its left page.
  const first = await status(page).textContent();
  expect(first).not.toContain('zdanie 2 z');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByTestId('folio-left')).toHaveText('5');
  await page.getByRole('button', { name: 'Wstecz' }).click();
  await expect(page.getByTestId('folio-left')).toHaveText('3');
  await expect(status(page)).toHaveText(first);

  // Swapped: Wstecz on the left, Dalej on the right.
  await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
  await settings.getByRole('switch', { name: 'Zamień strony przycisków' }).click();
  await page.keyboard.press('Escape');
  const nextBox = await page.getByRole('button', { name: 'Dalej' }).boundingBox();
  const backBox = await page.getByRole('button', { name: 'Wstecz' }).boundingBox();
  expect(backBox.x).toBeLessThan(nextBox.x);
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByTestId('folio-left')).toHaveText('5');

  // The same screen and text size give the same pages after a reload (once the place is saved).
  const place = await status(page).textContent();
  const n = Number(place.match(/zdanie (\d+)/)[1]);
  await expect.poll(() => storedProgress(page)).toBe(n - 1);
  await page.reload();
  await expect(page.getByTestId('folio-left')).toHaveText('5');
  await expect(status(page)).toHaveText(place);
});

test('Auto: the light walks the words, the zoom follows its sentence, and the spread turns by itself', async ({ page }) => {
  const account = await createUser({ tag: 'spread-auto', profile: { optInModules: ['reader'] } });
  await openBook(page, account);
  // To the last sentence that starts on the first spread: turn with the zoom off, then step back one.
  await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
  const settings = page.getByRole('dialog', { name: 'Ustawienia' });
  await settings.getByRole('switch', { name: 'Przybliżaj do zdania' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByTestId('folio-left')).toHaveText('3');
  await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
  await settings.getByRole('switch', { name: 'Przybliżaj do zdania' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Wstecz' }).click();
  await expect(page.getByTestId('folio-left')).toHaveText('1');

  await page.getByRole('button', { name: 'Auto' }).click();
  for (let i = 0; i < 40; i++) await page.getByRole('button', { name: 'Szybciej' }).click();
  await expect(page.locator('.reader__mini-out')).toHaveText('900 słów/min');
  const lamp = page.getByTestId('spread-lamp');
  const firstWord = await lamp.getAttribute('data-word');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect.poll(() => lamp.getAttribute('data-word')).not.toBe(firstWord);
  // Zoomed in on the sentence being read.
  await expect.poll(() => camera(page).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBeGreaterThan(1.2);
  // The light reaches the next spread: the pages turn by themselves.
  await expect(page.getByTestId('folio-left')).toHaveText('3', { timeout: 15000 });
  const transformBefore = await camera(page).evaluate((el) => getComputedStyle(el).transform);
  const statusBefore = await status(page).textContent();
  await expect.poll(() => status(page).textContent(), { timeout: 10000 }).not.toBe(statusBefore);
  // The camera moved with the new sentence.
  await expect.poll(() => camera(page).evaluate((el) => getComputedStyle(el).transform)).not.toBe(transformBefore);
  await page.getByRole('button', { name: 'Pauza' }).click();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('turning the phone keeps the place both ways', async ({ page }) => {
  const account = await createUser({ tag: 'spread-rotate', profile: { optInModules: ['reader'] } });
  await openBook(page, account);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.locator('.spread__sent.is-on')).toHaveText('Przyszedł m.in. dr Nowak, który — jak zwykle — spóźnił się o kilka minut.');
  await expect(status(page)).toHaveText(`4% · zdanie 6 z ${TOTAL}`);

  await page.setViewportSize({ width: 412, height: 915 });
  await expect(page.locator('.spread')).toHaveCount(0);
  await expect(page.getByTestId('reader-easy-text')).toHaveText('Przyszedł m.in. dr Nowak, który — jak zwykle — spóźnił się o kilka minut.');
  await expect(page.locator('.reader__foot .reader__status')).toHaveText(`4%zdanie 6 z ${TOTAL}`);
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.locator('.reader__foot .reader__status')).toHaveText(`4%zdanie 7 z ${TOTAL}`);

  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator('.spread__sent.is-on')).toHaveText('Na peronie stała kobieta w szarym płaszczu i patrzyła w stronę lasu.');
  await expect(status(page)).toHaveText(`4% · zdanie 7 z ${TOTAL}`);
});

test('the book\'s own contents list: skipped, reachable from the panel, and back in the book when not skipped', async ({ page }) => {
  const account = await createUser({ tag: 'spread-toc', profile: { optInModules: ['reader'] } });
  await openBook(page, account);
  await page.getByRole('button', { name: 'Spis', exact: true }).click();
  const toc = page.getByRole('dialog', { name: 'Spis treści', exact: true });
  await toc.getByRole('button', { name: 'Spis treści książki' }).click();
  const bookToc = page.getByRole('dialog', { name: 'Spis treści książki' });
  await expect(bookToc.locator('p')).toHaveText(['Spis treści', 'Rozdział 1. Początek ....... 3', 'Rozdział 2. Dalej ....... 7', 'Rozdział 3. Koniec ....... 12']);
  await bookToc.getByRole('button', { name: 'Zamknij' }).click();
  await expect(bookToc).toHaveCount(0);

  // Not skipped: the list is part of the book again, and of the count; the place stays.
  await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
  await page.getByRole('switch', { name: 'Pomijaj spis treści' }).click();
  await page.keyboard.press('Escape');
  const withToc = await status(page).textContent();
  expect(withToc).toMatch(/zdanie \d+ z (\d+)/);
  expect(Number(withToc.match(/z (\d+)/)[1])).toBeGreaterThan(TOTAL);
  await expect(page.locator('.spread__sent.is-on')).toHaveText('Rozdział 1.');
  await expect(page.locator('.spread__sent', { hasText: 'Dalej .......' })).toBeAttached();
});

test.describe('on a 851×393 phone (DPR 2.75)', () => {
  test.use({ viewport: { width: 851, height: 393 }, deviceScaleFactor: 2.75 });

  test('the spread fits, nothing overlaps the text, and the place survives a reload', async ({ page }) => {
    const account = await createUser({ tag: 'spread-851', profile: { optInModules: ['reader'] } });
    await openBook(page, account);
    const frame = await page.locator('.spread__frame').boundingBox();
    const next = await page.getByRole('button', { name: 'Dalej' }).boundingBox();
    const back = await page.getByRole('button', { name: 'Wstecz' }).boundingBox();
    expect(next.x + next.width).toBeLessThanOrEqual(frame.x);
    expect(back.x).toBeGreaterThanOrEqual(frame.x + frame.width);
    expect(frame.y + frame.height).toBeLessThanOrEqual(393);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(851);
    await expect(page.getByTestId('folio-right')).toHaveText('2');
    // The top bar's controls stay on one row, inside the screen.
    const spis = await page.getByRole('button', { name: 'Spis', exact: true }).boundingBox();
    expect(spis.x + spis.width).toBeLessThanOrEqual(851);
    expect(spis.y).toBeLessThan(frame.y);

    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Dalej' }).click();
    const place = `3% · zdanie 5 z ${TOTAL}`;
    await expect(status(page)).toHaveText(place);
    // Closing the book saves the place; the library's percentage counts without the contents list too.
    await page.getByRole('button', { name: 'Biblioteka' }).click();
    await expect(page.locator('.reader-lib__open')).toContainText(`TXT · ${TOTAL} zdania · 3%`);
    await page.locator('.reader-lib__open').click();
    await expect(status(page)).toHaveText(place);
  });
});

test('an EPUB\'s navigation document in the spine is its contents list: skipped and shown in the panel', async ({ page }) => {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    'OEBPS/content.opf',
    '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Z nawigacją</dc:title></metadata>' +
      '<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest>' +
      '<spine><itemref idref="nav"/><itemref idref="c1"/></spine></package>',
  );
  const page_ = (body) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>x</title></head><body>${body}</body></html>`;
  zip.file('OEBPS/nav.xhtml', page_('<nav epub:type="toc"><h1>Contents</h1><ol><li><a href="c1.xhtml">Pierwszy rozdział</a></li></ol></nav>'));
  zip.file('OEBPS/c1.xhtml', page_('<h1>Pierwszy rozdział</h1><p>Tekst rozdziału. Drugie zdanie.</p>'));
  const epub = { name: 'nav.epub', mimeType: 'application/epub+zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) };

  const account = await createUser({ tag: 'spread-nav', profile: { optInModules: ['reader'] } });
  await openSignedIn(page, account, '#/reader');
  await page.locator('input[type="file"]').setInputFiles([epub]);
  await expect(page.locator('.reader-lib__open')).toContainText('EPUB · 3 zdania · 0%');
  await page.locator('.reader-lib__open').click();
  await expect(page.locator('.spread__sent.is-on')).toHaveText('Pierwszy rozdział');
  await expect(page.getByTestId('reader-status')).toHaveText('0% · zdanie 1 z 3');
  await page.getByRole('button', { name: 'Spis', exact: true }).click();
  await page.getByRole('button', { name: 'Spis treści książki' }).click();
  await expect(page.getByRole('dialog', { name: 'Spis treści książki' }).locator('p, h3')).toHaveText(['Contents', 'Pierwszy rozdział']);
});

/** Two pages, the gutter between them and both buttons inside the screen, nothing wider than it. */
async function expectSpreadFits(page, width, height) {
  await expect(page.locator('.spread__frame')).toBeVisible();
  const left = await page.locator('.spread__page--left').boundingBox();
  const right = await page.locator('.spread__page--right').boundingBox();
  const gutter = await page.locator('.spread__gutter').boundingBox();
  expect(left.width).toBeGreaterThan(200);
  expect(Math.abs(left.width - right.width)).toBeLessThan(2);
  expect(gutter.x).toBeGreaterThan(left.x);
  expect(gutter.x + gutter.width).toBeLessThan(right.x + right.width);
  for (const name of ['Dalej', 'Wstecz']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
  }
  const reader = await page.locator('.reader').boundingBox();
  expect(Math.round(reader.width)).toBe(width);
  expect(Math.round(reader.height)).toBe(height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test.describe('turning a phone that started upright (393×851, DPR 2.75)', () => {
  test.use({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75 });

  test('each mode: upright → sideways shows the spread with working buttons → upright again, at the same place', async ({ page }) => {
    const account = await createUser({ tag: 'spread-live', profile: { optInModules: ['reader'] } });
    await openSignedIn(page, account, '#/reader');
    await page.locator('input[type="file"]').setInputFiles([BOOK]);
    await page.locator('.reader-lib__open').click();
    await expect(page.getByTestId('reader-easy-text')).toHaveText('Rozdział 1.');
    const footStatus = page.locator('.reader__foot .reader__status');

    for (const mode of ['Prosta', 'Auto', 'Normalny']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await expect(page.getByRole('button', { name: mode, exact: true })).toHaveAttribute('aria-pressed', 'true');
      const upright = await footStatus.textContent();
      const n = Number(upright.match(/zdanie (\d+)/)[1]);

      // Android fires resize around orientationchange; the layout follows the new size.
      await page.setViewportSize({ width: 851, height: 393 });
      await page.evaluate(() => dispatchEvent(new Event('orientationchange')));
      await expectSpreadFits(page, 851, 393);
      await expect(status(page)).toContainText(`zdanie ${n} z`);
      await page.getByRole('button', { name: 'Dalej' }).click();
      await expect(status(page)).not.toContainText(`zdanie ${n} z`);
      const sideways = await status(page).textContent();
      const m = Number(sideways.match(/zdanie (\d+)/)[1]);
      expect(m).toBeGreaterThan(n);
      await page.getByRole('button', { name: 'Wstecz' }).click();
      await expect(status(page)).not.toContainText(`zdanie ${m} z`);
      await page.getByRole('button', { name: 'Dalej' }).click();
      await expect(status(page)).toContainText(`zdanie ${m} z`);

      await page.setViewportSize({ width: 393, height: 851 });
      await page.evaluate(() => dispatchEvent(new Event('orientationchange')));
      await expect(page.locator('.spread')).toHaveCount(0);
      const reader = await page.locator('.reader').boundingBox();
      expect(Math.round(reader.width)).toBe(393);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(393);
      await expect(footStatus).toContainText(`zdanie ${m} z`);
    }
  });

  test('a long book (about 1 MB) turns sideways quickly on a slow phone: one chapter at a time is laid out', async ({ page }) => {
    test.setTimeout(120000);
    const long = Array.from({ length: 4000 }, (_, i) => prose(i + 1)).join('\n\n');
    const account = await createUser({ tag: 'spread-long', profile: { optInModules: ['reader'] } });
    await openSignedIn(page, account, '#/reader');
    await page.locator('input[type="file"]').setInputFiles([{ name: 'Długa.txt', mimeType: 'text/plain', buffer: Buffer.from(long, 'utf8') }]);
    await page.locator('.reader-lib__open').click({ timeout: 60000 });
    await expect(page.getByTestId('reader-easy-text')).toBeVisible({ timeout: 30000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const started = Date.now();
    await page.setViewportSize({ width: 851, height: 393 });
    await expect(page.locator('.spread__frame')).toBeVisible({ timeout: 60000 });
    await page.getByRole('button', { name: 'Dalej' }).click({ timeout: 60000 });
    await expect(status(page)).toContainText('zdanie 2 z');
    // Laying out the whole book in columns took ~24 s here before (the owner's frozen phone).
    expect(Date.now() - started).toBeLessThan(8000);
    // Only one chunk of the book is in the page.
    expect(await page.locator('.spread__columns:not(.spread__measure) .spread__sent').count()).toBeLessThan(200);
    // Pages are numbered over the whole book: past the first chunk the numbers go on.
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
    await page.getByRole('switch', { name: 'Przybliżaj do zdania' }).click();
    await page.keyboard.press('Escape');
    let folio = 1;
    for (let i = 0; i < 40 && folio < 30; i++) {
      await page.getByRole('button', { name: 'Dalej' }).click();
      folio = Number(await page.getByTestId('folio-left').textContent());
    }
    expect(folio).toBeGreaterThan(20);
    const before = folio;
    await page.getByRole('button', { name: 'Wstecz' }).click();
    await expect(page.getByTestId('folio-left')).toHaveText(String(before - 2));
  });
});
