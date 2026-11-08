// Strażnicy Doliny's balance (docs/v2/PLAN.md 9.1, stage td-1), played headless: the
// game's rules are pure (public/games/wardens/js/sim.js, a fixed 1/60 s step, no
// randomness), so these runs are exactly what a player with the same build would see.
//
// The scripted build is what a careful player does: a few archers and a mortar where
// the road bends, frost and a ballista next, then a banner (on the marsh an alchemist
// against its armor and healers), then every other pad filled with the td-4 towers (tesla,
// alchemist, flamer, sniper in turn) and everything upgraded, buying each step as soon as
// the gold is there and letting every wave after the first start by itself (no early
// calls). With the numbers in config.js, maps.js and waves.js it ends (lives left of 20):
//   Łąka 19 (3 stars) · Kanion 13 (2 stars) · Mokradła 12 (2 stars) · endless: 23 waves.
// Doing nothing loses every map by wave 3; a build that stops investing after its first
// 24 steps wins Łąka only (the td-4 kinds in Kanion's and Mokradła's late waves need more);
// archers alone lose every map. Each td-4 enemy has a counter (the last describe).
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
import type { EnemyType, Priority, TowerType } from '../public/games/wardens/js/config.js';

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
    ['build', 6, 'alchemist'], ['upgrade', 3], ['upgrade', 8], ['upgrade', 7], ['upgrade', 10], ['upgrade', 5],
    ['build', 13, 'ballista'], ['upgrade', 3], ['upgrade', 2], ['upgrade', 8], ['upgrade', 13], ['upgrade', 0],
    ['upgrade', 13], ['upgrade', 0],
  ],
};

const FILLERS: TowerType[] = ['tesla', 'alchemist', 'flamer', 'sniper'];

/** The opening, then every other pad (tesla, alchemist, flamer, sniper in turn), then every tower to level 3. */
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
    marsh: { lives: 12, stars: 2 },
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

  test('with only the first five towers, the same build loses the marsh: the new kinds need the new towers', () => {
    const map = byId('marsh');
    const opening = OPENINGS.marsh.map((s): Step => (s[0] === 'build' && s[2] === 'alchemist' ? ['build', s[1], 'banner'] : s));
    const steps = [...opening];
    const used = steps.filter((s) => s[0] === 'build').map((s) => s[1]);
    const rest = map.pads.map((_, i) => i).filter((i) => !used.includes(i));
    const old: TowerType[] = ['ballista', 'archer', 'mortar', 'archer'];
    rest.forEach((pad, k) => steps.push(['build', pad, old[k % old.length] ?? 'archer']));
    for (const pad of [...used, ...rest]) steps.push(['upgrade', pad], ['upgrade', pad]);
    expect(play(map, steps).phase).toBe('lost');
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

  test('stopping after the opening wins the meadow only; the canyon and the marsh are lost late', () => {
    expect(play(byId('meadow'), OPENINGS.meadow).phase).toBe('won');
    const canyon = play(byId('canyon'), OPENINGS.canyon);
    expect(canyon.phase).toBe('lost');
    expect(canyon.cleared).toBeGreaterThan(12);
    const marsh = play(byId('marsh'), OPENINGS.marsh);
    expect(marsh.phase).toBe('lost');
    expect(marsh.cleared).toBeGreaterThan(10);
  });

  for (const map of MAPS) {
    test(`${map.id}: archers alone, even upgraded, lose`, () => {
      const steps: Step[] = map.pads.map((_, i) => ['build', i, 'archer'] as Step);
      for (let i = 0; i < map.pads.length; i++) steps.push(['upgrade', i], ['upgrade', i]);
      expect(play(map, steps).phase).toBe('lost');
    });
  }
});

describe('endless play', () => {
  test('goes past the marsh’s 20 waves with the careful build, and ends', () => {
    const map = byId('marsh');
    const game = play(map, fullBuild(map), { endless: true });
    expect(game.phase).toBe('lost');
    expect(game.cleared).toBe(23);
  });
});

test('the same build plays out the same every time (no randomness, fixed step)', () => {
  const map = byId('canyon');
  const a = play(map, fullBuild(map));
  const b = play(map, fullBuild(map));
  expect([a.lives, a.gold, a.stats.kills, a.time]).toEqual([b.lives, b.gold, b.stats.kills, b.time]);
});

// ── Each td-4 enemy has a counter ──────────────────────────────────────────────
// A group walks the meadow's road past four level-2 towers on the pads at its first bends
// (wave-10 health, or 12 for the boss); what gets through is counted. The counter lets
// (almost) nothing through where an ordinary choice lets many through.
type Spawn = { at: number; type: EnemyType };

function fight(spawns: Spawn[], towers: [number, TowerType][], wave = 10): number {
  const game = createGame(byId('meadow'), { gold: 99_999 });
  for (const [pad, type] of towers) {
    buildTower(game, pad, type);
    upgradeTower(game, pad);
  }
  game.phase = 'wave';
  game.wave = wave;
  game.totalWaves = 99;
  game.spawns = spawns;
  game.spawnCursor = 0;
  game.waveTime = 0;
  for (let i = 0; i < 60 * 300 && (game.spawnCursor < game.spawns.length || game.aliveCount > 0); i++) updateGame(game, DT);
  return game.stats.leaked;
}

