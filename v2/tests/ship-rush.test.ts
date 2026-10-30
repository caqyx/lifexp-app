// Ship Rush's pure parts (docs/v2/PLAN.md 9.1, stage s-1): the game is plain ES modules in
// public/games/ship-rush on the Rush engine shared with Wave Rush (public/games/_engine),
// and these tests import the same files the game runs. The proof that every authored
// section is fair for a human is in ship-rush-sections.test.ts.
import { describe, expect, test } from 'vitest';
import { APP_TEXT_KEYS } from '../public/games/_engine/app.js';
import { solveBeam, verifyBeam, type BeamSpec } from '../public/games/_engine/beam.js';
import { buildGeometry, type SectionData } from '../public/games/_engine/geometry.js';
import { changesOf, peakRate } from '../public/games/_engine/limits.js';
import { createRng, parseSwitches } from '../public/games/_engine/rng.js';
import { easeAngle, targetAngle } from '../public/games/_engine/render/turn.js';
import { createAutopilot } from '../public/games/ship-rush/js/autopilot.js';
import { BASE_SPEED, FINALE_ID, JOINT, MAX_FRAME, SECTORS, SHIP, SNAP, STEP, TIERS, tierOf, tierSpeed, type SectorDef } from '../public/games/ship-rush/js/config.js';
import { createGame, keepsRecords, resultOf, stepGame, type Game } from '../public/games/ship-rush/js/game.js';
import { pickLang, textsOf, translator, TEXT_KEYS } from '../public/games/ship-rush/js/i18n.js';
import { advanceClock, createShip, roomy, settle, stepShip, type Ship } from '../public/games/ship-rush/js/physics.js';
import { checkShipSection, entriesOf, minGapOf, narrowestGap, proveEntry, statesOf, tierKeyOf } from '../public/games/ship-rush/js/prove.js';
import {
  KEYS,
  countAttempt,
  readAttempts,
  readBest,
  readProgress,
  saveBest,
  saveSkin,
  readSkin,
  unlock,
} from '../public/games/ship-rush/js/records.js';
import { PORTAL_OFFSET, buildFinale, buildRun, checkpointX, jumpX, locate, orderSections, pieceAt, stateAt } from '../public/games/ship-rush/js/run.js';
import { SECTION_LIBRARY } from '../public/games/ship-rush/js/sections/index.js';
import { DEFAULT_SKIN, SKINS, isUnlocked, resolveSkin } from '../public/games/ship-rush/js/skins.js';
import { runWorld, sectionWorld, solidsOf, type World } from '../public/games/ship-rush/js/solids.js';
import { THEMES } from '../public/games/ship-rush/js/render/themes.js';

const sector = (id: number) => SECTORS.find((s) => s.id === id) as SectorDef;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const sorted = (list: number[]) => [...list].sort((a, b) => a - b);
const SPEED = 8;

/** A test room: the joint corridor (or the given profiles) with these hazards and solids. */
function world(hazards: SectionData['hazards'], ceil = '2 r20', floor = '10 r20'): World {
  return sectionWorld(buildGeometry({ id: `room-${Math.random()}`, length: 20, ceil, floor, hazards }));
}

