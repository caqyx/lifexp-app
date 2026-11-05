// Robot Rush's pure parts (docs/v2/PLAN.md 9.1, stage rr-b): Rush's fourth mode, plain ES
// modules in public/games/robot-rush on the shared Rush engine (public/games/_engine);
// these tests import the same files the game runs. The proof that every authored section
// is fair for a human is in robot-rush-sections.test.ts.
import { describe, expect, test } from 'vitest';
import { APP_TEXT_KEYS } from '../public/games/_engine/app.js';
import { verifyBeam } from '../public/games/_engine/beam.js';
import { buildGeometry, type SectionData } from '../public/games/_engine/geometry.js';
import { changesOf, shiftChange } from '../public/games/_engine/limits.js';
import { createRng } from '../public/games/_engine/rng.js';
import { sectionWorld, type World } from '../public/games/_engine/solids.js';
import { createAutopilot } from '../public/games/robot-rush/js/autopilot.js';
import { FINALE_ID, JOINT, ROBOT, SECTORS, STEP, TIERS, tierSpeed, type SectorDef } from '../public/games/robot-rush/js/config.js';
import { createGame, keepsRecords, stepGame } from '../public/games/robot-rush/js/game.js';
import { pickLang, textsOf, translator, TEXT_KEYS } from '../public/games/robot-rush/js/i18n.js';
import { createRobot, stepRobot, type Robot } from '../public/games/robot-rush/js/physics.js';
import { beamSpec, entriesOf, proveEntry, statesOf } from '../public/games/robot-rush/js/prove.js';
import { KEYS, readBest, readProgress, saveBest, unlock } from '../public/games/robot-rush/js/records.js';
import { buildFinale, buildRun, orderSections } from '../public/games/robot-rush/js/run.js';
import { SECTION_LIBRARY } from '../public/games/robot-rush/js/sections/index.js';
import { DEFAULT_SKIN, SKINS, isUnlocked, resolveSkin } from '../public/games/robot-rush/js/skins.js';
import { THEMES } from '../public/games/robot-rush/js/render/themes.js';
import { THEMES as FLIP_THEMES } from '../public/games/flip-rush/js/render/themes.js';

const sector = (id: number) => SECTORS.find((s) => s.id === id) as SectorDef;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const SPEED = 8;
const FLOOR = JOINT.floor - ROBOT.normal.half;

function world(hazards: SectionData['hazards'], ceil = '2 r30', floor = '10 r30'): World {
  return sectionWorld(buildGeometry({ id: `room-${Math.random()}`, length: 30, ceil, floor, hazards }));
}

/** Runs the robot; the last state, whether it crashed, and every state on the way. */
function run(w: World, robot: Robot, holding: boolean | ((r: Robot, i: number) => boolean), steps: number, speed = SPEED) {
  let r = robot;
  const path: Robot[] = [];
  for (let i = 0; i < steps; i++) {
    const next = stepRobot(r, typeof holding === 'function' ? holding(r, i) : holding, speed, STEP, w);
    path.push(next.vehicle);
    if (next.crashed) return { robot: next.vehicle, crashed: true, path };
    r = next.vehicle;
  }
  return { robot: r, crashed: false, path };
}

/** A robot standing on the floor. */
const standing = (w: World, x = 1, mini = false) => run(w, { ...createRobot(x, JOINT.floor - (mini ? ROBOT.mini.half : ROBOT.normal.half)), mini }, false, 4, 0).robot;

/** How high a jump goes (cells above the floor) for a press held `held` seconds. */
function jumpHeight(held: number, mini = false) {
  const w = world([]);
  const start = standing(w, 1, mini);
  const steps = Math.round(held / STEP);
  const { path } = run(w, start, (_r, i) => i < steps, 240, SPEED);
  return Math.max(...path.map((r) => start.y - r.y));
}

