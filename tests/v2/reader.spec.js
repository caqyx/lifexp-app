// The book reader (docs/v2/PLAN.md 9.1 row "r") on the Firebase emulators: an opt-in
// module, off for every account until switched on in Settings (optInModules; v1's
// enabledModules never sees it). Books are imported from files generated here (no
// real books), kept in this browser's IndexedDB only, and read in the three modes.
const path = require('path');
const { createUser, db } = require('../support/emulator');
const { test, expect, openSignedIn, appUrl } = require('../support/v2');
// The reader's own EPUB library, from v2's dependencies: the root has no copy.
const JSZip = require(path.join(__dirname, '..', '..', 'v2', 'node_modules', 'jszip'));

test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

const TXT = {
  name: 'Krótka opowieść.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('Ala ma kota. Kot ma Alę.\n\nPrzyszedł m.in. dr Nowak. Było późno.\n\nKoniec opowieści.', 'utf8'),
};

const MD = {
  name: 'Notatki.md',
  mimeType: 'text/markdown',
  buffer: Buffer.from('# Rozdział pierwszy\n\nPierwsze zdanie. Drugie *zdanie*.\n\n## Rozdział drugi\n\nTrzecie zdanie jest ostatnie.', 'utf8'),
};

/** A one-page-per-entry PDF with real text (Helvetica, ASCII), offsets computed for the xref. */
function makePdf(pages) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add(null);
  const pagesObj = add(null);
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [];
  for (const lines of pages) {
    const ops = ['BT', '/F1 12 Tf', '72 720 Td', '14 TL'];
    for (const line of lines) ops.push(`(${line.replace(/[()\\]/g, '\\$&')}) Tj T*`);
    ops.push('ET');
    const stream = ops.join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

async function makeEpub() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    'OEBPS/content.opf',
    '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Mała książka</dc:title></metadata>' +
      '<manifest><item id="c1" href="Text/c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="Text/c2.xhtml" media-type="application/xhtml+xml"/><item id="css" href="s.css" media-type="text/css"/></manifest>' +
      '<spine><itemref idref="c1"/><itemref idref="css"/><itemref idref="c2"/></spine></package>',
  );
  const page = (body) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title><style>p{}</style></head><body>${body}</body></html>`;
  zip.file('OEBPS/Text/c1.xhtml', page('<h1>Wstęp</h1><p>Pierwszy akapit książki. Ma dwa zdania.</p>'));
  zip.file('OEBPS/Text/c2.xhtml', page('<p>Drugi plik bez nagłówka.</p><div><p>Zagnieżdżony akapit.</p></div>'));
  return { name: 'mala.epub', mimeType: 'application/epub+zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) };
}

/** The reader's book records in this browser's IndexedDB. */
function storedBooks(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('lifexp-v2-reader');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('meta').objectStore('meta').getAll();
          req.onsuccess = () => {
            resolve(req.result.map(({ title, format, pos, total }) => ({ title, format, pos, total })));
            db.close();
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

async function importFiles(page, files) {
  await page.locator('input[type="file"]').setInputFiles(files);
}

/** A book's row in the library (its open button; the delete button names the book too). */
const bookRow = (page, title) => page.locator('.reader-lib__open', { hasText: title });

/** A toast is on screen; a tap dismisses it so the next one in the queue shows. */
async function seeToast(page, message) {
  const toast = page.getByText(message);
  await expect(toast).toBeVisible({ timeout: 15000 });
  await toast.click();
}

const status = (page) => page.locator('.reader__foot .reader__status').first();

test('the reader is off until turned on in Settings, and only optInModules records it', async ({ page }) => {
  const account = await createUser({ tag: 'reader-optin' });
  await openSignedIn(page, account, '#/today');
  const tabbar = page.locator('.tabbar');
  await tabbar.getByRole('button', { name: 'Menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Nawigacja' });
  await expect(menu.getByRole('link', { name: 'Notatki' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Czytnik' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // A link to it leads to Today while it is off.
  await page.goto(appUrl('#/reader'));
  await expect(page).toHaveURL(/#\/today$/);

  await page.goto(appUrl('#/settings/modules'));
  const sw = page.getByRole('switch', { name: 'Czytnik' });
  await expect(sw).not.toBeChecked();
  await sw.check();
  await expect(page.getByText('Moduł zaktualizowany.')).toBeVisible();
  await expect
    .poll(async () => {
      const { enabledModules, disabledModules, optInModules } = (await db.doc(`users/${account.uid}`).get()).data();
      return { enabledModules, disabledModules, optInModules };
    })
    .toEqual({
      enabledModules: ['chores', 'money', 'games', 'stats', 'notes', 'aichat'],
      disabledModules: [],
      optInModules: ['reader'],
    });

  await tabbar.getByRole('button', { name: 'Menu' }).click();
  await menu.getByRole('link', { name: 'Czytnik' }).click();
  await expect(page).toHaveURL(/#\/reader$/);
  await expect(page.getByRole('heading', { name: 'Czytnik' })).toBeVisible();
  await expect(page.getByText('Biblioteka jest pusta. Dodaj pierwszą książkę.')).toBeVisible();
});

test('imports TXT and MD, reads in Prosta, Auto and Normalny, and keeps the position on this device', async ({ page }) => {
  const account = await createUser({ tag: 'reader-read', profile: { optInModules: ['reader'] } });
  const before = Object.keys((await db.doc(`users/${account.uid}`).get()).data()).sort();
  await openSignedIn(page, account, '#/reader');
  await importFiles(page, [TXT, MD]);
  await expect(page.getByText('Dodano książek: 2.')).toBeVisible();
  await expect(bookRow(page, 'Krótka opowieść')).toContainText('TXT · 5 zdań · 0%');
  await expect(bookRow(page, 'Notatki')).toContainText('MD · 5 zdań · 0%');

  // ── Prosta ──
  await bookRow(page, 'Krótka opowieść').click();
  await expect(page).toHaveURL(/#\/reader\/[\w]+$/);
  // Full screen: no app menu or tab bar.
  await expect(page.locator('.tabbar')).toHaveCount(0);
  const text = page.getByTestId('reader-easy-text');
  await expect(text).toHaveText('Ala ma kota.');
  await expect(status(page)).toHaveText('0%zdanie 1 z 5');
  // Literata is served by the app itself (the test blocks every other host).
  await expect(text).toHaveCSS('font-family', /^"Literata Variable"/);
  await expect
    .poll(() => page.evaluate(async () => (await document.fonts.ready, [...document.fonts].some((f) => f.family.includes('Literata') && f.status === 'loaded'))))
    .toBe(true);
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(text).toHaveText('Kot ma Alę.');
  await page.getByRole('button', { name: 'Dalej' }).click();
  // "m.in." and "dr" do not end the sentence.
  await expect(text).toHaveText('Przyszedł m.in. dr Nowak.');
  await page.getByRole('button', { name: 'Wstecz' }).click();
  await expect(text).toHaveText('Kot ma Alę.');
  await page.keyboard.press('ArrowRight');
  await expect(text).toHaveText('Przyszedł m.in. dr Nowak.');
  await expect(status(page)).toHaveText('50%zdanie 3 z 5');

  // Two per screen never crosses a paragraph.
  await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
  const settings = page.getByRole('dialog', { name: 'Ustawienia' });
  await settings.getByRole('button', { name: '2', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(text).toHaveText('Przyszedł m.in. dr Nowak. Było późno.');

  // The position is saved (debounced) and survives a reload, as do the settings.
  await expect.poll(async () => (await storedBooks(page)).find((b) => b.format === 'TXT')?.pos).toBe(2);
  await page.reload();
  await expect(page.getByTestId('reader-easy-text')).toHaveText('Przyszedł m.in. dr Nowak. Było późno.');
  await expect(status(page)).toHaveText('50%zdanie 3 z 5');

  // ── Auto ──
  await page.getByRole('button', { name: 'Auto' }).click();
  await expect(page.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
  const lit = page.locator('.reader__w.is-now');
  await expect(lit).toHaveText('Przyszedł');
  await page.getByRole('slider', { name: 'Tempo czytania' }).fill('900');
  await expect(page.locator('.reader__speed output')).toHaveText('900 słów/min');
  await page.getByRole('button', { name: 'Start' }).click();
  // The light walks to the end of the book and stops there.
  await expect(page.getByText('To koniec książki.')).toBeVisible({ timeout: 10000 });
  await expect(lit).toHaveText('opowieści.');
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect(status(page)).toHaveText('100%zdanie 5 z 5');
  // A tap on a word moves the light there.
  await page.locator('.reader__w', { hasText: 'Alę.' }).click();
  await expect(lit).toHaveText('Alę.');
  await expect(status(page)).toHaveText('25%zdanie 2 z 5');

  // ── Normalny ──
  await page.getByRole('button', { name: 'Normalny' }).click();
  const scroller = page.locator('.reader__scroller--normal');
  await expect(scroller.locator('p')).toHaveCount(3);
  // The slider moves through the book here too.
  await page.getByRole('slider', { name: 'Pozycja w książce' }).fill('4');
  await expect(status(page)).toHaveText('100%zdanie 5 z 5');
  await expect.poll(async () => (await storedBooks(page)).find((b) => b.format === 'TXT')?.pos).toBe(4);

  // Back to the library: the book is on top with its progress.
  await page.getByRole('button', { name: 'Biblioteka' }).click();
  await expect(page).toHaveURL(/#\/reader$/);
  await expect(page.locator('.reader-lib__book').first()).toContainText('Krótka opowieść');
  await expect(page.locator('.reader-lib__book').first()).toContainText('100%');

  // Nothing about the books went to Firestore.
  expect(Object.keys((await db.doc(`users/${account.uid}`).get()).data()).sort()).toEqual(before);
});

test('Markdown sections: the whole-page view, the table of contents and the Night theme', async ({ page }) => {
  const account = await createUser({ tag: 'reader-md', profile: { optInModules: ['reader'] } });
  await openSignedIn(page, account, '#/reader');
  await importFiles(page, [MD]);
  await expect(page.getByText('Dodano książkę.')).toBeVisible();
  await bookRow(page, 'Notatki').click();
  await expect(page.getByTestId('reader-easy-text')).toHaveText('Rozdział pierwszy');
  await expect(page.locator('.reader__easy-label')).toHaveText('Rozdział pierwszy');
  await expect(page.locator('.reader__crumb')).toHaveText('Notatki  ·  Rozdział pierwszy');

  await page.getByRole('button', { name: 'Ustawienia tekstu' }).click();
  const settings = page.getByRole('dialog', { name: 'Ustawienia' });
  await settings.getByRole('button', { name: 'Cała strona' }).click();
  await settings.getByRole('button', { name: 'Noc' }).click();
  await settings.getByRole('button', { name: 'Większy tekst' }).click();
  await expect(settings.locator('output')).toHaveText('4');
  await page.locator('.reader__scrim').click();
  await expect(settings).toHaveCount(0);
  await expect(page.locator('.reader')).toHaveAttribute('data-theme', 'night');
  const on = page.locator('.reader__sent.is-on');
  await expect(on).toHaveText(['Rozdział pierwszy']);
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(on).toHaveText(['Pierwsze zdanie.']);
  // A tap on a sentence moves there.
  await page.locator('.reader__sent', { hasText: 'Drugie zdanie.' }).click();
  await expect(on).toHaveText(['Drugie zdanie.']);

  await page.getByRole('button', { name: 'Spis' }).click();
  const toc = page.getByRole('dialog', { name: 'Spis treści' });
  await expect(toc.getByRole('button')).toHaveText(['Zamknij', 'Rozdział pierwszy', 'Rozdział drugi']);
  await toc.getByRole('button', { name: 'Rozdział drugi' }).click();
  await expect(toc).toHaveCount(0);
  await expect(page.locator('.reader__crumb')).toHaveText('Notatki  ·  Rozdział drugi');
  await expect(on).toHaveText(['Rozdział drugi']);
  await page.keyboard.press('ArrowRight');
  await expect(on).toHaveText(['Trzecie zdanie jest ostatnie.']);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('To koniec książki.')).toBeVisible();

  // Settings are the device's: a reload keeps the view, theme and size.
  await expect.poll(async () => (await storedBooks(page))[0]?.pos).toBe(4);
  await page.reload();
  await expect(page.locator('.reader')).toHaveAttribute('data-theme', 'night');
  await expect(page.locator('.reader__sent.is-on')).toHaveText(['Trzecie zdanie jest ostatnie.']);

  // Auto goes on to the next section by itself.
  await page.getByRole('button', { name: 'Spis' }).click();
  await page.getByRole('dialog', { name: 'Spis treści' }).getByRole('button', { name: 'Rozdział pierwszy' }).click();
  await page.getByRole('button', { name: 'Auto' }).click();
  await expect(page.locator('.reader__w.is-now')).toHaveText('Rozdział');
  await page.getByRole('slider', { name: 'Tempo czytania' }).fill('900');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.reader__crumb')).toHaveText('Notatki  ·  Rozdział drugi', { timeout: 10000 });
  await expect(page.getByText('To koniec książki.')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.reader__w.is-now')).toHaveText('ostatnie.');
});

test('imports a PDF and an EPUB; a scan, an unknown format and an empty file get their own message; two taps delete', async ({ page }) => {
  const account = await createUser({ tag: 'reader-formats', profile: { optInModules: ['reader'] } });
  await openSignedIn(page, account, '#/reader');
  const pdf = makePdf([
    ['To jest pierwsza strona dokumentu, ktora ma tekst', 'i zdanie, ktore trwa na', '1'],
    ['nastepnej stronie.', 'Nowe zdanie na drugiej stronie, ktore jest dosc dlugie.'],
  ]);
  const scan = makePdf([[]]);
  await importFiles(page, [
    { name: 'dokument.pdf', mimeType: 'application/pdf', buffer: pdf },
    await makeEpub(),
    { name: 'skan.pdf', mimeType: 'application/pdf', buffer: scan },
    { name: 'tabela.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') },
    { name: 'pusty.txt', mimeType: 'text/plain', buffer: Buffer.from('  \n\n ') },
  ]);
  await seeToast(page, 'skan.pdf: Ten PDF nie ma warstwy tekstowej (to prawdopodobnie skan). Potrzebny jest PDF z zaznaczalnym tekstem.');
  await seeToast(page, 'tabela.docx: Nieobsługiwany format: .docx (obsługuję PDF, EPUB, TXT, MD).');
  await seeToast(page, 'pusty.txt: Nie znalazłem w pliku żadnego tekstu.');
  await seeToast(page, 'Dodano książek: 2.');
  await expect.poll(async () => (await storedBooks(page)).map((b) => `${b.format} ${b.title} ${b.total}`).sort()).toEqual([
    'EPUB Mała książka 5',
    // The page number is dropped; the sentence cut by the page break goes back to page 1.
    'PDF dokument 2',
  ]);

  await bookRow(page, 'dokument').click();
  await page.getByRole('button', { name: 'Normalny' }).click();
  await expect(page.locator('.reader__scroller--normal p')).toHaveText([
    'To jest pierwsza strona dokumentu, ktora ma tekst i zdanie, ktore trwa na nastepnej stronie.',
    'Nowe zdanie na drugiej stronie, ktore jest dosc dlugie.',
  ]);
  await page.getByRole('button', { name: 'Spis' }).click();
  await expect(page.getByRole('dialog', { name: 'Spis treści' }).getByRole('button')).toHaveText(['Zamknij', 'Strona 1', 'Strona 2']);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Biblioteka' }).click();

  await bookRow(page, 'Mała książka').click();
  await page.getByRole('button', { name: 'Prosta' }).click();
  await expect(page.getByTestId('reader-easy-text')).toHaveText('Wstęp');
  await page.getByRole('button', { name: 'Spis' }).click();
  // The second file has no heading: it is numbered.
  await expect(page.getByRole('dialog', { name: 'Spis treści' }).getByRole('button')).toHaveText(['Zamknij', 'Wstęp', 'Rozdział 2']);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Biblioteka' }).click();

  const del = page.getByRole('button', { name: 'Usuń książkę Mała książka' });
  await del.click();
  const sure = page.getByRole('button', { name: /Na pewno usunąć książkę Mała książka/ });
  await expect(sure).toHaveText('Na pewno?');
  await sure.click();
  await expect(bookRow(page, 'Mała książka')).toHaveCount(0);
  await expect.poll(async () => (await storedBooks(page)).map((b) => b.title)).toEqual(['dokument']);
});

test('Normalny follows the scroll, and a reload opens where it stopped', async ({ page }) => {
  const account = await createUser({ tag: 'reader-normal', profile: { optInModules: ['reader'] } });
  await openSignedIn(page, account, '#/reader');
  const paragraphs = Array.from({ length: 60 }, (_, i) => `Akapit numer ${i + 1} ma jedno zdanie, dość długie, żeby zająć kilka linii na telefonie.`);
  await importFiles(page, [{ name: 'Długi tekst.txt', mimeType: 'text/plain', buffer: Buffer.from(paragraphs.join('\n\n'), 'utf8') }]);
  await seeToast(page, 'Dodano książkę.');
  await bookRow(page, 'Długi tekst').click();
  await page.getByRole('button', { name: 'Normalny' }).click();
  const scroller = page.locator('.reader__scroller--normal');
  await expect(scroller.locator('p')).toHaveCount(60);
  await expect(status(page)).toHaveText('0%zdanie 1 z 60');

  // Scrolled so that paragraph 30 is at the top.
  await scroller.evaluate((el) => {
    const p = el.querySelectorAll('p')[29];
    el.scrollTo(0, p.offsetTop);
  });
  await expect(status(page)).toHaveText('49%zdanie 30 z 60');
  await expect.poll(async () => (await storedBooks(page))[0]?.pos).toBe(29);

  await page.reload();
  await expect(page.locator('.reader__scroller--normal p')).toHaveCount(60);
  await expect(status(page)).toHaveText('49%zdanie 30 z 60');
  await expect
    .poll(() =>
      page.locator('.reader__scroller--normal').evaluate((el) => {
        const top = el.querySelectorAll('p')[29].offsetTop;
        return Math.abs(el.scrollTop - (top - 12)) < 2;
      }),
    )
    .toBe(true);

  // At the very end the last sentence counts as read.
  await page.locator('.reader__scroller--normal').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(status(page)).toHaveText('100%zdanie 60 z 60');
});