/** Flies a ship held (or not) for `steps` steps; the last state and whether it crashed. */
function fly(w: World, ship: Ship, holding: boolean | ((s: Ship, i: number) => boolean), steps: number) {
  let s = ship;
  for (let i = 0; i < steps; i++) {
    const next = stepShip(s, typeof holding === 'function' ? holding(s, i) : holding, SPEED, STEP, w);
    if (next.crashed) return { ship: next.vehicle, crashed: true, step: i };
    s = next.vehicle;
  }
  return { ship: s, crashed: false, step: steps };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

const half = SHIP.normal.half;

// ── The run ──────────────────────────────────────────────────────────────────

describe('the run', () => {
  test('Wave Rush’s structure: sectors of 10, 15, 15, 10, 10 and 30 sections in its shuffle groups', () => {
    const counts: Record<number, number> = { 1: 10, 2: 15, 3: 15, 4: 10, 5: 10, 6: 30 };
    expect(SECTORS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const s of SECTORS) expect(SECTION_LIBRARY[s.id]?.length, `sector ${s.id}`).toBe(counts[s.id]);
    expect(sector(1).groups).toEqual([range(1, 10)]);
    expect(sector(2).groups).toEqual([range(1, 5), range(6, 15)]);
    expect(sector(3).groups).toEqual([range(1, 5), range(6, 15)]);
    expect(sector(3).portals).toEqual([{ kind: 'gravity', count: 1, span: 2 }]);
    expect(sector(4).groups).toEqual([range(1, 10)]);
    expect(sector(4).portals).toEqual([{ kind: 'gravity', count: 3, span: 1 }, { kind: 'mini', count: 1 }]);
    expect(sector(5).groups).toEqual([range(1, 5), range(6, 10)]);
    expect(sector(5).portals).toEqual([{ kind: 'gravity', count: 2, span: 1 }, { kind: 'mini', count: 1 }]);
    // One mini section in each of sectors 4 and 5, none before.
    expect(sector(6).groups).toEqual([range(1, 10), range(11, 15), range(16, 25), range(26, 30)]);
    // One mini section in each of sectors 4 and 5 and in the Demon's Hard, Insane and Extreme tiers.
    expect(SECTORS.map((s) => SECTION_LIBRARY[s.id]!.filter((d) => d.mini).length)).toEqual([0, 0, 0, 1, 1, 3]);
    expect(SECTION_LIBRARY[6]!.flatMap((d, i) => (d.mini ? [i + 1] : []))).toEqual([15, 25, 30]);
    const ids = Object.values(SECTION_LIBRARY).flat().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Every section of the run is flown as the ship (the finale has wave stretches too).
    for (const s of SECTORS) for (const data of SECTION_LIBRARY[s.id]!) expect(data.mode ?? 'ship').toBe('ship');
  });

  test('speeds: 0.8, 0.85, 1.0, 1.1, 1.25 for sectors 1–5 and 1.25–1.7 in the Demon (sectors 1–2 not slow, owner); tiers ramp up and stay humanly possible', () => {
    expect(SECTORS.map((s) => tierOf(s.tier).speed)).toEqual([0.8, 0.85, 1.0, 1.1, 1.25, 1.25]);
    expect(sector(6).bands!.map((b) => tierOf(b.tier).speed)).toEqual([1.25, 1.4, 1.55, 1.7]);
    expect(tierSpeed('hard')).toBeCloseTo(BASE_SPEED);
    const order = ['easy', 'normal', 'hard', 'harder', 'insane', 'easyDemon', 'hardDemon', 'insaneDemon', 'extremeDemon'];
    const tiers = order.map((k) => TIERS[k]!);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]!.speed).toBeGreaterThanOrEqual(tiers[i - 1]!.speed);
      expect(tiers[i]!.minInterval).toBeLessThanOrEqual(tiers[i - 1]!.minInterval);
      expect(tiers[i]!.tolerance).toBeLessThanOrEqual(tiers[i - 1]!.tolerance);
      expect(tiers[i]!.clearance).toBeLessThanOrEqual(tiers[i - 1]!.clearance);
    }
    for (const t of tiers) expect(t.maxRate).toBeLessThanOrEqual(1 / t.minInterval);
  });

  test('sections: joints at both ends, level runs and steps only (no slope), wide enough for their tier', () => {
    for (const s of SECTORS) {
      SECTION_LIBRARY[s.id]!.forEach((data, i) => expect(checkShipSection(data, minGapOf(tierKeyOf(data, s, i + 1), data.mini === true)), data.id).toEqual([]));
    }
    const slope: SectionData = { id: 'slope', length: 20, ceil: '2 r20', floor: '10 r6 u2 r12', hazards: [] };
    expect(checkShipSection(slope, 1).join()).toContain('slope');
  });

  test('further sectors are harder: narrower openings and more obstacles per cell; the Demon’s Extreme has the tightest spots', () => {
    const stats = SECTORS.filter((s) => s.id <= 5).map((s) => {
      const list = SECTION_LIBRARY[s.id]!;
      const cells = list.reduce((n, d) => n + d.length, 0);
      // Obstacles: hazards and solids, and every step of the floor or the ceiling (a wall).
      const steps = (d: SectionData) => [...buildGeometry(d).ceilSegs, ...buildGeometry(d).floorSegs].filter((seg) => seg.slope === null).length;
      const things = list.reduce((n, d) => n + buildGeometry(d).hazards.length + steps(d), 0);
      const mean = list.reduce((n, d) => n + narrowestGap(d), 0) / list.length;
      return { density: things / cells, mean, least: Math.min(...list.map(narrowestGap)) };
    });
    expect(stats[1]!.density).toBeGreaterThan(stats[0]!.density);
    expect(stats[2]!.density).toBeGreaterThan(stats[1]!.density);
    expect(stats[1]!.mean).toBeLessThan(stats[0]!.mean);
    expect(stats[2]!.mean).toBeLessThan(stats[1]!.mean);
    expect(stats[2]!.least).toBeLessThan(stats[0]!.least);
    for (let i = 3; i < stats.length; i++) {
      expect(stats[i]!.density).toBeGreaterThan(stats[i - 1]!.density);
      expect(stats[i]!.mean).toBeLessThan(stats[i - 1]!.mean);
    }
    // The Demon's difficulty is mostly speed and tighter limits (its tiers); its Extreme
    // still holds the tightest spots of the run.
    const least = (list: SectionData[]) => Math.min(...list.map(narrowestGap));
    const demon = SECTION_LIBRARY[6]!;
    expect(least(demon.slice(25))).toBeLessThanOrEqual(Math.min(...SECTORS.filter((s) => s.id <= 5).map((s) => least(SECTION_LIBRARY[s.id]!))));
  });

  test('each group is shuffled within itself; the same seed builds the same run', () => {
    const order = orderSections(sector(2), createRng(9));
    expect(sorted(order.slice(0, 5))).toEqual(range(1, 5));
    expect(sorted(order.slice(5))).toEqual(range(6, 15));
    const a = buildRun(createRng(5));
    const b = buildRun(createRng(5));
    expect(a.sectors.map((s) => s.order)).toEqual(b.sectors.map((s) => s.order));
    expect(a.baseMode).toBe('ship');
    // The ship from the very start: no ship portals in a run that is all ship.
    expect(a.portals.some((p) => p.kind === 'ship')).toBe(false);
    expect(stateAt(a, a.startX).ship).toBe(true);
  });

  test('sector 3: exactly one flip and its way back two sections later; sectors 1–2 have none', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const run = buildRun(createRng(seed));
      expect(run.portals.filter((p) => p.sector < 2)).toEqual([]);
      const flips = run.portals.filter((p) => p.sector === 2);
      expect(flips.map((p) => [p.kind, p.on])).toEqual([['gravity', true], ['gravity', false]]);
      const [on, off] = flips as [(typeof flips)[0], (typeof flips)[0]];
      const placed = run.sectors[2]!;
      const first = pieceAt(run, on.x);
      expect(pieceAt(run, off.x).place - first.place).toBe(2);
      expect(first.place).toBeGreaterThan(1);
      expect(off.x).toBeLessThan(placed.x1);
      expect(stateAt(run, (on.x + off.x) / 2).gravity).toBe(-1);
      expect(stateAt(run, off.x + 0.1).gravity).toBe(1);
    }
  });

  test('sectors 4 and 5: exact flips (each back one section later) and one mini stretch around the mini section', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const run = buildRun(createRng(seed));
      for (const [index, flips] of [[3, 3], [4, 2]] as const) {
        const placed = run.sectors[index]!;
        const portals = run.portals.filter((p) => p.sector === index);
        const gravity = portals.filter((p) => p.kind === 'gravity');
        expect(gravity).toHaveLength(flips * 2);
        for (let k = 0; k < gravity.length; k += 2) {
          const on = gravity[k]!;
          const off = gravity[k + 1]!;
          expect([on.on, off.on]).toEqual([true, false]);
          expect(pieceAt(run, off.x).place - pieceAt(run, on.x).place).toBe(1);
          expect(stateAt(run, (on.x + off.x) / 2).gravity).toBe(-1);
        }
        expect(stateAt(run, placed.x1 - 0.1).gravity).toBe(1);
        const mini = portals.filter((p) => p.kind === 'mini');
        expect(mini.map((p) => p.on)).toEqual([true, false]);
        const piece = pieceAt(run, mini[0]!.x);
        expect(piece.g.mini).toBe(true);
        expect(pieceAt(run, mini[1]!.x)).toBe(piece);
        expect(stateAt(run, (piece.x0 + piece.x1) / 2).mini).toBe(true);
        expect(stateAt(run, piece.x1 + 0.1).mini).toBe(false);
      }
    }
  });

  test('the Demon: tiers in order, each shuffled within itself, at its own speed and look, with its own portals and checkpoints', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const run = buildRun(createRng(seed));
      const placed = run.sectors[5]!;
      const bands = sector(6).bands!;
      const pieces = run.pieces.slice(placed.first, placed.first + placed.count);
      bands.forEach((band, b) => {
        const mine = pieces.filter((p) => p.band === b);
        expect(sorted(mine.map((p) => p.number))).toEqual(range(band.from, band.to));
        for (const p of mine) expect(p).toMatchObject({ tier: band.tier, theme: band.theme, speed: tierSpeed(band.tier) });
        // Practice in the Demon goes back to the tier's start.
        expect(checkpointX(run, mine[mine.length - 1]!.x0 + 1, 'sector')).toBe(mine[0]!.x0);
      });
      expect(pieces.map((p) => p.band)).toEqual([...pieces.map((p) => p.band)].sort((a, b) => a - b));
      const portals = run.portals.filter((p) => p.sector === 5);
      const inBand = (b: number, kind: string) => portals.filter((p) => p.kind === kind && pieceAt(run, p.x).band === b);
      expect([0, 1, 2, 3].map((b) => inBand(b, 'gravity').length)).toEqual([2, 0, 4, 2]);
      expect([0, 1, 2, 3].map((b) => inBand(b, 'mini').length)).toEqual([0, 2, 2, 2]);
      const easy = inBand(0, 'gravity');
      expect(pieceAt(run, easy[1]!.x).place - pieceAt(run, easy[0]!.x).place).toBe(2);
      for (const p of portals.filter((q) => q.kind === 'mini')) expect(pieceAt(run, p.x).g.mini).toBe(true);
      expect(stateAt(run, placed.x1 - 0.1)).toMatchObject({ gravity: 1, mini: false });
    }
  });

  test('places, checkpoints and the test jump', () => {
    const run = buildRun(createRng(3));
    const x = jumpX(run, 2, 4)!;
    expect(locate(run, x + 1)).toEqual({ sector: 2, section: 4 });
    expect(checkpointX(run, x + 1, 'sector')).toBe(run.sectors[1]!.x0);
    expect(checkpointX(run, x + 1, 'section')).toBe(x);
  });
});

