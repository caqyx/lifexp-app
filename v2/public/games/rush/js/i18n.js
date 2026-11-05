// @ts-check
// The Rush mode picker's texts (docs/v2/PLAN.md 9.1, stage rr-a): Polish by default,
// English with ?lang=en (as the modes).
import { makeTranslator, pickLang } from '../../_engine/i18n.js';

export { pickLang };

const TEXTS = {
  pl: {
    lead: 'Wybierz tryb. Każdy ma własne sektory, rekordy, skórki i finał.',
    open: 'Graj: {name}',
    best: 'Najlepiej: {percent}%',
    bestNone: 'Jeszcze bez rekordu',
    finaleLocked: 'Finał zamknięty',
    finaleOpen: 'Finał otwarty',
    finaleBest: 'Finał: {percent}%',
    finaleDone: 'Finał ukończony',
  },
  en: {
    lead: 'Pick a mode. Each has its own sectors, records, skins and finale.',
    open: 'Play: {name}',
    best: 'Best: {percent}%',
    bestNone: 'No record yet',
    finaleLocked: 'Finale locked',
    finaleOpen: 'Finale open',
    finaleBest: 'Finale: {percent}%',
    finaleDone: 'Finale complete',
  },
};

/** @typedef {keyof typeof TEXTS.pl} PickerKey */

/** @param {'pl' | 'en'} lang */
export const pickerTranslator = (lang) => makeTranslator(TEXTS[lang]);
/** Every key, both languages (for the tests). */
export const PICKER_KEYS = /** @type {PickerKey[]} */ (Object.keys(TEXTS.pl));
/** @param {'pl' | 'en'} lang */
export const pickerTextsOf = (lang) => TEXTS[lang];
