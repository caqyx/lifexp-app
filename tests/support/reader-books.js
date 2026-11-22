// Books made for the reader's tests (rows r-5, r-6): PDFs written by hand (text, a ruled
// table, an image, a framed box), an EPUB with a picture and a table, and helpers that
// read or age the reader's IndexedDB. Generated content only.
const path = require('path');
const zlib = require('zlib');
const { expect } = require('./v2');
const JSZip = require(path.join(__dirname, '..', '..', 'v2', 'node_modules', 'jszip'));

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
    async (name) => {
      const dbName = (await indexedDB.databases()).map((d) => d.name).find((n) => n && n.startsWith('lifexp-v2-reader:'));
      return new Promise((resolve, reject) => {
        const open = indexedDB.open(dbName);
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
      });
    },
    store,
  );
}

/** Makes every stored book look as if added before r-5 (no parser version, no pictures, no kept file). */
function makeBooksOld(page) {
  return page.evaluate(
    async () => {
      const dbName = (await indexedDB.databases()).map((d) => d.name).find((n) => n && n.startsWith('lifexp-v2-reader:'));
      return new Promise((resolve, reject) => {
        const open = indexedDB.open(dbName);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['meta', 'assets', 'files'], 'readwrite');
          const metas = tx.objectStore('meta');
          metas.getAll().onsuccess = (e) => {
            for (const m of e.target.result) {
              delete m.parser;
              delete m.originalSize;
              metas.put(m);
            }
          };
          tx.objectStore('assets').clear();
          tx.objectStore('files').clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
  );
}

const bookRow = (page, title) => page.locator('.reader-lib__open', { hasText: title });

async function seeToast(page, message) {
  const toast = page.getByText(message);
  await expect(toast).toBeVisible({ timeout: 20000 });
  await toast.click();
}

const shot = (page, name) => (SHOTS ? page.screenshot({ path: path.join(SHOTS, name) }) : Promise.resolve());


module.exports = { makePdf, text, lines, elementsPdf, png, elementsEpub, storeKeys, makeBooksOld, bookRow, seeToast, shot, SHOTS };
