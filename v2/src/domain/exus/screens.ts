// "/idz": the screens a name can lead to (docs/v2/PLAN.md 6.5). The paths and
// the modules mirror app/registry.ts (a test there keeps them in step: features
// and domain cannot import the registry).
import type { OptionalModule } from '../modules';
import { matchEntity } from './entities';

export type ScreenId = 'today' | 'tasks' | 'goals' | 'chores' | 'money' | 'notes' | 'stats' | 'games' | 'reports' | 'settings';

export interface Screen {
  id: ScreenId;
  path: string;
  /** The screen is gone while this module is off. */
  module: OptionalModule | null;
  /** Names it answers to, in Polish and English, typed with or without Polish letters. */
  words: readonly string[];
}

export const SCREENS: readonly Screen[] = [
  { id: 'today', path: '/today', module: null, words: ['dziś', 'dzisiaj', 'today', 'start'] },
  { id: 'tasks', path: '/tasks', module: null, words: ['zadania', 'zadanie', 'tasks'] },
  { id: 'goals', path: '/goals', module: null, words: ['cele', 'cel', 'goals'] },
  { id: 'chores', path: '/chores', module: 'chores', words: ['obowiązki', 'chores'] },
  { id: 'money', path: '/money', module: 'money', words: ['pieniądze', 'money'] },
  { id: 'notes', path: '/notes', module: 'notes', words: ['notatki', 'notes'] },
  { id: 'stats', path: '/stats', module: 'stats', words: ['statystyki', 'stats'] },
  { id: 'games', path: '/games', module: 'games', words: ['gry', 'games'] },
  { id: 'reports', path: '/reports', module: null, words: ['zgłoszenia', 'aktualizacje', 'reports'] },
  { id: 'settings', path: '/settings', module: null, words: ['ustawienia', 'settings'] },
];

export type ScreenMatch = { kind: 'found'; screen: Screen } | { kind: 'ambiguous'; screens: Screen[] } | { kind: 'none' };

/** The screen a name points at: the exact word, a word it starts, one that contains it, a typo. */
export function matchScreen(query: string): ScreenMatch {
  const byId = new Map(SCREENS.map((s) => [s.id, s]));
  const match = matchEntity(
    query,
    SCREENS.flatMap((s) => s.words.map((name) => ({ id: s.id, name }))),
  );
  if (match.kind === 'none') return match;
  const ids = [...new Set((match.kind === 'found' ? [match.item] : match.items).map((item) => item.id))];
  const screens = ids.map((id) => byId.get(id as ScreenId)!);
  return screens.length === 1 ? { kind: 'found', screen: screens[0]! } : { kind: 'ambiguous', screens };
}
