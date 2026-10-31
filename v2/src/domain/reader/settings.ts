// The reader's own settings (kept on the device, offline/readerLibrary) and the pace
// of Auto mode. Pure.

/** Text sizes of Easy mode in px (other views use two thirds of it). */
export const EASY_SIZES = [18, 22, 26, 30, 36, 44, 54] as const;

export type ReaderMode = 'easy' | 'auto' | 'normal';
export type ReaderTheme = 'paper' | 'night';
export type EasyView = 'sentences' | 'page';

export interface ReaderSettings {
  theme: ReaderTheme;
  /** Index into EASY_SIZES. */
  size: number;
  /** Sentences per Easy screen. */
  per: 1 | 2;
  mode: ReaderMode;
  /** Auto mode's words per minute. */
  wpm: number;
  view: EasyView;
}

export const WPM_MIN = 60;
export const WPM_MAX = 900;
export const WPM_STEP = 20;

/** First start: Paper, Easy with one sentence, 250 words a minute; a size up on a wide screen. */
export function defaultReaderSettings(wide: boolean): ReaderSettings {
  return { theme: 'paper', size: wide ? 3 : 2, per: 1, mode: 'easy', wpm: 250, view: 'sentences' };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Words per minute rounded to tens, within WPM_MIN … WPM_MAX. */
export function clampWpm(v: number): number {
  return clamp(Math.round(v / 10) * 10, WPM_MIN, WPM_MAX);
}

/** Whatever was stored, as valid settings (a broken value falls back as the standalone reader did). */
export function normalizeReaderSettings(stored: unknown, wide: boolean): ReaderSettings {
  const s = { ...defaultReaderSettings(wide) } as Record<string, unknown>;
  if (typeof stored === 'object' && stored !== null) Object.assign(s, stored);
  const size = typeof s.size === 'number' ? s.size | 0 : 0;
  const mode = s.mode;
  const wpm = typeof s.wpm === 'number' ? Math.round(s.wpm) : 0;
  return {
    theme: s.theme === 'night' ? 'night' : 'paper',
    size: clamp(size, 0, EASY_SIZES.length - 1),
    per: s.per === 2 ? 2 : 1,
    mode: mode === 'easy' || mode === 'auto' || mode === 'normal' ? mode : 'normal',
    wpm: clamp(wpm || 250, WPM_MIN, WPM_MAX),
    view: s.view === 'page' ? 'page' : 'sentences',
  };
}

/**
 * How long Auto mode's light stays on a word: one beat at `wpm`, twice that at the
 * end of a sentence, one and a half after a comma, colon or dash, a fifth more for
 * a long word (9+ characters).
 */
export function wordDelay(text: string, wpm: number): number {
  let d = 60000 / wpm;
  if (/[.!?…]["”»')\]]*$/.test(text)) d *= 2;
  else if (/[,;:—–]["”»')\]]*$/.test(text)) d *= 1.5;
  if (text.length >= 9) d *= 1.2;
  return d;
}

/** A sentence's words as Auto mode lights them. */
export function wordsOf(sentence: string): string[] {
  return sentence.split(' ').filter(Boolean);
}