// ── Physics ──────────────────────────────────────────────────────────────────

describe('the ship’s flight', () => {
  const open = world([]);

  test('holding thrusts up, letting go falls, smoothly and capped; flipped gravity mirrors it', () => {
    let s = createShip(0, 6);
    s = stepShip(s, true, SPEED, 0.05, open).vehicle;
    expect(s.vy).toBeCloseTo(-SHIP.normal.upRise * 0.05);
    expect(s.y).toBeLessThan(6);
    expect(s.x).toBeCloseTo(SPEED * 0.05);
    for (let i = 0; i < 120; i++) s = stepShip({ ...s, y: 6 }, true, SPEED, STEP, open).vehicle;
    expect(s.vy).toBe(-SHIP.normal.capUp);
    for (let i = 0; i < 300; i++) s = stepShip({ ...s, y: 6 }, false, SPEED, STEP, open).vehicle;
    expect(s.vy).toBe(SHIP.normal.capDown);
    const flipped = stepShip({ ...createShip(0, 6), gravity: -1 }, true, SPEED, 0.05, open).vehicle;
    expect(flipped.vy).toBeCloseTo(SHIP.normal.upRise * 0.05);
  });

  test('the genre’s feel (stage f-0): braking is stronger than speeding up, the climb faster than the fall', () => {
    const k = SHIP.normal;
    // Held: braking a fall (0.5 g) beats climbing (0.4 g); released: braking a climb (0.48 g) beats sinking (0.32 g).
    expect(k.upFall / k.upRise).toBeCloseTo(1.25, 2);
    expect(k.downRise / k.downFall).toBeCloseTo(1.5, 2);
    expect(k.capUp / k.capDown).toBeCloseTo(1.25, 2);
    // A falling ship, held, brakes at upFall.
    const falling = stepShip({ ...createShip(0, 6), vy: 5 }, true, SPEED, 0.01, open).vehicle;
    expect(falling.vy).toBeCloseTo(5 - k.upFall * 0.01);
    // A climbing ship, released, brakes at downRise.
    const climbing = stepShip({ ...createShip(0, 6), vy: -5 }, false, SPEED, 0.01, open).vehicle;
    expect(climbing.vy).toBeCloseTo(-5 + k.downRise * 0.01);
    // The mini ship is the same ship ÷ 0.85.
    for (const key of ['upRise', 'upFall', 'downRise', 'downFall', 'capUp', 'capDown'] as const) expect(SHIP.mini[key] * 0.85).toBeCloseTo(k[key], 0);
  });

  test('the mini ship is smaller, lighter and answers faster', () => {
    expect(SHIP.mini.half).toBeLessThan(SHIP.normal.half);
    expect(SHIP.mini.radius).toBeLessThan(SHIP.normal.radius);
    expect(SHIP.mini.upRise).toBeGreaterThan(SHIP.normal.upRise);
    expect(SHIP.mini.downFall).toBeGreaterThan(SHIP.normal.downFall);
    const big = fly(open, createShip(0, 6), true, 24).ship;
    const mini = fly(open, { ...createShip(0, 6), mini: true }, true, 24).ship;
    expect(mini.y).toBeLessThan(big.y);
    // It rests lower on the floor (a smaller body).
    expect(fly(open, { ...createShip(0, 9), mini: true }, false, 240).ship.y).toBeCloseTo(JOINT.floor - SHIP.mini.half);
  });

  test('a fixed step: the ship ends in the same place at 60, 120 and 144 Hz', () => {
    const results = [60, 120, 144].map((hz) => {
      let acc = 0;
      let steps = 0;
      let s = createShip(0, 6);
      for (let f = 0; f < hz * 2; f++) {
        const tick = advanceClock(acc, 1 / hz);
        acc = tick.accumulator;
        for (let i = 0; i < tick.steps; i++) {
          s = stepShip(s, Math.floor(steps / 50) % 2 === 0, SPEED, STEP, open).vehicle;
          steps += 1;
        }
      }
      return { steps, y: s.y, x: s.x };
    });
    for (const r of results) expect(Math.abs(r.steps - 480)).toBeLessThanOrEqual(1);
    expect(results[0]!.y).toBeCloseTo(results[1]!.y, 1);
    expect(results[1]!.y).toBeCloseTo(results[2]!.y, 1);
    expect(advanceClock(0, 5).steps).toBe(Math.floor(MAX_FRAME / STEP + 1e-9));
  });

  test('the icon tilts with the climb and turns smoothly (drawing only)', () => {
    const climbing = { ...createShip(0, 6), vy: -8 };
    const target = targetAngle(climbing, SPEED, 1);
    expect(target).toBeLessThan(0);
    expect(targetAngle({ ...climbing, vy: 0 }, SPEED, 1)).toBe(0);
    // One 60 Hz frame turns only part of the way.
    const after = easeAngle(0, target, 1 / 60);
    expect(after).toBeLessThan(0);
    expect(after).toBeGreaterThan(target);
  });
});