describe('the robot', () => {
  test('stands and runs on the floor, grounded', () => {
    const w = world([]);
    const r = run(w, createRobot(1, 6), false, 240).robot;
    expect(r.grounded).toBe(true);
    expect(r.y).toBeCloseTo(FLOOR, 6);
  });

  test('a press on the ground jumps; the longer it is held, the higher, up to the thrusters’ longest burn', () => {
    const tap = jumpHeight(STEP);
    const short = jumpHeight(0.12);
    const mid = jumpHeight(0.2);
    const full = jumpHeight(ROBOT.normal.boost);
    const longer = jumpHeight(ROBOT.normal.boost + 0.2);
    expect(tap).toBeGreaterThan(0.6);
    expect(tap).toBeLessThan(0.9);
    expect(short).toBeGreaterThan(tap + 0.8);
    expect(mid).toBeGreaterThan(short + 0.5);
    expect(full).toBeGreaterThan(mid);
    // Past the longest burn, holding on climbs no higher.
    expect(longer).toBeCloseTo(full, 1);
    expect(full).toBeGreaterThan(3.2);
    expect(full).toBeLessThan(3.6);
  });

  test('held on, it jumps again the moment it lands', () => {
    const w = world([]);
    const { path } = run(w, standing(w), true, 600);
    const takeoffs = path.filter((r, i) => i > 0 && path[i - 1]!.grounded && !r.grounded).length;
    expect(takeoffs).toBeGreaterThanOrEqual(2);
  });

  test('the mini robot jumps lower and shorter', () => {
    expect(jumpHeight(ROBOT.mini.boost, true)).toBeLessThan(jumpHeight(ROBOT.normal.boost) - 0.8);
    expect(ROBOT.mini.half).toBeLessThan(ROBOT.normal.half);
  });

  test('lands on a block’s top and runs on; its side kills; spikes and saws kill', () => {
    const ledge = world([{ type: 'block', x: 6, y: 8, w: 6, h: 2 }]);
    const tries = range(0, 80).map((at) => run(ledge, standing(ledge), (_r, i) => i >= at && i < at + 60, 240));
    const over = tries.find((t) => !t.crashed)!;
    expect(over).toBeDefined();
    expect(over.path.some((r) => r.grounded && Math.abs(r.y - (8 - ROBOT.normal.half)) < 1e-6)).toBe(true);
    expect(run(ledge, standing(ledge), false, 240).crashed).toBe(true);
    const bed = world([{ type: 'spike', x: 5, on: 'floor', count: 2 }]);
    expect(run(bed, standing(bed), false, 240).crashed).toBe(true);
    // A jump at the right moment clears it.
    expect(range(0, 60).some((at) => !run(bed, standing(bed), (_r, i) => i >= at && i < at + 48, 240).crashed)).toBe(true);
    const saw = world([{ type: 'saw', x: 6, y: 9.5, r: 0.7 }]);
    expect(run(saw, standing(saw), false, 240).crashed).toBe(true);
  });

  test('a bump overhead ends the climb (the thrusters stop); upside down it runs on the ceiling and jumps down', () => {
    const roof = world([{ type: 'block', x: 0, y: 2, w: 30, h: 5 }]);
    const { path } = run(roof, standing(roof), true, 60);
    const bump = path.findIndex((r) => r.y < 7 + ROBOT.normal.half + 0.01);
    expect(bump).toBeGreaterThan(0);
    expect(path[bump + 1]!.lift).toBe(0);
    const w = world([]);
    const flipped = run(w, { ...createRobot(1, 6), gravity: -1 }, false, 240).robot;
    expect(flipped.y).toBeCloseTo(JOINT.ceil + ROBOT.normal.half, 6);
    const jump = run(w, flipped, (_r, i) => i < 30, 60);
    expect(Math.max(...jump.path.map((r) => r.y))).toBeGreaterThan(flipped.y + 1.5);
  });

  test('orbs and pads: an orb fires on a fresh press in the air, a pad on touch', () => {
    const w = world([{ type: 'ring', kind: 'jump', x: 3, y: 7.5 }, { type: 'pad', kind: 'jump', x: 12, on: 'floor' }]);
    const start = standing(w, 1);
    // Jump, let go, press again over the orb.
    const { path } = run(w, start, (r, i) => i < 20 || (r.x > 2.6 && r.x < 3.4), 400);
    expect(path.some((r) => r.spentRing !== undefined)).toBe(true);
    expect(path.some((r) => r.spentPad !== undefined)).toBe(true);
  });
});

