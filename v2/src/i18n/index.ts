// Translations (docs/v2/PLAN.md 4.9). Keys are typed from pl.json (see
// i18next.d.ts), so a misspelled key is a compile error. Strings are added here
// as v2 screens need them, reusing the wording of v1's i18n-resources.js.
import { signal } from '@preact/signals';
import i18next from 'i18next';
import pl from './pl.json';

export const LANGUAGES = ['pl', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** v1 stores the chosen language under this key; v2 starts from it. */
export const V1_LANG_STORAGE_KEY = 'lifexp-lang';

export function pickLanguage(stored: string | null): Language {
  return stored === 'en' ? 'en' : 'pl';
}

/** The active language. Reading it subscribes a component, so a change re-renders the app. */
export const language = signal<Language>('pl');

/**
 * Polish is in the entry chunk (it is also the fallback for a missing key); English is
 * its own chunk, fetched only by someone who uses it (docs/v2/PERF.md), so the start
 * does not download and parse a dictionary nobody reads.
 */
let english: Promise<void> | null = null;

/** Resolves once `lng`'s strings are loaded (at once for Polish); rejects if its chunk cannot be fetched. */
export function loadLanguage(lng: Language): Promise<void> {
  if (lng === 'pl') return Promise.resolve();
  english ??= import('./en.json').then(
    (en) => {
      i18next.addResourceBundle('en', 'translation', en.default, true, true);
    },
    (error: unknown) => {
      english = null;
      throw error;
    },
  );
  return english;
}

/** Starts i18n; resolves when the first render can show `lng` (at once for Polish). */
export function initI18n(lng: Language): Promise<void> {
  void i18next.init({
    lng: 'pl',
    fallbackLng: 'pl',
    resources: { pl: { translation: pl } },
    // Preact escapes text itself.
    interpolation: { escapeValue: false },
    // Resources are bundled: initialise synchronously, before the first render.
    initAsync: false,
  });
  return setLanguage(lng);
}

/**
 * The language asked for last, at once: a control showing the choice reads this, not
 * `language`, which changes only once the strings are loaded (English is fetched on
 * first use). A slower earlier switch must not win over it; if the strings cannot be
 * loaded it goes back to the language in force.
 */
export const languageChoice = signal<Language>('pl');

/**
 * Switch language at runtime (the profile's choice wins over the device's, as in v1).
 * It switches once the language's strings are loaded; if they cannot be (offline before
 * the chunk was ever cached), the current language stays.
 */
export function setLanguage(lng: Language): Promise<void> {
  languageChoice.value = lng;
  // peek(): callable from an effect without subscribing it to the language.
  if (language.peek() === lng && i18next.language === lng) return Promise.resolve();
  return loadLanguage(lng).then(
    () => {
      if (languageChoice.peek() !== lng) return;
      void i18next.changeLanguage(lng);
      language.value = lng;
    },
    () => {
      if (languageChoice.peek() === lng) languageChoice.value = language.peek();
    },
  );
}

export const t = i18next.t.bind(i18next);

/** BCP 47 locale for Intl (numbers, dates, money) in the active language. */
export function locale(): string {
  return language.value === 'en' ? 'en-GB' : 'pl-PL';
}
