import { describe, expect, it } from 'vitest';
import { ACTIVITY_SEEDS, type GeneratorPick } from '../activity';
import type { Activity } from '../activity';
import { findActivity, splitTypeDesc, whatNow } from './activities';

const DEFS = ACTIVITY_SEEDS;
const split = (text: string) => splitTypeDesc(text.split(/\s+/).filter(Boolean), DEFS);

describe('splitTypeDesc', () => {
  it.each([
    ['nauka', 'learning', ''],
    ['Nauka rozdział 3', 'learning', 'rozdział 3'],
    ['NAUKA js', 'learning', 'js'],
    ['czytanie', 'reading', ''],
    ['cwiczenia trening nóg', 'exercise', 'trening nóg'],
    ['ćwiczenia', 'exercise', ''],
    ['zadania matma', 'school', 'matma'],
    ['praca nad projektem szkic', 'project', 'szkic'],
    ['Praca nad projektem', 'project', ''],
    ['praca', 'project', ''],
    ['nuka', 'learning', ''],
    ['cwiczenia', 'exercise', ''],
  ])('%s → %s / "%s"', (text, id, desc) => {
    expect(split(text)).toMatchObject({ kind: 'found', def: { id }, desc });
  });

  it('lists the types a first word fits when several do', () => {
    const defs = [...DEFS, { id: 'x', name: 'Nauka gry', points: 10, order: 9, icon: null, color: null }];
    const got = splitTypeDesc(['nauk'], defs);
    expect(got).toEqual({ kind: 'ambiguous', names: ['Nauka (JS, Unity, C#)', 'Nauka gry'] });
  });

  it('prefers an exact name over a prefix of two types', () => {
    const defs = [
      { id: 'a', name: 'Czytanie', points: 10, order: 0, icon: null, color: null },
      { id: 'b', name: 'Czytanie książek', points: 10, order: 1, icon: null, color: null },
    ];
    expect(splitTypeDesc(['czytanie', 'wieczorem'], defs)).toMatchObject({ kind: 'found', def: { id: 'a' }, desc: 'wieczorem' });
    expect(splitTypeDesc(['czytanie', 'książek'], defs)).toMatchObject({ kind: 'found', def: { id: 'b' }, desc: '' });
  });

  it.each([[''], ['latanie'], ['xx nauka']])('"%s" names no type', (text) => {
    expect(split(text)).toEqual({ kind: 'none' });
  });
});

describe('whatNow', () => {
  const pool: GeneratorPick[] = [
    { name: 'Spacer', points: 20, defId: null },
    { name: 'Nauka', points: 40, defId: 'learning' },
  ];

  it('picks from the pool and credits as the log sheet does', () => {
    expect(whatNow(pool, 90, 0, 150, () => 0)).toEqual({
      pick: pool[0],
      credit: { earned: 30, points: 30, limit: 150 },
    });
    expect(whatNow(pool, 60, 0, 150, () => 0.99)?.credit).toEqual({ earned: 40, points: 40, limit: 150 });
  });

  it('cuts the credit to what is left of the limit, down to none', () => {
    expect(whatNow(pool, 120, 130, 150, () => 0.99)?.credit).toEqual({ earned: 80, points: 20, limit: 150 });
    expect(whatNow(pool, 60, 150, 150, () => 0)?.credit).toEqual({ earned: 20, points: 0, limit: 150 });
    expect(whatNow(pool, 60, 0, null, () => 0)?.credit.limit).toBe(150);
  });

  it('gives nothing for a time below the minimum or an empty pool', () => {
    expect(whatNow(pool, 4, 0, 150)).toBeNull();
    expect(whatNow([], 30, 0, 150)).toBeNull();
  });
});

describe('findActivity', () => {
  const names = new Map([['learning', 'Nauka (JS, Unity, C#)'], ['reading', 'Czytanie / kurs']]);
  const act = (id: string, type: string, desc: string, hour: number): Activity => ({
    id,
    type,
    typeName: null,
    desc,
    duration: 60,
    points: 40,
    at: new Date(Date.UTC(2026, 9, 12, hour)),
  });
  const ACTIVITIES = [act('a1', 'learning', 'rozdział 3', 8), act('a2', 'reading', '', 10), act('a3', 'learning', 'testy', 9)];

  it('nothing or "ostatnia" is the newest', () => {
    for (const ref of [undefined, '', 'ostatnia', 'Ostatni', 'last']) {
      expect(findActivity(ref, ACTIVITIES, names)).toMatchObject({ kind: 'found', activity: { id: 'a2' } });
    }
  });

  it('a text is matched with the type and the note', () => {
    expect(findActivity('czytanie', ACTIVITIES, names)).toMatchObject({ kind: 'found', activity: { id: 'a2' } });
    expect(findActivity('nauka rozdzial', ACTIVITIES, names)).toMatchObject({ kind: 'found', activity: { id: 'a1' } });
    expect(findActivity('testy', ACTIVITIES, names)).toMatchObject({ kind: 'found', activity: { id: 'a3' } });
  });

  it('lists the activities a text fits when several do, newest first', () => {
    const got = findActivity('nauka', ACTIVITIES, names);
    expect(got.kind).toBe('ambiguous');
    if (got.kind === 'ambiguous') expect(got.activities.map((a) => a.id)).toEqual(['a3', 'a1']);
  });

  it('says when nothing fits or there is nothing', () => {
    expect(findActivity('latanie', ACTIVITIES, names)).toEqual({ kind: 'none' });
    expect(findActivity(undefined, [], names)).toEqual({ kind: 'none' });
  });

  it('uses the name saved with the entry before the definition', () => {
    const saved = { ...act('a4', 'gone', '', 11), typeName: 'Spacer' };
    expect(findActivity('spacer', [...ACTIVITIES, saved], names)).toMatchObject({ kind: 'found', activity: { id: 'a4' } });
  });
});
