// Flip Rush's pure parts (docs/v2/PLAN.md 9.1, stage f-1): the game is plain ES modules in
// public/games/flip-rush on the Rush engine shared with Wave Rush and Ship Rush
// (public/games/_engine), and these tests import the same files the game runs. The proof
// that every authored section is fair for a human is in flip-rush-sections.test.ts.
import { describe, expect, test } from 'vitest';
import { APP_TEXT_KEYS } from '../public/games/_engine/app.js';
import { verifyBeam } from '../public/games/_engine/beam.js';
import { buildGeometry, type SectionData } from '../public/games/_engine/geometry.js';
import { changesOf, peakRate } from '../public/games/_engine/limits.js';
import { createRng, parseSwitches } from '../public/games/_engine/rng.js';
import { sectionWorld, type World } from '../public/games/_engine/solids.js';
import { createAutopilot } from '../public/games/flip-rush/js/autopilot.js';
import { BODY, JOINT, SECTORS, SNAP, STEP, TIERS, tierSpeed, type SectorDef } from '../public/games/flip-rush/js/config.js';
import { createGame, keepsRecords, stepGame, type Game } from '../public/games/flip-rush/js/game.js';
import { pickLang, textsOf, translator, TEXT_KEYS } from '../public/games/flip-rush/js/i18n.js';
import { createBody, snapTarget, stepBody, type Body } from '../public/games/flip-rush/js/physics.js';
import { beamSpec, checkFlipSection, entriesOf, minGapOf, proveEntry, statesOf } from '../public/games/flip-rush/js/prove.js';
import { KEYS, countAttempt, readAttempts, readBest, readProgress, readSkin, saveBest, saveSkin, unlock } from '../public/games/flip-rush/js/records.js';
import { buildFinale, buildRun, orderSections, pieceAt, stateAt } from '../public/games/flip-rush/js/run.js';
import { SECTION_LIBRARY } from '../public/games/flip-rush/js/sections/index.js';
import { DEFAULT_SKIN, SKINS, isUnlocked, resolveSkin } from '../public/games/flip-rush/js/skins.js';
import { THEMES } from '../public/games/flip-rush/js/render/themes.js';
import { rollAngle } from '../public/games/flip-rush/js/render/vehicles.js';

const sector = (id: number) => SECTORS.find((s) => s.id === id) as SectorDef;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const sorted = (list: number[]) => [...list].sort((a, b) => a - b);
const SPEED = 8;
const half = BODY.normal.half;
const FLOOR = JOINT.floor - half;
const CEIL = JOINT.ceil + half;

/** A test room: the joint corridor (or the given profiles) with these hazards and solids. */
function world(hazards: SectionData['hazards'], ceil = '2 r30', floor = '10 r30'): World {
  return sectionWorld(buildGeometry({ id: `room-${Math.random()}`, length: 30, ceil, floor, hazards }));
}

type Input = boolean | ((b: Body, i: number) => boolean);

/** Runs a body for `steps` steps; the last state, whether it crashed, and every state on the way. */
function run(w: World, body: Body, holding: Input, steps: number, speed = SPEED) {
  let b = body;
  const path: Body[] = [];
  for (let i = 0; i < steps; i++) {
    const next = stepBody(b, typeof holding === 'function' ? holding(b, i) : holding, speed, STEP, w);
    path.push(next.vehicle);
    if (next.crashed) return { body: next.vehicle, crashed: true, step: i, path };
    b = next.vehicle;
  }
  return { body: b, crashed: false, step: steps, path };
}

/** A body resting on the floor (after settling a moment). */
function resting(w: World, mode: 'ball' | 'spider', x = 1): Body {
  return run(w, createBody(x, FLOOR, mode), false, 4, 0).body;
}

/** How many times gravity flipped along a path from `from`. */
const flips = (from: Body, path: Body[]) => path.filter((b, i) => b.gravity !== (i ? path[i - 1]! : from).gravity).length;

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

// ── The run ──────────────────────────────────────────────────────────────────

