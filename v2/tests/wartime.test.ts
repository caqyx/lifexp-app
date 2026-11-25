// War Time (vendored, docs/v2/VENDOR-PATCHES.md): the game's own logic, loaded the way the
// browser loads it (plain scripts on `window`, real map data), plus LifeXP's patch script
// (lifexp-patches.js). Covers the patches: missions complete the moment they are met, and
// the random-event settings (on/off, frequency, strength).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

const DIR = join(__dirname, '..', 'public', 'games', 'wartime');
const CORE = ['util', 'state', 'economy', 'diplomacy', 'vassal', 'land', 'world', 'goals', 'military', 'warfare', 'naval', 'air', 'tech', 'ai', 'god', 'turn', 'save'];

/* eslint-disable @typescript-eslint/no-explicit-any -- the game is untyped plain JS */
type Root = Record<string, any>;
const root = globalThis as unknown as Root;

function run(file: string) {
  // The game's scripts take `window` as their global; give them this one.
  new Function('window', readFileSync(join(DIR, file), 'utf8'))(root);
}

const memory = new Map<string, string>();
const storage = {
  getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};

let WT: Root;
beforeAll(() => {
  root.localStorage = storage;
  run('data/map.js');
  run('data/countries.js');
  run('data/scenarios.js');
  for (const m of CORE) run(`js/core/${m}.js`);
  run('lifexp-patches.js');
  WT = root.WT;
}, 60000);

beforeEach(() => {
  memory.clear();
  WT.lifexpEvents.reload();
});

function newGame(player = 'POL', extra: Root = {}) {
  WT.lifexpEvents.reload();
  WT.state.newGame({ player, seed: 2026, startWars: false, ...extra });
  WT.events.clear();
  WT.goals.attach();
  return WT.G;
}

describe('missions complete the moment they are met (not at the next end of turn)', () => {
  test('two provinces taken at once past the target: done at once, with the reward', () => {
    newGame();
    const S = WT.state;
    const mission = WT.goals.missions().find((m: Root) => m.id === 'provs');
    const done: string[] = [];
    WT.events.on('mission', (e: Root) => done.push(e.mission.id));
    const treasury = WT.G.countries.POL.treasury;
    const needed = mission.target - S.provincesOf('POL').length;
    // A peace treaty / land deal hands provinces over in one go: one more than needed.
    const theirs = S.provincesOf('DEU').concat(S.provincesOf('CZE'), S.provincesOf('UKR')).slice(0, needed + 1);
    theirs.forEach((id: number) => S.setOwner(id, 'POL'));
    expect(WT.goals.progress(mission).have).toBeGreaterThan(mission.target);
    expect(mission.done).toBe(true);
    expect(mission.doneTurn).toBe(WT.G.turn);
    expect(done).toContain('provs');
    expect(WT.G.countries.POL.treasury).toBeGreaterThan(treasury);
  });

  test('a save that already went past a target completes it when loaded', () => {
    newGame();
    const S = WT.state;
    const mission = WT.goals.missions().find((m: Root) => m.id === 'provs');
    WT.lifexpPatches.missionsLive = false; // as the unpatched game saved it
    S.provincesOf('DEU').slice(0, mission.target).forEach((id: number) => S.setOwner(id, 'POL'));
    WT.lifexpPatches.missionsLive = true;
    expect(mission.done).toBe(false);
    const json = WT.save.exportJSON();
    expect(WT.save.importJSON(json)).toBe(true);
    expect(WT.goals.missions().find((m: Root) => m.id === 'provs').done).toBe(true);
  });

  test('an achievement unlocks the moment it is met too (Imperium: 100 provinces)', () => {
    newGame();
    const S = WT.state;
    expect(WT.goals.unlocked().empire).toBeFalsy();
    const others = ['RUS', 'UKR', 'BLR', 'DEU', 'CZE', 'SVK', 'LTU', 'LVA', 'EST', 'ROU', 'HUN', 'KAZ'];
    for (const cc of others) {
      for (const id of S.provincesOf(cc)) {
        if (S.provincesOf('POL').length >= 100) break;
        S.setOwner(id, 'POL');
      }
    }
    expect(S.provincesOf('POL').length).toBeGreaterThanOrEqual(100);
    expect(WT.goals.unlocked().empire).toBeTruthy();
  });

  test('a new game does not complete anything while it is being set up', () => {
    newGame();
    expect(WT.goals.missions().every((m: Root) => !m.done)).toBe(true);
  });
});

