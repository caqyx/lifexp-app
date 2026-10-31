import { describe, expect, it } from 'vitest';
import { decodeText, parseText, stripMarkdown } from './parse-text';

describe('decodeText', () => {
  it('reads UTF-8', () => {
    expect(decodeText(new TextEncoder().encode('Zażółć gęślą jaźń'))).toBe('Zażółć gęślą jaźń');
  });

  it('falls back to Windows-1250 for invalid UTF-8', () => {
    // "Łódź" in Windows-1250: Ł = A3, ó = F3, d, ź = 9F.
    expect(decodeText(new Uint8Array([0xa3, 0xf3, 0x64, 0x9f]))).toBe('Łódź');
  });
});

describe('stripMarkdown', () => {
  it('drops marks and keeps text', () => {
    expect(stripMarkdown('**Gruby** i _krzywy_, `kod` i [link](http://x) ![obraz](y.png)')).toBe('Gruby i krzywy, kod i link ');
    expect(stripMarkdown('> cytat\n- punkt\n2. numer')).toBe('cytat\npunkt\nnumer');
  });
});

describe('parseText', () => {
  it('a plain text: paragraphs between blank lines, in parts, named after the file', () => {
    const book = parseText('\ufeffPierwszy akapit.\r\nCiąg dalszy.\r\n\r\nDrugi akapit.\n\nTrzeci.', 'Moja książka.txt', false);
    expect(book.title).toBe('Moja książka');
    expect(book.format).toBe('TXT');
    expect(book.sections).toEqual([
      {
        title: '',
        label: { kind: 'part', n: 1 },
        paras: [
          { t: 'Pierwszy akapit. Ciąg dalszy.', h: 0 },
          { t: 'Drugi akapit.', h: 0 },
          { t: 'Trzeci.', h: 0 },
        ],
      },
    ]);
  });

  it('a long text with no blank lines: one line is one paragraph', () => {
    const text = Array.from({ length: 12 }, (_, i) => `Linia ${i}.`).join('\n');
    const book = parseText(text, 'a.txt', false);
    expect(book.sections[0]?.paras).toHaveLength(12);
  });

  it('Markdown: # and ## open sections, deeper headings stay inside, marks dropped, code fences gone', () => {
    const md = [
      'Wstęp przed nagłówkiem.',
      '# Rozdział **1**',
      'Tekst *pierwszy*.',
      '### Podrozdział',
      '```js',
      'kod();',
      '```',
      '## Rozdział 2',
      '- punkt jeden',
    ].join('\n\n');
    const book = parseText(md, 'notatki.md', true);
    expect(book.format).toBe('MD');
    expect(book.sections.map((s) => [s.title, s.label])).toEqual([
      ['', { kind: 'start', n: 1 }],
      ['Rozdział 1', null],
      ['Rozdział 2', null],
    ]);
    expect(book.sections[1]?.paras).toEqual([
      { t: 'Rozdział 1', h: 1 },
      { t: 'Tekst pierwszy.', h: 0 },
      { t: 'Podrozdział', h: 1 },
      { t: 'kod();', h: 0 },
    ]);
    expect(book.sections[2]?.paras).toEqual([
      { t: 'Rozdział 2', h: 1 },
      { t: 'punkt jeden', h: 0 },
    ]);
  });

  it('Markdown headings in a .txt are plain text', () => {
    const book = parseText('# Nie nagłówek\n\nTekst.', 'a.txt', false);
    expect(book.sections[0]?.paras[0]).toEqual({ t: '# Nie nagłówek', h: 0 });
  });

  it('an empty file has no sections', () => {
    expect(parseText(' \n\n ', 'pusty.md', true).sections).toEqual([]);
  });
});
