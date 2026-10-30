// @ts-check
// A Rush game's texts (docs/v2/PLAN.md 9.1, stages w-1 and s-1): the frame cannot use the
// app's i18n, so GameHost passes the app's language as ?lang=pl|en (Polish when missing
// or unknown). Each game keeps its own texts; this is how they are picked and filled in.

/** @typedef {'pl' | 'en'} Lang */

/** @param {string} search @returns {Lang} */
export function pickLang(search) {
  return new URLSearchParams(search).get('lang') === 'en' ? 'en' : 'pl';
}

/**
 * A translator over one language's texts: `{name}` is filled from `values`.
 * @template {string} K
 * @param {Record<K, string>} texts
 * @returns {(key: K, values?: Record<string, string | number>) => string}
 */
export function makeTranslator(texts) {
  return (key, values) => texts[key].replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? `{${name}}`));
}
