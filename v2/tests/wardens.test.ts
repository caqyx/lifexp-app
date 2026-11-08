// Strażnicy Doliny's pure parts (docs/v2/PLAN.md 9.1, stage td-1): the game is plain ES
// modules in public/games/wardens (no build step, its own CSP), and these tests import
// the same files the game runs. The balance is in wardens-balance.test.ts.
import { describe, expect, test } from 'vitest';
import { DT, ENEMIES, ENEMY_TYPES, SELL_REFUND, START_LIVES, TOWERS, TOWER_TYPES } from '../public/games/wardens/js/config.js';
import { COLS, MAPS, ROWS, createPath, distanceToRoad, pointAt, roadTiles } from '../public/games/wardens/js/maps.js';
import { createSpawns, createWave, describeWave, isBossWave } from '../public/games/wardens/js/waves.js';
import {
  MAX_ENEMIES,
  applySlow,
  buildCost,
  buildTower,
  callWave,
  canHit,
  createGame,
  damageAfterArmor,
  earlyBonus,
  enemyHp,
  findTarget,
  sellTower,
  setPaused,
  setPriority,
  spawnEnemy,
  starsFor,
  updateGame,
  upgradeCost,
  upgradeTower,
  waveBonus,
  type Game,
} from '../public/games/wardens/js/sim.js';
import { computeLayout, mapTransform, toMap, toMapCell, toScreen } from '../public/games/wardens/js/layout.js';
import {
  PROGRESS_KEY,
  SETTINGS_KEY,
  isUnlocked,
  readProgress,
  readSettings,
  saveEndless,
  saveSettings,
  saveWin,
} from '../public/games/wardens/js/records.js';
import { TEXT_KEYS, pickLang, testParams, translator } from '../public/games/wardens/js/i18n.js';
import { addBurst, createEffects, plusLabel, updateEffects } from '../public/games/wardens/js/effects.js';

const [meadow, canyon, marsh] = MAPS as [(typeof MAPS)[0], (typeof MAPS)[0], (typeof MAPS)[0]];

/** A game in the middle of a wave with nothing left to spawn, so enemies can be placed by hand. */
function waveGame(map = meadow, gold = 5000): Game {
  const game = createGame(map, { gold });
  game.phase = 'wave';
  game.wave = 1;
  game.spawns = [];
  return game;
}

function run(game: Game, seconds: number) {
  for (let i = 0; i < Math.round(seconds / DT); i++) updateGame(game, DT);
}