const PADS = [4, 2, 8, 5];
const four = (type: TowerType): [number, TowerType][] => PADS.map((pad) => [pad, type]);
const row = (type: EnemyType, count: number, gap: number, from = 0): Spawn[] => Array.from({ length: count }, (_, i) => ({ at: from + i * gap, type }));

describe('each new enemy has a counter', () => {
  test('ironclad (armor 12): ballistas and snipers stop all eight; archers none', () => {
    const group = row('ironclad', 8, 1.2);
    expect(fight(group, four('ballista'))).toBe(0);
    expect(fight(group, four('sniper'))).toBe(0);
    expect(fight(group, four('archer'))).toBe(8);
  });

  test('shieldbearer: a blast, fire or lightning breaks the shield; arrows feed it', () => {
    const group = row('shieldbearer', 8, 1.2);
    for (const counter of ['mortar', 'flamer', 'tesla'] as const) expect(fight(group, four(counter)), counter).toBe(0);
    expect(fight(group, four('archer'))).toBeGreaterThanOrEqual(4);
  });

  test('shaman heals the column (more get through); a sniper picks the healers off', () => {
    const shells = row('shellback', 8, 1);
    const column = [...shells, ...row('shaman', 3, 2, 0.5)].sort((a, b) => a.at - b.at);
    const archers = four('archer');
    expect(fight(column, archers)).toBeGreaterThan(fight(shells, archers));
    const withSniper: [number, TowerType][] = [[4, 'archer'], [2, 'archer'], [8, 'sniper'], [5, 'archer']];
    expect(fight(column, withSniper)).toBeLessThanOrEqual(2);
  });

  test('bats (fast fliers in a flock): lightning and arrows stop them; mortars cannot reach them', () => {
    const flock = row('bat', 8, 0.28);
    expect(fight(flock, four('tesla'))).toBe(0);
    expect(fight(flock, four('archer'))).toBe(0);
    expect(fight(flock, four('mortar'))).toBe(8);
  });

  test('burrower (under the road for a stretch): reach and lightning get it; archers on the dug stretch do not', () => {
    const group = row('burrower', 8, 1.2);
    expect(fight(group, four('sniper'))).toBe(0);
    expect(fight(group, four('tesla'))).toBe(0);
    expect(fight(group, four('archer'))).toBeGreaterThanOrEqual(6);
  });

  test('berserker (faster when hurt): heavy single hits kill it before it rages; arrows let it run', () => {
    const group = row('berserker', 6, 1.5);
    expect(fight(group, four('ballista'))).toBe(0);
    expect(fight(group, four('sniper'))).toBe(0);
    expect(fight(group, four('archer'))).toBeGreaterThanOrEqual(3);
  });

  test('brood mother (boss, drops crawlers): heavy hits for her and splash or fire for her brood', () => {
    const boss = [{ at: 0, type: 'broodmother' as const }];
    expect(fight(boss, [[4, 'ballista'], [2, 'mortar'], [8, 'ballista'], [5, 'mortar']], 12)).toBe(0);
    expect(fight(boss, [[4, 'sniper'], [2, 'flamer'], [8, 'sniper'], [5, 'flamer']], 12)).toBe(0);
    expect(fight(boss, four('archer'), 12)).toBeGreaterThanOrEqual(3);
  });
});

// ── Custom mode (td-5): a painted map with waves from the chosen kinds ──────────
describe('custom games', async () => {
  const { toMapDef } = await import('../public/games/wardens/js/mapedit.js');
  const { PICKABLE_ENEMIES } = await import('../public/games/wardens/js/config.js');
  const road: [number, number][] = [];
  for (let r = 0; r <= 5; r++) road.push([2, r]);
  for (let c = 3; c <= 6; c++) road.push([c, 5]);
  for (let r = 6; r < 15; r++) road.push([6, r]);
  const pads: [number, number][] = [[3, 2], [1, 4], [4, 6], [5, 8], [7, 10], [5, 12], [3, 4], [5, 4], [7, 6], [5, 10]];
  const map = toMapDef({ id: 't', name: 't', look: 'meadow', path: road, pads });
  const kinds: TowerType[] = ['archer', 'mortar', 'tesla', 'sniper', 'alchemist', 'flamer', 'frost', 'ballista', 'archer', 'mortar'];
  const build: Step[] = pads.map((_, i) => ['build', i, kinds[i] ?? 'archer'] as Step);
  for (let i = 0; i < pads.length; i++) build.push(['upgrade', i], ['upgrade', i]);
  const every = { types: [...PICKABLE_ENEMIES], waves: 10, bosses: true, difficulty: 1 };

  test('every kind chosen, 10 waves: doing nothing loses at once, a full build of the spots wins', () => {
    expect(play(map, [], { custom: every }).phase).toBe('lost');
    const game = play(map, build, { custom: every });
    expect(game.phase).toBe('won');
    expect(game.cleared).toBe(10);
  });

  test('the hard setting (health × 1.5) loses with the same build; infinite gold carries 20 waves', () => {
    expect(play(map, build, { custom: { ...every, difficulty: 1.5 }, difficulty: 1.5 }).phase).toBe('lost');
    expect(play(map, build, { custom: { ...every, waves: 20 }, infiniteGold: true }).phase).toBe('won');
  });

  test('the painted map with the campaign’s waves plays like the meadow: won with the full build', () => {
    expect(play(map, build).phase).toBe('won');
  });
});