describe('the run', () => {
  test('Wave Rush’s structure for sectors 1–3: 10, 15 and 15 sections in its shuffle groups, at its speeds', () => {
    expect(SECTORS.map((s) => SECTION_LIBRARY[s.id]!.length)).toEqual([10, 15, 15]);
    expect(SECTORS.map((s) => s.groups)).toEqual([[range(1, 10)], [range(1, 5), range(6, 15)], [range(1, 5), range(6, 15)]]);
    expect(SECTORS.map((s) => TIERS[s.tier]!.speed)).toEqual([0.8, 0.85, 1.0]);
    expect(sector(3).portals).toEqual([{ kind: 'gravity', count: 1, span: 2 }]);
  });

  test('tiers ramp up: faster, quicker taps, less slack, tighter openings, a higher rate', () => {
    const order = ['easy', 'normal', 'hard', 'harder', 'insane', 'hardDemon', 'insaneDemon', 'extremeDemon'].map((k) => TIERS[k]!);
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!.speed).toBeGreaterThan(order[i - 1]!.speed);
      expect(order[i]!.minInterval).toBeLessThan(order[i - 1]!.minInterval);
      expect(order[i]!.tolerance).toBeLessThan(order[i - 1]!.tolerance);
      expect(order[i]!.clearance).toBeLessThan(order[i - 1]!.clearance);
      expect(order[i]!.maxRate).toBeGreaterThan(order[i - 1]!.maxRate);
    }
    // Still human: never under 70 ms between changes or 18 ms of slack.
    for (const t of order) {
      expect(t.minInterval).toBeGreaterThanOrEqual(0.07);
      expect(t.tolerance).toBeGreaterThanOrEqual(0.018);
    }
  });

  test('every section is for the ball or the spider, level runs and steps only, wide enough for its tier; both vehicles in every sector', () => {
    for (const s of SECTORS) {
      const list = SECTION_LIBRARY[s.id]!;
      for (const data of list) expect(checkFlipSection(data, minGapOf(s.tier))).toEqual([]);
      expect(list.some((d) => d.mode === 'ball')).toBe(true);
      expect(list.some((d) => d.mode === 'spider')).toBe(true);
    }
  });

  test('a vehicle portal at every joint where the vehicle changes or a sector opens with the spider, none elsewhere', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = buildRun(createRng(seed));
      expect(r.baseMode).toBe('ball');
      const sections = r.pieces.filter((p) => p.kind === 'section');
      const vehicle = r.portals.filter((p) => p.kind === 'ship');
      let before = r.baseMode;
      let expected = 0;
      for (const p of sections) {
        // Each sector begins as the ball (a practice checkpoint does too).
        const opens = p.place === 1 && p.mode !== r.baseMode;
        if (p.mode !== before || opens) {
          expected++;
          expect(vehicle.some((v) => v.x > p.x0 - 0.01 && v.x < p.x0 + 3 && v.mode === p.mode)).toBe(true);
        }
        expect(stateAt(r, p.x0 + 5).mode).toBe(p.mode);
        before = p.mode;
      }
      expect(vehicle).toHaveLength(expected);
    }
  });

  test('from sector 3 the vehicle changes more often: dealt out in turns, a change at every joint the group allows', () => {
    const rate = (s: number) => {
      let changes = 0;
      for (let seed = 1; seed <= 40; seed++) changes += buildRun(createRng(seed)).portals.filter((p) => p.kind === 'ship' && p.sector === s).length;
      return changes / 40 / SECTION_LIBRARY[s + 1]!.length;
    };
    expect(rate(2)).toBeGreaterThan(rate(0) + 0.3);
    expect(rate(2)).toBeGreaterThan(rate(1) + 0.3);
    const order = orderSections(sector(3), createRng(9), SECTION_LIBRARY[3]);
    expect(sorted(order.slice(0, 5))).toEqual(range(1, 5));
    expect(sorted(order.slice(5))).toEqual(range(6, 15));
    const modes = order.map((n) => SECTION_LIBRARY[3]![n - 1]!.mode);
    for (let i = 1; i < modes.length; i++) expect(modes[i]).not.toBe(modes[i - 1]);
  });

  test('sector 3: one gravity flip and its way back two sections later; sectors 1–2 none; the same seed builds the same run', () => {
    for (const seed of [1, 2, 3, 4]) {
      const r = buildRun(createRng(seed));
      expect(r.portals.filter((p) => p.kind === 'gravity' && p.sector < 2)).toEqual([]);
      const g = r.portals.filter((p) => p.kind === 'gravity');
      expect(g.map((p) => p.on)).toEqual([true, false]);
      expect(pieceAt(r, g[1]!.x).place - pieceAt(r, g[0]!.x).place).toBe(2);
    }
    expect(buildRun(createRng(5)).sectors.map((s) => s.order)).toEqual(buildRun(createRng(5)).sectors.map((s) => s.order));
  });

  test('no finale yet (stage f-2)', () => {
    expect(() => buildFinale()).toThrow();
  });
});

