// The games of v2 (owner's decision 2026-10-26: exactly these four; v1's Coins, Snake,
// 2048, Redstone and FPS stay in v1 until the cutover). A game with `src` runs in
// GameHost; without one it is shown as "Wkrótce" until its stage (g-2..g-4) adds it.
// Vendored games live in v2/public/games/<id>/ (scripts/vendor-game.mjs).
import { Bird, Calculator, FlaskConical, Grid3x3, type LucideIcon, Swords } from 'lucide-preact';
import { emulatorTarget } from '@/lib/emulator';

export type GameId = 'flappy-bird' | 'wartime' | 'gridlock' | 'quick-math' | 'test';

export interface GameDef {
  id: GameId;
  /**
   * The `game` field of the gamingSessions it writes, as v1's history shows it. Fixed
   * in every language and never renamed: today's time is matched by it.
   */
  sessionName: string;
  icon: LucideIcon;
  /** The game's page, relative to v2's index.html; null = not added yet ("Wkrótce"). */
  src: string | null;
  /** Plays better held sideways: GameHost asks to turn a phone held upright. */
  landscape?: boolean;
}

export const GAMES: readonly GameDef[] = [
  { id: 'flappy-bird', sessionName: 'Flappy Bird', icon: Bird, src: null },
  { id: 'wartime', sessionName: 'Wartime', icon: Swords, src: null, landscape: true },
  { id: 'gridlock', sessionName: 'Gridlock', icon: Grid3x3, src: null },
  { id: 'quick-math', sessionName: 'Szybkie liczenie', icon: Calculator, src: null },
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
