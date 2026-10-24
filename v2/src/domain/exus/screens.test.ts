import { describe, expect, it } from 'vitest';
import { matchScreen, SCREENS } from './screens';

const idOf = (query: string) => {
  const m = matchScreen(query);
  return m.kind === 'found' ? m.screen.id : m.kind === 'ambiguous' ? m.screens.map((s) => s.id) : null;
};

describe('matchScreen', () => {
  it.each([
    ['dziś', 'today'],
    ['dzis', 'today'],
    ['Zadania', 'tasks'],
    ['zadanie', 'tasks'],
    ['cele', 'goals'],
    ['obowiązki', 'chores'],
    ['obowiazki', 'chores'],
    ['PIENIĄDZE', 'money'],
    ['notatki', 'notes'],
    ['statystyki', 'stats'],
    ['ustawienia', 'settings'],
    ['zgłoszenia', 'reports'],
    ['settings', 'settings'],
    ['money', 'money'],
  ])('%s', (query, id) => {
    expect(idOf(query)).toBe(id);
  });

  it('a start of a name and a typo', () => {
    expect(idOf('statyst')).toBe('stats');
    expect(idOf('ustawenia')).toBe('settings');
  });

  it('several screens fit, or none', () => {
    expect(idOf('z')).toEqual(['tasks', 'reports']);
    expect(idOf('kosmos')).toBeNull();
    expect(idOf('  ')).toBeNull();
  });

  it('one screen reached by two of its words is one screen, not a choice', () => {
    expect(idOf('zad')).toBe('tasks');
  });

  it('has unique ids, paths and words', () => {
    expect(new Set(SCREENS.map((s) => s.id)).size).toBe(SCREENS.length);
    expect(new Set(SCREENS.map((s) => s.path)).size).toBe(SCREENS.length);
    const words = SCREENS.flatMap((s) => s.words);
    expect(new Set(words.map((w) => w.toLowerCase())).size).toBe(words.length);
  });
});