// ── Physics ──────────────────────────────────────────────────────────────────

describe('the ball', () => {
  const open = world([]);

  test('falls to the floor and rolls along it, grounded', () => {
    const r = run(open, createBody(1, 6, 'ball'), false, 240);
    expect(r.crashed).toBe(false);
    expect(r.body.y).toBeCloseTo(FLOOR, 6);
    expect(r.body.grounded).toBe(true);
    expect(r.body.vy).toBe(0);
    expect(r.body.x).toBeCloseTo(1 + SPEED, 6);
  });

  test('a tap on the ground flips gravity and kicks it across; it lands on the ceiling and rolls on', () => {
    const start = resting(open, 'ball');
    const first = stepBody(start, true, SPEED, STEP, open).vehicle;
    expect(first.gravity).toBe(-1);
    expect(first.vy).toBeLessThan(-BODY.normal.kick + 1);
    const r = run(open, first, false, 240);
    expect(r.crashed).toBe(false);
    expect(r.body.y).toBeCloseTo(CEIL, 6);
    expect(r.body.grounded).toBe(true);
  });

  test('the genre’s numbers: 0.6 of a cube’s gravity, a kick of 0.6 of its jump; the crossing of an 8-cell corridor takes about 0.4 s', () => {
    expect(BODY.normal.gravity).toBeCloseTo(0.6 * 115, 0);
    expect(BODY.normal.kick).toBeCloseTo(0.6 * 22.4, 1);
    const r = run(open, stepBody(resting(open, 'ball'), true, SPEED, STEP, open).vehicle, false, 480);
    const landed = r.path.findIndex((b) => b.grounded);
    expect(landed * STEP).toBeGreaterThan(0.3);
    expect(landed * STEP).toBeLessThan(0.5);
  });

  test('holding on does nothing more: one press, one flip', () => {
    const start = resting(open, 'ball');
    const r = run(open, start, true, 240 * 2);
    expect(r.crashed).toBe(false);
    expect(flips(start, r.path)).toBe(1);
    expect(r.body.y).toBeCloseTo(CEIL, 6);
  });

  test('a press in the air waits while held and acts on landing; let go before landing, it is dropped', () => {
    const air = createBody(1, 5, 'ball');
    const held = run(open, air, true, 240);
    const landed = held.path.findIndex((b) => b.gravity === -1);
    expect(landed).toBeGreaterThan(10);
    expect(held.path[landed - 1]!.grounded).toBe(true);
    const dropped = run(open, air, (_b, i) => i < 10, 240);
    expect(flips(air, dropped.path)).toBe(0);
    expect(dropped.body.y).toBeCloseTo(FLOOR, 6);
  });

  test('a new press is needed for each flip', () => {
    const start = resting(open, 'ball');
    const r = run(open, start, (_b, i) => i < 30 || (i > 200 && i < 230), 480);
    expect(flips(start, r.path)).toBe(2);
    expect(r.body.y).toBeCloseTo(FLOOR, 6);
  });

  test('the mini ball is smaller, kicks softer, falls the same', () => {
    expect(BODY.mini.half).toBeLessThan(BODY.normal.half);
    expect(BODY.mini.kick).toBeCloseTo(BODY.normal.kick * 0.8, 1);
    expect(BODY.mini.gravity).toBe(BODY.normal.gravity);
    const mini = { ...createBody(1, 6, 'ball'), mini: true };
    expect(run(open, mini, false, 240).body.y).toBeCloseTo(JOINT.floor - BODY.mini.half, 6);
  });

  test('the drawn roll turns with the distance over the radius, backward upside down, and starts over on a new run', () => {
    rollAngle(100, 0.5, false);
    expect(rollAngle(101, 0.5, false)).toBeCloseTo(2, 6);
    expect(rollAngle(101.5, 0.5, true)).toBeCloseTo(1, 6);
    expect(rollAngle(3, 0.5, false)).toBe(0);
  });
});

