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
import { BODY, FINALE_ID, JOINT, MINI_BOOST, PAD, RING, RING_REACH, SECTORS, SNAP, STEP, TIERS, tierSpeed, type SectorDef } from '../public/games/flip-rush/js/config.js';
import { boostOf } from '../public/games/flip-rush/js/boosters.js';
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
  test('Wave Rush’s structure: 10, 15, 15, 10, 10 and 30 sections in its shuffle groups, at its speeds; the Demon in four tiers', () => {
    expect(SECTORS.map((s) => SECTION_LIBRARY[s.id]!.length)).toEqual([10, 15, 15, 10, 10, 30]);
    expect(SECTORS.map((s) => s.groups)).toEqual([
      [range(1, 10)],
      [range(1, 5), range(6, 15)],
      [range(1, 5), range(6, 15)],
      [range(1, 10)],
      [range(1, 5), range(6, 10)],
      [range(1, 10), range(11, 15), range(16, 25), range(26, 30)],
    ]);
    expect(SECTORS.map((s) => TIERS[s.tier]!.speed)).toEqual([0.8, 0.85, 1.0, 1.1, 1.25, 1.25]);
    expect(sector(6).bands!.map((b) => [b.from, b.to, b.tier, TIERS[b.tier]!.speed])).toEqual([
      [1, 10, 'easyDemon', 1.25],
      [11, 15, 'hardDemon', 1.4],
      [16, 25, 'insaneDemon', 1.55],
      [26, 30, 'extremeDemon', 1.7],
    ]);
    // Mini sections where the mini portals go: one in sectors 4 and 5, one in each of the Demon's last three tiers.
    const minis = (s: number) => SECTION_LIBRARY[s]!.flatMap((d, i) => (d.mini ? [i + 1] : []));
    expect([minis(4), minis(5), minis(6)]).toEqual([[10], [10], [15, 25, 30]]);
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

  test('the Demon’s ornament: denser tier by tier, never near a hazard, an orb or a pad', () => {
    const tiers = [[1, 10], [11, 15], [16, 25], [26, 30]].map(([a, b]) => SECTION_LIBRARY[6]!.slice(a! - 1, b));
    const per = tiers.map((list) => list.reduce((n, d) => n + (d.deco?.length ?? 0), 0) / list.length);
    for (let i = 1; i < per.length; i++) expect(per[i]).toBeGreaterThan(per[i - 1]!);
    for (const d of SECTION_LIBRARY[6]!) {
      const g = buildGeometry(d);
      for (const item of d.deco ?? []) {
        if (item.type !== 'chain' && item.type !== 'gear' && item.type !== 'eye') continue;
        for (const b of g.boosters) expect(Math.abs(item.x - b.x), d.id).toBeGreaterThan(0.5);
      }
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

  test('gravity flips: one for two sections in sector 3, three and two (each back one section later) in sectors 4 and 5, four in the Demon; sectors 1–2 none; the same seed builds the same run', () => {
    for (const seed of [1, 2, 3, 4]) {
      const r = buildRun(createRng(seed));
      expect(r.portals.filter((p) => p.kind === 'gravity' && p.sector < 2)).toEqual([]);
      const g = r.portals.filter((p) => p.kind === 'gravity' && p.sector === 2);
      expect(g.map((p) => p.on)).toEqual([true, false]);
      expect(pieceAt(r, g[1]!.x).place - pieceAt(r, g[0]!.x).place).toBe(2);
      const on = (s: number) => r.portals.filter((p) => p.kind === 'gravity' && p.sector === s && p.on).length;
      expect([on(3), on(4), on(5)]).toEqual([3, 2, 4]);
      const mini = (s: number) => r.portals.filter((p) => p.kind === 'mini' && p.sector === s && p.on).length;
      expect([mini(3), mini(4), mini(5)]).toEqual([1, 1, 3]);
    }
    expect(buildRun(createRng(5)).sectors.map((s) => s.order)).toEqual(buildRun(createRng(5)).sectors.map((s) => s.order));
  });

  test('the finale: ten fixed stretches, ball and spider in turn, a vehicle portal at every change, never shuffled; every kind of orb and pad', () => {
    const a = buildFinale();
    const b = buildFinale();
    const sections = a.pieces.filter((p) => p.kind === 'section');
    expect(sections.map((p) => p.g.id)).toEqual(range(1, 10).map((n) => `f-${String(n).padStart(2, '0')}`));
    expect(b.pieces.filter((p) => p.kind === 'section').map((p) => p.g.id)).toEqual(sections.map((p) => p.g.id));
    expect(sections.map((p) => p.mode)).toEqual(range(1, 10).map((n) => (n % 2 ? 'ball' : 'spider')));
    expect(sections.every((p) => p.tier === 'finale')).toBe(true);
    expect(a.portals.filter((p) => p.kind === 'ship')).toHaveLength(9);
    const kinds = new Set(SECTION_LIBRARY[FINALE_ID]!.flatMap((d) => d.hazards.filter((h) => h.type === 'ring' || h.type === 'pad').map((h) => `${h.type}:${'kind' in h ? h.kind : ''}`)));
    for (const k of ['ring:jump', 'ring:gravity', 'ring:gravityJump', 'ring:dash', 'pad:jump', 'pad:small']) expect(kinds.has(k), k).toBe(true);
  });

  test('the pilot plays the whole finale', { timeout: 120_000 }, () => {
    const game = createGame({ rng: createRng(1), mode: 'normal', level: 'finale' });
    stepGame(game, { holding: false, tap: true }, STEP);
    const pilot = createAutopilot();
    for (let i = 0; i < 240 * 120 && game.phase === 'playing'; i++) stepGame(game, { holding: pilot.advise(game.run, game.wave), tap: false }, STEP);
    expect(game.phase, JSON.stringify(game.where)).toBe('finished');
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

// ── Orbs and pads ────────────────────────────────────────────────────────────

describe('orbs and pads (stage f-2)', () => {
  test('each sets the vertical speed (never adds), along the gravity it leaves; gravity kinds flip first; mini × 0.8', () => {
    for (const gravity of [1, -1] as const) {
      for (const mini of [false, true]) {
        const k = mini ? MINI_BOOST : 1;
        expect(boostOf('ring', 'jump', gravity, mini)).toEqual({ gravity, vy: RING.jump * k * gravity });
        expect(boostOf('ring', 'small', gravity, mini)).toEqual({ gravity, vy: RING.small * k * gravity });
        expect(boostOf('ring', 'dash', gravity, mini)).toEqual({ gravity, vy: RING.dash * k * gravity });
        expect(boostOf('ring', 'gravity', gravity, mini)).toEqual({ gravity: -gravity, vy: RING.gravity * k * -gravity });
        expect(boostOf('ring', 'gravityJump', gravity, mini)).toEqual({ gravity: -gravity, vy: RING.gravityJump * k * -gravity });
        expect(boostOf('pad', 'jump', gravity, mini)).toEqual({ gravity, vy: PAD.jump * k * gravity });
        expect(boostOf('pad', 'small', gravity, mini)).toEqual({ gravity, vy: PAD.small * k * gravity });
        expect(boostOf('pad', 'gravity', gravity, mini)).toEqual({ gravity: -gravity, vy: PAD.gravity * k * -gravity });
      }
    }
    // Jump-type speeds lift away from the ground; the dash and the gravity kinds send toward it.
    expect(RING.jump).toBeLessThan(RING.small);
    expect(RING.small).toBeLessThan(0);
    expect(RING.dash).toBeGreaterThan(0);
    expect(PAD.jump).toBeLessThan(PAD.small);
  });

  /** A body at (x, y) in gravity g, mini or not, falling already at vy. */
  const at = (mode: 'ball' | 'spider', x: number, y: number, gravity: 1 | -1 = 1, mini = false, vy = 0): Body => ({ ...createBody(x, y, mode), gravity, mini, vy });

  for (const gravity of [1, -1] as const) {
    for (const mini of [false, true]) {
      const h = (mini ? BODY.mini : BODY.normal).half;
      const ground = gravity > 0 ? JOINT.floor - h : JOINT.ceil + h;
      const k = mini ? MINI_BOOST : 1;
      const label = `gravity ${gravity}${mini ? ', mini' : ''}`;

      test(`an orb fires on a fresh press while touched, before the ground takes it (${label})`, () => {
        for (const mode of ['ball', 'spider'] as const) {
          const w = world([{ type: 'ring', kind: 'jump', x: 6, y: ground - 0.3 * gravity }]);
          const start = run(w, at(mode, 5.9, ground, gravity, mini), false, 2, 0).body;
          const fired = stepBody(start, true, SPEED, STEP, w).vehicle;
          expect(fired.gravity, mode).toBe(gravity);
          expect(fired.spentRing).toBeDefined();
          // Set, then one step of gravity: about the orb's speed, away from the ground; no teleport.
          expect(fired.vy * gravity).toBeCloseTo(RING.jump * k + BODY.normal.gravity * STEP, 6);
          expect(Math.abs(fired.y - ground)).toBeLessThan(0.2);
        }
      });

      test(`a press made in the air and still held fires the orb on reaching it (buffer); a used press does not (${label})`, () => {
        // Falling from (4, 6) at SPEED, the body reaches x = 6 about 2.16 cells lower down.
        const w = world([{ type: 'ring', kind: 'small', x: 6, y: 6 + 2.16 * gravity }]);
        const air = at('ball', 4, 6, gravity, mini, 0);
        const held = run(w, air, true, 120, SPEED);
        expect(held.path.some((b) => b.spentRing !== undefined)).toBe(true);
        const fired = held.path.find((b) => b.spentRing !== undefined)!;
        expect(fired.vy * gravity).toBeLessThan(RING.small * k + 1);
        // The press acted on the ground first: holding it on into the orb does nothing.
        const used = at('ball', 3, ground, gravity, mini);
        const late = run(w, { ...used, grounded: true }, true, 240, SPEED);
        expect(late.path.filter((b) => b.spentRing !== undefined)).toHaveLength(0);
      });

      test(`an orb fires once per pass; the gravity orb and the gravity-jump orb flip, the dash slams (${label})`, () => {
        const w = world([{ type: 'ring', kind: 'gravity', x: 6, y: 6 }]);
        const twice = run(w, at('spider', 5.6, 6, gravity, mini), (_b, i) => i < 3 || (i > 8 && i < 12), 14, SPEED);
        expect(flips(at('spider', 5.6, 6, gravity, mini), twice.path)).toBe(1);
        const jumpFlip = stepBody(at('ball', 6, 6, gravity, mini), true, SPEED, STEP, world([{ type: 'ring', kind: 'gravityJump', x: 6, y: 6 }])).vehicle;
        expect(jumpFlip.gravity).toBe(-gravity);
        expect(jumpFlip.vy * -gravity).toBeLessThan(0);
        const dash = stepBody(at('ball', 6, 6, gravity, mini), true, SPEED, STEP, world([{ type: 'ring', kind: 'dash', x: 6, y: 6 }])).vehicle;
        expect(dash.vy * gravity).toBeGreaterThan(RING.dash * k - 1);
      });

      test(`a pad fires on touch with no press, once; the gravity pad sends it across; the spider is moved, not teleported (${label})`, () => {
        const on = gravity > 0 ? 'floor' : 'ceil';
        for (const mode of ['ball', 'spider'] as const) {
          const w = world([{ type: 'pad', kind: 'jump', x: 6, on }]);
          const r = run(w, at(mode, 3, ground, gravity, mini), false, 240, SPEED);
          const i = r.path.findIndex((b) => b.spentPad !== undefined);
          expect(i, mode).toBeGreaterThan(0);
          expect(r.path[i]!.vy * gravity).toBeLessThan(PAD.jump * k + 1);
          expect(Math.abs(r.path[i]!.y - ground)).toBeLessThan(0.2);
          expect(r.crashed).toBe(false);
        }
        const g = world([{ type: 'pad', kind: 'gravity', x: 6, on }]);
        const across = run(g, at('ball', 3, ground, gravity, mini), false, 240, SPEED);
        expect(across.body.gravity).toBe(-gravity);
        expect(across.body.y).toBeCloseTo(gravity > 0 ? JOINT.ceil + h : JOINT.floor - h, 6);
      });
    }
  }

  test('reach: an orb counts within RING_REACH of its centre, a pad on its cell and a little above it', () => {
    expect(RING_REACH.normal).toBeGreaterThan(RING_REACH.mini);
    const w = world([{ type: 'ring', kind: 'jump', x: 6, y: 6 }]);
    expect(stepBody(at('ball', 6, 6 + RING_REACH.normal - 0.05), true, 0, STEP, w).vehicle.spentRing).toBeDefined();
    expect(stepBody(at('ball', 6, 6 + RING_REACH.normal + 0.05), true, 0, STEP, w).vehicle.spentRing).toBeUndefined();
    const p = world([{ type: 'pad', kind: 'small', x: 6, on: 'floor' }]);
    expect(stepBody(at('ball', 6.5, FLOOR), false, 0, STEP, p).vehicle.spentPad).toBeDefined();
    expect(stepBody(at('ball', 8.2, FLOOR), false, 0, STEP, p).vehicle.spentPad).toBeUndefined();
  });

  test('the validator plays orb chains and pads; an orb out of reach of every path is caught', () => {
    // r2-15 with a ceiling bed over its floor bed too: only the orb chain gets across.
    const base = SECTION_LIBRARY[2]!.find((d) => d.id === 'r2-15')!;
    const chain: SectionData = { ...base, id: 'v-chain', hazards: [...base.hazards, { type: 'spike', x: 7, on: 'ceil', count: 13 }] };
    const r = proveEntry(chain, 'normal', { gravity: 1, mini: false }, { y: FLOOR, vy: 0 });
    expect(r.problem).toBeNull();
    const high: SectionData = { ...chain, id: 'v-high', hazards: chain.hazards.map((h) => (h.type === 'ring' ? { ...h, y: 4 } : h)) };
    expect(proveEntry(high, 'normal', { gravity: 1, mini: false }, { y: FLOOR, vy: 0 }).problem).not.toBeNull();
  });

  test('pads come in sector 1, orbs from sector 2, both in sector 3', () => {
    const kinds = (s: number) => new Set(SECTION_LIBRARY[s]!.flatMap((d) => d.hazards.map((h) => h.type)));
    expect(kinds(1).has('pad')).toBe(true);
    expect(kinds(1).has('ring')).toBe(false);
    expect(kinds(2).has('ring')).toBe(true);
    expect(kinds(3).has('ring') && kinds(3).has('pad')).toBe(true);
  });
});

// ── The validator ────────────────────────────────────────────────────────────

describe('the human-feasibility validator', () => {
  const open: SectionData = { id: 'v-open', mode: 'ball', length: 30, ceil: '2 r30', floor: '10 r30', hazards: [] };

  test('every section is proven in both gravities, mini where marked; entries rest on either side or come through the air', () => {
    expect(statesOf(sector(1), open)).toEqual([{ gravity: 1, mini: false }, { gravity: -1, mini: false }]);
    expect(statesOf(sector(1), { ...open, mini: true })).toEqual([{ gravity: 1, mini: true }, { gravity: -1, mini: true }]);
    expect(entriesOf(false, 1)[0]).toEqual({ y: FLOOR, vy: 0 });
    expect(entriesOf(false, -1)[0]).toEqual({ y: CEIL, vy: 0 });
    // ...and resting on the other side, as a gravity portal leaves it (it falls across).
    expect(entriesOf(false, 1)[1]).toEqual({ y: CEIL, vy: 0 });
    expect(entriesOf(false, 1)).toHaveLength(8);
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
      expect(game.result).toEqual({ sector: 6, section: 30, percent: 100 });
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

  test('every sector and Demon tier has its own factory look; detail grows from one to the next', () => {
    const looks = [...SECTORS.map((s) => THEMES[s.theme]!), ...sector(6).bands!.slice(1).map((b) => THEMES[b.theme]!)];
    expect(looks.map((t) => t.backdrop)).toEqual(['hall', 'mine', 'foundry', 'reactor', 'core', 'circuits', 'gears', 'saws', 'overdrive']);
    const detail = (t: (typeof looks)[number]) =>
      (t.fx?.glow ?? 0) + (t.fx?.chevrons ? 1 : 0) + (t.fx?.ground ? 1 : 0) + (t.fx?.hazardGlow ? 1 : 0) + (t.motes ? t.motes.count / 20 : 0);
    for (let i = 1; i < looks.length; i++) expect(detail(looks[i]!)).toBeGreaterThan(detail(looks[i - 1]!));
  });
});
