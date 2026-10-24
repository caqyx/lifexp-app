// Settings and navigation commands, the pure part (docs/v2/PLAN.md 6.5, "Ustawienia"
// and "/idz"): the words they read and the theme they arrive at. Nothing here
// touches a store.
import type { Language } from '../profile';
import type { OptionalModule } from '../modules';
import { FAMILY_MODES, type ModePreference, type ThemeFamily, type ThemePreference } from '@/lib/theme';
import type { Recognizer } from './parse';
import { integer, oneOf, points } from './recognizers';

/** "120" or "120 pkt" (the tokenizer joins the unit). Whether it is in range is the settings rule's to say. */
export const limitValue: Recognizer<number> = (token) => points(token) ?? integer(token);

export const LANG_WORD = oneOf<Language>({ pl: 'pl', polski: 'pl', polish: 'pl', en: 'en', english: 'en', angielski: 'en' });

export const SWITCH_WORD = oneOf<boolean>({
  on: true,
  wlacz: true,
  wlaczony: true,
  wl: true,
  tak: true,
  off: false,
  wylacz: false,
  wylaczony: false,
  wyl: false,
  nie: false,
});

/** Modules by their Polish and English names and by their ids. */
export const MODULE_WORD = oneOf<OptionalModule>({
  obowiazki: 'chores',
  chores: 'chores',
  pieniadze: 'money',
  money: 'money',
  notatki: 'notes',
  notes: 'notes',
  statystyki: 'stats',
  stats: 'stats',
  xp: 'stats',
  gry: 'games',
  games: 'games',
  'ex-us': 'aichat',
  exus: 'aichat',
  aichat: 'aichat',
});

export const THEME_FAMILY_WORD = oneOf<ThemeFamily>({ lifexp: 'lifexp', ios: 'ios', gold: 'gold' });

export const THEME_MODE_WORD = oneOf<ModePreference>({
  jasny: 'light',
  jasne: 'light',
  jasna: 'light',
  light: 'light',
  ciemny: 'dark',
  ciemne: 'dark',
  ciemna: 'dark',
  dark: 'dark',
  system: 'system',
  auto: 'system',
});

export type ThemeChoice =
  | { ok: true; pref: ThemePreference }
  /** Nothing was said: neither a family nor a mode. */
  | { ok: false; problem: 'nothing' }
  /** The family does not come in this mode (Gold is dark only). */
  | { ok: false; problem: 'unsupported'; family: ThemeFamily; mode: ModePreference };

/**
 * The theme a command arrives at, by the rules of Settings → Wygląd: a family alone
 * starts in its default mode; a mode alone keeps the family; a family never gets
 * a mode it does not ship.
 */
export function chooseTheme(current: ThemePreference, family: ThemeFamily | undefined, mode: ModePreference | undefined): ThemeChoice {
  if (!family && !mode) return { ok: false, problem: 'nothing' };
  const target = family ?? current.family;
  const modes = FAMILY_MODES[target];
  if (!mode) return { ok: true, pref: { family: target, mode: modes[0] } };
  if (!modes.includes(mode)) return { ok: false, problem: 'unsupported', family: target, mode };
  return { ok: true, pref: { family: target, mode } };
}

/** Switching off Ex-us from inside Ex-us would end the conversation: it is left to Settings. */
export const KEPT_ON_HERE: OptionalModule = 'aichat';