// ── Collision ────────────────────────────────────────────────────────────────

describe('collision: rest and slide on tops and undersides, die on sides and hazards', () => {
  test('the floor: the ship rests on it and slides along, its fall stopped', () => {
    const r = fly(world([]), createShip(0, 8), false, 480);
    expect(r.crashed).toBe(false);
    expect(r.ship.y).toBeCloseTo(JOINT.floor - half);
    expect(r.ship.vy).toBe(0);
    expect(r.ship.x).toBeGreaterThan(15);
  });

  test('the ceiling: held up against it, the ship slides along under it', () => {
    const r = fly(world([]), createShip(0, 4), true, 400);
    expect(r.crashed).toBe(false);
    expect(r.ship.y).toBeCloseTo(JOINT.ceil + half);
    expect(r.ship.vy).toBe(0);
  });

  test('a block: rest on its top, slide under its underside, crash into its side', () => {
    const block: SectionData['hazards'] = [{ type: 'block', x: 6, y: 5, w: 8, h: 2 }];
    // Falling onto it from above.
    const top = fly(world(block), createShip(6.5, 3), false, 120);
    expect(top.crashed).toBe(false);
    expect(top.ship.y).toBeCloseTo(5 - half);
    // Held up against its underside.
    const under = fly(world(block), createShip(6.5, 8.5), true, 200);
    expect(under.crashed).toBe(false);
    expect(under.ship.y).toBeCloseTo(7 + half);
    // Flying level into its side.
    const side = fly(world(block), createShip(2, 6), (s) => s.vy > 0, 240);
    expect(side.crashed).toBe(true);
    expect(side.ship.x + half).toBeGreaterThan(6);
    expect(side.ship.x + half).toBeLessThan(6.1);
  });

  test('a pillar: its top is a platform, its side a wall', () => {
    const pillar: SectionData['hazards'] = [{ type: 'pillar', x: 8, on: 'floor', h: 3 }];
    expect(fly(world(pillar), createShip(1, 9.7), false, 240).crashed).toBe(true);
    const over = fly(world(pillar), createShip(7.9, 6.6), false, 20);
    expect(over.crashed).toBe(false);
    expect(over.ship.y).toBeCloseTo(7 - half);
  });

  test('a step of the floor or the ceiling is a wall; a step away is not', () => {
    // Floor up by one at x=8: riding the floor into it is a crash.
    expect(fly(world([], '2 r20', '10 r8 -1 r12'), createShip(1, 9.7), false, 300).crashed).toBe(true);
    // Floor down by one: the ship drops onto the lower floor.
    const down = fly(world([], '2 r20', '10 r8 +1 r12'), createShip(1, 9.7), false, 400);
    expect(down.crashed).toBe(false);
    expect(down.ship.y).toBeCloseTo(11 - half);
    // Ceiling down by one at x=8: held against it, the ship hits its step.
    expect(fly(world([], '2 r8 +1 r12', '10 r20'), createShip(1, 2.3), true, 300).crashed).toBe(true);
  });

  test('a landing forgives SNAP: a body a little below a top the step before is put back on it', () => {
    const w = world([{ type: 'block', x: 5, y: 6, w: 4, h: 1 }]);
    const block = { x0: 5, x1: 9, y0: 6, y1: 7 };
    expect(settle(w, block.y0 - half + SNAP * 0.9, 6, block.y0 - half + SNAP, half)).toMatchObject({ crash: false, landed: true, y: block.y0 - half });
    expect(settle(w, block.y0 - half + SNAP * 1.5, 6, block.y0 - half + SNAP * 1.6, half).crash).toBe(true);
  });

  test('squeezed between a top and an underside is a crash', () => {
    // A gap lower than the body.
    const w = world([{ type: 'block', x: 5, y: 2, w: 4, h: 4 }, { type: 'block', x: 5, y: 6.5, w: 4, h: 3.5 }]);
    expect(fly(w, createShip(0, 6.2), (s) => s.vy > 0.5, 300).crashed).toBe(true);
  });

  test('spikes, half-spikes, saws, orbs and mines kill on any touch, even from above', () => {
    const cases: [SectionData['hazards'][number], number][] = [
      [{ type: 'spike', x: 6, on: 'floor' }, 9.7],
      [{ type: 'halfSpike', x: 6, on: 'floor' }, 9.7],
      [{ type: 'saw', x: 7, y: 9, r: 0.8 }, 9.7],
      [{ type: 'orb', x: 7, y: 9, r: 0.8 }, 9.7],
      [{ type: 'mine', x: 7, y: 9, r: 0.8 }, 9.7],
      [{ type: 'spike', x: 6, on: 'ceil' }, 2.3],
    ];
    for (const [hazard, y] of cases) {
      const r = fly(world([hazard]), createShip(1, y), y < 6, 300);
      expect(r.crashed, hazard.type).toBe(true);
    }
    // A spike on a block's top: the block is a platform, its spike is not.
    const w = world([{ type: 'block', x: 4, y: 7, w: 8, h: 1 }, { type: 'spike', x: 9, y: 7, dir: 'up' }]);
    const r = fly(w, createShip(4.5, 6.5), false, 400);
    expect(r.crashed).toBe(true);
    expect(r.ship.x).toBeGreaterThan(8.4);
  });

  test('a hazard’s hit is smaller than its drawing: a near miss is forgiven', () => {
    // Resting on the floor next to a spike's base corner.
    const w = world([{ type: 'spike', x: 6, on: 'floor' }]);
    expect(stepShip({ ...createShip(5.75, 9.7) }, false, 0, STEP, w).crashed).toBe(false);
  });

  test('upside down, the ceiling is the ground and the floor a ceiling', () => {
    const r = fly(world([]), { ...createShip(0, 6), gravity: -1 }, false, 400);
    expect(r.crashed).toBe(false);
    expect(r.ship.y).toBeCloseTo(JOINT.ceil + half);
    const held = fly(world([]), { ...createShip(0, 6), gravity: -1 }, true, 400);
    expect(held.ship.y).toBeCloseTo(JOINT.floor - half);
  });

  test('leaving the playfield is a crash (where nothing else stops it)', () => {
    const empty: World = { solids: new Map(), hazard: () => false };
    expect(stepShip(createShip(7, half - 0.01), true, SPEED, STEP, empty).crashed).toBe(true);
    expect(stepShip(createShip(7, 6), true, SPEED, STEP, empty).crashed).toBe(false);
  });

  test('a run’s pieces join without a seam: riding the floor across every joint is safe', () => {
    const run = buildRun(createRng(2));
    const w = runWorld(run);
    let s = createShip(run.startX, JOINT.floor - half);
    for (let i = 0; i < 240 * 4; i++) {
      const next = stepShip(s, false, SPEED, STEP, w);
      if (next.crashed) break;
      s = next.vehicle;
    }
    // The first section's lead-in and the pad before it meet at the joint's height.
    expect(s.x).toBeGreaterThan(run.sectors[0]!.x0 + 2);
    expect(solidsOf(run.pieces[1]!.g).length).toBeGreaterThan(1);
  });
});