describe('the spider', () => {
  const open = world([]);

  test('a tap on the ground snaps it at once to the surface across, gravity flipped, a streak left behind', () => {
    const start = resting(open, 'spider');
    const next = stepBody(start, true, SPEED, STEP, open);
    expect(next.crashed).toBe(false);
    expect(next.vehicle.y).toBeCloseTo(CEIL, 6);
    expect(next.vehicle.gravity).toBe(-1);
    expect(next.vehicle.grounded).toBe(true);
    expect(next.vehicle.streakFrom).toBeCloseTo(FLOOR, 6);
    expect(next.vehicle.streak).toBeGreaterThan(0);
    // And back down with the next press.
    const r = run(open, next.vehicle, (_b, i) => i > 30 && i < 60, 120);
    expect(r.body.y).toBeCloseTo(FLOOR, 6);
  });

  test('it snaps to the first surface across: the underside of a platform over it', () => {
    const w = world([{ type: 'block', x: 0, y: 5, w: 20, h: 0.8 }]);
    const next = stepBody(resting(w, 'spider'), true, SPEED, STEP, w);
    expect(next.crashed).toBe(false);
    expect(next.vehicle.y).toBeCloseTo(5.8 + half, 6);
  });

  test('the way across is instant: a hazard it passes does not kill, a hazard where it lands does', () => {
    const passed = world([{ type: 'saw', x: 1.2, y: 6, r: 1 }]);
    expect(stepBody(resting(passed, 'spider'), true, SPEED, STEP, passed).crashed).toBe(false);
    const landing = world([{ type: 'spike', x: 0, on: 'ceil', count: 3 }]);
    expect(stepBody(resting(landing, 'spider'), true, SPEED, STEP, landing).crashed).toBe(true);
  });

  test('with nothing across, it is lost', () => {
    const empty = { solids: new Map(), hazard: () => false } as unknown as World;
    expect(snapTarget(empty, 1, FLOOR, half, -1)).toBeNull();
    expect(snapTarget(open, 1, FLOOR, half, -1)).toBeCloseTo(CEIL, 6);
  });

  test('a press in the air acts on landing, if still held', () => {
    const air = createBody(1, 5, 'spider');
    const r = run(open, air, true, 240);
    expect(flips(air, r.path)).toBe(1);
    expect(r.body.y).toBeCloseTo(CEIL, 6);
  });

  test('running off a ledge, it falls to the floor below', () => {
    const w = world([], '2 r30', '10 r2 -2 r6 +2 r22');
    const r = run(w, createBody(2.5, 8 - half, 'spider'), false, 240 * 1.5);
    expect(r.crashed).toBe(false);
    expect(r.path.some((b) => b.y > 8.5)).toBe(true);
    expect(r.body.y).toBeCloseTo(FLOOR, 6);
  });
});