describe('random-event settings', () => {
  test('defaults: every event on, normal frequency and strength; old or broken storage falls back to them', () => {
    const E = WT.lifexpEvents;
    memory.set('wartime_lifexp_events', '{not json');
    E.reload();
    for (const id of E.IDS) {
      expect(E.get(id)).toMatchObject({ on: true, freq: 'normal' });
      expect(E.chance(id)).toBe(1);
    }
    expect(E.strength('revolt')).toBe(1);
    memory.set('wartime_lifexp_events', JSON.stringify({ v: 1, events: { revolt: { on: false }, crisis: { freq: 'nonsense' }, unknown: { on: false } } }));
    E.reload();
    expect(E.get('revolt').on).toBe(false);
    expect(E.get('crisis').freq).toBe('normal');
    expect(E.isDefault()).toBe(false);
  });

  test('frequency and strength map to multipliers of the game’s own chance; off is 0', () => {
    const E = WT.lifexpEvents;
    E.set('revolt', { freq: 'rare' });
    expect(E.chance('revolt')).toBe(0.5);
    E.set('revolt', { freq: 'often' });
    expect(E.chance('revolt')).toBe(2);
    E.set('revolt', { strength: 'mild' });
    expect(E.strength('revolt')).toBe(0.6);
    E.set('revolt', { strength: 'harsh' });
    expect(E.strength('revolt')).toBe(1.5);
    E.set('revolt', { on: false });
    expect(E.chance('revolt')).toBe(0);
    // Saved, versioned, and read back.
    expect(JSON.parse(memory.get('wartime_lifexp_events')!)).toMatchObject({ v: 1, events: { revolt: { on: false, freq: 'often', strength: 'harsh' } } });
    E.reload();
    expect(E.get('revolt')).toEqual({ on: false, freq: 'often', strength: 'harsh' });
  });

  /** Poland holding all of Lithuania (gone): Lithuanian lands can rise and bring it back. */
  function lithuaniaUnderPoland() {
    newGame('POL');
    const S = WT.state;
    const lands = S.provincesOf('LTU');
    lands.forEach((id: number) => S.setOwner(id, 'POL'));
    WT.G.countries.LTU.alive = false;
    S.armiesOf('LTU').forEach((a: Root) => S.removeArmy(a.id));
    return lands as number[];
  }
  /** Runs the world's turn with Lithuanian lands at full unrest; returns each rebellion's army. */
  function rebellions(turns: number, lands: number[]) {
    const armies: number[] = [];
    const listener = (e: Root) => armies.push(WT.state.armiesOf(e.nation).reduce((s: number, a: Root) => s + a.size, 0));
    WT.events.on('revolt', listener);
    for (let t = 0; t < turns; t++) {
      for (const id of lands) {
        const p = WT.G.provinces[id];
        if (p.owner === 'POL') p.unrest = 100;
      }
      // a garrison calms a province; these tests are about the roll itself
      WT.state.armiesOf('POL').forEach((a: Root) => WT.state.removeArmy(a.id));
      WT.world.processTurn();
      WT.G.turn++;
    }
    WT.events.off('revolt', listener);
    return armies;
  }

  test('rebellion off: none in 60 seeded turns of full unrest; on: it comes', () => {
    let lands = lithuaniaUnderPoland();
    WT.lifexpEvents.set('revolt', { on: false });
    expect(rebellions(60, lands)).toEqual([]);
    lands = lithuaniaUnderPoland();
    WT.lifexpEvents.set('revolt', { on: true });
    expect(rebellions(40, lands).length).toBeGreaterThan(0);
  });

  test('rebellion strength scales the rebel army', () => {
    const armyOf = (strength: string) => {
      const lands = lithuaniaUnderPoland();
      WT.lifexpEvents.set('revolt', { on: true, freq: 'often', strength });
      return rebellions(40, lands)[0];
    };
    const normal = armyOf('normal');
    expect(normal).toBeGreaterThan(0);
    expect(armyOf('harsh')).toBeGreaterThan(normal);
    expect(armyOf('mild')).toBeLessThan(normal);
  });

  function playerEvents(turns: number) {
    const seen: string[] = [];
    WT.events.on('worldEvent', (e: Root) => { if (e.cc === WT.G.player) seen.push(e.ev); });
    for (let t = 0; t < turns; t++) {
      WT.world.processTurn();
      WT.G.events = []; // answered at once, so the next one can come
      WT.G.turn++;
    }
    return seen;
  }

  test('a random event switched off never comes; the others still do', () => {
    newGame();
    const E = WT.lifexpEvents;
    for (const id of ['crisis', 'boom', 'scandal', 'science']) E.set(id, { on: false });
    const seen = playerEvents(400);
    expect(seen.length).toBeGreaterThan(5);
    for (const id of ['crisis', 'boom', 'scandal', 'science']) expect(seen).not.toContain(id);
  });

  test('all random events off: none in 400 turns; "often" brings more than "rare"', () => {
    newGame();
    const E = WT.lifexpEvents;
    for (const id of E.RANDOM) E.set(id, { on: false });
    E.set('election', { on: false });
    expect(playerEvents(400)).toEqual([]);
    const count = (freq: string) => {
      newGame();
      memory.clear();
      E.reload();
      for (const id of E.RANDOM) E.set(id, { freq });
      return playerEvents(300).length;
    };
    expect(count('often')).toBeGreaterThan(count('rare'));
  });

  test('defaults keep the game’s exact behaviour (same seed, same events)', () => {
    const seq = () => {
      newGame();
      return playerEvents(200).join(',');
    };
    const withPatch = seq();
    WT.lifexpPatches.eventsLive = false;
    const without = seq();
    WT.lifexpPatches.eventsLive = true;
    expect(withPatch).toBe(without);
    expect(withPatch.length).toBeGreaterThan(0);
  });
});