// ── The validator ────────────────────────────────────────────────────────────

describe('the human-feasibility validator', () => {
  const open: SectionData = { id: 'v-open', length: 30, ceil: '2 r30', floor: '10 r30', hazards: [] };

  test('an open room is fair from every entry; resting is a strategy (no taps at all from the floor)', () => {
    for (const entry of entriesOf(false)) expect(proveEntry(open, 'hard', { gravity: 1, mini: false }, entry).problem).toBeNull();
    expect(proveEntry(open, 'hard', { gravity: 1, mini: false }, { y: JOINT.floor - half, vy: 0 }).changes).toBe(0);
  });

  test('a path keeps the minimum interval and the rate cap, and survives every tap shifted by the tolerance', () => {
    const data = SECTION_LIBRARY[3]![0]!;
    const tier = TIERS.hard!;
    const r = proveEntry(data, 'hard', { gravity: 1, mini: false }, { y: 6.5, vy: 0 });
    expect(r.problem).toBeNull();
    const changes = changesOf(r.holds!);
    for (let k = 1; k < changes.length; k++) expect(changes[k]! - changes[k - 1]!).toBeGreaterThanOrEqual(Math.ceil(tier.minInterval / STEP - 1e-9));
    expect(peakRate(changes)).toBeLessThanOrEqual(tier.maxRate);
  });

  test('a wall with no way through, or one too close to the start to climb over, is caught', () => {
    const wall: SectionData = { ...open, id: 'v-wall', hazards: [{ type: 'pillar', x: 12, on: 'floor', h: 8 }] };
    expect(proveEntry(wall, 'easy', { gravity: 1, mini: false }, { y: 6, vy: 0 }).problem).not.toBeNull();
    const early: SectionData = { ...open, id: 'v-early', hazards: [{ type: 'pillar', x: 3, on: 'floor', h: 6.5 }] };
    expect(proveEntry(early, 'hard', { gravity: 1, mini: false }, { y: JOINT.floor - half, vy: 0 }).problem).not.toBeNull();
  });

  test('a path only a bot could fly (no room for a mistimed tap) is refused', () => {
    // A slot one and a half bodies high, entered from a fall: nominally passable, not robustly.
    const slot: SectionData = { ...open, id: 'v-slot', hazards: [{ type: 'pillar', x: 10, on: 'floor', h: 3.55, w: 6 }, { type: 'pillar', x: 10, on: 'ceil', h: 3.55, w: 6 }] };
    const spec = (limits: { minInterval: number; tolerance: number; maxRate: number }): BeamSpec => {
      const w = sectionWorld(buildGeometry(slot));
      return {
        x0: 0, x1: 30, speed: tierSpeed('hard'), limits, start: createShip(0, 6),
        step: (v, h, dt) => { const n = stepShip(v, h, tierSpeed('hard'), dt, w); return n.crashed ? null : n.vehicle; },
        safe: (v, band) => roomy(w, v, band),
      };
    };
    const bot = solveBeam(spec({ minInterval: 0.05, tolerance: 0, maxRate: 20 }), { bands: [[0, 'min']] });
    expect(bot.holds).not.toBeNull();
    expect(verifyBeam(spec(TIERS.hard!), bot.holds!)).not.toBeNull();
    expect(proveEntry(slot, 'hard', { gravity: 1, mini: false }, { y: 6, vy: 0 }).problem).not.toBeNull();
  });

  test('sector 3 is proven in both gravities; sectors 1–2 upright only', () => {
    expect(statesOf(sector(1))).toEqual([{ gravity: 1, mini: false }]);
    expect(statesOf(sector(3))).toEqual([{ gravity: 1, mini: false }, { gravity: -1, mini: false }]);
  });
});

