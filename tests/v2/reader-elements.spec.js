// The reader's book elements (docs/v2/PLAN.md 9.1, row r-5): a PDF made here with a
// ruled table, a painted image, a framed box and running text shows the table as a
// table, the image as a picture and the box as a frame (ramka), in every view; sentence
// stepping goes past them. An EPUB keeps its <img> and <table>. A book added before
// r-5 can be read again from its file (Przetwórz ponownie). Generated files only.
const path = require('path');
const zlib = require('zlib');
const { createUser } = require('../support/emulator');
const { test, expect, openSignedIn } = require('../support/v2');
const JSZip = require(path.join(__dirname, '..', '..', 'v2', 'node_modules', 'jszip'));

test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

const SHOTS = process.env.READER_SHOTS || '';

/** A PDF from raw content streams (one per page), Helvetica as F1 and a 4 × 4 RGB image as Im1. */
function makePdf(pageStreams) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add(null);
  const pagesObj = add(null);
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  // A small picture: four coloured bands (its colours must stay as they are in Noc).
  const px = [];
  const colours = [
    [200, 40, 40],
    [40, 160, 60],
    [40, 80, 200],
    [230, 190, 30],
  ];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) px.push(...colours[(x + y) % 4]);
  const imgData = String.fromCharCode(...px);
  const image = add(`<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${imgData.length} >>\nstream\n${imgData}\nendstream`);
  const kids = [];
  for (const stream of pageStreams) {
    const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    kids.push(
      add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im1 ${image} 0 R >> >> /Contents ${content} 0 R >>`),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const text = (x, y, s, size = 12) => `BT /F1 ${size} Tf ${x} ${y} Td (${s.replace(/[()\\]/g, '\\$&')}) Tj ET`;
const lines = (x, y, rows, size = 12, lead = 16) => rows.map((r, k) => text(x, y - k * lead, r, size));

/** Page 1: text, a ruled 3 × 3 table, text, an image, text, a framed box, text. Page 2: plain text. */
function elementsPdf(morePages = 0) {
  const grid = [];
  for (const y of [620, 600, 580, 560]) grid.push(`72 ${y} m 372 ${y} l S`);
  for (const x of [72, 172, 272, 372]) grid.push(`${x} 560 m ${x} 620 l S`);
  const cells = [
    ['Miasto', 'Rok', 'Wynik'],
    ['Lodz', '2021', '12'],
    ['Krakow', '2022', '15'],
  ];
  const cellText = cells.flatMap((row, r) => row.map((c, k) => text(80 + k * 100, 606 - r * 20, c, 10)));
  const page1 = [
    ...lines(72, 740, ['Tekst przed tabela jest pierwszym akapitem tej strony.', 'Drugie zdanie akapitu konczy go tutaj.']),
    '0.8 w',
    ...grid,
    ...cellText,
    ...lines(72, 530, ['Tekst po tabeli prowadzi do obrazka ponizej.']),
    'q 240 0 0 140 72 360 cm /Im1 Do Q',
    ...lines(72, 330, ['Akapit pod obrazkiem opisuje go krotko.']),
    '72 230 320 56 re S',
    ...lines(84, 262, ['Uwaga: to jest ramka z waznym zdaniem.']),
    ...lines(72, 190, ['Koniec pierwszej strony jest tutaj.']),
  ].join('\n');
  const page2 = lines(72, 740, ['Druga strona ma zwykly tekst.', 'I jeszcze jedno zdanie na koniec.']).join('\n');
  // Longer books (for the spread): pages of ordinary paragraphs after these two.
  const more = Array.from({ length: morePages }, (_, n) =>
    Array.from({ length: 10 }, (_, k) => lines(72, 740 - k * 64, [`Akapit ${k + 1} strony ${n + 3} ma kilka slow, zeby zajac miejsce.`, 'Drugie zdanie tego akapitu tez jest dlugie i spokojne.'])).flat().join('\n'),
  );
  return { name: 'elementy.pdf', mimeType: 'application/pdf', buffer: makePdf([page1, page2, ...more]) };
}

/** A tiny PNG (solid colour), for the EPUB's picture. */
function png(w, h, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function elementsEpub() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    'OEBPS/content.opf',
    '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Ksiazka z obrazkiem</dc:title></metadata>' +
      '<manifest><item id="c1" href="Text/c1.xhtml" media-type="application/xhtml+xml"/><item id="i1" href="Images/kot.png" media-type="image/png"/></manifest>' +
      '<spine><itemref idref="c1"/></spine></package>',
  );
  zip.file(
    'OEBPS/Text/c1.xhtml',
    '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>' +
      '<h1>Rozdział</h1><p>Akapit przed obrazkiem.</p>' +
      '<figure><img src="../Images/kot.png" alt="Rudy kot"/></figure>' +
      '<p>Akapit przed tabelą.</p>' +
      '<table><tr><th>Imię</th><th>Wiek</th></tr><tr><td>Ala</td><td>7</td></tr><tr><td colspan="2">Razem dwoje</td></tr></table>' +
      '<p>Ostatni akapit.</p></body></html>',
  );
  zip.file('OEBPS/Images/kot.png', png(60, 40, [220, 120, 30]));
  return { name: 'obrazek.epub', mimeType: 'application/epub+zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) };
}

/** Records of one store of the reader's IndexedDB. */
function storeKeys(page, store) {
  return page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('lifexp-v2-reader');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(name).objectStore(name).getAllKeys();
          req.onsuccess = () => {
            resolve(req.result.map(String));
            db.close();
          };
          req.onerror = () => reject(req.error);
        };
      }),
    store,
  );
}

/** Makes every stored book look as if added before r-5 (no parser version, no pictures). */
function makeBooksOld(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('lifexp-v2-reader');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['meta', 'assets'], 'readwrite');
          const metas = tx.objectStore('meta');
          metas.getAll().onsuccess = (e) => {
            for (const m of e.target.result) {
              delete m.parser;
              metas.put(m);
            }
          };
          tx.objectStore('assets').clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

const bookRow = (page, title) => page.locator('.reader-lib__open', { hasText: title });

async function seeToast(page, message) {
  const toast = page.getByText(message);
  await expect(toast).toBeVisible({ timeout: 20000 });
  await toast.click();
}

const shot = (page, name) => (SHOTS ? page.screenshot({ path: path.join(SHOTS, name) }) : Promise.resolve());

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
