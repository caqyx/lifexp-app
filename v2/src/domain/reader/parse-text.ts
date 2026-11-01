// Plain text and Markdown books (the reader). Paragraphs are blocks between blank
// lines (or single lines, in a file that has almost no blank lines); in Markdown,
// "#"/"##" headings open sections, deeper ones stay headings inside them, and the
// inline marks are dropped. Pure.
import { baseName, chunkSections, type Para, type ParsedBook, type Section } from './book';
import { normSpace } from './sentences';

/**
 * The file's text: UTF-8 when it is valid UTF-8, else Windows-1250 (Polish
 * texts saved by older Windows editors).
 */
export function decodeText(buf: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1250').decode(buf);
  }
}

/** Markdown inline marks removed: images, links (text kept), bold, italics, code, quotes, list bullets. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, '');
}

const HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;

/** A .txt or .md file's text as a book named after the file. */
export function parseText(raw: string, fileName: string, isMd: boolean): ParsedBook {
  let text = raw.replace(/\r\n?/g, '\n').replace(/^\ufeff/, '');
  if (isMd) text = text.replace(/^```.*$/gm, '');
  let blocks = text.split(/\n\s*\n/);
  // Hardly any blank lines in a long file: one line is one paragraph.
  if (blocks.length < 3 && text.split('\n').length > 10) blocks = text.split('\n');
  const sections: Section[] = [];
  let cur: Section | null = null;
  const loose: Para[] = [];
  const push = (p: Para) => (cur ? cur.paras : loose).push(p);
  for (const block of blocks) {
    const lines = block.split('\n');
    const head = isMd && lines.length === 1 ? block.match(HEADING) : null;
    if (head?.[1] && head[2]) {
      const t = normSpace(stripMarkdown(head[2]));
      if (head[1].length <= 2) {
        cur = { title: t, label: null, paras: [] };
        sections.push(cur);
      }
      if (t) push({ t, h: 1 });
      continue;
    }
    const t = normSpace(isMd ? stripMarkdown(block) : block);
    if (t) push({ t, h: 0 });
  }
  let out = sections.filter((s) => s.paras.length);
  if (loose.length) {
    out = out.length ? [{ title: '', label: { kind: 'start', n: 1 }, paras: loose }, ...out] : chunkSections(loose);
  }
  return { title: baseName(fileName), format: isMd ? 'MD' : 'TXT', sections: out };
}