describe('maps', () => {
  test('three maps, 15, 18 and 20 waves, endless only on the last', () => {
    expect(MAPS.map((m) => [m.id, m.waves, m.endless === true])).toEqual([
      ['meadow', 15, false],
      ['canyon', 18, false],
      ['marsh', 20, true],
    ]);
  });

  for (const map of MAPS) {
    test(`${map.id}: the road enters above and leaves below; pads are off the road, beside it, on the grid, each once`, () => {
      const first = map.road[0] as readonly [number, number];
      const last = map.road[map.road.length - 1] as readonly [number, number];
      expect(first[1]).toBeLessThan(0);
      expect(last[1]).toBeGreaterThan(ROWS - 1);
      const road = roadTiles(map);
      const path = createPath(map);
      const keys = map.pads.map(([c, r]) => `${c},${r}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(map.pads.length).toBeGreaterThanOrEqual(12);
      for (const [c, r] of map.pads) {
        expect(road.has(`${c},${r}`)).toBe(false);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(COLS);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(ROWS);
        expect(distanceToRoad(path, c + 0.5, r + 0.5)).toBeLessThanOrEqual(1.6);
      }
    });
  }

  test('the roads differ: lengths and corners', () => {
    const lengths = MAPS.map((m) => Math.round(createPath(m).total));
    expect(new Set(lengths).size).toBe(3);
    expect(new Set(MAPS.map((m) => JSON.stringify(m.road))).size).toBe(3);
  });

  test('a point along the road: the start, a corner, the end and past it', () => {
    const path = createPath(meadow);
    const out = { x: 0, y: 0 };
    pointAt(path, 0, out);
    expect(out).toEqual({ x: 4.5, y: -0.7 });
    pointAt(path, 4.2 + 3, out); // down to the first corner (4.2 tiles), then 3 to the left
    expect(out.x).toBeCloseTo(1.5);
    expect(out.y).toBeCloseTo(3.5);
    pointAt(path, path.total + 5, out);
    expect(out.y).toBeCloseTo(15.7);
  });
});

describe('waves', () => {
  test('every enemy type comes in the campaign; Colossus waves are the last and one at three fifths', () => {
    const seen = new Set<string>();
    for (const map of MAPS) {
      for (let n = 1; n <= map.waves; n++) for (const g of createWave(map, n).groups) seen.add(g.type);
      const bosses = Array.from({ length: map.waves }, (_, i) => i + 1).filter((n) => isBossWave(map, n));
      expect(bosses).toEqual([Math.ceil(map.waves * 0.6), map.waves]);
    }
    seen.add('shard'); // shards only come out of splitters
    expect([...seen].sort()).toEqual([...ENEMY_TYPES].sort());
  });

  test('waves grow; the canyon brings moths sooner, the marsh armor sooner', () => {
    const size = (map: typeof meadow, n: number) => createSpawns(createWave(map, n)).length;
    expect(size(meadow, 10)).toBeGreaterThan(size(meadow, 2));
    const has = (map: typeof meadow, n: number, type: string) => createWave(map, n).groups.some((g) => g.type === type);
    expect(has(canyon, 3, 'moth')).toBe(true);
    expect(has(meadow, 3, 'moth')).toBe(false);
    expect(has(marsh, 4, 'shellback')).toBe(true);
    expect(has(meadow, 4, 'shellback')).toBe(false);
  });

  test('spawns are in time order and match the preview', () => {
    const wave = createWave(marsh, 12);
    const spawns = createSpawns(wave);
    expect(spawns.map((s) => s.at)).toEqual([...spawns.map((s) => s.at)].sort((a, b) => a - b));
    const total = describeWave(wave).reduce((n, row) => n + row.count, 0);
    expect(total).toBe(spawns.length);
  });

  test('endless play goes on past the map, a Colossus every fifth wave', () => {
    expect(createWave(marsh, 37).groups.length).toBeGreaterThan(2);
    expect(isBossWave(marsh, 25)).toBe(true);
    expect(isBossWave(marsh, 26)).toBe(false);
  });

  test('health grows with the wave and the map; past the map it grows faster', () => {
    const game = createGame(marsh);
    expect(enemyHp(game, 'crawler', 1)).toBe(Math.round(ENEMIES.crawler.hp * marsh.hpFactor));
    expect(enemyHp(game, 'crawler', 10)).toBeGreaterThan(enemyHp(game, 'crawler', 5));
    const step20 = enemyHp(game, 'crawler', 20) - enemyHp(game, 'crawler', 19);
    const step22 = enemyHp(game, 'crawler', 22) - enemyHp(game, 'crawler', 21);
    expect(step22).toBeGreaterThan(step20);
  });
});

describe('combat', () => {
  test('armor comes off every hit, at least 1 gets through; a piercing hit ignores it', () => {
    expect(damageAfterArmor(6, 5, false)).toBe(1);
    expect(damageAfterArmor(3, 5, false)).toBe(1);
    expect(damageAfterArmor(15, 5, false)).toBe(10);
    expect(damageAfterArmor(40, 5, true)).toBe(40);
  });

  test('fliers: the mortar cannot reach them, the others can (the banner does not attack)', () => {
    const game = waveGame();
    spawnEnemy(game, 'moth', 1, 1);
    const moth = game.enemies.find((e) => e.alive)!;
    expect(canHit(TOWERS.mortar, moth)).toBe(false);
    for (const type of ['archer', 'frost', 'ballista'] as const) expect(canHit(TOWERS[type], moth)).toBe(true);
    expect(canHit(TOWERS.banner, moth)).toBe(false);
  });

  test('targeting: first along the road, strongest by health, closest to the tower', () => {
    const game = waveGame();
    // Pad 4 (2,5) beside the left stretch of the meadow's road.
    buildTower(game, 4, 'ballista');
    spawnEnemy(game, 'crawler', 6.5, 1); // near the top-left corner
    spawnEnemy(game, 'shellback', 8.5, 1); // closest to the pad, more health
    spawnEnemy(game, 'runner', 10.5, 1); // furthest along
    const slots = game.enemies.map((e, i) => (e.alive ? i : -1)).filter((i) => i >= 0);
    const tower = game.towers[4]!;
    const [crawler, shellback, runner] = slots as [number, number, number];
    expect(findTarget(game, tower)).toBe(runner);
    setPriority(game, 4, 'strongest');
    expect(findTarget(game, tower)).toBe(shellback);
    setPriority(game, 4, 'closest');
    const d = (i: number) => Math.hypot(game.enemies[i]!.x - tower.x, game.enemies[i]!.y - tower.y);
    const nearest = [crawler, shellback, runner].sort((a, b) => d(a) - d(b))[0];
    expect(findTarget(game, tower)).toBe(nearest);
  });

  test('out of range: no target, and the tower stays ready', () => {
    const game = waveGame();
    buildTower(game, 0, 'archer');
    spawnEnemy(game, 'crawler', 26, 1); // near the gate, far from pad 0
    expect(findTarget(game, game.towers[0]!)).toBe(-1);
  });

  test('frost slows everything around it; a Colossus resists half; the slow wears off', () => {
    const game = waveGame();
    spawnEnemy(game, 'crawler', 1, 1);
    spawnEnemy(game, 'colossus', 1, 1);
    const [crawler, boss] = game.enemies.filter((e) => e.alive);
    applySlow(crawler!, 0.4, 1);
    applySlow(boss!, 0.4, 1);
    expect(crawler!.slowFactor).toBeCloseTo(0.6);
    expect(boss!.slowFactor).toBeCloseTo(0.8);
    run(game, 1.1);
    expect(crawler!.slowFactor).toBe(1);
  });

  test('a splitter breaks into two shards; every kill pays its gold', () => {
    const game = waveGame(meadow, 0);
    game.gold = 0;
    spawnEnemy(game, 'splitter', 5, 1);
    const splitter = game.enemies.find((e) => e.alive)!;
    splitter.hp = 1;
    game.towers[4] = null;
    // Kill it the way a shot would: a piercing tower right there.
    game.gold = 500;
    buildTower(game, 4, 'ballista');
    const before = game.gold;
    run(game, 0.5);
    expect(game.enemies.filter((e) => e.alive && e.type === 'shard')).toHaveLength(2);
    expect(game.gold).toBe(before + ENEMIES.splitter.gold);
    expect(game.stats.kills).toBe(1);
  });

  test('an enemy through the gate costs its lives (a Colossus five); at 0 the game is lost', () => {
    const game = waveGame();
    game.lives = 6;
    const path = game.path.total;
    spawnEnemy(game, 'colossus', path - 0.01, 1);
    spawnEnemy(game, 'crawler', 0, 1);
    run(game, 0.1);
    expect(game.lives).toBe(1);
    expect(game.phase).toBe('wave');
    game.enemies.find((e) => e.alive)!.dist = path - 0.01;
    run(game, 0.1);
    expect(game.lives).toBe(0);
    expect(game.phase).toBe('lost');
  });

  test('the pools are fixed: enemies past the pool are not created, nothing breaks', () => {
    const game = waveGame();
    for (let i = 0; i < MAX_ENEMIES + 10; i++) spawnEnemy(game, 'crawler', 0, 1);
    expect(game.aliveCount).toBe(MAX_ENEMIES);
    run(game, 0.5);
    expect(game.enemies).toHaveLength(MAX_ENEMIES);
  });
});

describe('economy and actions', () => {
  test('build: the price comes off; not without the gold; not twice on a pad', () => {
    const game = createGame(meadow, { gold: 100 });
    expect(buildTower(game, 0, 'ballista')).toBe(true);
    expect(game.gold).toBe(100 - buildCost('ballista'));
    expect(buildTower(game, 1, 'ballista')).toBe(false);
    expect(buildTower(game, 0, 'archer')).toBe(false);
    expect(buildTower(game, 99, 'archer')).toBe(false);
  });

  test('upgrade to level 3 and no further; sell gives back 70 % of everything spent', () => {
    const game = createGame(meadow, { gold: 1000 });
    buildTower(game, 2, 'mortar');
    const tower = game.towers[2]!;
    expect(upgradeCost(tower)).toBe(TOWERS.mortar.cost[1]);
    expect(upgradeTower(game, 2)).toBe(true);
    expect(upgradeTower(game, 2)).toBe(true);
    expect(tower.level).toBe(3);
    expect(upgradeCost(tower)).toBeNull();
    expect(upgradeTower(game, 2)).toBe(false);
    const spent = TOWERS.mortar.cost.reduce((a, b) => a + b, 0);
    const gold = game.gold;
    expect(sellTower(game, 2)).toBe(Math.floor(spent * SELL_REFUND));
    expect(game.gold).toBe(gold + Math.floor(spent * SELL_REFUND));
    expect(game.towers[2]).toBeNull();
  });

  test('a banner makes towers in its range hit harder; banners do not stack', () => {
    // A small field of its own: three pads in a row, 1 and 2 tiles apart.
    const field = { ...meadow, pads: [[0, 10], [1, 10], [2, 10]] as const };
    const game = createGame(field, { gold: 2000 });
    buildTower(game, 0, 'archer');
    buildTower(game, 2, 'banner'); // 2 tiles away: out of a level-1 banner's 1.6
    expect(game.towers[0]!.buff).toBe(0);
    upgradeTower(game, 2);
    upgradeTower(game, 2); // level 3 reaches 2.05 tiles
    expect(game.towers[0]!.buff).toBe(TOWERS.banner.buff![2]);
    buildTower(game, 1, 'banner'); // a second banner, right next to it
    expect(game.towers[0]!.buff).toBe(TOWERS.banner.buff![2]); // the strongest counts, no stacking
    expect(game.towers[1]!.buff).toBe(0); // banners are not buffed
    sellTower(game, 2);
    expect(game.towers[0]!.buff).toBe(TOWERS.banner.buff![0]);
  });

  test('the first wave waits for the player; then each starts by itself after the break, or early for a bonus', () => {
    const game = createGame(meadow, { waves: 3 });
    run(game, 60);
    expect(game.wave).toBe(0);
    expect(callWave(game)).toBe(0);
    expect(game.phase).toBe('wave');
    expect(callWave(game)).toBe(-1); // not while one is running
    // Clear it by hand: no enemies, no spawns left.
    for (const e of game.enemies) e.alive = false;
    game.aliveCount = 0;
    game.spawnCursor = game.spawns.length;
    const gold = game.gold;
    run(game, DT);
    expect(game.phase).toBe('build');
    expect(game.gold).toBe(gold + waveBonus(1));
    run(game, 9.5);
    expect(earlyBonus(game)).toBe(15); // 25 s break − 9.5 s: 15 whole seconds left
    const before = game.gold;
    expect(callWave(game)).toBe(15);
    expect(game.gold).toBe(before + 15);
    expect(game.wave).toBe(2);
  });

  test('a wave left alone starts when the break ends', () => {
    const game = createGame(meadow, { waves: 3 });
    callWave(game);
    for (const e of game.enemies) e.alive = false;
    game.aliveCount = 0;
    game.spawnCursor = game.spawns.length;
    run(game, 26);
    expect(game.wave).toBe(2);
  });

  test('winning the last wave ends the map; stars by lives left', () => {
    const game = createGame(meadow, { waves: 1, gold: 2000 });
    for (const pad of [4, 2, 8, 0]) buildTower(game, pad, 'ballista');
    callWave(game);
    run(game, 120);
    expect(game.phase).toBe('won');
    expect(starsFor(20)).toBe(3);
    expect(starsFor(18)).toBe(3);
    expect(starsFor(17)).toBe(2);
    expect(starsFor(10)).toBe(2);
    expect(starsFor(9)).toBe(1);
    expect(starsFor(1)).toBe(1);
    // With the test switch's lives, the thresholds scale: 5 lives of 5 is all of them.
    expect(starsFor(5, 5)).toBe(3);
  });

  test('pause stops time; nothing changes after the end', () => {
    const game = createGame(meadow);
    callWave(game);
    setPaused(game, true);
    run(game, 5);
    expect(game.time).toBe(0);
    setPaused(game, false);
    run(game, 1);
    expect(game.time).toBeGreaterThan(0.9);
    game.phase = 'lost';
    expect(buildTower(game, 0, 'archer')).toBe(false);
  });

  test('start numbers: 20 lives, the map’s gold', () => {
    const game = createGame(canyon);
    expect(game.lives).toBe(START_LIVES);
    expect(game.gold).toBe(canyon.startGold);
    expect(game.totalWaves).toBe(18);
    expect(createGame(marsh, { endless: true }).totalWaves).toBe(Infinity);
    expect(createGame(meadow, { endless: true }).totalWaves).toBe(15); // no endless on the meadow
  });

  test('every tower type has three levels that get stronger', () => {
    for (const type of TOWER_TYPES) {
      const def = TOWERS[type];
      expect(def.cost).toHaveLength(3);
      expect(def.range[2]).toBeGreaterThan(def.range[0] ?? 0);
      if (def.attack !== 'aura') expect(def.damage[2]).toBeGreaterThan(def.damage[0] ?? 0);
      else expect(def.buff![2]).toBeGreaterThan(def.buff![0] ?? 0);
    }
  });
});

describe('layout', () => {
  test('pixel art: 16-pixel tiles, a whole number of device pixels per art pixel, the art covering the stage', () => {
    // A Pixel 7 held upright (the stage under the HUD) and sideways, and a desktop window.
    for (const [w, h, dpr, rotated] of [[396, 700, 2.625, false], [600, 380, 2.625, true], [1000, 640, 1, true]] as const) {
      const layout = computeLayout(w, h, dpr);
      expect(layout.rotated).toBe(rotated);
      expect(layout.tile).toBe(16);
      expect(Number.isInteger(layout.k)).toBe(true);
      expect(layout.mapWidth).toBe((rotated ? 15 : 9) * 16);
      expect(layout.width * layout.k).toBeGreaterThanOrEqual(Math.round(w * dpr));
      expect(layout.height * layout.k).toBeGreaterThanOrEqual(Math.round(h * dpr));
      expect(layout.ox).toBeGreaterThanOrEqual(0);
      expect(layout.oy).toBeGreaterThanOrEqual(0);
      expect(layout.px).toBeCloseTo(layout.k / dpr);
    }
    // Pixel 7 upright: 7 device pixels per art pixel, a tile ≈ 43 CSS pixels.
    expect(computeLayout(396, 700, 2.625).k).toBe(7);
  });

  test('a point goes to the screen and back; the canvas transform agrees', () => {
    for (const layout of [computeLayout(412, 700, 2), computeLayout(800, 360, 3)]) {
      const s = { x: 0, y: 0 };
      const m = { x: 0, y: 0 };
      toScreen(layout, 2.5, 7.25, s);
      toMap(layout, s.x, s.y, m);
      expect(m.x).toBeCloseTo(2.5);
      expect(m.y).toBeCloseTo(7.25);
      const [a, b, c, d, e, f] = mapTransform(layout);
      expect(a * 2.5 + c * 7.25 + e).toBeCloseTo(s.x);
      expect(b * 2.5 + d * 7.25 + f).toBeCloseTo(s.y);
    }
  });

  test('turned, the road enters on the left', () => {
    const layout = computeLayout(800, 360, 2);
    const s = { x: 0, y: 0 };
    toScreen(layout, 4.5, 0, s);
    expect(s.x).toBe(layout.ox);
    const cell = { c: 0, r: 0 };
    toMapCell(layout, s.x + 1, s.y - 1, cell);
    expect(cell).toEqual({ c: 4, r: 0 });
  });
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('records', () => {
  test('stars are kept when better; the next map opens after a win; endless after the marsh', () => {
    const storage = memoryStorage();
    const progress = readProgress(storage);
    expect(isUnlocked(progress, MAPS, 0)).toBe(true);
    expect(isUnlocked(progress, MAPS, 1)).toBe(false);
    expect(saveWin(storage, progress, 'meadow', 2)).toBe(true);
    expect(saveWin(storage, progress, 'meadow', 1)).toBe(false);
    expect(isUnlocked(progress, MAPS, 1)).toBe(true);
    expect(isUnlocked(progress, MAPS, 2)).toBe(false);
    expect(saveEndless(storage, progress, 23)).toBe(true);
    expect(saveEndless(storage, progress, 20)).toBe(false);
    expect(readProgress(storage)).toEqual({ stars: { meadow: 2 }, endlessBest: 23 });
    expect([...storage.data.keys()]).toEqual([PROGRESS_KEY]);
  });

  test('garbage and blocked storage read as nothing, and writing never throws', () => {
    expect(readProgress(memoryStorage({ [PROGRESS_KEY]: '{oops' }))).toEqual({ stars: {}, endlessBest: 0 });
    expect(readProgress(memoryStorage({ [PROGRESS_KEY]: '{"stars":{"meadow":9,"x":-1},"endlessBest":"7"}' }))).toEqual({
      stars: { meadow: 3, x: 0 },
      endlessBest: 0,
    });
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readProgress(blocked)).toEqual({ stars: {}, endlessBest: 0 });
    expect(() => saveWin(blocked, readProgress(blocked), 'meadow', 3)).not.toThrow();
    expect(readProgress(null)).toEqual({ stars: {}, endlessBest: 0 });
  });

  test('settings: the speed, 1 or 2', () => {
    const storage = memoryStorage();
    expect(readSettings(storage)).toEqual({ speed: 1 });
    saveSettings(storage, { speed: 2 });
    expect(readSettings(storage)).toEqual({ speed: 2 });
    expect(readSettings(memoryStorage({ [SETTINGS_KEY]: '{"speed":7}' }))).toEqual({ speed: 1 });
  });
});

describe('texts and test switches', () => {
  test('Polish and English have the same keys; ?lang=en picks English', () => {
    expect(TEXT_KEYS.en).toEqual(TEXT_KEYS.pl);
    expect(pickLang('?lang=en')).toBe('en');
    expect(pickLang('?lang=de')).toBe('pl');
    expect(translator('pl')('waveOf', { n: 3, total: 15 })).toBe('3/15');
    expect(translator('en')('title')).toBe('Valley Wardens');
  });

  test('every tower and enemy has a name in both languages', () => {
    for (const lang of ['pl', 'en'] as const) {
      const keys = TEXT_KEYS[lang];
      for (const type of TOWER_TYPES) expect(keys).toContain(`tower.${type}`);
      for (const type of ENEMY_TYPES) expect(keys).toContain(`enemy.${type}`);
      for (const map of MAPS) expect(keys).toContain(`map.${map.id}`);
    }
  });

  test('the switches work only with ?test=1, within bounds', () => {
    expect(testParams('?speed=20&waves=2')).toEqual({ on: false, speed: null, waves: null, lives: null, gold: null, start: null });
    expect(testParams('?test=1&speed=500&waves=2&lives=3&gold=900&start=21')).toEqual({ on: true, speed: 60, waves: 2, lives: 3, gold: 900, start: 21 });
    expect(testParams('?test=1&speed=abc').speed).toBeNull();
  });
});

describe('effects', () => {
  test('fixed pools: a burst bigger than the pool fills it and stops; effects run out', () => {
    const fx = createEffects();
    addBurst(fx, 1, 1, 1000, '#fff', 2);
    expect(fx.sparks.every((s) => s.alive)).toBe(true);
    updateEffects(fx, 2);
    expect(fx.sparks.some((s) => s.alive)).toBe(false);
    expect(plusLabel(4)).toBe('+4');
    expect(plusLabel(9999)).toBe('+200');
  });
});

describe('smooth drawing and the perf switch (q-own)', () => {
  test('each step keeps where enemies and shots were, for drawing between steps', () => {
    const game = waveGame();
    spawnEnemy(game, 'runner', 2, 1);
    const enemy = game.enemies.find((e) => e.alive)!;
    expect([enemy.px, enemy.py]).toEqual([enemy.x, enemy.y]);
    const before = { x: enemy.x, y: enemy.y };
    run(game, DT);
    expect([enemy.px, enemy.py]).toEqual([before.x, before.y]);
    expect(enemy.y).not.toBe(before.y);
  });

  test('?start= (test only) begins at a later wave, counted as cleared', () => {
    const game = createGame(marsh, { start: 18 });
    expect([game.wave, game.cleared, game.nextWave?.number]).toEqual([17, 17, 18]);
    callWave(game);
    expect(game.wave).toBe(18);
    expect(createGame(marsh, { endless: true, start: 24 }).nextWave?.number).toBe(24);
  });
});

// ── Pixel art (td-2): the font covers every text, every sprite is a clean rectangle ──
describe('pixel art', async () => {
  const { FONT_HEIGHT, GLYPHS, PALETTE, isRectangular, measureText, wrapText } = await import('../public/games/wardens/js/pixelart.js');
  const { ICONS } = await import('../public/games/wardens/js/sprites.js');
  const { roadCells } = await import('../public/games/wardens/js/terrain.js');
  const { textScaleFor } = await import('../public/games/wardens/js/pixelui.js');

  test('the bitmap font has a glyph for every character of every text in both languages, Polish letters included', () => {
    const values = { n: '0123456789', total: '20', s: '25', k: '18', gold: '15', map: 'Łąka', name: 'Łucznik', level: '2', p: '25' };
    const missing = new Set<string>();
    for (const lang of ['pl', 'en'] as const) {
      const t = translator(lang);
      for (const key of TEXT_KEYS[lang]) for (const ch of t(key as Parameters<typeof t>[0], values)) if (!GLYPHS.has(ch)) missing.add(ch);
    }
    for (const ch of 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ×·→∞+') if (!GLYPHS.has(ch)) missing.add(ch);
    expect([...missing]).toEqual([]);
    for (const [, glyph] of GLYPHS) {
      expect(glyph).toHaveLength(FONT_HEIGHT);
      expect(isRectangular(glyph)).toBe(true);
    }
  });

  test('accents sit above the letter and the ogonek below it', () => {
    const z = GLYPHS.get('ż')!;
    const zz = GLYPHS.get('z')!;
    expect(z.slice(4)).toEqual(zz.slice(4));
    expect(z.slice(0, 4).join('')).toContain('#');
    const a = GLYPHS.get('ą')!;
    expect(a.slice(9).join('')).toContain('#');
    expect(GLYPHS.get('Ż')![1]).toContain('#');
  });

  test('measuring and wrapping text', () => {
    expect(measureText('')).toBe(0);
    expect(measureText('II')).toBe(7);
    expect(wrapText('Stuknij jasne pole przy drodze', 60).length).toBeGreaterThan(1);
    expect(wrapText('Fala', 60)).toEqual(['Fala']);
  });

  test('every icon is a rectangle of palette colours', () => {
    const colours = new Set([...Object.keys(PALETTE), '.']);
    for (const rows of Object.values(ICONS)) {
      expect(isRectangular(rows)).toBe(true);
      for (const row of rows) for (const ch of row) expect(colours.has(ch)).toBe(true);
    }
    expect(Object.keys(PALETTE)).toHaveLength(32);
  });

  test('the road runs on past both edges of the map (into the cave and out through the gate)', () => {
    const cells = roadCells(meadow);
    expect(cells.has('4,-3')).toBe(true);
    expect(cells.has('4,17')).toBe(true);
  });

  test('text scale: a whole number of device pixels per font pixel, at least 2', () => {
    expect(textScaleFor(1)).toBe(2);
    expect(textScaleFor(2.625)).toBe(5);
    expect(textScaleFor(3)).toBe(6);
  });
});

// ── Characters drawn in code (td-3): sizes, frames, aiming, palette-only pixels ──
/** A tiny software canvas (fillRect, getImageData, putImageData), enough for art.js in Node. */
function fakeDocument() {
  const parse = (style: string): [number, number, number, number] => {
    const n = Number.parseInt(style.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  };
  return {
    createElement: () => {
      const canvas = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray(4),
        getContext: () => ctx,
      };
      const ensure = () => {
        if (canvas.data.length !== canvas.width * canvas.height * 4) canvas.data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      };
      const ctx = {
        fillStyle: '#000000',
        imageSmoothingEnabled: false,
        tx: 0,
        ty: 0,
        translate(dx: number, dy: number) {
          this.tx += dx;
          this.ty += dy;
        },
        fillRect(x0: number, y0: number, w: number, h: number) {
          ensure();
          const x = x0 + this.tx;
          const y = y0 + this.ty;
          const c = parse(String(this.fillStyle));
          for (let yy = Math.max(0, y); yy < Math.min(canvas.height, y + h); yy++)
            for (let xx = Math.max(0, x); xx < Math.min(canvas.width, x + w); xx++) canvas.data.set(c, (yy * canvas.width + xx) * 4);
        },
        getImageData: () => {
          ensure();
          return { data: new Uint8ClampedArray(canvas.data) };
        },
        putImageData: (img: { data: Uint8ClampedArray }) => {
          canvas.data = new Uint8ClampedArray(img.data);
        },
        // Enough for the ground's tiles to be built (their pictures are not checked here).
        drawImage: () => {},
        clearRect: () => {},
      };
      return canvas;
    },
  };
}

describe('characters (art.js)', async () => {
  (globalThis as unknown as { document: unknown }).document ??= fakeDocument();
  const { PALETTE } = await import('../public/games/wardens/js/pixelart.js');
  const { TOWER_H, TOWER_W, aimDir, enemyArt, towerArt } = await import('../public/games/wardens/js/art.js');
  type Pic = { width: number; height: number; data: Uint8ClampedArray };
  const colours = new Set(Object.values(PALETTE).map((hex) => hex.toLowerCase()));
  const onPalette = (pic: Pic) => {
    for (let i = 0; i < pic.data.length; i += 4) {
      if (pic.data[i + 3] === 0) continue;
      const hex = `#${[0, 1, 2].map((k) => (pic.data[i + k] ?? 0).toString(16).padStart(2, '0')).join('')}`;
      if (!colours.has(hex)) return false;
    }
    return true;
  };

  test('enemies are 14–40 px (plus a clear margin) with 4–6 walk frames, all on the palette; the Colossus is the big one', () => {
    for (const type of ENEMY_TYPES) {
      const art = enemyArt(type);
      expect(art.frames).toBeGreaterThanOrEqual(4);
      expect(art.frames).toBeLessThanOrEqual(6);
      for (let f = 0; f < art.frames; f++) {
        const pic = art.make(f) as unknown as Pic;
        expect(pic.width).toBeGreaterThanOrEqual(14);
        expect(pic.width).toBeLessThanOrEqual(44);
        expect(onPalette(pic)).toBe(true);
      }
    }
    const colossus = enemyArt('colossus').make(0) as unknown as Pic;
    const crawler = enemyArt('crawler').make(0) as unknown as Pic;
    expect(colossus.width).toBeGreaterThanOrEqual(36);
    expect(colossus.height).toBeGreaterThanOrEqual(36);
    expect(colossus.width * colossus.height).toBeGreaterThan(crawler.width * crawler.height * 3);
  });

  test('towers: one size, every level, 8 aims and a firing frame, each level taller than the last', () => {
    for (const type of TOWER_TYPES) {
      const tops: number[] = [];
      for (const level of [1, 2, 3]) {
        for (let dir = 0; dir < 8; dir++) {
          const pic = towerArt(type, level, dir, dir === 3) as unknown as Pic;
          expect([pic.width, pic.height]).toEqual([TOWER_W, TOWER_H]);
          expect(onPalette(pic)).toBe(true);
        }
        const pic = towerArt(type, level, 0, false) as unknown as Pic;
        let top = 0;
        while (top < pic.height && ![...Array(pic.width).keys()].some((x) => (pic.data[(top * pic.width + x) * 4 + 3] ?? 0) > 0)) top += 1;
        tops.push(top);
      }
      expect(tops[1]).toBeLessThan(tops[0]!);
      expect(tops[2]).toBeLessThan(tops[1]!);
    }
  });

  /** Where a picture's drawn pixels touch its edge ('' when a clear pixel runs all round). */
  const touching = (pic: Pic) => {
    const solid = (x: number, y: number) => (pic.data[(y * pic.width + x) * 4 + 3] ?? 0) > 0;
    const edges = new Set<string>();
    for (let x = 0; x < pic.width; x++) {
      if (solid(x, 0)) edges.add('top');
      if (solid(x, pic.height - 1)) edges.add('bottom');
    }
    for (let y = 0; y < pic.height; y++) {
      if (solid(0, y)) edges.add('left');
      if (solid(pic.width - 1, y)) edges.add('right');
    }
    return [...edges].join(',');
  };

  test('nothing is cut off: every tower (type × level × 8 aims × idle/firing × frame) keeps a clear pixel round its outline', () => {
    const clipped: string[] = [];
    for (const type of TOWER_TYPES)
      for (const level of [1, 2, 3])
        for (let dir = 0; dir < 8; dir++)
          for (const firing of [false, true])
            for (let frame = 0; frame < 4; frame++) {
              const edge = touching(towerArt(type, level, dir, firing, frame) as unknown as Pic);
              if (edge) clipped.push(`${type} L${level} d${dir}${firing ? ' firing' : ''} f${frame}: ${edge}`);
            }
    expect(clipped).toEqual([]);
  });

  test('nothing is cut off: every enemy frame keeps a clear pixel round its outline', () => {
    const clipped: string[] = [];
    for (const type of ENEMY_TYPES) {
      const art = enemyArt(type);
      for (let f = 0; f < art.frames; f++) {
        const edge = touching(art.make(f) as unknown as Pic);
        if (edge) clipped.push(`${type} f${f}: ${edge}`);
      }
    }
    expect(clipped).toEqual([]);
  });

  test('aim: 0 right, clockwise in eighths', () => {
    expect(aimDir(0)).toBe(0);
    expect(aimDir(Math.PI / 2)).toBe(2);
    expect(aimDir(Math.PI)).toBe(4);
    expect(aimDir(-Math.PI / 2)).toBe(6);
    expect(aimDir(-Math.PI / 4)).toBe(7);
    expect(aimDir(Math.PI * 2 + 0.1)).toBe(0);
  });
});

// ── Towers stand on their slabs (td-3 fix): every pad, every map, upright and turned ──
describe('tower placement', async () => {
  (globalThis as unknown as { document: unknown }).document ??= fakeDocument();
  const { towerAnchor } = await import('../public/games/wardens/js/render.js');
  const { createTileset, renderTerrain, tileOrigin } = await import('../public/games/wardens/js/terrain.js');
  const { TOWER_W, TOWER_H } = await import('../public/games/wardens/js/art.js');
  const screens = [
    [412, 800, 2.625],
    [800, 412, 2.625],
    [360, 640, 2],
    [640, 300, 2],
    [851, 337, 2.75],
    [1280, 720, 1],
    // Fractional pixel ratios: Xiaomi/Redmi/POCO phones held sideways, Windows scaling, zoom.
    [851, 393, 2.75],
    [892, 412, 3],
    [800, 360, 3],
    [851, 393, 2.8125],
    [1536, 864, 1.25],
    [1280, 720, 1.5],
    [1745, 982, 1.1],
  ] as const;

  test('each tower picture is centred on its pad’s tile and its foot is on the slab, and the ground draws the slab there', () => {
    const wrong: string[] = [];
    for (const map of MAPS) {
      const tiles = createTileset(map);
      for (const [w, h, dpr] of screens) {
        const layout = computeLayout(w, h, dpr);
        // Where the ground puts its slabs: a recording context.
        const slabs = new Set<string>();
        const ctx = {
          fillStyle: '',
          fillRect: () => {},
          drawImage: (img: unknown, x: number, y: number) => {
            if (img === tiles.pad) slabs.add(`${x},${y}`);
          },
          save: () => {},
          restore: () => {},
          beginPath: () => {},
          rect: () => {},
          clip: () => {},
        };
        renderTerrain(ctx as unknown as CanvasRenderingContext2D, layout, map, tiles, 0);
        const at = { x: 0, y: 0 };
        const anchor = { x: 0, foot: 0, left: 0, top: 0 };
        for (const [c, r] of map.pads) {
          tileOrigin(layout, c, r, at);
          towerAnchor(layout, c + 0.5, r + 0.5, anchor);
          const where = `${map.id} ${w}×${h} pad ${c},${r}`;
          if (!slabs.has(`${at.x},${at.y}`)) wrong.push(`${where}: no slab drawn at its tile`);
          // The foundation (16 wide, centred in the picture) covers the tile exactly.
          if (anchor.left + TOWER_W / 2 - 8 !== at.x) wrong.push(`${where}: foundation from x ${anchor.left + TOWER_W / 2 - 8}, tile ${at.x}`);
          // The foot is the tile's last row but one; the picture's bottom margin hangs below.
          if (anchor.foot !== at.y + 15) wrong.push(`${where}: foot at y ${anchor.foot}, tile ${at.y}..${at.y + 15}`);
          if (anchor.top + TOWER_H - 3 !== anchor.foot) wrong.push(`${where}: picture not on its foot`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

// ── td-4: the new enemies and towers ─────────────────────────────────────────
/** How far along the road the point nearest a pad is. */
function distNear(game: Game, pad: number): number {
  const spot = game.pads[pad]!;
  const at = { x: 0, y: 0 };
  let best = 0;
  let bestD = Infinity;
  for (let d = 0; d < game.path.total; d += 0.05) {
    pointAt(game.path, d, at);
    const dd = Math.hypot(at.x - spot.x, at.y - spot.y);
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

/** Holds an enemy where it is (it stops walking). */
function hold<T extends { speed: number; baseSpeed: number }>(enemy: T): T {
  enemy.speed = enemy.baseSpeed = 0;
  return enemy;
}

/** The live enemy of a kind (the first one). */
const find = (game: Game, type: string) => game.enemies.find((e) => e.alive && e.type === type)!;

describe('new enemies (td-4)', () => {
  test('a shield swallows arrows until it breaks; a blast breaks it at once', () => {
    const game = waveGame();
    buildTower(game, 4, 'archer');
    spawnEnemy(game, 'shieldbearer', distNear(game, 4), 1);
    const enemy = hold(find(game, 'shieldbearer'));
    run(game, 1.5);
    expect(enemy.hp).toBe(enemy.maxHp);
    expect(enemy.shield).toBeLessThan(ENEMIES.shieldbearer.shield!);
    const game2 = waveGame();
    buildTower(game2, 4, 'flamer');
    spawnEnemy(game2, 'shieldbearer', distNear(game2, 4), 1);
    const e2 = hold(find(game2, 'shieldbearer'));
    run(game2, 0.5);
    expect(e2.shield).toBe(0);
    expect(e2.hp).toBeLessThan(e2.maxHp);
  });

  test('a burrower cannot be hit while it is under the road, and comes up after the stretch', () => {
    const game = waveGame();
    const span = ENEMIES.burrower.burrow!;
    spawnEnemy(game, 'burrower', game.path.total * (span[0] + 0.05), 1);
    const enemy = find(game, 'burrower');
    run(game, DT);
    expect(enemy.buried).toBe(true);
    for (const type of TOWER_TYPES) expect(canHit(TOWERS[type], enemy)).toBe(false);
    enemy.dist = game.path.total * (span[1] + 0.01);
    run(game, DT);
    expect(enemy.buried).toBe(false);
    expect(canHit(TOWERS.archer, enemy)).toBe(true);
  });

  test('a shaman heals those around it, but not the poisoned', () => {
    const game = waveGame();
    spawnEnemy(game, 'shaman', 6, 1);
    spawnEnemy(game, 'crawler', 6.3, 1);
    spawnEnemy(game, 'crawler', 6.6, 1);
    const [a, b] = game.enemies.filter((e) => e.alive && e.type === 'crawler');
    for (const e of game.enemies) if (e.alive) e.speed = e.baseSpeed = 0;
    a!.hp = b!.hp = 10;
    b!.poisonLeft = 10;
    b!.poisonDps = 0;
    run(game, ENEMIES.shaman.heal!.every + 0.1);
    expect(a!.hp).toBeGreaterThan(10);
    expect(b!.hp).toBe(10);
  });

  test('a berserker runs faster the more it is hurt (up to twice as fast)', () => {
    const game = waveGame();
    spawnEnemy(game, 'berserker', 2, 1);
    const enemy = find(game, 'berserker');
    run(game, DT);
    expect(enemy.speed).toBeCloseTo(ENEMIES.berserker.speed);
    enemy.hp = enemy.maxHp / 2;
    run(game, DT);
    expect(enemy.speed).toBeCloseTo(ENEMIES.berserker.speed * 1.5);
  });

  test('the brood mother drops three crawlers each time she loses another quarter (three times at most)', () => {
    const game = waveGame();
    spawnEnemy(game, 'broodmother', 8, 1);
    const mother = find(game, 'broodmother');
    const crawlers = () => game.enemies.filter((e) => e.alive && e.type === 'crawler').length;
    mother.poisonDps = mother.maxHp * 0.3;
    mother.poisonLeft = 1;
    run(game, 1);
    expect(crawlers()).toBe(3);
    mother.poisonDps = mother.maxHp * 0.6;
    mother.poisonLeft = 1;
    run(game, 1);
    expect(crawlers()).toBe(9);
  });

  test('bats fly; the burrower, ironclad, shield-bearer, shaman and berserker walk', () => {
    expect(ENEMIES.bat.flying).toBe(true);
    for (const type of ['burrower', 'ironclad', 'shieldbearer', 'shaman', 'berserker'] as const) expect(ENEMIES[type].flying).toBeUndefined();
  });
});

describe('new towers (td-4)', () => {
  test('the tesla hits its target and jumps to others nearby, weaker each time, fliers too', () => {
    const game = waveGame();
    buildTower(game, 4, 'tesla');
    const near = distNear(game, 4);
    const kinds = ['crawler', 'bat', 'crawler'] as const;
    kinds.forEach((type, k) => spawnEnemy(game, type, near + (k - 1) * 0.6, 1));
    const hit = game.enemies.filter((e) => e.alive).map(hold);
    run(game, DT);
    const lost = hit.map((e) => e.maxHp - e.hp);
    expect(lost.every((v) => v > 0)).toBe(true);
    const first = Math.max(...lost);
    expect(Math.min(...lost)).toBeLessThan(first);
    expect(first).toBe(TOWERS.tesla.damage[0]);
  });

  test('the sniper reaches far, and every third shot is critical', () => {
    const def = TOWERS.sniper;
    expect(def.range[2]).toBeGreaterThan(TOWERS.ballista.range[2]!);
    const game = waveGame();
    buildTower(game, 4, 'sniper');
    spawnEnemy(game, 'colossus', distNear(game, 4), 1);
    const boss = hold(game.enemies.find((e) => e.alive)!);
    const tower = game.towers[4]!;
    const damage = def.damage[0]!;
    const hits: number[] = [];
    let seq = game.eventSeq;
    for (let shot = 0; shot < 3; shot++) {
      tower.cooldown = 0;
      run(game, DT);
      for (; seq < game.eventSeq; seq++) {
        const e = game.events[seq % game.events.length]!;
        if (e.type === 'hit') hits.push(e.value);
      }
    }
    expect(hits).toEqual([damage - boss.armor, damage - boss.armor, damage * def.critMultiplier! - boss.armor]);
  });

  test('the alchemist’s flask poisons (through armor) and eats armor for a while', () => {
    const game = waveGame();
    buildTower(game, 4, 'alchemist');
    spawnEnemy(game, 'ironclad', 1, 1);
    const enemy = game.enemies.find((e) => e.alive)!;
    let shredded = false;
    for (let i = 0; i < 60 * 8 && enemy.alive; i++) {
      updateGame(game, DT);
      if (enemy.shred > 0 && enemy.poisonLeft > 0) shredded = true;
    }
    expect(shredded).toBe(true);
    expect(damageAfterArmor(20, Math.max(0, ENEMIES.ironclad.armor - TOWERS.alchemist.shred![0]!), false)).toBe(20 - 8);
  });

  test('the flamer sets everything in its cone burning, ground only', () => {
    expect(TOWERS.flamer.hitsAir).toBe(false);
    const game = waveGame();
    buildTower(game, 8, 'flamer');
    for (let i = 0; i < 3; i++) spawnEnemy(game, 'crawler', 0.4 * i, 1);
    let burning = 0;
    for (let i = 0; i < 60 * 30 && burning < 2; i++) {
      updateGame(game, DT);
      burning = Math.max(burning, game.enemies.filter((e) => e.alive && e.burnLeft > 0).length);
    }
    expect(burning).toBeGreaterThanOrEqual(2);
  });

  test('every new tower has three levels, costs and a counter role in the texts', () => {
    const t = translator('pl');
    for (const type of ['flamer', 'tesla', 'sniper', 'alchemist'] as const) {
      expect(TOWERS[type].cost).toHaveLength(3);
      expect(t(`role.${type}` as Parameters<typeof t>[0]).length).toBeGreaterThan(10);
    }
  });
});

describe('waves with the new kinds', () => {
  test('each map brings its new kinds only after its first waves; endless brings them all', () => {
    for (const map of MAPS) {
      const early = [1, 2, 3, 4, 5].flatMap((n) => describeWave(createWave(map, n)).map((r) => r.type));
      for (const type of ['ironclad', 'shieldbearer', 'shaman', 'bat', 'burrower', 'berserker', 'broodmother']) expect(early).not.toContain(type);
    }
    const endless = [21, 22, 23, 24, 25, 26].flatMap((n) => describeWave(createWave(marsh, n)).map((r) => r.type));
    for (const type of ['ironclad', 'shieldbearer', 'shaman', 'bat', 'burrower', 'berserker']) expect(endless).toContain(type);
  });

  test('the marsh’s middle boss is the brood mother, its last the Colossus pair; endless bosses take turns', () => {
    const bosses = (n: number) => describeWave(createWave(marsh, n)).filter((r) => ENEMIES[r.type].boss);
    expect(bosses(12)).toEqual([{ type: 'broodmother', count: 1 }]);
    expect(bosses(20)).toEqual([{ type: 'colossus', count: 2 }]);
    expect(bosses(25)[0]!.type).toBe('broodmother');
    expect(bosses(30)[0]!.type).toBe('colossus');
  });
});