// ── The game ─────────────────────────────────────────────────────────────────

function crash(game: Game) {
  for (let i = 0; i < 240 * 30 && game.phase === 'playing'; i++) stepGame(game, { holding: true, tap: false }, STEP);
}

describe('game', () => {
  test('normal: a crash restarts the run at sector 1 with a new shuffle; practice goes back to the checkpoint', () => {
    const game = createGame({ rng: createRng(2), mode: 'normal' });
    stepGame(game, { holding: false, tap: true }, STEP);
    expect(game.wave.ship).toBe(true);
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
    expect(practice.wave.x).toBeLessThan(practice.run.sectors[1]!.x0);
    expect(keepsRecords(practice)).toBe(false);
  });

  test('the pilot flies the last section to the finish, and the result says how far', { timeout: 60_000 }, () => {
    const game = createGame({ rng: createRng(12), mode: 'normal', jump: { sector: SECTORS.length, section: SECTION_LIBRARY[SECTORS.length]!.length } });
    stepGame(game, { holding: false, tap: true }, STEP);
    const pilot = createAutopilot();
    for (let i = 0; i < 240 * 30 && game.phase === 'playing'; i++) stepGame(game, { holding: pilot.advise(game.run, game.wave), tap: false }, STEP);
    expect(game.phase).toBe('finished');
    expect(game.result).toEqual({ sector: SECTORS.length, section: SECTION_LIBRARY[SECTORS.length]!.length, percent: 100 });
    expect(resultOf(game).percent).toBe(100);
  });

  test('the pilot flies the whole run, every sector, for several shuffles', { timeout: 300_000 }, () => {
    for (const seed of [1, 7, 21]) {
      const game = createGame({ rng: createRng(seed), mode: 'normal' });
      stepGame(game, { holding: false, tap: true }, STEP);
      const pilot = createAutopilot();
      for (let i = 0; i < 240 * 600 && game.phase === 'playing'; i++) stepGame(game, { holding: pilot.advise(game.run, game.wave), tap: false }, STEP);
      expect(game.phase, `seed ${seed} at ${JSON.stringify(game.where)}`).toBe('finished');
    }
  });
});

