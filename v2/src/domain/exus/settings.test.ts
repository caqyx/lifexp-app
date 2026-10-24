import { describe, expect, it } from 'vitest';
import { OPTIONAL_MODULES } from '../modules';
import { DEFAULT_THEME, FAMILY_MODES, THEME_FAMILIES } from '@/lib/theme';
import { chooseTheme, LANG_WORD, limitValue, MODULE_WORD, SWITCH_WORD, THEME_FAMILY_WORD, THEME_MODE_WORD } from './settings';

describe('limitValue', () => {
  it.each([
    ['120', 120],
    ['120pkt', 120],
    ['20', 20],
    ['0', 0],
    ['12,5', undefined],
    ['abc', undefined],
    ['120zł', undefined],
  ])('%s', (token, expected) => {
    expect(limitValue(token)).toBe(expected);
  });
});

describe('the words', () => {
  it.each([
    ['pl', 'pl'],
    ['Polski', 'pl'],
    ['EN', 'en'],
    ['English', 'en'],
    ['angielski', 'en'],
  ])('language %s', (word, lang) => {
    expect(LANG_WORD(word)).toBe(lang);
  });

  it.each([
    ['on', true],
    ['włącz', true],
    ['WLACZ', true],
    ['off', false],
    ['wyłącz', false],
    ['nie', false],
  ])('switch %s', (word, on) => {
    expect(SWITCH_WORD(word)).toBe(on);
  });

  it.each([
    ['Obowiązki', 'chores'],
    ['chores', 'chores'],
    ['pieniądze', 'money'],
    ['pieniadze', 'money'],
    ['Money', 'money'],
    ['notatki', 'notes'],
    ['statystyki', 'stats'],
    ['XP', 'stats'],
    ['gry', 'games'],
    ['Ex-us', 'aichat'],
    ['aichat', 'aichat'],
  ])('module %s', (word, id) => {
    expect(MODULE_WORD(word)).toBe(id);
  });

  it('every module that can be turned off has a name, and its own id works', () => {
    const named = new Set(['obowiazki', 'pieniadze', 'notatki', 'statystyki', 'gry', 'ex-us'].map((w) => MODULE_WORD(w)));
    expect([...named].sort()).toEqual([...OPTIONAL_MODULES].sort());
    for (const id of OPTIONAL_MODULES) expect(MODULE_WORD(id), id).toBe(id);
  });

  it('theme words', () => {
    expect(THEME_FAMILY_WORD('iOS')).toBe('ios');
    expect(THEME_FAMILY_WORD('jasny')).toBeUndefined();
    expect(THEME_MODE_WORD('Jasny')).toBe('light');
    expect(THEME_MODE_WORD('ciemny')).toBe('dark');
    expect(THEME_MODE_WORD('system')).toBe('system');
    expect(THEME_MODE_WORD('gold')).toBeUndefined();
  });
});

describe('chooseTheme', () => {
  it('a family alone starts in its default mode, as picking it in Settings does', () => {
    for (const family of THEME_FAMILIES) {
      expect(chooseTheme(DEFAULT_THEME, family, undefined)).toEqual({ ok: true, pref: { family, mode: FAMILY_MODES[family][0] } });
    }
    expect(chooseTheme({ family: 'lifexp', mode: 'light' }, 'ios', undefined)).toEqual({ ok: true, pref: { family: 'ios', mode: 'system' } });
  });

  it('a mode alone keeps the family', () => {
    expect(chooseTheme({ family: 'lifexp', mode: 'dark' }, undefined, 'light')).toEqual({ ok: true, pref: { family: 'lifexp', mode: 'light' } });
    expect(chooseTheme({ family: 'ios', mode: 'light' }, undefined, 'system')).toEqual({ ok: true, pref: { family: 'ios', mode: 'system' } });
  });

  it('a family and a mode', () => {
    expect(chooseTheme(DEFAULT_THEME, 'ios', 'dark')).toEqual({ ok: true, pref: { family: 'ios', mode: 'dark' } });
  });

  it('Gold comes dark only, whether named or kept', () => {
    expect(chooseTheme(DEFAULT_THEME, 'gold', 'light')).toEqual({ ok: false, problem: 'unsupported', family: 'gold', mode: 'light' });
    expect(chooseTheme({ family: 'gold', mode: 'dark' }, undefined, 'system')).toEqual({ ok: false, problem: 'unsupported', family: 'gold', mode: 'system' });
    expect(chooseTheme({ family: 'gold', mode: 'dark' }, undefined, 'dark')).toEqual({ ok: true, pref: { family: 'gold', mode: 'dark' } });
  });

  it('nothing said is nothing to do', () => {
    expect(chooseTheme(DEFAULT_THEME, undefined, undefined)).toEqual({ ok: false, problem: 'nothing' });
  });
});
