// Splitting book text into sentences (the reader, docs/v2/PLAN.md 9.1 row "r"):
// a sentence ends at . ! ? … (with closing quotes or brackets) before a capital,
// a digit or an opening quote, unless the word before is a known abbreviation or
// an initial; sentences longer than MAX_SENTENCE are cut at a comma, colon or dash
// near the middle. Pure: the reader's Easy mode shows these one or two at a time.

/** Non-breaking and figure spaces as plain spaces, runs collapsed, ends trimmed. */
export function normSpace(s: string): string {
  return s.replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Abbreviations after which a period does not end the sentence (Polish and English), lower case, without the last period. */
export const ABBR: ReadonlySet<string> = new Set([
  'np', 'm.in', 'tzw', 'itd', 'itp', 'tj', 'tzn', 'dr', 'prof', 'mgr', 'inż', 'ul', 'godz', 'ok', 'zob', 'por', 'str',
  'al', 'os', 'wg', 'ww', 'św', 'im', 'ks', 'gen', 'płk', 'mjr', 'kpt', 'mr', 'mrs', 'ms', 'st', 'vs', 'etc', 'fig',
  'pp', 'ed', 'jr', 'sr', 'cd', 'cdn', 'nr', 'tel', 'ew', 'hab', 'dot', 'ur', 'zm', 'tys', 'mln', 'mld', 'pt', 'poz',
  'rys', 'tab', 'rozdz', 'art', 'ust', 'pkt', 'lit', 'zał', 'sygn', 'red', 'tłum', 'wyd', 'woj', 'pow', 'gm', 'kol',
]);

/** Where a sentence may end: terminal punctuation, closing marks, space, then a capital, a digit or an opening mark. */
export const SENT_BOUNDARY = /[.!?…]+["”»')\]]*\s+(?=[\p{Lu}\p{N}"„“«'([—–])/gu;

/** Longer sentences are cut (splitLong). */
export const MAX_SENTENCE = 280;

/** The text before a boundary ends with an abbreviation ("np.") or an initial ("J."). */
export function endsWithAbbreviation(prev: string): boolean {
  const last = prev.match(/(\S+)$/);
  if (!last?.[1]) return false;
  const raw = last[1].replace(/^[("„“«'[]+/, '');
  if (/^\p{Lu}\.$/u.test(raw)) return true;
  const tok = raw.replace(/[^\p{L}.]/gu, '').toLowerCase().replace(/\.+$/, '');
  return raw.endsWith('.') && ABBR.has(tok);
}

/**
 * A sentence over MAX_SENTENCE characters cut in two at the comma, semicolon,
 * colon or spaced dash nearest the middle (at least 50 characters from either end),
 * recursively; a very long one with none of those at the space before the middle.
 */
export function splitLong(text: string): string[] {
  if (text.length <= MAX_SENTENCE) return [text];
  const mid = text.length / 2;
  let best = -1;
  let bestDist = Infinity;
  const re = /[;:,]\s|\s[—–]\s/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const cut = m.index + m[0].length;
    if (cut < 50 || cut > text.length - 50) continue;
    const d = Math.abs(cut - mid);
    if (d < bestDist) {
      bestDist = d;
      best = cut;
    }
  }
  if (best < 0 && text.length > MAX_SENTENCE * 1.6) {
    const sp = text.lastIndexOf(' ', Math.floor(mid));
    if (sp > 40) best = sp + 1;
  }
  if (best < 0) return [text];
  return [...splitLong(text.slice(0, best).trim()), ...splitLong(text.slice(best).trim())];
}

/** One paragraph's sentences, in order. */
export function splitSentences(text: string): string[] {
  const raw: string[] = [];
  let last = 0;
  for (const m of text.matchAll(SENT_BOUNDARY)) {
    const end = m.index + m[0].length;
    raw.push(text.slice(last, end).trim());
    last = end;
  }
  raw.push(text.slice(last).trim());
  const merged: string[] = [];
  for (const part of raw) {
    if (!part) continue;
    const prev = merged[merged.length - 1];
    if (prev !== undefined && endsWithAbbreviation(prev)) merged[merged.length - 1] = `${prev} ${part}`;
    else merged.push(part);
  }
  return merged.flatMap(splitLong);
}