describe('the finale', () => {
  test('a fixed sequence, mostly the ship with wave stretches, a vehicle portal at every change, never shuffled', () => {
    const a = buildFinale();
    const b = buildFinale();
    const list = SECTION_LIBRARY[FINALE_ID]!;
    expect(a.sectors[0]!.order).toEqual(range(1, list.length));
    expect(b.sectors[0]!.order).toEqual(a.sectors[0]!.order);
    const pieces = a.pieces.filter((p) => p.kind === 'section');
    const modes = pieces.map((p) => p.mode);
    expect(modes.filter((m) => m === 'wave').length).toBeGreaterThanOrEqual(2);
    expect(modes.filter((m) => m === 'ship').length).toBeGreaterThan(modes.filter((m) => m === 'wave').length);
    expect(modes[0]).toBe('ship');
    const changes = pieces.filter((p, i) => i > 0 && p.mode !== pieces[i - 1]!.mode);
    expect(a.portals.filter((p) => p.kind === 'ship').map((p) => [p.x, p.on])).toEqual(changes.map((p) => [p.x0 + PORTAL_OFFSET.ship, p.mode === 'ship']));
    for (const p of pieces) expect(p.tier).toBe(p.mode === 'ship' ? 'finaleShip' : 'finaleWave');
    for (const p of pieces) expect(stateAt(a, p.x0 + 2).ship).toBe(p.mode === 'ship');
  });

  test('practice in the finale goes back to the stretch; a crash in normal play to its start', () => {
    const practice = createGame({ rng: createRng(1), mode: 'practice', level: 'finale', jump: { sector: 1, section: 4 } });
    expect(practice.checkpointBy).toBe('section');
    expect(practice.checkpoint).toBe(jumpX(practice.run, 1, 4));
    const normal = createGame({ rng: createRng(1), mode: 'normal', level: 'finale' });
    stepGame(normal, { holding: false, tap: true }, STEP);
    crash(normal);
    for (let i = 0; i < 240; i++) stepGame(normal, { holding: false, tap: false }, STEP);
    stepGame(normal, { holding: false, tap: true }, STEP);
    expect(normal.where).toEqual({ sector: 1, section: 1 });
    expect(normal.level).toBe('finale');
  });

  test('the wave stretches fly as the wave: at 45°, a touch is a crash', () => {
    const game = createGame({ rng: createRng(1), mode: 'normal', level: 'finale', jump: { sector: 1, section: 3 } });
    stepGame(game, { holding: false, tap: true }, STEP);
    for (let i = 0; i < 240 && game.wave.ship; i++) stepGame(game, { holding: false, tap: false }, STEP);
    expect(game.wave.ship).toBe(false);
    const y = game.wave.y;
    stepGame(game, { holding: true, tap: false }, STEP);
    expect(game.wave.y - y).toBeCloseTo(-tierSpeed('finaleWave') * STEP, 6);
  });

  test('the pilot flies the whole finale, ship and wave', { timeout: 120_000 }, () => {
    const game = createGame({ rng: createRng(1), mode: 'normal', level: 'finale' });
    stepGame(game, { holding: false, tap: true }, STEP);
    const pilot = createAutopilot();
    let wave = 0;
    for (let i = 0; i < 240 * 120 && game.phase === 'playing'; i++) {
      stepGame(game, { holding: pilot.advise(game.run, game.wave), tap: false }, STEP);
      if (!game.wave.ship) wave += 1;
    }
    expect(game.phase).toBe('finished');
    expect(wave).toBeGreaterThan(240);
  });
});

