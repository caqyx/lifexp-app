import { describe, expect, it } from 'vitest';
import type { PdfTextItem } from './parse-pdf';
import { mergeParasAcrossPages, pdfParaSections } from './parse-pdf';
import { clusterValues, findRules, isFormula, layoutPage, rectOf, type PdfPageInput, type PdfPath, type Rect } from './pdf-layout';

const item = (str: string, x: number, y: number, w = str.length * 5, h = 10): PdfTextItem => ({ str, transform: [h, 0, 0, h, x, y], width: w, height: h });
const line = (x1: number, y1: number, x2: number, y2: number): PdfPath => ({
  segs: [{ x1, y1, x2, y2 }],
  box: rectOf(x1, y1, x2, y2),
  stroke: true,
  fill: false,
  curves: false,
  rect: false,
});
const rectPath = (r: Rect, stroke = true, fill = false): PdfPath => ({
  segs: [
    { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y },
    { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h },
    { x1: r.x + r.w, y1: r.y + r.h, x2: r.x, y2: r.y + r.h },
    { x1: r.x, y1: r.y + r.h, x2: r.x, y2: r.y },
  ],
  box: r,
  stroke,
  fill,
  curves: false,
  rect: true,
});
const page = (over: Partial<PdfPageInput>): PdfPageInput => ({ width: 600, height: 800, items: [], images: [], paths: [], ...over });

/** A 3 × 3 ruled grid from x 100–400, y 640–700, rows 20 high. */
function grid(skipInnerVerticalInTopRow = false): PdfPath[] {
  const paths = [700, 680, 660, 640].map((y) => line(100, y, 400, y));
  for (const x of [100, 200, 300, 400]) {
    if (skipInnerVerticalInTopRow && x === 200) {
      paths.push(line(x, 640, x, 680));
    } else paths.push(line(x, 640, x, 700));
  }
  return paths;
}

const cellItems = () => [
  item('Imię', 110, 686),
  item('Wiek', 210, 686),
  item('Miasto', 310, 686),
  item('Ala', 110, 666),
  item('7', 210, 666),
  item('Łódź', 310, 666),
  item('Ola', 110, 646),
  item('9', 210, 646),
  item('Kraków', 310, 646),
];

describe('clusterValues / findRules', () => {
  it('joins close values', () => {
    expect(clusterValues([10, 11, 50, 49.5, 100], 2)).toEqual([10.5, 49.75, 100]);
  });
  it('finds rules from strokes and from thin filled boxes', () => {
    const rules = findRules([line(0, 10, 100, 10), line(5, 0, 5, 50), rectPath({ x: 0, y: 100, w: 200, h: 1 }, false, true), rectPath({ x: 0, y: 200, w: 50, h: 50 })]);
    expect(rules.h.length).toBeGreaterThanOrEqual(2);
    expect(rules.v.length).toBeGreaterThanOrEqual(1);
  });
});

describe('layoutPage: tables', () => {
  it('rebuilds a ruled 3 × 3 table with its header, between paragraphs', () => {
    const blocks = layoutPage(page({ paths: grid(), items: [item('Tekst przed tabelą.', 100, 740), ...cellItems(), item('Tekst po tabeli.', 100, 600)] }));
    expect(blocks.map((b) => b.kind)).toEqual(['text', 'table', 'text']);
    const table = blocks[1];
    expect(table?.kind === 'table' && table.rows.map((r) => r.map((c) => c.t))).toEqual([
      ['Imię', 'Wiek', 'Miasto'],
      ['Ala', '7', 'Łódź'],
      ['Ola', '9', 'Kraków'],
    ]);
    expect(table?.kind === 'table' && table.header).toBe(true);
  });

  it('a row with no rule between two cells merges them (span)', () => {
    const items = [item('Nagłówek wspólny', 110, 686, 150), item('Miasto', 310, 686), ...cellItems().slice(3)];
    const blocks = layoutPage(page({ paths: grid(true), items }));
    const table = blocks.find((b) => b.kind === 'table');
    expect(table?.kind === 'table' && table.rows[0]).toEqual([{ t: 'Nagłówek wspólny', span: 2 }, { t: 'Miasto' }]);
    expect(table?.kind === 'table' && table.rows[1]?.length).toBe(3);
  });

  it('a table ruled only above, below and under the header: rows from the lines of text, columns from alignment', () => {
    const paths = [700, 680, 620].map((y) => line(100, y, 400, y));
    const items = [
      item('Rok', 110, 686),
      item('Wynik', 250, 686),
      item('2021', 110, 666),
      item('12', 250, 666),
      item('2022', 110, 646),
      item('15', 250, 646),
      item('2023', 110, 626),
      item('19', 250, 626),
    ];
    const blocks = layoutPage(page({ paths, items }));
    const table = blocks.find((b) => b.kind === 'table');
    expect(table?.kind === 'table' && table.rows.map((r) => r.map((c) => c.t))).toEqual([
      ['Rok', 'Wynik'],
      ['2021', '12'],
      ['2022', '15'],
      ['2023', '19'],
    ]);
  });

  it('a table without any rules: column-aligned runs of text', () => {
    const items = [
      item('Produkt', 100, 700),
      item('Cena', 300, 700),
      item('Ilość', 420, 700),
      item('Chleb', 100, 685),
      item('4,50', 300, 685),
      item('2', 420, 685),
      item('Mleko', 100, 670),
      item('3,20', 300, 670),
      item('1', 420, 670),
      item('Zwykły akapit pod tabelą, długi na całą szerokość strony.', 100, 640, 400),
    ];
    const blocks = layoutPage(page({ items }));
    expect(blocks.map((b) => b.kind)).toEqual(['table', 'text']);
    const table = blocks[0];
    expect(table?.kind === 'table' && table.rows.map((r) => r.map((c) => c.t))).toEqual([
      ['Produkt', 'Cena', 'Ilość'],
      ['Chleb', '4,50', '2'],
      ['Mleko', '3,20', '1'],
    ]);
  });

  it('a grid it cannot fill with text becomes a picture of its region', () => {
    const blocks = layoutPage(page({ paths: grid(), items: [item('x', 110, 686)] }));
    expect(blocks).toEqual([{ kind: 'region', box: expect.any(Object), reason: 'table' }]);
  });
});

