import { describe, expect, it } from 'vitest';
import { blocksToParas, dirOf, epubSection, markToc, resolvePath, spineItems, tableFromCells, tocPaths } from './parse-epub';

describe('resolvePath', () => {
  it('resolves relative to the OPF folder, drops the fragment', () => {
    expect(resolvePath('OEBPS/', 'Text/ch1.xhtml#start')).toBe('OEBPS/Text/ch1.xhtml');
    expect(resolvePath('OEBPS/Text/', '../Images/../Text/./ch2.xhtml')).toBe('OEBPS/Text/ch2.xhtml');
    expect(resolvePath('', 'ch3.html')).toBe('ch3.html');
    expect(resolvePath('a/', '../../x.html')).toBe('x.html');
  });
});

describe('dirOf', () => {
  it('the folder with its slash, or nothing', () => {
    expect(dirOf('OEBPS/content.opf')).toBe('OEBPS/');
    expect(dirOf('content.opf')).toBe('');
  });
});

describe('spineItems', () => {
  it('reading order from the spine, only (X)HTML documents', () => {
    const manifest = [
      { id: 'css', href: 'style.css', mediaType: 'text/css' },
      { id: 'c2', href: 'c2.xhtml', mediaType: 'application/xhtml+xml' },
      { id: 'c1', href: 'c1.html', mediaType: 'text/html' },
      { id: 'img', href: 'a.png', mediaType: 'image/png' },
    ];
    expect(spineItems(manifest, ['c1', 'missing', 'img', 'c2']).map((m) => m.id)).toEqual(['c1', 'c2']);
  });
});

describe('blocksToParas', () => {
  it('blocks as paragraphs, headings marked, empty blocks dropped', () => {
    expect(
      blocksToParas(
        [
          { tag: 'H2', text: ' Rozdział\n 1 ' },
          { tag: 'p', text: 'Tekst  akapitu.' },
          { tag: 'DIV', text: '   ' },
          { tag: 'li', text: 'Punkt.' },
        ],
        'ignored',
      ),
    ).toEqual([
      { t: 'Rozdział 1', h: 1 },
      { t: 'Tekst akapitu.', h: 0 },
      { t: 'Punkt.', h: 0 },
    ]);
  });

  it('without blocks, the text line by line', () => {
    expect(blocksToParas([], 'Linia jeden\n\n  Linia dwa  \n')).toEqual([
      { t: 'Linia jeden', h: 0 },
      { t: 'Linia dwa', h: 0 },
    ]);
  });
});

describe('epubSection', () => {
  it('titled by its first short heading', () => {
    const paras = [
      { t: 'x'.repeat(130), h: 1 as const },
      { t: 'Rozdział drugi', h: 1 as const },
      { t: 'Tekst.', h: 0 as const },
    ];
    expect(epubSection(paras, 4)).toEqual({ title: 'Rozdział drugi', label: null, paras });
  });

  it('numbered by the sections kept so far when it has no heading', () => {
    expect(epubSection([{ t: 'Tekst.', h: 0 }], 2)).toMatchObject({ title: '', label: { kind: 'chapter', n: 3 } });
  });

  it('a file with (almost) no text is no section', () => {
    expect(epubSection([{ t: 'ab', h: 0 }], 0)).toBeNull();
    expect(epubSection([], 0)).toBeNull();
  });
});

describe('tocPaths / markToc', () => {
  it('the guide\'s and the landmarks\' "toc" references, resolved', () => {
    expect(
      tocPaths([
        { type: 'toc', href: 'Text/toc.xhtml#x', base: 'OEBPS/' },
        { type: 'cover', href: 'Text/cover.xhtml', base: 'OEBPS/' },
        { type: 'bodymatter toc', href: '../Text/contents.xhtml', base: 'OEBPS/Nav/' },
      ]),
    ).toEqual(['OEBPS/Text/toc.xhtml', 'OEBPS/Text/contents.xhtml']);
  });

  it('marks, never drops', () => {
    expect(markToc([{ t: 'A', h: 0 }])).toEqual([{ t: 'A', h: 0, toc: 1 }]);
  });

  it('blocks inside the file\'s <nav> are marked', () => {
    expect(blocksToParas([{ tag: 'li', text: 'Rozdział 1', toc: true }, { tag: 'p', text: 'Tekst.' }], '')).toEqual([
      { t: 'Rozdział 1', h: 0, toc: 1 },
      { t: 'Tekst.', h: 0 },
    ]);
  });
});

describe('EPUB tables and pictures', () => {
  it('a table and a picture become elements in their place', () => {
    const table = tableFromCells([
      [
        { th: true, text: 'Kraj', span: 1 },
        { th: true, text: 'Stolica', span: 1 },
      ],
      [
        { th: false, text: ' Polska ', span: 1 },
        { th: false, text: 'Warszawa', span: 1 },
      ],
      [{ th: false, text: 'Razem', span: 2 }],
    ]);
    expect(table).toEqual({
      rows: [[{ t: 'Kraj' }, { t: 'Stolica' }], [{ t: 'Polska' }, { t: 'Warszawa' }], [{ t: 'Razem', span: 2 }]],
      header: true,
    });
    const paras = blocksToParas(
      [
        { tag: 'p', text: 'Przed.' },
        { tag: 'table', text: '', table },
        { tag: 'img', text: '', image: { asset: 'a1', w: 40, h: 30, alt: 'Mapa' } },
        { tag: 'p', text: 'Po.' },
      ],
      '',
    );
    expect(paras.map((p) => p.el?.kind ?? p.t)).toEqual(['Przed.', 'table', 'image', 'Po.']);
    expect(paras[2]?.el).toEqual({ kind: 'image', asset: 'a1', w: 40, h: 30, alt: 'Mapa' });
  });

  it('a file with only a picture is still a section', () => {
    expect(epubSection([{ t: '', h: 0, el: { kind: 'image', asset: 'a', w: 1, h: 1, alt: '' } }], 0)).not.toBeNull();
  });
});