describe('collision: roll and run on tops and undersides, die on sides and hazards', () => {
  test('a block: its top carries the vehicle, its underside too (upside down), its side kills', () => {
    const w = world([{ type: 'block', x: 6, y: 6, w: 6, h: 1 }]);
    const top = run(w, createBody(7, 5, 'ball'), false, 240 * 0.5);
    expect(top.crashed).toBe(false);
    expect(top.path.some((b) => b.grounded && Math.abs(b.y - (6 - half)) < 1e-6)).toBe(true);
    const under = run(w, { ...createBody(7, 7.4, 'ball'), gravity: -1 }, false, 240 * 0.5);
    expect(under.crashed).toBe(false);
    expect(under.path.some((b) => b.grounded && Math.abs(b.y - (7 + half)) < 1e-6)).toBe(true);
    const wall = world([{ type: 'block', x: 6, y: 8, w: 6, h: 2 }]);
    const side = run(wall, createBody(1, FLOOR, 'spider'), false, 240);
    expect(side.crashed).toBe(true);
  });

  test('a step up in the floor is a wall; a step down is not', () => {
    const up = run(world([], '2 r30', '10 r5 -1.5 r25'), createBody(1, FLOOR, 'ball'), false, 240);
    expect(up.crashed).toBe(true);
    const down = run(world([], '2 r30', '10 r5 +1 r25'), createBody(1, FLOOR, 'ball'), false, 240);
    expect(down.crashed).toBe(false);
  });

  test('a landing forgives SNAP (a third of a cell): a body a little past a top the step before is put on it', () => {
    expect(SNAP).toBeCloseTo(0.33, 2);
    const w = world([{ type: 'block', x: 0, y: 6, w: 20, h: 1 }]);
    const fast = { ...createBody(1, 6 - half - 0.01, 'ball'), vy: 30 };
    const r = stepBody(fast, false, SPEED, STEP, w);
    expect(r.crashed).toBe(false);
    expect(r.vehicle.y).toBeCloseTo(6 - half, 6);
  });

  test('spikes, saws and mines kill on any touch; pillars’ sides kill', () => {
    for (const h of [
      { type: 'spike' as const, x: 4, on: 'floor' as const, count: 2 },
      { type: 'saw' as const, x: 5, y: 9.4, r: 0.8 },
      { type: 'mine' as const, x: 5, y: 9.3, r: 0.6 },
      { type: 'pillar' as const, x: 5, on: 'floor' as const, h: 2 },
    ]) {
      expect(run(world([h]), createBody(1, FLOOR, 'ball'), false, 240).crashed, h.type).toBe(true);
    }
  });

  test('leaving the playfield is a crash', () => {
    const w = world([], '2 r4 -3 r26', '10 r30');
    const r = run(w, { ...createBody(5, CEIL, 'ball'), gravity: -1 }, false, 240);
    expect(r.crashed).toBe(true);
  });
});

// ── The validator ────────────────────────────────────────────────────────────

