// The games of v2 (owner's decision 2026-10-26: these four, plus Wave Rush from w-1 and
// Ship Rush from s-1;
// v1's Coins, Snake, 2048, Redstone and FPS stay in v1 until the cutover). Every game
// runs in GameHost.
// Vendored games live in v2/public/games/<id>/ (scripts/vendor-game.mjs, VENDORED.json);
// Flappy Bird, Szybkie liczenie, Wave Rush and Ship Rush are LifeXP's own, written in this
// repo in v2/public/games/flappy/, quick-math/, wave-rush/ and ship-rush/ (GAME.json; the
// two Rush games share their engine in v2/public/games/_engine/).
import { Activity, Bird, Calculator, FlaskConical, Grid3x3, type LucideIcon, Rocket, Swords } from 'lucide-preact';
import { emulatorTarget } from '@/lib/emulator';

export type GameId = 'flappy-bird' | 'wartime' | 'gridlock' | 'quick-math' | 'wave-rush' | 'ship-rush' | 'test';

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
}

export const GAMES: readonly GameDef[] = [
  { id: 'flappy-bird', sessionName: 'Flappy Bird', icon: Bird, src: 'games/flappy/index.html' },
  { id: 'wartime', sessionName: 'Wartime', icon: Swords, src: 'games/wartime/index.html', landscape: true, downloads: true },
  { id: 'gridlock', sessionName: 'Gridlock', icon: Grid3x3, src: 'games/gridlock/index.html' },
  { id: 'quick-math', sessionName: 'Szybkie liczenie', icon: Calculator, src: 'games/quick-math/index.html' },
  { id: 'wave-rush', sessionName: 'Wave Rush', icon: Activity, src: 'games/wave-rush/index.html', landscape: true },
  { id: 'ship-rush', sessionName: 'Ship Rush', icon: Rocket, src: 'games/ship-rush/index.html', landscape: true },
];

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
