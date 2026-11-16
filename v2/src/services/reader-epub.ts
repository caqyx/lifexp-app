// EPUB import for the reader, loaded only when an EPUB is imported: JSZip opens the
// file, the browser's DOMParser reads its XML and HTML, and domain/reader/parse-epub
// decides the reading order, the paragraphs and the section titles. Text only:
// scripts, styles, images and the book's own table of contents are dropped.
import JSZip from 'jszip';
import { baseName, type Section } from '@/domain/reader/book';
import {
  BLOCK_SELECTOR,
  blocksToParas,
  dirOf,
  epubSection,
  markToc,
  resolvePath,
  spineItems,
  tableFromCells,
  tocPaths,
  type EpubReference,
  type HtmlBlock,
  type ManifestItem,
} from '@/domain/reader/parse-epub';
import { normSpace } from '@/domain/reader/sentences';
import { ReaderImportError } from './reader-errors';
import type { ParsedWithAssets, PendingAsset } from './reader-assets';

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

/** Pictures bigger than this (either side, px) are scaled down before they are stored. */
const MAX_PICTURE = 1600;

/** A picture of the book stored as is, or scaled down when big; its size in px. */
async function storePicture(blob: Blob, key: string, assets: PendingAsset[]): Promise<{ w: number; h: number } | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_PICTURE / Math.max(bitmap.width, bitmap.height));
    let out = blob;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    if (scale < 1) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h);
      out = (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))) ?? blob;
    }
    bitmap.close();
    assets.push({ key, blob: out });
    return { w, h };
  } catch {
    return null;
  }
}

const MEDIA: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

/**
 * A chapter's paragraphs, tables and pictures in document order. Text of a table belongs
 * to the table; a picture is read from the zip and stored (`assets`).
 */
async function htmlParas(html: string, zip: JSZip, dir: string, assets: PendingAsset[], next: () => string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style').forEach((n) => n.remove());
  // An inline <svg> is a drawing only when it shows a picture; its text otherwise.
  doc.querySelectorAll('svg').forEach((n) => {
    if (!n.querySelector('image')) n.remove();
  });
  const blocks: HtmlBlock[] = [];
  const units = [...doc.body.querySelectorAll(`${BLOCK_SELECTOR},img,image,table`)];
  for (const el of units) {
    const name = el.localName.toLowerCase();
    if (name !== 'table' && el.closest('table')) continue;
    if (name === 'table') {
      if (el.parentElement?.closest('table')) continue;
      const rows = [...el.querySelectorAll('tr')]
        .filter((tr) => tr.closest('table') === el)
        .map((tr) =>
          [...tr.children]
            .filter((c) => /^t[hd]$/i.test(c.tagName))
            .map((c) => ({ th: c.tagName.toLowerCase() === 'th', text: c.textContent ?? '', span: Number(c.getAttribute('colspan')) || 1 })),
        );
      blocks.push({ tag: 'table', text: '', table: tableFromCells(rows) });
      continue;
    }
    if (name === 'img' || name === 'image') {
      const src = el.getAttribute('src') ?? el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '';
      if (!src || src.startsWith('data:')) continue;
      const path = resolvePath(dir, src);
      const f = zipFile(zip, path);
      if (!f) continue;
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      const blob = new Blob([await f.async('arraybuffer')], { type: MEDIA[ext] ?? 'application/octet-stream' });
      const key = next();
      const size = await storePicture(blob, key, assets);
      if (size) blocks.push({ tag: 'img', text: '', image: { asset: key, ...size, alt: normSpace(el.getAttribute('alt') ?? '') } });
      continue;
    }
    if (el.querySelector(BLOCK_SELECTOR)) continue;
    // The book's own navigation (its table of contents, landmarks) stays, marked (domain/reader/toc).
    blocks.push({ tag: el.tagName, text: el.textContent ?? '', toc: el.closest('nav') !== null });
  }
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

export async function parseEpubFile(file: File, onProgress: (p: number) => void): Promise<ParsedWithAssets> {
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
  const assets: PendingAsset[] = [];
  let pictures = 0;
  const sections: Section[] = [];
  for (let i = 0; i < spine.length; i++) {
    const item = spine[i] as ManifestItem;
    const path = resolvePath(opfDir, item.href);
    const f = zipFile(zip, path);
    if (f) {
      const paras = await htmlParas(await f.async('string'), zip, dirOf(path), assets, () => `e${++pictures}`);
      const isToc = tocFiles.has(path) || /(^|\s)nav(\s|$)/.test(item.properties ?? '');
      const section = epubSection(isToc ? markToc(paras) : paras, sections.length);
      if (section) sections.push(section);
    }
    if (i % 2 === 0) {
      onProgress((i + 1) / spine.length);
      await nextFrame();
    }
  }
  return { title, format: 'EPUB', sections, assets };
}