describe('the validator', () => {
  test('a robot’s hold is checked too: a release moved alone, a hold made shorter or longer, must survive', () => {
    const holds = Int8Array.from([-1, -1, 1, 1, 1, 1, -1, -1]);
    expect([...shiftChange(holds, 6, 1)]).toEqual([-1, -1, 1, 1, 1, 1, 1, -1]);
    expect([...shiftChange(holds, 6, -2)]).toEqual([-1, -1, 1, 1, -1, -1, -1, -1]);
    // A roof of spikes low over a bed: only a short, exact hop passes, and its hold must
    // keep within the tolerance either way.
    const data: SectionData = { id: 'rr-roof', mode: 'robot', length: 30, ceil: '2 r30', floor: '10 r30', hazards: [{ type: 'spike', x: 12, on: 'floor', count: 2 }, { type: 'block', x: 11, y: 2, w: 4, h: 1.8 }, { type: 'spike', x: 11, y: 3.8, dir: 'down', count: 4 }] };
    const fair = proveEntry(data, 'easy', { gravity: 1, mini: false }, { y: FLOOR, vy: 0 });
    expect(fair.problem).toBeNull();
    const spec = beamSpec(sectionWorld(buildGeometry(data)), 0, 30, tierSpeed('easy'), TIERS.easy!, createRobot(0, FLOOR));
    expect(spec.holdSlack).toBe(true);
    expect(verifyBeam(spec, fair.holds!)).toBeNull();
    // Too low a roof for any hop: caught.
    const shut = { ...data, id: 'rr-shut', hazards: [{ type: 'spike' as const, x: 12, on: 'floor' as const, count: 3 }, { type: 'block' as const, x: 11, y: 2, w: 5, h: 5.4 }, { type: 'spike' as const, x: 11, y: 7.4, dir: 'down' as const, count: 5 }] };
    expect(proveEntry(shut, 'easy', { gravity: 1, mini: false }, { y: FLOOR, vy: 0 }).problem).not.toBeNull();
  });

  test('states and entries: upright everywhere (flips are inside sections), mini where marked; running or in the air', () => {
    for (const s of SECTORS) expect(statesOf(s).map((x) => x.gravity)).toEqual([1]);
    expect(statesOf(sector(4), { id: 'm', length: 30, ceil: '', floor: '', hazards: [], mini: true })[0]!.mini).toBe(true);
    expect(entriesOf(false, 1)[0]).toEqual({ y: FLOOR, vy: 0 });
    expect(changesOf(Int8Array.from([-1, 1, 1, -1]))).toEqual([1, 3]);
  });
});

