import { describe, expect, it } from 'vitest';
import { levenshtein, matchEntity } from './entities';

const goal = (id: string, name: string) => ({ id, name });
const GOALS = [goal('a', 'Rower'), goal('b', 'Nowy telefon'), goal('c', 'Żaglówka')];
const ids = (m: ReturnType<typeof matchEntity>) => (m.kind === 'found' ? [m.item.id] : m.kind === 'ambiguous' ? m.items.map((i) => i.id) : []);

describe('levenshtein', () => {
  it.each([
    ['rower', 'rower', 0],
    ['rowr', 'rower', 1],
    ['rewor', 'rower', 2],
    ['', 'abc', 3],
    ['kot', 'pies', 4],
  ])('%s ~ %s = %i', (a, b, d) => expect(levenshtein(a, b)).toBe(d));
});

describe('matchEntity', () => {
  it.each([
    // exact, whatever the case and the Polish letters
    ['Rower', 'found', ['a']],
    ['ROWER', 'found', ['a']],
    ['zaglowka', 'found', ['c']],
    ['  nowy   telefon ', 'found', ['b']],
    // a prefix, then a part inside
    ['row', 'found', ['a']],
    ['tele', 'found', ['b']],
    ['glowka', 'found', ['c']],
    // a typo (Levenshtein up to 2), also in one word of a longer name
    ['rowr', 'found', ['a']],
    ['rewor', 'found', ['a']],
    ['telefn', 'found', ['b']],
    ['zaglowca', 'found', ['c']],
    // too far, too short, empty
    ['samochod', 'none', []],
    ['ro', 'found', ['a']],
    ['xy', 'none', []],
    ['   ', 'none', []],
  ])('%s → %s', (query, kind, expected) => {
    const m = matchEntity(query, GOALS);
    expect(m.kind).toBe(kind);
    expect(ids(m)).toEqual(expected);
  });

  it('an exact name beats a longer name that starts or contains it', () => {
    const goals = [goal('a', 'Rower górski'), goal('b', 'Rower')];
    expect(ids(matchEntity('rower', goals))).toEqual(['b']);
  });

  it('a prefix beats a name that only contains the text', () => {
    const goals = [goal('a', 'Nowy rower'), goal('b', 'Rowerek')];
    expect(ids(matchEntity('rower', goals))).toEqual(['b']);
  });

  it('several fits are all returned, in order', () => {
    const goals = [goal('a', 'Rower górski'), goal('b', 'Rower szosowy'), goal('c', 'Telefon')];
    const m = matchEntity('rower', goals);
    expect(m.kind).toBe('ambiguous');
    expect(ids(m)).toEqual(['a', 'b']);
  });

  it('two goals with the same name are ambiguous even for the exact name', () => {
    expect(ids(matchEntity('Rower', [goal('a', 'Rower'), goal('b', 'rower')]))).toEqual(['a', 'b']);
  });

  it('fuzzy: only the closest ones win', () => {
    const goals = [goal('a', 'Rower'), goal('b', 'Rowery')];
    // "rowar": 1 from Rower, 2 from Rowery
    expect(ids(matchEntity('rowar', goals))).toEqual(['a']);
  });

  it('every word of the text may be anywhere in the name, in any order', () => {
    const items = [goal('a', 'Nauka (JS, Unity) rozdział 3'), goal('b', 'Czytanie książki')];
    expect(ids(matchEntity('nauka rozdzial', items))).toEqual(['a']);
    expect(ids(matchEntity('rozdział 3 nauka', items))).toEqual(['a']);
    expect(matchEntity('nauka książki', items)).toEqual({ kind: 'none' });
  });

  it('nothing to choose from', () => {
    expect(matchEntity('rower', [])).toEqual({ kind: 'none' });
  });
});
