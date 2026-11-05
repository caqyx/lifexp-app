// The games of v2 (owner's decision 2026-10-26: these four, plus Wave Rush from w-1,
// Ship Rush from s-1 and Flip Rush from f-1 — one game "Rush" with a mode picker since
// stage rr-a;
// v1's Coins, Snake, 2048, Redstone and FPS stay in v1 until the cutover). Every game
// runs in GameHost.
// Vendored games live in v2/public/games/<id>/ (scripts/vendor-game.mjs, VENDORED.json);
// Flappy Bird, Szybkie liczenie, Wave Rush, Ship Rush and Flip Rush are LifeXP's own,
// written in this repo in v2/public/games/flappy/, quick-math/, wave-rush/, ship-rush/ and
// flip-rush/ (GAME.json; the Rush games share their engine in v2/public/games/_engine/).
import { Activity, Bird, Calculator, Castle, FlaskConical, Grid3x3, type LucideIcon, Swords } from 'lucide-preact';
import { emulatorTarget } from '@/lib/emulator';

export type GameId = 'flappy-bird' | 'wartime' | 'gridlock' | 'quick-math' | 'rush' | 'wardens' | 'test';

export interface GameDef {
  id: GameId;
  /**
   * The `game` field of the gamingSessions it writes, as v1's history shows it. Fixed
   * in every language and never renamed: today's time is matched by it.
   */
  sessionName: string;
  icon: LucideIcon;
  /** The game's page, relative to v2's index.html. */
  src: string;
  /** Plays better held sideways: GameHost asks to turn a phone held upright. */
  landscape?: boolean;
  /** The game saves files for the player (Wartime: "Eksportuj JSON" of a save): adds allow-downloads. */
  downloads?: boolean;
  /**
   * Names its time had before (Rush, stage rr-a: each mode was a game of its own — "Wave
   * Rush", "Ship Rush", "Flip Rush"): today's time on its card counts them too. History
   * keeps the names it was written with.
   */
  pastNames?: readonly string[];
}

export const GAMES: readonly GameDef[] = [
  { id: 'flappy-bird', sessionName: 'Flappy Bird', icon: Bird, src: 'games/flappy/index.html' },
  { id: 'wartime', sessionName: 'Wartime', icon: Swords, src: 'games/wartime/index.html', landscape: true, downloads: true },
  { id: 'gridlock', sessionName: 'Gridlock', icon: Grid3x3, src: 'games/gridlock/index.html' },
  { id: 'quick-math', sessionName: 'Szybkie liczenie', icon: Calculator, src: 'games/quick-math/index.html' },
  // One game with its modes (Wave, Ship, Flip Rush): the picker is its first screen
  // (games/rush/); each mode keeps its own page, progress and storage keys.
  {
    id: 'rush',
    sessionName: 'Rush',
    icon: Activity,
    src: 'games/rush/index.html',
    landscape: true,
    downloads: true,
    pastNames: ['Wave Rush', 'Ship Rush', 'Flip Rush'],
  },
  // LifeXP's own tower defense (stage td-1), written in this repo in games/wardens/.
  { id: 'wardens', sessionName: 'Strażnicy Doliny', icon: Castle, src: 'games/wardens/index.html' },
];

/** The modes' old games (their links still work: the game Rush, opened in that mode). */
const RUSH_MODES: Readonly<Record<string, string>> = { 'wave-rush': 'wave', 'ship-rush': 'ship', 'flip-rush': 'flip' };

/**
 * A stand-in game for the browser tests (tests/v2/games.spec.js serves its page), only
 * on the Firebase emulators, which exist only on localhost: never in production.
 */
const TEST_GAME: GameDef = { id: 'test', sessionName: 'Gra testowa', icon: FlaskConical, src: 'games/test/index.html' };

function onEmulators(): boolean {
  try {
    return emulatorTarget(location.hostname, location.search, sessionStorage) !== null;
  } catch {
    return false;
  }
}

/** The game behind #/games/:id; the test game only on the emulators, and never listed. */
export function gameById(id: string): GameDef | null {
  if (id === TEST_GAME.id) return onEmulators() ? TEST_GAME : null;
  const mode = RUSH_MODES[id];
  if (mode) {
    const rush = GAMES.find((g) => g.id === 'rush');
    return rush ? { ...rush, src: `${rush.src}?mode=${mode}` } : null;
  }
  return GAMES.find((g) => g.id === id) ?? null;
}

/**
 * The game's page with the app's language (?lang=pl|en): a framed page cannot use the
 * app's i18n, so a game that has texts of its own (Flappy Bird) reads it from there;
 * the vendored games ignore it.
 */
export function frameSrc(src: string, lang: string): string {
  return `${src}${src.includes('?') ? '&' : '?'}lang=${encodeURIComponent(lang)}`;
}
