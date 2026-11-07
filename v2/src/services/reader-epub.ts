// EPUB import for the reader, loaded only when an EPUB is imported: JSZip opens the
// file, the browser's DOMParser reads its XML and HTML, and domain/reader/parse-epub
// decides the reading order, the paragraphs and the section titles. Text only:
// scripts, styles, images and the book's own table of contents are dropped.
import JSZip from 'jszip';
import { baseName, type ParsedBook, type Section } from '@/domain/reader/book';
import {
  BLOCK_SELECTOR,
  blocksToParas,
  dirOf,
  epubSection,
  markToc,
  resolvePath,
  spineItems,
  tocPaths,
  type EpubReference,
  type ManifestItem,
} from '@/domain/reader/parse-epub';
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
  doc.querySelectorAll('script,style,svg').forEach((n) => n.remove());
  // The book's own navigation (its table of contents, landmarks) stays, marked (domain/reader/toc).
  const blocks = [...doc.body.querySelectorAll(BLOCK_SELECTOR)]
    .filter((el) => !el.querySelector(BLOCK_SELECTOR))
    .map((el) => ({ tag: el.tagName, text: el.textContent ?? '', toc: el.closest('nav') !== null }));
  return blocksToParas(blocks, doc.body.textContent ?? '');
}

/** Files the book calls its table of contents: the OPF guide's and the nav document's landmarks. */
async function tocReferences(zip: JSZip, opfElements: Element[], manifest: ManifestItem[], opfDir: string): Promise<string[]> {
  const refs: EpubReference[] = opfElements
    .filter((e) => e.localName === 'reference')
    .map((e) => ({ type: e.getAttribute('type') ?? '', href: e.getAttribute('href') ?? '', base: opfDir }));
  const nav = manifest.find((m) => /(^|\s)nav(\s|$)/.test(m.properties ?? ''));
  if (nav) {
    const navPath = resolvePath(opfDir, nav.href);
    const f = zipFile(zip, navPath);
    if (f) {
      const doc = new DOMParser().parseFromString(await f.async('string'), 'text/html');
      doc.querySelectorAll('nav a').forEach((a) => {
        const type = a.getAttribute('epub:type') ?? '';
        const inLandmarks = (a.closest('nav')?.getAttribute('epub:type') ?? '').split(/\s+/).includes('landmarks');
        if (inLandmarks) refs.push({ type, href: a.getAttribute('href') ?? '', base: dirOf(navPath) });
      });
    }
  }
  return tocPaths(refs);
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
    .map((e) => ({
      id: e.getAttribute('id') ?? '',
      href: e.getAttribute('href') ?? '',
      mediaType: e.getAttribute('media-type') ?? '',
      properties: e.getAttribute('properties') ?? '',
    }));
  const spine = spineItems(
    manifest,
    all.filter((e) => e.localName === 'itemref').map((e) => e.getAttribute('idref') ?? ''),
  );
  const tocFiles = new Set(await tocReferences(zip, all, manifest, opfDir));
  const sections: Section[] = [];
  for (let i = 0; i < spine.length; i++) {
    const item = spine[i] as ManifestItem;
    const path = resolvePath(opfDir, item.href);
    const f = zipFile(zip, path);
    if (f) {
      const paras = htmlParas(await f.async('string'));
      const isToc = tocFiles.has(path) || /(^|\s)nav(\s|$)/.test(item.properties ?? '');
      const section = epubSection(isToc ? markToc(paras) : paras, sections.length);
      if (section) sections.push(section);
    }
    if (i % 2 === 0) {
      onProgress((i + 1) / spine.length);
      await nextFrame();
    }
  }
  return { title, format: 'EPUB', sections };
}
