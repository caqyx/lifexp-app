import { describe, expect, test } from 'vitest';
import { initI18n, language, languageChoice, setLanguage, t } from './index';

describe('switching the language', () => {
  test('the choice shows at once; the language follows once its strings are loaded', async () => {
    await initI18n('pl');
    const switching = setLanguage('en');
    // A control reading the choice does not jump back to Polish while English is fetched.
    expect(languageChoice.value).toBe('en');
    expect(language.value).toBe('pl');
    await switching;
    expect(language.value).toBe('en');
    expect(t('settings.language')).toBe('Language');

    await setLanguage('pl');
    expect(languageChoice.value).toBe('pl');
    expect(language.value).toBe('pl');
  });

  test('the last choice wins over a slower earlier one', async () => {
    await initI18n('pl');
    const toEnglish = setLanguage('en');
    const backToPolish = setLanguage('pl');
    await Promise.all([toEnglish, backToPolish]);
    expect(languageChoice.value).toBe('pl');
    expect(language.value).toBe('pl');
  });
});