// ── Records, skins, texts ────────────────────────────────────────────────────

describe('records and skins', () => {
  test('only lifexp-shiprush-* keys; a better run replaces the best', () => {
    const storage = memoryStorage();
    expect(readBest(storage)).toBeNull();
    expect(saveBest(storage, { sector: 1, section: 3, percent: 7 }).isNew).toBe(true);
    expect(saveBest(storage, { sector: 1, section: 2, percent: 4 }).isNew).toBe(false);
    expect(countAttempt(storage)).toBe(1);
    expect(readAttempts(storage)).toBe(1);
    saveSkin(storage, 'manta');
    expect(readSkin(storage)).toBe('manta');
    expect(unlock(storage, 'demonComplete')).toBe(true);
    expect(unlock(storage, 'demonComplete')).toBe(false);
    expect(readProgress(storage)).toEqual({ demonComplete: true, finaleComplete: false });
    expect(unlock(storage, 'finaleComplete')).toBe(true);
    expect(readProgress(storage)).toEqual({ demonComplete: true, finaleComplete: true });
    expect(saveBest(storage, { sector: 1, section: 4, percent: 40 }, KEYS.finaleBest).isNew).toBe(true);
    expect(readBest(storage, KEYS.finaleBest)).toEqual({ sector: 1, section: 4, percent: 40 });
    expect(readBest(storage)).toEqual({ sector: 1, section: 3, percent: 7 });
    for (const key of storage.data.keys()) expect(key.startsWith('lifexp-shiprush-')).toBe(true);
    for (const key of Object.values(KEYS)) expect(key.startsWith('lifexp-shiprush-')).toBe(true);
  });

  test('ten hulls; all free except the last, which needs the whole Demon sector', () => {
    expect(SKINS).toHaveLength(10);
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(10);
    expect(new Set(SKINS.map((s) => s.hull)).size).toBe(10);
    const last = SKINS[SKINS.length - 1]!;
    for (const skin of SKINS.slice(0, -1)) expect(isUnlocked(skin, { demonComplete: false })).toBe(true);
    expect(isUnlocked(last, { demonComplete: false })).toBe(false);
    expect(resolveSkin(last.id, { demonComplete: false })).toBe(DEFAULT_SKIN);
    expect(resolveSkin(last.id, { demonComplete: true })).toBe(last);
    expect(resolveSkin('nope', { demonComplete: false })).toBe(DEFAULT_SKIN);
  });

  test('texts: Polish by default, both languages complete, every key the page uses', () => {
    expect(pickLang('?lang=en')).toBe('en');
    expect(pickLang('')).toBe('pl');
    for (const key of [...TEXT_KEYS, ...APP_TEXT_KEYS]) {
      expect((textsOf('pl') as Record<string, string>)[key], key).toBeTruthy();
      expect((textsOf('en') as Record<string, string>)[key], key).toBeTruthy();
    }
    for (const s of SECTORS) expect(translator('pl')(`sector${s.id}` as never)).toBeTruthy();
    expect(translator('en')('title')).toBe('Ship Rush');
  });

  test('the test switches only work with a seed', () => {
    expect(parseSwitches('?seed=3&sector=2&section=5&autopilot=2')).toEqual({ seed: 3, jump: { sector: 2, section: 5 }, autopilot: 2, finale: null });
    expect(parseSwitches('?sector=2')).toEqual({ seed: null, jump: null, autopilot: null, finale: null });
  });

  test('every sector has its own look; detail grows from sector to sector', () => {
    const looks = [...SECTORS.map((s) => THEMES[s.theme]!), ...sector(6).bands!.slice(1).map((b) => THEMES[b.theme]!)];
    expect(new Set(looks.map((t) => t.id)).size).toBe(looks.length);
    const detail = (t: (typeof looks)[number]) => {
      const sp = t.space;
      const space = sp ? sp.stars / 100 + sp.galaxies + sp.satellites + (sp.planet ? 1 : 0) + (sp.earth ? 1 : 0) + sp.structures + sp.asteroids + (sp.rays ? 1 : 0) : 0;
      return (t.fx?.glow ?? 0) + (t.fx?.chevrons ? 1 : 0) + (t.fx?.teeth ? 1 : 0) + (t.fx?.ground ? 1 : 0) + (t.motes ? 1 : 0) + (t.backdrop === 'storm' ? 1 : 0) + space;
    };
    for (let i = 1; i < looks.length; i++) expect(detail(looks[i]!)).toBeGreaterThan(detail(looks[i - 1]!));
  });
});
