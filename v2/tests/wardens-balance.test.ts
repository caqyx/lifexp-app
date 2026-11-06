// Strażnicy Doliny's balance (docs/v2/PLAN.md 9.1, stage td-1), played headless: the
// game's rules are pure (public/games/wardens/js/sim.js, a fixed 1/60 s step, no
// randomness), so these runs are exactly what a player with the same build would see.
//
// The scripted build is what a careful player does: a few archers and a mortar where
// the road bends, frost and a ballista next, then a banner, then every pad filled and
// everything upgraded, buying each step as soon as the gold is there and letting every
// wave after the first start by itself (no early calls). With the numbers in config.js
// and maps.js it ends (lives left of 20):
//   Łąka 19 (3 stars) · Kanion 13 (2 stars) · Mokradła 9 (1 star) · endless: 24 waves.
// Doing nothing loses every map by wave 3; a build that stops investing after its first
// 24 steps still wins Łąka and Kanion but loses Mokradła; archers alone lose Mokradła.
import { describe, expect, test, vi } from 'vitest';
import { DT } from '../public/games/wardens/js/config.js';
import { MAPS, type MapDef } from '../public/games/wardens/js/maps.js';
import {
  buildTower,
  callWave,
  createGame,
  setPriority,
  starsFor,
  updateGame,
  upgradeCost,
  upgradeTower,
  type GameOptions,
} from '../public/games/wardens/js/sim.js';
import type { Priority, TowerType } from '../public/games/wardens/js/config.js';

type Step = ['build', number, TowerType] | ['upgrade', number] | ['aim', number, Priority];

/** The opening of each map: pads (by index in maps.js) where the road bends. */
const OPENINGS: Record<MapDef['id'], Step[]> = {
  meadow: [
    ['build', 4, 'archer'], ['build', 2, 'archer'], ['build', 8, 'mortar'], ['build', 5, 'frost'], ['upgrade', 4],
    ['build', 10, 'archer'], ['build', 0, 'ballista'], ['upgrade', 8], ['upgrade', 2], ['build', 12, 'mortar'],
    ['upgrade', 10], ['build', 13, 'banner'], ['upgrade', 0], ['upgrade', 5], ['upgrade', 4], ['upgrade', 8],
    ['upgrade', 12], ['build', 3, 'ballista'], ['upgrade', 0], ['upgrade', 3], ['upgrade', 2], ['upgrade', 10],
    ['upgrade', 12], ['upgrade', 3],
  ],
  canyon: [
    ['build', 5, 'archer'], ['build', 2, 'archer'], ['build', 6, 'mortar'], ['build', 15, 'frost'], ['upgrade', 5],
    ['build', 12, 'archer'], ['build', 9, 'ballista'], ['upgrade', 6], ['upgrade', 2], ['build', 10, 'mortar'],
    ['build', 7, 'banner'], ['upgrade', 12], ['upgrade', 9], ['upgrade', 15], ['upgrade', 5], ['upgrade', 6],
    ['build', 1, 'ballista'], ['upgrade', 10], ['upgrade', 9], ['upgrade', 1], ['upgrade', 2], ['upgrade', 12],
    ['upgrade', 1], ['upgrade', 10],
  ],
  marsh: [
    ['build', 10, 'archer'], ['build', 5, 'archer'], ['build', 2, 'mortar'], ['build', 7, 'frost'], ['upgrade', 10],
    ['build', 3, 'ballista'], ['upgrade', 5], ['build', 8, 'mortar'], ['upgrade', 2], ['build', 0, 'archer'],
    ['build', 6, 'banner'], ['upgrade', 3], ['upgrade', 8], ['upgrade', 7], ['upgrade', 10], ['upgrade', 5],
    ['build', 13, 'ballista'], ['upgrade', 3], ['upgrade', 2], ['upgrade', 8], ['upgrade', 13], ['upgrade', 0],
    ['upgrade', 13], ['upgrade', 0],
  ],
};

const FILLERS: TowerType[] = ['ballista', 'archer', 'mortar', 'archer'];

