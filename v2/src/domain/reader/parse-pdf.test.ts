import { describe, expect, it } from 'vitest';
import { itemsToLines, linesToParagraphs, looksScanned, mergeAcrossPages, pdfSections, type PdfTextItem } from './parse-pdf';

/** A text piece at (x, y), 10 pt high, `width` wide (default: 5 per character). */
const item = (str: string, x: number, y: number, width = str.length * 5): PdfTextItem => ({
  str,
  transform: [10, 0, 0, 10, x, y],
  width,
  height: 10,
});

describe('itemsToLines', () => {
  it('groups pieces on one baseline into a line, with a space where there is a gap', () => {
    const lines = itemsToLines([item('Ala', 50, 700), item('ma', 70, 700), item('kota', 50, 686)]);
    expect(lines.map((l) => l.text)).toEqual(['Ala ma', 'kota']);
    expect(lines[0]).toMatchObject({ x: 50, y: 700, end: 80 });
  });

  it('adds no space between pieces that touch', () => {
    expect(itemsToLines([item('Zda', 50, 700), item('nie', 65, 700)]).map((l) => l.text)).toEqual(['Zdanie']);
  });

  it('drops page-number lines and items without text', () => {
    const lines = itemsToLines([item('Tekst.', 50, 700), { type: 'beginMarkedContent' }, item('12', 300, 40), item('- 13 -', 300, 30)]);
    expect(lines.map((l) => l.text)).toEqual(['Tekst.']);
  });
});

/** Lines of `width` at the usual 14 pt spacing, starting from y = 700; '' adds an extra gap. */
function page(...rows: (string | [string, number])[]) {
  let y = 700;
  const items: PdfTextItem[] = [];
  for (const row of rows) {
    if (row === '') {
      y -= 14;
      continue;
    }
    const [text, width] = typeof row === 'string' ? [row, 400] : row;
    items.push(item(text, 50, y, width));
    y -= 14;
  }
  return linesToParagraphs(itemsToLines(items));
}

describe('linesToParagraphs', () => {
  it('joins lines into a paragraph and splits at a wider gap', () => {
    expect(page('Pierwsza linia', 'druga linia.', '', 'Nowy akapit', 'dalej.', 'jeszcze', 'i koniec')).toEqual([
      'Pierwsza linia druga linia.',
      'Nowy akapit dalej. jeszcze i koniec',
    ]);
  });

  it('ends a paragraph at a short line that ends a sentence', () => {
    expect(page('Długa linia tekstu', ['krótka.', 100], 'Następny akapit', 'trwa.')).toEqual([
      'Długa linia tekstu krótka.',
      'Następny akapit trwa.',
    ]);
  });

  it('joins a word hyphenated across lines, but not before a capital', () => {
    expect(page('To jest przy-', 'kład podziału i Polsko-', 'Litwa razem.')).toEqual(['To jest przykład podziału i Polsko- Litwa razem.']);
  });

  it('gives nothing for an empty page', () => {
    expect(linesToParagraphs([])).toEqual([]);
  });
});

describe('mergeAcrossPages', () => {
  it('brings a sentence that runs onto the next page back to its page', () => {
    expect(mergeAcrossPages([['Zdanie, które', 'trwa na'], ['następnej stronie.', 'Nowe.'], ['Inne.']])).toEqual([
      ['Zdanie, które', 'trwa na następnej stronie.'],
      ['Nowe.'],
      ['Inne.'],
    ]);
  });

  it('leaves pages that end a sentence or start with a capital', () => {
    const pages = [['Koniec.'], ['dalej'], ['Bez kropki'], ['Wielka litera.'], ['Dwukropek:'], ['mała']];
    expect(mergeAcrossPages(pages.map((p) => [...p]))).toEqual(pages);
  });

  it('skips empty pages', () => {
    expect(mergeAcrossPages([[], ['mała litera']])).toEqual([[], ['mała litera']]);
  });
});

describe('looksScanned / pdfSections', () => {
  it('a PDF with (almost) no text is a scan', () => {
    expect(looksScanned([[], ['12345']])).toBe(true);
    expect(looksScanned([['To jest strona z tekstem, który da się zaznaczyć.']])).toBe(false);
  });

  it('pages become numbered sections; empty pages are left out', () => {
    expect(pdfSections([['A.'], [], ['B.']])).toEqual([
      { title: '', label: { kind: 'page', n: 1 }, paras: [{ t: 'A.', h: 0 }] },
      { title: '', label: { kind: 'page', n: 3 }, paras: [{ t: 'B.', h: 0 }] },
    ]);
  });
});
