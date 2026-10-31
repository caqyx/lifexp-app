// EPUB import for the reader, loaded only when an EPUB is imported: JSZip opens the
// file, the browser's DOMParser reads its XML and HTML, and domain/reader/parse-epub
// decides the reading order, the paragraphs and the section titles. Text only:
// scripts, styles, images and the book's own table of contents are dropped.
import JSZip from 'jszip';
import { baseName, type ParsedBook, type Section } from '@/domain/reader/book';
import { BLOCK_SELECTOR, blocksToParas, dirOf, epubSection, resolvePath, spineItems, type ManifestItem } from '@/domain/reader/parse-epub';
import { normSpace } from '@/domain/reader/sentences';
import { ReaderImportError } from './reader-errors';

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function zipFile(zip: JSZip, path: string): JSZip.JSZipObject | null {
  let f = zip.file(path);
  if (!f) {
    try {
      f = zip.file(decodeURIComponent(path));
    } catch {
      // A "%" that is not an escape: the name as it is was all there was to try.
    }
  }
  return f;
}

function htmlParas(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,svg,nav[epub\\:type="toc"],nav[role="doc-toc"]').forEach((n) => n.remove());
  const blocks = [...doc.body.querySelectorAll(BLOCK_SELECTOR)]
    .filter((el) => !el.querySelector(BLOCK_SELECTOR))
    .map((el) => ({ tag: el.tagName, text: el.textContent ?? '' }));
  return blocksToParas(blocks, doc.body.textContent ?? '');
}

export async function parseEpubFile(file: File, onProgress: (p: number) => void): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer()).catch((err: unknown) => {
    throw new ReaderImportError('unreadable', err instanceof Error ? err.message : String(err));
  });
  const xml = async (path: string) => {
    const f = zipFile(zip, path);
    if (!f) throw new ReaderImportError('brokenEpub', path);
    return new DOMParser().parseFromString(await f.async('string'), 'application/xml');
  };
  const container = await xml('META-INF/container.xml');
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath) throw new ReaderImportError('noOpf');
  const opf = await xml(opfPath);
  const opfDir = dirOf(opfPath);
  const all = [...opf.getElementsByTagName('*')];
  const title = normSpace(all.find((e) => e.localName === 'title')?.textContent ?? '') || baseName(file.name);
  const manifest: ManifestItem[] = all
    .filter((e) => e.localName === 'item')
    .map((e) => ({ id: e.getAttribute('id') ?? '', href: e.getAttribute('href') ?? '', mediaType: e.getAttribute('media-type') ?? '' }));
  const spine = spineItems(
    manifest,
    all.filter((e) => e.localName === 'itemref').map((e) => e.getAttribute('idref') ?? ''),
  );
  const sections: Section[] = [];
  for (let i = 0; i < spine.length; i++) {
    const item = spine[i] as ManifestItem;
    const f = zipFile(zip, resolvePath(opfDir, item.href));
    if (f) {
      const section = epubSection(htmlParas(await f.async('string')), sections.length);
      if (section) sections.push(section);
    }
    if (i % 2 === 0) {
      onProgress((i + 1) / spine.length);
      await nextFrame();
    }
  }
  return { title, format: 'EPUB', sections };
}