describe('layoutPage: pictures, frames, formulas', () => {
  it('an image is a region in its place; text inside it (labels) belongs to it', () => {
    const blocks = layoutPage(
      page({
        images: [{ x: 100, y: 500, w: 300, h: 200 }],
        items: [item('Akapit nad obrazkiem.', 100, 740), item('etykieta', 150, 600), item('Akapit pod obrazkiem.', 100, 460)],
      }),
    );
    expect(blocks).toEqual([
      { kind: 'text', paras: ['Akapit nad obrazkiem.'] },
      { kind: 'region', box: { x: 100, y: 500, w: 300, h: 200 }, reason: 'image' },
      { kind: 'text', paras: ['Akapit pod obrazkiem.'] },
    ]);
  });

  it('tiny images (ornaments) are not pictures', () => {
    expect(layoutPage(page({ images: [{ x: 10, y: 10, w: 8, h: 8 }], items: [item('Tekst.', 100, 700)] })).map((b) => b.kind)).toEqual(['text']);
  });

  it('a drawing of curves (a chart) is a region with its labels', () => {
    const curve = (x: number, y: number): PdfPath => ({ segs: [{ x1: x, y1: y, x2: x + 30, y2: y + 30 }], box: { x, y, w: 30, h: 30 }, stroke: true, fill: false, curves: true, rect: false });
    const blocks = layoutPage(page({ paths: [curve(100, 500), curve(125, 520), curve(150, 540), curve(175, 560)], items: [item('oś X', 130, 530), item('Opis wykresu.', 100, 450)] }));
    expect(blocks.map((b) => (b.kind === 'region' ? b.reason : b.kind))).toEqual(['drawing', 'text']);
  });

  it('a box drawn around text is a frame that keeps the text', () => {
    const blocks = layoutPage(
      page({
        paths: [rectPath({ x: 90, y: 560, w: 320, h: 80 })],
        items: [item('Przed ramką.', 100, 700), item('Uwaga: to jest ważne.', 100, 610, 200), item('Po ramce.', 100, 500)],
      }),
    );
    expect(blocks).toEqual([
      { kind: 'text', paras: ['Przed ramką.'] },
      { kind: 'frame', paras: ['Uwaga: to jest ważne.'] },
      { kind: 'text', paras: ['Po ramce.'] },
    ]);
  });

  it('a page-size background is not a frame', () => {
    expect(layoutPage(page({ paths: [rectPath({ x: 0, y: 0, w: 600, h: 800 }, false, true)], items: [item('Tekst.', 100, 700)] })).map((b) => b.kind)).toEqual(['text']);
  });

  it('a formula line is a picture; prose with an equals sign is not', () => {
    expect(isFormula('x = (a + b) / 2')).toBe(true);
    expect(isFormula('∑ xᵢ ≤ n²')).toBe(true);
    expect(isFormula('Wynik równania wynosi = dwa')).toBe(false);
    expect(isFormula('Ala ma kota.')).toBe(false);
    const blocks = layoutPage(page({ items: [item('Wzór:', 100, 700), item('E = m · c ^ 2', 150, 680), item('Koniec.', 100, 650)] }));
    expect(blocks.map((b) => (b.kind === 'region' ? b.reason : b.kind))).toEqual(['text', 'formula', 'text']);
  });
});

describe('mergeParasAcrossPages / pdfParaSections', () => {
  it('joins a sentence cut by the page break, never across an element or a frame', () => {
    const img = { kind: 'image' as const, asset: 'a1', w: 10, h: 10, alt: '' };
    expect(mergeParasAcrossPages([[{ t: 'Zdanie, które', h: 0 }], [{ t: 'trwa dalej.', h: 0 }]])).toEqual([[{ t: 'Zdanie, które trwa dalej.', h: 0 }], []]);
    const withEl = [[{ t: '', h: 0 as const, el: img }], [{ t: 'mała litera', h: 0 as const }]];
    expect(mergeParasAcrossPages(withEl.map((p) => [...p]))).toEqual(withEl);
    const framed = [[{ t: 'w ramce', h: 0 as const, frame: 1 }], [{ t: 'dalej', h: 0 as const }]];
    expect(mergeParasAcrossPages(framed.map((p) => [...p]))).toEqual(framed);
  });

  it('pages are sections, empty ones left out', () => {
    expect(pdfParaSections([[{ t: 'A.', h: 0 }], []]).map((s) => s.label)).toEqual([{ kind: 'page', n: 1 }]);
  });
});
