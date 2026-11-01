// Normal play's checkpoints in all three Rush games (owner, after f-2): at the start of
// every sector except Insane, the Demon and the finale, dying starts that sector again
// (the same run); in Insane and the Demon a crash starts the whole run again, as before.
// Practice is unchanged. The engine is shared (public/games/_engine/game.js), so each
// game is checked through its own rules.
import { describe, expect, test } from 'vitest';
import { keepsNormalCheckpoint } from '../public/games/_engine/sectors.js';
import { createRng } from '../public/games/_engine/rng.js';
import { stepGame, type Game } from '../public/games/_engine/game.js';
import * as wave from '../public/games/wave-rush/js/game.js';
import * as waveConfig from '../public/games/wave-rush/js/config.js';
import * as ship from '../public/games/ship-rush/js/game.js';
import * as shipConfig from '../public/games/ship-rush/js/config.js';
import * as flip from '../public/games/flip-rush/js/game.js';
import * as flipConfig from '../public/games/flip-rush/js/config.js';
import { createAutopilot } from '../public/games/flip-rush/js/autopilot.js';

const STEP = 1 / 240;
const GAMES = [
  { name: 'Wave Rush', createGame: wave.createGame, sectors: waveConfig.SECTORS },
  { name: 'Ship Rush', createGame: ship.createGame, sectors: shipConfig.SECTORS },
  { name: 'Flip Rush', createGame: flip.createGame, sectors: flipConfig.SECTORS },
];

/** Plays with no input (and, for the ship, holding up) until it crashes. */
function crash(game: Game) {
  for (let i = 0; i < 240 * 60 && game.phase === 'playing'; i++) stepGame(game, { holding: game.wave.ship, tap: false }, STEP);
  expect(game.phase).toBe('dead');
}

/** A tap after the restart lock. */
function again(game: Game) {
  for (let i = 0; i < 240; i++) stepGame(game, { holding: false, tap: false }, STEP);
  stepGame(game, { holding: false, tap: true }, STEP);
}

describe.each(GAMES)('$name: normal play’s sector checkpoints', ({ createGame, sectors }) => {
  test('sectors 1–4 keep one; Insane and the Demon do not', () => {
    expect(sectors.map((s) => keepsNormalCheckpoint(s))).toEqual([true, true, true, true, false, false]);
  });

  test('a crash in a checkpointed sector starts that sector again, in the same run', () => {
    for (const sector of [2, 3, 4]) {
      const game = createGame({ rng: createRng(5), mode: 'normal', jump: { sector, section: 3 } });
      stepGame(game, { holding: false, tap: true }, STEP);
      const start = game.run.sectors[sector - 1]!.x0;
      expect(game.sectorStart).toBe(start);
      const run = game.run;
      crash(game);
      again(game);
      expect(game.run).toBe(run);
      expect(game.attempt).toBe(2);
      expect(game.wave.x).toBeLessThan(start + 0.1);
      expect(game.wave.x).toBeGreaterThan(start - 3);
      expect(game.wave.gravity).toBe(1);
    }
  });

  test('in Insane and the Demon a crash starts the whole run again', () => {
    for (const sector of [5, 6]) {
      const game = createGame({ rng: createRng(5), mode: 'normal', jump: { sector, section: 2 } });
      stepGame(game, { holding: false, tap: true }, STEP);
      expect(game.sectorStart).toBeNull();
      const run = game.run;
      crash(game);
      again(game);
      expect(game.run).not.toBe(run);
      expect(game.where.sector).toBe(1);
    }
  });

  test('sector 1 is the run’s start: a crash there builds a new run, as before; practice is unchanged', () => {
    const game = createGame({ rng: createRng(5), mode: 'normal' });
    stepGame(game, { holding: false, tap: true }, STEP);
    expect(game.sectorStart).toBeNull();
    const run = game.run;
    crash(game);
    again(game);
    expect(game.run).not.toBe(run);
    const practice = createGame({ rng: createRng(5), mode: 'practice', jump: { sector: 5, section: 3 } });
    expect(practice.sectorStart).toBeNull();
  });
});

test('reaching a checkpointed sector in normal play says so once (the page shows a toast)', () => {
  const game = flip.createGame({ rng: createRng(5), mode: 'normal', jump: { sector: 1, section: 10 } });
  stepGame(game, { holding: false, tap: true }, STEP);
  const pilot = createAutopilot();
  const events: string[] = [];
  const target = game.run.sectors[1]!.x0 + 1;
  for (let i = 0; i < 240 * 20 && game.wave.x < target && game.phase === 'playing'; i++) events.push(...stepGame(game, { holding: pilot.advise(game.run, game.wave), tap: false }, STEP));
  expect(game.phase).toBe('playing');
  expect(events.filter((e) => e === 'checkpoint')).toHaveLength(1);
  expect(game.sectorStart).toBe(game.run.sectors[1]!.x0);
});