/** The opening, then every other pad (ballista, archer, mortar, archer in turn), then every tower to level 3. */
function fullBuild(map: MapDef): Step[] {
  const steps = [...OPENINGS[map.id]];
  const used = steps.filter((s) => s[0] === 'build').map((s) => s[1]);
  const rest = map.pads.map((_, i) => i).filter((i) => !used.includes(i));
  rest.forEach((pad, k) => steps.push(['build', pad, FILLERS[k % FILLERS.length] ?? 'archer']));
  for (const pad of [...used, ...rest]) steps.push(['upgrade', pad], ['upgrade', pad]);
  return steps;
}

/** Plays a map with a build order: each step bought as soon as it can be, in order. */
function play(map: MapDef, steps: Step[], options: GameOptions = {}) {
  const game = createGame(map, options);
  let next = 0;
  const limit = 60 * 60 * 90; // 90 minutes of game time: no map lasts that long
  for (let i = 0; i < limit && game.phase !== 'won' && game.phase !== 'lost'; i++) {
    while (next < steps.length) {
      const step = steps[next] as Step;
      const tower = game.towers[step[1]];
      if (step[0] === 'build' && tower) next++;
      else if (step[0] === 'upgrade' && (!tower || upgradeCost(tower) === null)) next++;
      else if (step[0] === 'aim') {
        setPriority(game, step[1], step[2]);
        next++;
      }
      else if (step[0] === 'build' ? buildTower(game, step[1], step[2]) : upgradeTower(game, step[1])) next++;
      else break;
    }
    if (game.phase === 'build' && game.wave === 0) callWave(game);
    updateGame(game, DT);
  }
  return game;
}

// Each run plays whole maps (a few seconds on a busy machine): a timeout well past vitest's 5 s.
vi.setConfig({ testTimeout: 60_000 });

const byId = (id: MapDef['id']) => MAPS.find((m) => m.id === id) as MapDef;

describe('a careful build wins every map', () => {
  const expected: Record<MapDef['id'], { lives: number; stars: number }> = {
    meadow: { lives: 19, stars: 3 },
    canyon: { lives: 13, stars: 2 },
    marsh: { lives: 9, stars: 1 },
  };
  for (const map of MAPS) {
    test(`${map.id}: won with lives to spare`, () => {
      const game = play(map, fullBuild(map));
      expect(game.phase).toBe('won');
      expect(game.cleared).toBe(map.waves);
      expect(game.lives).toBe(expected[map.id].lives);
      expect(starsFor(game.lives)).toBe(expected[map.id].stars);
    });
  }

  test('the maps get harder in order: fewer lives left on each', () => {
    const lives = MAPS.map((map) => play(map, fullBuild(map)).lives);
    expect(lives[0]).toBeGreaterThan(lives[1] ?? 0);
    expect(lives[1]).toBeGreaterThan(lives[2] ?? 0);
  });
});

describe('a weak defence loses', () => {
  for (const map of MAPS) {
    test(`${map.id}: doing nothing loses by wave 3`, () => {
      const game = play(map, []);
      expect(game.phase).toBe('lost');
      expect(game.wave).toBeLessThanOrEqual(3);
      expect(game.stats.kills).toBe(0);
    });
  }

  test('stopping after the opening still wins the first two maps, not the marsh', () => {
    expect(play(byId('meadow'), OPENINGS.meadow).phase).toBe('won');
    expect(play(byId('canyon'), OPENINGS.canyon).phase).toBe('won');
    const marsh = play(byId('marsh'), OPENINGS.marsh);
    expect(marsh.phase).toBe('lost');
    expect(marsh.cleared).toBeGreaterThan(10);
  });

  test('archers alone, even upgraded, lose the marsh', () => {
    const map = byId('marsh');
    const steps: Step[] = map.pads.map((_, i) => ['build', i, 'archer'] as Step);
    for (let i = 0; i < map.pads.length; i++) steps.push(['upgrade', i], ['upgrade', i]);
    expect(play(map, steps).phase).toBe('lost');
  });
});

describe('endless play', () => {
  test('goes past the marsh’s 20 waves with the careful build, and ends', () => {
    const map = byId('marsh');
    const game = play(map, fullBuild(map), { endless: true });
    expect(game.phase).toBe('lost');
    expect(game.cleared).toBe(24);
  });
});

test('the same build plays out the same every time (no randomness, fixed step)', () => {
  const map = byId('canyon');
  const a = play(map, fullBuild(map));
  const b = play(map, fullBuild(map));
  expect([a.lives, a.gold, a.stats.kills, a.time]).toEqual([b.lives, b.gold, b.stats.kills, b.time]);
});