describe('the human-feasibility validator', () => {
  const open: SectionData = { id: 'v-open', mode: 'ball', length: 30, ceil: '2 r30', floor: '10 r30', hazards: [] };

  test('every section is proven in both gravities, mini where marked; entries rest on the ground or come through the air', () => {
    expect(statesOf(sector(1), open)).toEqual([{ gravity: 1, mini: false }, { gravity: -1, mini: false }]);
    expect(statesOf(sector(1), { ...open, mini: true })).toEqual([{ gravity: 1, mini: true }, { gravity: -1, mini: true }]);
    expect(entriesOf(false, 1)[0]).toEqual({ y: FLOOR, vy: 0 });
    expect(entriesOf(false, -1)[0]).toEqual({ y: CEIL, vy: 0 });
    expect(entriesOf(false, 1)).toHaveLength(7);
  });

  test('an open room is fair from every entry, with no tap at all', () => {
    for (const mode of ['ball', 'spider'] as const) {
      for (const gravity of [1, -1] as const) {
        for (const entry of entriesOf(false, gravity)) {
          const r = proveEntry({ ...open, mode }, 'hard', { gravity, mini: false }, entry);
          expect(r.problem).toBeNull();
          expect(r.changes).toBe(0);
        }
      }
    }
  });

  test('a path keeps the minimum interval and the rate cap, and survives every tap shifted by the tolerance', () => {
    const data = SECTION_LIBRARY[3]![0]!;
    const tier = TIERS.hard!;
    const r = proveEntry(data, 'hard', { gravity: 1, mini: false }, { y: FLOOR, vy: 0 });
    expect(r.problem).toBeNull();
    const changes = changesOf(r.holds!);
    expect(changes.length).toBeGreaterThan(0);
    for (let k = 1; k < changes.length; k++) expect(changes[k]! - changes[k - 1]!).toBeGreaterThanOrEqual(Math.ceil(tier.minInterval / STEP - 1e-9));
    expect(peakRate(changes)).toBeLessThanOrEqual(tier.maxRate);
    const g = buildGeometry(data);
    const spec = beamSpec(sectionWorld(g), 0, g.length, tierSpeed('hard'), tier, { ...createBody(0, FLOOR, 'spider') });
    expect(verifyBeam(spec, r.holds!)).toBeNull();
  });

  test('a wall with no way past, or a bed with no time to flip away, is caught', () => {
    const wall: SectionData = { ...open, id: 'v-wall', hazards: [{ type: 'pillar', x: 12, on: 'floor', h: 8 }] };
    expect(proveEntry(wall, 'easy', { gravity: 1, mini: false }, { y: FLOOR, vy: 0 }).problem).not.toBeNull();
    const both: SectionData = { ...open, id: 'v-both', hazards: [{ type: 'spike', x: 10, on: 'floor', count: 4 }, { type: 'spike', x: 10, on: 'ceil', count: 4 }] };
    expect(proveEntry(both, 'easy', { gravity: 1, mini: false }, { y: FLOOR, vy: 0 }).problem).not.toBeNull();
  });

  test('a spider bed right at the start, with no time to react, is caught', () => {
    const early: SectionData = { ...open, id: 'v-early', mode: 'spider', hazards: [{ type: 'spike', x: 0.5, on: 'floor', count: 3 }] };
    expect(proveEntry(early, 'hard', { gravity: 1, mini: false }, { y: FLOOR, vy: 0 }).problem).not.toBeNull();
  });
});

// ── The game ─────────────────────────────────────────────────────────────────

function crash(game: Game) {
  for (let i = 0; i < 240 * 60 && game.phase === 'playing'; i++) stepGame(game, { holding: false, tap: false }, STEP);
}

describe('game', () => {
  test('normal: a crash restarts the run at sector 1 with a new shuffle; practice goes back to the checkpoint', () => {
    const game = createGame({ rng: createRng(2), mode: 'normal' });
    stepGame(game, { holding: false, tap: true }, STEP);
    expect(['ball', 'spider']).toContain(game.wave.mode);
    const first = game.run;
    crash(game);
    expect(game.phase).toBe('dead');
    for (let i = 0; i < 240; i++) stepGame(game, { holding: false, tap: false }, STEP);
    stepGame(game, { holding: false, tap: true }, STEP);
    expect(game.run).not.toBe(first);
    expect(game.attempt).toBe(2);
    expect(keepsRecords(game)).toBe(true);

    const practice = createGame({ rng: createRng(4), mode: 'practice', jump: { sector: 2, section: 3 } });
    stepGame(practice, { holding: false, tap: true }, STEP);
    crash(practice);
    for (let i = 0; i < 240; i++) stepGame(practice, { holding: false, tap: false }, STEP);
    stepGame(practice, { holding: false, tap: true }, STEP);
    expect(practice.wave.x).toBeLessThan(practice.run.sectors[1]!.x1);
    expect(practice.wave.x).toBeGreaterThanOrEqual(practice.run.sectors[1]!.x0 - 3);
    expect(keepsRecords(practice)).toBe(false);
  });

  test('a vehicle portal changes the vehicle as the game runs', () => {
    const game = createGame({ rng: createRng(3), mode: 'normal', jump: { sector: 3, section: 1 } });
    stepGame(game, { holding: false, tap: true }, STEP);
    const pilot = createAutopilot();
    const seen = new Set<string>();
    for (let i = 0; i < 240 * 20 && game.phase === 'playing'; i++) {
      stepGame(game, { holding: pilot.advise(game.run, game.wave), tap: false }, STEP);
      seen.add(game.wave.mode!);
    }
    expect([...seen].sort()).toEqual(['ball', 'spider']);
  });

  test('the pilot plays the whole run, every sector, for several shuffles', { timeout: 300_000 }, () => {
    for (const seed of [1, 7, 21]) {
      const game = createGame({ rng: createRng(seed), mode: 'normal' });
      stepGame(game, { holding: false, tap: true }, STEP);
      const pilot = createAutopilot();
      for (let i = 0; i < 240 * 400 && game.phase === 'playing'; i++) stepGame(game, { holding: pilot.advise(game.run, game.wave), tap: false }, STEP);
      expect(game.phase, `seed ${seed} at ${JSON.stringify(game.where)}`).toBe('finished');
      expect(game.result).toEqual({ sector: 3, section: 15, percent: 100 });
    }
  });
});

