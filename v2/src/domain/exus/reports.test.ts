import { describe, expect, it } from 'vitest';
import { BUG_AREAS } from '../reports';
import { findArea, splitBugReport } from './reports';

const AREAS = BUG_AREAS.map((id) => ({
  id,
  name: { dashboard: 'Dziś', money: 'Pieniądze', chores: 'Obowiązki', history: 'Historia', stats: 'Statystyki', settings: 'Ustawienia', other: 'Inne' }[id],
}));

describe('splitBugReport', () => {
  it('cuts the title, the area and the description on the first two bars', () => {
    expect(splitBugReport('Saldo | Pieniądze | Saldo nie działa po wypłacie')).toEqual({
      ok: true,
      title: 'Saldo',
      area: 'Pieniądze',
      description: 'Saldo nie działa po wypłacie',
    });
    expect(splitBugReport(' A|B|C ')).toEqual({ ok: true, title: 'A', area: 'B', description: 'C' });
  });

  it('keeps further bars in the description', () => {
    expect(splitBugReport('A | B | x | y | z')).toEqual({ ok: true, title: 'A', area: 'B', description: 'x | y | z' });
  });

  it.each([[''], ['Tylko tytuł'], ['A | B'], ['A | B |'], ['A | | C'], [' | B | C'], ['A | B |   ']])('"%s" is not three parts', (text) => {
    expect(splitBugReport(text)).toEqual({ ok: false });
  });
});

describe('findArea', () => {
  it.each([
    ['Pieniądze', 'money'],
    ['pieniadze', 'money'],
    ['PIENIĄDZE', 'money'],
    ['money', 'money'],
    ['dziś', 'dashboard'],
    ['dzis', 'dashboard'],
    ['inne', 'other'],
    ['obow', 'chores'],
    ['statyst', 'stats'],
    ['ustawienai', 'settings'],
  ])('%s → %s', (text, id) => {
    expect(findArea(text, AREAS)).toEqual({ kind: 'found', id });
  });

  it('says when nothing fits', () => {
    expect(findArea('latanie', AREAS)).toEqual({ kind: 'none' });
    expect(findArea('', AREAS)).toEqual({ kind: 'none' });
  });

  it('lists the areas a text fits when several do', () => {
    const got = findArea('i', [{ id: 'history', name: 'Historia' }, { id: 'other', name: 'Inne' }]);
    expect(got.kind === 'ambiguous' || got.kind === 'found').toBe(true);
    expect(findArea('hi', [{ id: 'history', name: 'Historia' }, { id: 'stats', name: 'Historie' }])).toEqual({ kind: 'ambiguous', names: ['Historia', 'Historie'] });
  });
});