describe('the run', () => {
  test('the other modes’ structure: 10, 15, 15, 10, 10 and 30 sections, the Demon in four tiers, a finale of ten', () => {
    expect(SECTORS.map((s) => SECTION_LIBRARY[s.id]!.length)).toEqual([10, 15, 15, 10, 10, 30]);
    expect(SECTION_LIBRARY[FINALE_ID]).toHaveLength(10);
    expect(sector(6).bands!.map((b) => [b.from, b.to, b.tier])).toEqual([[1, 10, 'easyDemon'], [11, 15, 'hardDemon'], [16, 25, 'insaneDemon'], [26, 30, 'extremeDemon']]);
    expect(SECTORS.map((s) => s.tier)).toEqual(['easy', 'normal', 'hard', 'harder', 'insane', 'easyDemon']);
    const all = Object.values(SECTION_LIBRARY).flat();
    expect(all.every((d) => d.mode === 'robot')).toBe(true);
    expect(new Set(all.map((d) => d.id)).size).toBe(all.length);
    // The mini sections: one in sectors 4 and 5, one per Demon band from Hard.
    const minis = (id: number) => SECTION_LIBRARY[id]!.map((d, i) => (d.mini ? i + 1 : 0)).filter(Boolean);
    expect([minis(1), minis(2), minis(3), minis(4), minis(5), minis(6)]).toEqual([[], [], [], [10], [10], [15, 25, 30]]);
    const order = orderSections(sector(1), createRng(3));
    expect([...order].sort((a, b) => a - b)).toEqual(range(1, 10));
  });

  test('each later sector brings something new: speed portals in 2, gravity flips in 3, moving saws in 4, the dark, orbs and pads in 5, all in the Demon', () => {
    const has = (id: number, t: (h: SectionData['hazards'][number]) => boolean) => SECTION_LIBRARY[id]!.some((d) => d.hazards.some(t));
    const speed = (h: SectionData['hazards'][number]) => h.type === 'speed';
    const flip = (h: SectionData['hazards'][number]) => h.type === 'portal' && h.kind === 'flip';
    const moving = (h: SectionData['hazards'][number]) => 'move' in h && h.move !== undefined;
    const dark = (h: SectionData['hazards'][number]) => h.type === 'dark';
    const boost = (h: SectionData['hazards'][number]) => h.type === 'ring' || h.type === 'pad';
    expect([speed, flip, moving, dark, boost].map((t) => has(1, t))).toEqual([false, false, false, false, false]);
    expect([has(2, speed), has(2, flip)]).toEqual([true, false]);
    expect([has(3, flip), has(3, moving)]).toEqual([true, false]);
    expect([has(4, moving), has(4, dark)]).toEqual([true, false]);
    expect([has(5, dark), has(5, (h) => h.type === 'ring'), has(5, (h) => h.type === 'pad')]).toEqual([true, true, true]);
    for (const t of [speed, flip, moving, dark, boost]) expect(has(6, t)).toBe(true);
  });

  test('a run: the sectors in order, mini portals round the mini sections, never a gravity portal at a joint; the finale fixed', () => {
    const r = buildRun(createRng(5));
    expect(r.sectors.map((s) => s.def.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.portals.filter((p) => p.kind === 'gravity')).toEqual([]);
    expect(r.portals.filter((p) => p.kind === 'mini' && p.on)).toHaveLength(5);
    // Sections whose gravity is turned over inside run 36 cells in the Demon; 30 elsewhere.
    for (const d of Object.values(SECTION_LIBRARY).flat()) expect(d.length, d.id).toBe(d.id.startsWith('n-') ? 44 : d.hazards.some((h) => h.type === 'portal') && d.id.startsWith('rd-') ? 36 : 30);
    const f = buildFinale();
    expect(f.pieces.filter((p) => p.kind === 'section').map((p) => p.g.id)).toEqual(range(1, 10).map((n) => `n-${String(n).padStart(2, '0')}`));
    expect(f.pieces.filter((p) => p.kind === 'section').every((p) => p.tier === 'finale' && p.g.length === 44)).toBe(true);
  });

  test('the pilot plays the whole finale', { timeout: 120_000 }, () => {
    const game = createGame({ rng: createRng(1), mode: 'normal', level: 'finale' });
    stepGame(game, { holding: false, tap: true }, STEP);
    const pilot = createAutopilot();
    for (let i = 0; i < 240 * 120 && game.phase === 'playing'; i++) stepGame(game, { holding: pilot.advise(game.run, game.wave), tap: false }, STEP);
    expect(game.phase, JSON.stringify(game.where)).toBe('finished');
  });

  test('the pilot plays the whole run, every sector, for several shuffles', { timeout: 300_000 }, () => {
    for (const seed of [1, 7, 21]) {
      const game = createGame({ rng: createRng(seed), mode: 'normal' });
      stepGame(game, { holding: false, tap: true }, STEP);
      expect(game.wave.mode).toBe('robot');
      const pilot = createAutopilot();
      for (let i = 0; i < 240 * 400 && game.phase === 'playing'; i++) stepGame(game, { holding: pilot.advise(game.run, game.wave), tap: false }, STEP);
      expect(game.phase, `seed ${seed} at ${JSON.stringify(game.where)}`).toBe('finished');
      expect(game.result).toEqual({ sector: 6, section: 30, percent: 100 });
      expect(keepsRecords(game)).toBe(true);
    }
  });
});

describe('records, skins, texts, looks', () => {
  test('only lifexp-robotrush-* keys', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(readBest(storage)).toBeNull();
    expect(saveBest(storage, { sector: 2, section: 4, percent: 23 }).isNew).toBe(true);
    expect(unlock(storage, 'demonComplete')).toBe(true);
    expect(readProgress(storage)).toEqual({ demonComplete: true, finaleComplete: false });
    for (const key of [...data.keys(), ...Object.values(KEYS)]) expect(key.startsWith('lifexp-robotrush-')).toBe(true);
  });

  test('ten skins, each its own crest; all free except the last, which needs the whole Demon sector', () => {
    expect(SKINS).toHaveLength(10);
    expect(new Set(SKINS.map((s) => s.crest)).size).toBe(10);
    const last = SKINS[SKINS.length - 1]!;
    expect(last.unlock).toBe('demon');
    for (const skin of SKINS.slice(0, -1)) expect(isUnlocked(skin, { demonComplete: false })).toBe(true);
    expect(resolveSkin(last.id, { demonComplete: false })).toBe(DEFAULT_SKIN);
    expect(resolveSkin(last.id, { demonComplete: true })).toBe(last);
  });

  test('texts: both languages complete, every key the page uses', () => {
    expect(pickLang('?lang=en')).toBe('en');
    for (const key of [...TEXT_KEYS, ...APP_TEXT_KEYS]) {
      expect((textsOf('pl') as Record<string, string>)[key], key).toBeTruthy();
      expect((textsOf('en') as Record<string, string>)[key], key).toBeTruthy();
    }
    expect(translator('en')('title')).toBe('Robot Rush');
    expect(translator('pl')('finaleName')).toBe('Neonowy Szczyt');
  });

  test('a neon city of its own: every sector and Demon tier its own look, none shared with Flip Rush; detail grows', () => {
    const looks = [...SECTORS.map((s) => THEMES[s.theme]!), ...sector(6).bands!.slice(1).map((b) => THEMES[b.theme]!)];
    expect(looks.map((t) => t.backdrop)).toEqual(['rooftops', 'avenue', 'cranes', 'tunnels', 'storm', 'grid', 'signs', 'blackout', 'overload']);
    for (const id of Object.keys(THEMES)) expect(FLIP_THEMES[id]).toBeUndefined();
    const detail = (t: (typeof looks)[number]) => (t.fx?.glow ?? 0) + (t.fx?.chevrons ? 1 : 0) + (t.fx?.ground ? 1 : 0) + (t.fx?.hazardGlow ? 1 : 0);
    for (let i = 1; i < looks.length; i++) expect(detail(looks[i]!)).toBeGreaterThanOrEqual(detail(looks[i - 1]!));
    expect(THEMES.summit!.backdrop).toBe('summit');
  });
});