describe('records, skins, texts, looks', () => {
  test('only lifexp-fliprush-* keys; a better run replaces the best', () => {
    const storage = memoryStorage();
    expect(readBest(storage)).toBeNull();
    expect(saveBest(storage, { sector: 1, section: 3, percent: 7 }).isNew).toBe(true);
    expect(saveBest(storage, { sector: 1, section: 2, percent: 4 }).isNew).toBe(false);
    expect(countAttempt(storage)).toBe(1);
    expect(readAttempts(storage)).toBe(1);
    saveSkin(storage, 'spark');
    expect(readSkin(storage)).toBe('spark');
    expect(unlock(storage, 'demonComplete')).toBe(true);
    expect(readProgress(storage)).toEqual({ demonComplete: true, finaleComplete: false });
    for (const key of storage.data.keys()) expect(key.startsWith('lifexp-fliprush-')).toBe(true);
    for (const key of Object.values(KEYS)) expect(key.startsWith('lifexp-fliprush-')).toBe(true);
  });

  test('ten skins, each its own pattern; all free except the last, which needs the whole Demon sector', () => {
    expect(SKINS).toHaveLength(10);
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(10);
    expect(new Set(SKINS.map((s) => s.pattern)).size).toBe(10);
    const last = SKINS[SKINS.length - 1]!;
    expect(last.unlock).toBe('demon');
    for (const skin of SKINS.slice(0, -1)) expect(isUnlocked(skin, { demonComplete: false })).toBe(true);
    expect(isUnlocked(last, { demonComplete: false })).toBe(false);
    expect(resolveSkin(last.id, { demonComplete: false })).toBe(DEFAULT_SKIN);
    expect(resolveSkin(last.id, { demonComplete: true })).toBe(last);
  });

  test('texts: Polish by default, both languages complete, every key the page uses, a toast for each vehicle', () => {
    expect(pickLang('?lang=en')).toBe('en');
    expect(pickLang('')).toBe('pl');
    for (const key of [...TEXT_KEYS, ...APP_TEXT_KEYS, 'ballOn', 'spiderOn']) {
      expect((textsOf('pl') as Record<string, string>)[key], key).toBeTruthy();
      expect((textsOf('en') as Record<string, string>)[key], key).toBeTruthy();
    }
    for (const s of SECTORS) expect(translator('pl')(`sector${s.id}` as never)).toBeTruthy();
    expect(translator('en')('title')).toBe('Flip Rush');
  });

  test('the test switches only work with a seed', () => {
    expect(parseSwitches('?sector=2')).toEqual({ seed: null, jump: null, autopilot: null, finale: null });
  });

  test('every sector has its own factory look; detail grows from sector to sector', () => {
    const looks = SECTORS.map((s) => THEMES[s.theme]!);
    expect(looks.map((t) => t.backdrop)).toEqual(['hall', 'mine', 'foundry']);
    const detail = (t: (typeof looks)[number]) =>
      (t.fx?.glow ?? 0) + (t.fx?.chevrons ? 1 : 0) + (t.fx?.ground ? 1 : 0) + (t.fx?.hazardGlow ? 1 : 0) + (t.motes ? t.motes.count / 20 : 0);
    for (let i = 1; i < looks.length; i++) expect(detail(looks[i]!)).toBeGreaterThan(detail(looks[i - 1]!));
  });
});
