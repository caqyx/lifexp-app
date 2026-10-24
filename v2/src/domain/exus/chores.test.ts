import { describe, expect, it } from 'vitest';
import type { ChoreDef, ChoreEntry } from '../chores';
import { CHORE_DAY, choreDayKey, choresOverview } from './chores';
import { matchEntity } from './entities';

const def = (id: string, name: string, order: number, points = 10): ChoreDef => ({ id, name, desc: '', emoji: '🧹', points, oneTime: false, order });
const DEFS = [
  def('a', 'Odkurzanie wiatrołapu (buty, kurtki)', 0),
  def('b', 'Odkurzanie schodów', 1, 5),
  def('c', 'Zmycie schodów na mokro', 2, 30),
  def('d', 'Opróżnienie zmywarki', 3, 15),
];
let n = 0;
const entry = (choreId: string, dateISO: string, points: number): ChoreEntry => ({
  id: `e${(n += 1)}`,
  choreId,
  name: DEFS.find((d) => d.id === choreId)?.name ?? choreId,
  emoji: '🧹',
  points,
  dateISO,
  monthKey: dateISO.slice(0, 7),
  createdAt: null,
});

describe('the day of /obowiazek', () => {
  it.each([
    ['dzis', 'today'],
    ['Dziś', 'today'],
    ['wczoraj', 'yesterday'],
    ['WCZORAJ', 'yesterday'],
    ['yesterday', 'yesterday'],
    ['jutro', undefined],
    ['pt', undefined],
  ])('%s → %s', (token, expected) => expect(CHORE_DAY(token)).toBe(expected));

  it('counts from the local day', () => {
    expect(choreDayKey('today', '2026-10-01')).toBe('2026-10-01');
    expect(choreDayKey('yesterday', '2026-10-01')).toBe('2026-09-30');
    expect(choreDayKey('yesterday', '2026-01-01')).toBe('2025-12-31');
  });
});

describe('which chore a name means', () => {
  const find = (name: string) => matchEntity(name, DEFS);

  it('takes a unique name, with or without Polish letters', () => {
    expect(find('zmywarki')).toMatchObject({ kind: 'found', item: { id: 'd' } });
    expect(find('opróżnienie zmywarki')).toMatchObject({ kind: 'found', item: { id: 'd' } });
    expect(find('odkurzanie schodow')).toMatchObject({ kind: 'found', item: { id: 'b' } });
  });

  it('lists the chores a shared word fits', () => {
    const match = find('schodow');
    expect(match.kind).toBe('ambiguous');
    if (match.kind === 'ambiguous') expect(match.items.map((d) => d.id)).toEqual(['b', 'c']);
    expect(find('odkurzanie').kind).toBe('ambiguous');
  });

  it('knows there is none', () => expect(find('latanie')).toEqual({ kind: 'none' }));
});

describe('choresOverview', () => {
  const TODAY = '2026-10-09';

  it('lists today only, counts the month and prices everything unpaid at the rate', () => {
    const entries = [
      entry('b', TODAY, 5),
      entry('b', TODAY, 5),
      entry('d', TODAY, 15),
      entry('c', '2026-10-08', 30),
      entry('a', '2026-09-30', 10),
    ];
    const overview = choresOverview(DEFS, entries, TODAY, 0.5);
    expect(overview.done.map((r) => [r.name, r.doneToday])).toEqual([
      ['Odkurzanie schodów', 2],
      ['Opróżnienie zmywarki', 1],
    ]);
    expect(overview.unpaid).toEqual({ points: 65, grosze: 3250 });
    // The 30 September entry is last month's.
    expect(overview.monthEntries).toBe(4);
  });

  it('is empty for no entries', () => {
    expect(choresOverview(DEFS, [], TODAY, 0.45)).toEqual({ done: [], unpaid: { points: 0, grosze: 0 }, monthEntries: 0 });
  });

  it('keeps an entry whose definition is gone', () => {
    const overview = choresOverview([], [entry('gone', TODAY, 20)], TODAY, 0.45);
    expect(overview.done.map((r) => r.name)).toEqual(['gone']);
  });
});
