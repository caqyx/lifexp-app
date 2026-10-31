// EPUB structure (the reader): container.xml names the OPF, the OPF's spine lists
// the (X)HTML files in reading order, each file is one section titled by its first
// short heading. Pure: services/reader-epub reads the zip and the DOM and passes
// plain values here.
import type { Para, Section } from './book';
import { normSpace } from './sentences';

/** `href` (relative to the folder `base`, which ends with "/" or is "") as a path in the zip; "#…" dropped, "." and ".." resolved. */
export function resolvePath(base: string, href: string): string {
  const out: string[] = [];
  for (const part of (base + (href.split('#')[0] ?? '')).split('/')) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

/** "OEBPS/content.opf" → "OEBPS/"; "content.opf" → "". */
export function dirOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
}

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
}

/** The spine's documents in reading order: unknown ids and non-(X)HTML items left out. */
export function spineItems(manifest: readonly ManifestItem[], itemrefs: readonly string[]): ManifestItem[] {
  const byId = new Map(manifest.map((m) => [m.id, m]));
  return itemrefs
    .map((ref) => byId.get(ref))
    .filter((it): it is ManifestItem => it !== undefined && /html|xml/.test(it.mediaType));
}

/** A block of a chapter's HTML: its tag name (upper or lower case) and its text. */
export interface HtmlBlock {
  tag: string;
  text: string;
}

/**
 * The innermost blocks (p, h1–h6, li, …) as paragraphs, headings marked; a file
 * without any blocks falls back to its text line by line.
 */
export function blocksToParas(blocks: readonly HtmlBlock[], bodyText: string): Para[] {
  const paras: Para[] = [];
  for (const b of blocks) {
    const t = normSpace(b.text);
    if (t) paras.push({ t, h: /^h[1-6]$/i.test(b.tag) ? 1 : 0 });
  }
  if (!paras.length) {
    for (const line of bodyText.split(/\n+/)) {
      const t = normSpace(line);
      if (t) paras.push({ t, h: 0 });
    }
  }
  return paras;
}

/** Block elements whose innermost instances become paragraphs. */
export const BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,div,td,dd,dt';

/**
 * A spine file as a section, or null when it has (almost) no text (a cover, an
 * empty page). Titled by its first heading under 120 characters, else "Rozdział N"
 * counting the sections kept so far.
 */
export function epubSection(paras: Para[], keptSoFar: number): Section | null {
  if (paras.reduce((n, p) => n + p.t.length, 0) < 3) return null;
  const head = paras.find((p) => p.h && p.t.length < 120);
  return head ? { title: head.t, label: null, paras } : { title: '', label: { kind: 'chapter', n: keptSoFar + 1 }, paras };
}
