// Wave Rush's pure parts (docs/v2/PLAN.md 9.1, stage w-1): the game is plain ES modules
// in public/games/wave-rush (no build step, its own CSP), and these tests import the
// same files the game runs. The proof that every authored section is fair for a human
// (solver.js) is here too, so CI fails on a section nobody could fly.
import { describe, expect, test } from 'vitest';
import {
  BASE_SPEED,
  JOINT,
  MAX_FRAME,
  SECTORS,
  STEP,
  TIERS,
  WAVE,
  flatCorridorMinHeight,
  sectorSpeed,
  sectorTier,
  type SectorDef,
} from '../public/games/wave-rush/js/config.js';
import { createGame, keepsRecords, resultOf, stepGame, type Game } from '../public/games/wave-rush/js/game.js';
import {
  buildGeometry,
  capsuleHits,
  checkSection,
  parseProfile,
  profileSegments,
  profileY,
  widestGapAt,
  type SectionData,
} from '../public/games/wave-rush/js/geometry.js';
import { pickLang, textsOf, translator, TEXT_KEYS } from '../public/games/wave-rush/js/i18n.js';
import { advanceClock, createWave, directionFor, holdFor, isBuffered, stepWave } from '../public/games/wave-rush/js/physics.js';
import { minGapOf, proveSection, sectionProblems, statesOf, tierKeyOf } from '../public/games/wave-rush/js/prove.js';
import {
  KEYS,
  countAttempt,
  readAttempts,
  readBest,
  readCheckpointBy,
  readProgress,
  unlock,
  readSkin,
  saveBest,
  saveCheckpointBy,
  saveSkin,
} from '../public/games/wave-rush/js/records.js';
import { createRng, parseSwitches, shuffle } from '../public/games/wave-rush/js/rng.js';
import {
  PORTAL_OFFSET,
  buildRun,
  checkpointX,
  jumpX,
  locate,
  orderSections,
  pieceAt,
  placePortals,
  progressAt,
  stateAt,
} from '../public/games/wave-rush/js/run.js';
import { SECTION_LIBRARY } from '../public/games/wave-rush/js/sections/index.js';
import { createAutopilot } from '../public/games/wave-rush/js/autopilot.js';
import { DEFAULT_SKIN, SKINS, isUnlocked, resolveSkin } from '../public/games/wave-rush/js/skins.js';
import { buildTable, changesOf, peakRate, planSteps, readPlan, replay, rowOf, shiftTap, toleranceBand } from '../public/games/wave-rush/js/solver.js';

const sector = (id: number) => SECTORS.find((s) => s.id === id) as SectorDef;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const sorted = (list: number[]) => [...list].sort((a, b) => a - b);

/** A tiny section for collision tests: an open joint corridor plus the given hazards. */
function room(hazards: SectionData['hazards'], ceil = '2 r20', floor = '10 r20'): ReturnType<typeof buildGeometry> {
  return buildGeometry({ id: 'test', length: 20, ceil, floor, hazards });
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const blockedStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

// ── Sections and sectors ─────────────────────────────────────────────────────

describe('authored sectors', () => {
  test('the run: sectors with 10, 15, 15, 10, 10 (and 30 Demon) sections', () => {
    const counts: Record<number, number> = { 1: 10, 2: 15, 3: 15, 4: 10, 5: 10, 6: 30 };
    expect(SECTORS.map((s) => s.id)).toEqual(range(1, SECTORS.length));
    for (const s of SECTORS) expect(SECTION_LIBRARY[s.id]?.length, `sector ${s.id}`).toBe(counts[s.id]);
    for (const s of SECTORS) expect(sorted(s.groups.flat())).toEqual(range(1, counts[s.id]!));
    const ids = Object.values(SECTION_LIBRARY).flat().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('speeds: 0.5, 0.5 and 1.0 of the base speed; tiers ramp up and stay humanly possible', () => {
    expect(SECTORS.map((s) => sectorTier(s).speed)).toEqual([0.5, 0.5, 1.0, 1.1, 1.3, 1.3]);
    expect(sector(6).bands!.map((b) => TIERS[b.tier]!.speed)).toEqual([1.3, 1.5, 1.7, 1.9]);
    expect(sectorSpeed(sector(3))).toBeCloseTo(BASE_SPEED);
    const order = ['easy', 'normal', 'hard', 'harder', 'insane', 'easyDemon', 'hardDemon', 'insaneDemon', 'extremeDemon'];
    const tiers = order.map((k) => TIERS[k]!);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]!.speed).toBeGreaterThanOrEqual(tiers[i - 1]!.speed);
      expect(tiers[i]!.minInterval).toBeLessThanOrEqual(tiers[i - 1]!.minInterval);
      expect(tiers[i]!.tolerance).toBeLessThanOrEqual(tiers[i - 1]!.tolerance);
    }
    // Owner's bounds: ≥ 220 ms on sectors 1–2 down to 110–120 ms on Extreme; Extreme ≈ 1.9–2.0.
    expect(TIERS.easy!.minInterval).toBeGreaterThanOrEqual(0.22);
    expect(TIERS.extremeDemon!.minInterval).toBeGreaterThanOrEqual(0.11);
    expect(TIERS.extremeDemon!.speed).toBeGreaterThanOrEqual(1.9);
    expect(TIERS.extremeDemon!.speed).toBeLessThanOrEqual(2.0);
    expect(TIERS.extremeDemon!.clearance).toBeGreaterThanOrEqual(TIERS.insaneDemon!.clearance - 0.25);
    // A rate cap never asks for more than the interval allows.
    for (const t of tiers) expect(t.maxRate).toBeLessThanOrEqual(1 / t.minInterval);
  });

  test('every section is well formed: joint ends, 45° slopes only, spikes on flat ground, wide enough', () => {
    for (const s of SECTORS) {
      SECTION_LIBRARY[s.id]!.forEach((data, i) => expect(checkSection(data, minGapOf(tierKeyOf(data, s, i + 1))), data.id).toEqual([]));
    }
  });

  test('further sectors are harder: narrower corridors and more hazards per cell', () => {
    const stats = SECTORS.map((s) => {
      const list = SECTION_LIBRARY[s.id]!.map(buildGeometry);
      const cells = list.reduce((n, g) => n + g.length, 0);
      const hazards = list.reduce((n, g) => n + g.hazards.length, 0);
      let gap = Infinity;
      for (const g of list) for (let x = 0; x <= g.length; x += 0.1) gap = Math.min(gap, widestGapAt(g, x));
      return { density: hazards / cells, gap };
    });
    expect(stats[1]!.density).toBeGreaterThan(stats[0]!.density);
    expect(stats[2]!.gap).toBeLessThan(stats[0]!.gap);
    expect(stats[4]!.gap).toBeLessThan(stats[2]!.gap);
  });

  test('flat stretches are tall enough to zig-zag through at the tier’s tap rate', () => {
    for (const s of SECTORS) {
      SECTION_LIBRARY[s.id]!.forEach((data, i) => {
        const tier = TIERS[tierKeyOf(data, s, i + 1)]!;
        // A stretch is "flat" when both walls stay level for a whole zig-zag (two legs).
        const leg = tier.speed * BASE_SPEED * tier.minInterval;
        const need = flatCorridorMinHeight(tier, data.mini === true);
        const g = buildGeometry(data);
        for (let x = 0; x + 2 * leg <= g.length; x += 0.25) {
          const flat = [g.ceil, g.floor].every((pts) =>
            profileSegments(pts).every((seg) => seg.x1 <= x || seg.x0 >= x + 2 * leg || seg.slope === 0),
          );
          if (!flat) continue;
          const height = profileY(g.floor, x, 'floor') - profileY(g.ceil, x, 'ceil');
          expect(height, `${data.id} at x=${x}`).toBeGreaterThanOrEqual(need - 1e-9);
        }
      });
    }
  });
});

describe('the human-feasibility validator', () => {
  test('a flat corridor of the formula height (plus the tap tolerance) is provable at every tier; much lower is not', { timeout: 120_000 }, () => {
    for (const [name, tier] of Object.entries(TIERS)) {
      const band = toleranceBand(tier.speed * BASE_SPEED, false, tier.tolerance);
      const height = Math.min(7.9, flatCorridorMinHeight(tier) + 2 * band + 0.3);
      const half = height / 2;
      const funnel = 4 - half;
      const ok: SectionData = {
        id: `flat-${name}`,
        length: 40,
        ceil: `2 r3 d${funnel} r${40 - 6 - 2 * funnel} u${funnel} r3`,
        floor: `10 r3 u${funnel} r${40 - 6 - 2 * funnel} d${funnel} r3`,
        hazards: [],
      };
      const fails = proveSection(ok, name, { gravity: 1, mini: false }, 2).filter((r) => r.problem);
      expect(fails, `${name}: ${height.toFixed(2)} cells`).toEqual([]);
      if (flatCorridorMinHeight(tier) - 0.7 > 2 * WAVE.radius) {
        const low = flatCorridorMinHeight(tier) - 0.7;
        const f2 = 4 - low / 2;
        const tooLow: SectionData = { ...ok, id: `low-${name}`, ceil: `2 r3 d${f2} r${34 - 2 * f2} u${f2} r3`, floor: `10 r3 u${f2} r${34 - 2 * f2} d${f2} r3` };
        expect(proveSection(tooLow, name, { gravity: 1, mini: false }, 2).some((r) => r.problem), name).toBe(true);
      }
    }
  });

  test('a plan keeps the minimum interval and the rate cap, and survives every tap shifted by the tolerance', () => {
    const s = sector(3);
    const data = SECTION_LIBRARY[3]![0]!;
    const g = buildGeometry(data);
    const spec = {
      hits: (x: number, ya: number, yb: number, r: number, dir: number, slope: number) => capsuleHits(g, x, ya, yb, r, dir, slope),
      x0: 0,
      x1: g.length,
      speed: sectorSpeed(s),
      mini: false,
      limits: sectorTier(s),
      yAnchor: JOINT.ceil,
    };
    const table = buildTable(spec);
    const plan = readPlan(table, rowOf(table, 6))!;
    expect(plan).not.toBeNull();
    const dirs = planSteps(plan, table.n);
    const changes = changesOf(dirs);
    for (let k = 1; k < changes.length; k++) expect((changes[k]! - changes[k - 1]!) * STEP).toBeGreaterThanOrEqual(sectorTier(s).minInterval - 1e-9);
    expect(peakRate(changes)).toBeLessThanOrEqual(sectorTier(s).maxRate);
    expect(replay(spec, plan.entryY, dirs, 1)).toBe(true);
    const shift = Math.ceil(sectorTier(s).tolerance / STEP);
    for (let k = 0; k < changes.length; k++) {
      expect(replay(spec, plan.entryY, shiftTap(dirs, changes, k, shift), 1)).toBe(true);
      expect(replay(spec, plan.entryY, shiftTap(dirs, changes, k, -shift), 1)).toBe(true);
    }
    // The same input with the screen upside down: the holds flip, the path does not.
    expect(replay(spec, plan.entryY, dirs, -1)).toBe(true);
  });

  test('a section with no way through is caught', () => {
    const wall: SectionData = { id: 'wall', length: 20, ceil: '2 r20', floor: '10 r20', hazards: [{ type: 'block', x: 9, y: 2, w: 1, h: 8 }] };
    expect(proveSection(wall, 'easy', { gravity: 1, mini: false }).every((r) => r.problem)).toBe(true);
  });

  // The proof itself: every authored section, every entry height across the joint, in
  // every state its sector can put it in (both gravities in sector 3).
  for (const s of SECTORS) {
    test(`sector ${s.id}: every section is passable for a human (in ${statesOf(s).length} gravity state(s); mini sections as mini)`, { timeout: 300_000 }, () => {
      const problems = SECTION_LIBRARY[s.id]!.flatMap((data, i) => sectionProblems(data, s, i + 1));
      expect(problems).toEqual([]);
    });
  }
});

// ── Shuffles and portals ─────────────────────────────────────────────────────

describe('a run', () => {
  test('sector 1 is fully shuffled; sectors 2 and 3 play 1–5 (shuffled) then 6–15 (shuffled)', () => {
    const firsts = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const rng = createRng(seed);
      const one = orderSections(sector(1), rng);
      expect(sorted(one)).toEqual(range(1, 10));
      firsts.add(one[0]!);
      for (const id of [2, 3]) {
        const order = orderSections(sector(id), rng);
        expect(sorted(order.slice(0, 5))).toEqual(range(1, 5));
        expect(sorted(order.slice(5))).toEqual(range(6, 15));
      }
    }
    // Really shuffled: many different openers.
    expect(firsts.size).toBeGreaterThan(5);
  });

  test('the same seed builds the same run', () => {
    const a = buildRun(createRng(42));
    const b = buildRun(createRng(42));
    expect(a.sectors.map((s) => s.order)).toEqual(b.sectors.map((s) => s.order));
    expect(a.portals).toEqual(b.portals);
  });

  test('sector 3 has exactly one gravity portal and the way back two sections later; sectors 1–2 have none', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const run = buildRun(createRng(seed));
      const bySector = SECTORS.map((_, i) => run.portals.filter((p) => p.sector === i));
      expect(bySector[0]).toEqual([]);
      expect(bySector[1]).toEqual([]);
      const [on, off] = bySector[2]!;
      expect(bySector[2]).toHaveLength(2);
      expect(on).toMatchObject({ kind: 'gravity', on: true });
      expect(off).toMatchObject({ kind: 'gravity', on: false });
      const s3 = run.sectors[2]!;
      const pieceOn = pieceAt(run, on!.x);
      const pieceOff = pieceAt(run, off!.x);
      expect(pieceOff.place - pieceOn.place).toBe(2);
      // Never at the sector's very start, always back before it ends.
      expect(pieceOn.place).toBeGreaterThan(1);
      expect(pieceOff.place).toBeLessThanOrEqual(s3.count);
      // Exactly two sections are flown upside down.
      const flipped = run.pieces.filter((p) => p.kind === 'section' && p.sector === 2 && stateAt(run, (p.x0 + p.x1) / 2).gravity === -1);
      expect(flipped).toHaveLength(2);
    }
  });

  test('sectors 4 and 5: exact gravity flips (each with its way back) and one mini stretch around the mini section', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const run = buildRun(createRng(seed));
      for (const [index, flips] of [[3, 3], [4, 2]] as const) {
        const portals = run.portals.filter((p) => p.sector === index);
        const gravity = portals.filter((p) => p.kind === 'gravity');
        expect(gravity.filter((p) => p.on)).toHaveLength(flips);
        expect(gravity.filter((p) => !p.on)).toHaveLength(flips);
        // On, off, on, off…: a flip always comes back before the next, and the sector ends upright.
        gravity.forEach((p, i) => expect(p.on).toBe(i % 2 === 0));
        const sector = run.sectors[index]!;
        const pieces = run.pieces.slice(sector.first, sector.first + sector.count);
        expect(pieces.filter((p) => stateAt(run, (p.x0 + p.x1) / 2).gravity === -1)).toHaveLength(flips);
        expect(stateAt(run, sector.x1 - 0.1).gravity).toBe(1);
        // Mini: exactly the section marked mini, wherever the shuffle put it.
        const mini = portals.filter((p) => p.kind === 'mini');
        expect(mini.map((p) => p.on)).toEqual([true, false]);
        const small = pieces.filter((p) => stateAt(run, (p.x0 + p.x1) / 2).mini);
        expect(small.map((p) => p.g.mini)).toEqual([true]);
        expect(pieces.filter((p) => p.g.mini)).toHaveLength(1);
      }
    }
  });

  test('a portal stands in an open joint (a section’s lead-in, a mini’s lead-out): never in a hazard', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const run = buildRun(createRng(seed));
      for (const p of run.portals) {
        const piece = pieceAt(run, p.x);
        const local = p.x - piece.x0;
        if (p.kind === 'mini' && !p.on) expect(piece.x1 - p.x).toBeCloseTo(PORTAL_OFFSET.miniBack);
        else expect(local).toBeCloseTo(p.kind === 'mini' ? PORTAL_OFFSET.mini : PORTAL_OFFSET.gravity);
        for (const h of piece.g.hazards) expect(Math.abs((h.bbox[0]! + h.bbox[2]!) / 2 - local)).toBeGreaterThan(1);
        expect(profileY(piece.g.ceil, local, 'ceil')).toBe(JOINT.ceil);
        expect(profileY(piece.g.floor, local, 'floor')).toBe(JOINT.floor);
      }
    }
  });

  test('the Demon: tiers in order, each shuffled within itself, at its own speed and look, with its own portals', () => {
    const demon = sector(6);
    const bands = demon.bands!;
    for (let seed = 1; seed <= 100; seed++) {
      const run = buildRun(createRng(seed));
      const placed = run.sectors[5]!;
      const pieces = run.pieces.slice(placed.first, placed.first + placed.count);
      bands.forEach((band, b) => {
        const mine = pieces.filter((p) => p.band === b);
        expect(sorted(mine.map((p) => p.number))).toEqual(range(band.from, band.to));
        for (const p of mine) expect(p).toMatchObject({ tier: band.tier, theme: band.theme });
        for (const p of mine) expect(p.speed).toBeCloseTo(TIERS[band.tier]!.speed * BASE_SPEED);
      });
      // Tiers in order.
      expect(pieces.map((p) => p.band)).toEqual([...pieces.map((p) => p.band)].sort((a, b) => a - b));
      // Gravity: 1 + 2 + 1 flips, each back inside its own tier; mini around each tier's mini section.
      const portals = run.portals.filter((p) => p.sector === 5);
      expect(portals.filter((p) => p.kind === 'gravity' && p.on)).toHaveLength(4);
      expect(portals.filter((p) => p.kind === 'mini' && p.on)).toHaveLength(3);
      for (const b of [1, 2, 3]) {
        const small = pieces.filter((p) => p.band === b && stateAt(run, (p.x0 + p.x1) / 2).mini);
        expect(small.map((p) => p.g.mini)).toEqual([true]);
      }
      expect(stateAt(run, placed.x1 - 0.1)).toMatchObject({ gravity: 1, mini: false });
    }
  });

  test('practice checkpoints in the Demon are per tier', () => {
    const run = buildRun(createRng(3));
    const placed = run.sectors[5]!;
    const pieces = run.pieces.slice(placed.first, placed.first + placed.count);
    for (const b of [0, 1, 2, 3]) {
      const mine = pieces.filter((p) => p.band === b);
      const last = mine[mine.length - 1]!;
      expect(checkpointX(run, (last.x0 + last.x1) / 2, 'sector')).toBe(mine[0]!.x0);
      expect(checkpointX(run, (last.x0 + last.x1) / 2, 'section')).toBe(last.x0);
    }
  });

  test('portal placement: exact counts, never overlapping, inside its range', () => {
    const def: SectorDef = { id: 4, key: 'harder', tier: 'harder', theme: 'lagoon', groups: [range(1, 10)], portals: [{ kind: 'gravity', count: 3, span: 1 }, { kind: 'mini', count: 1 }] };
    const data: SectionData[] = range(1, 10).map((n) => ({ id: `t${n}`, length: 10, ceil: '2 r10', floor: '10 r10', hazards: [], mini: n === 4 }));
    for (let seed = 1; seed <= 100; seed++) {
      const order = shuffle(range(1, 10), createRng(seed));
      const slots = placePortals(def, order, data, createRng(seed));
      const gravity = slots.filter((s) => s.kind === 'gravity');
      expect(gravity.filter((s) => s.on)).toHaveLength(3);
      expect(new Set(gravity.map((s) => s.boundary)).size).toBe(6);
      for (const s of gravity) expect(s.boundary).toBeGreaterThanOrEqual(1);
      for (const s of gravity) expect(s.boundary).toBeLessThanOrEqual(9);
      const mini = slots.filter((s) => s.kind === 'mini');
      expect(mini).toHaveLength(2);
      for (const s of mini) expect(order[s.place - 1]).toBe(4);
    }
  });

  test('progress, places, checkpoints and the test jump', () => {
    const run = buildRun(createRng(5));
    expect(progressAt(run, run.startX)).toBe(0);
    expect(progressAt(run, run.length)).toBe(100);
    const s2 = run.sectors[1]!;
    const third = run.pieces[s2.first + 2]!;
    const mid = (third.x0 + third.x1) / 2;
    expect(locate(run, mid)).toEqual({ sector: 2, section: 3 });
    expect(checkpointX(run, mid, 'sector')).toBe(s2.x0);
    expect(checkpointX(run, mid, 'section')).toBe(third.x0);
    expect(jumpX(run, 2, 3)).toBe(third.x0);
    expect(jumpX(run, 9, 1)).toBeNull();
  });
});

// ── Physics and collision ────────────────────────────────────────────────────

describe('physics', () => {
  test('the wave never flies flat: up at its slope while held, down while released', () => {
    const w = createWave(0, 6);
    const up = stepWave(w, true, 10, 0.1);
    expect(up).toMatchObject({ x: 1, dir: -1 });
    expect(up.y).toBeCloseTo(5);
    const down = stepWave(w, false, 10, 0.1);
    expect(down.y).toBeCloseTo(7);
    // Mini: dy:dx = 2:1.
    expect(stepWave({ ...w, mini: true }, true, 10, 0.1).y).toBeCloseTo(4);
    // Upside down, holding goes down.
    expect(stepWave({ ...w, gravity: -1 }, true, 10, 0.1).y).toBeCloseTo(7);
    expect(directionFor(true, 1)).toBe(-1);
    expect(holdFor(1, -1)).toBe(true);
    expect(holdFor(-1, -1)).toBe(false);
    // No horizontal state: only x, y, direction, gravity and size.
    expect(Object.keys(w).sort()).toEqual(['dir', 'gravity', 'mini', 'x', 'y']);
  });

  test('a fixed step: 60, 120 and 144 Hz run the same number of steps and end in the same place', () => {
    const results = [60, 120, 144].map((hz) => {
      let acc = 0;
      let steps = 0;
      let w = createWave(0, 6);
      for (let f = 0; f < hz * 2; f++) {
        const tick = advanceClock(acc, 1 / hz);
        acc = tick.accumulator;
        for (let i = 0; i < tick.steps; i++) {
          w = stepWave(w, Math.floor(steps / 60) % 2 === 0, 10, STEP);
          steps += 1;
        }
        expect(tick.alpha).toBeGreaterThanOrEqual(0);
        expect(tick.alpha).toBeLessThan(1);
      }
      return { steps, x: w.x, y: w.y };
    });
    for (const r of results) {
      expect(Math.abs(r.steps - 480)).toBeLessThanOrEqual(1);
    }
    expect(results[0]!.x).toBeCloseTo(results[1]!.x, 1);
    expect(results[1]!.y).toBeCloseTo(results[2]!.y, 1);
    // A stalled tab does not jump far ahead.
    expect(advanceClock(0, 5).steps).toBe(Math.floor(MAX_FRAME / STEP + 1e-9));
  });

  test('a tap is buffered briefly', () => {
    expect(isBuffered(1000, 1100)).toBe(true);
    expect(isBuffered(1000, 1200)).toBe(false);
    expect(isBuffered(null, 1000)).toBe(false);
  });
});

describe('collision', () => {
  const r = WAVE.radius;
  const hit = (g: ReturnType<typeof buildGeometry>, x: number, y: number, dir = 1) => capsuleHits(g, x, y, y, r, dir, 1);

  test('the open corridor is safe; its floor and ceiling are not (no sliding)', () => {
    const g = room([]);
    expect(hit(g, 10, 6)).toBe(false);
    expect(hit(g, 10, 10 - r + 0.05)).toBe(true);
    expect(hit(g, 10, 2 + r - 0.05, -1)).toBe(true);
    expect(hit(g, 10, 10 - r - 0.05)).toBe(false);
  });

  test('spike and half-spike: the tip kills, a graze of the drawn corner is forgiven', () => {
    const g = room([{ type: 'spike', x: 9, on: 'floor' }, { type: 'halfSpike', x: 14, on: 'floor' }]);
    // The spike stands on the floor (y 10), its tip drawn at y 9; its hit tip is at 9.25.
    expect(hit(g, 9.5, 9.25 - r + 0.05)).toBe(true);
    // Touching the drawn tip is forgiven.
    expect(hit(g, 9.5, 8.75)).toBe(false);
    expect(hit(g, 14.5, 9.62 - r + 0.05)).toBe(true);
    expect(hit(g, 14.5, 9.1)).toBe(false);
  });

  test('block and pillar: exact edges', () => {
    const g = room([{ type: 'block', x: 8, y: 5, w: 2, h: 1 }, { type: 'pillar', x: 14, on: 'ceil', h: 3 }]);
    expect(hit(g, 9, 5 - r + 0.01)).toBe(true);
    expect(hit(g, 9, 5 - r - 0.01)).toBe(false);
    expect(hit(g, 8 - r - 0.01, 5.5)).toBe(false);
    expect(hit(g, 14.5, 5 + r - 0.01)).toBe(true);
    expect(hit(g, 14.5, 5 + r + 0.01)).toBe(false);
  });

  test('saw and spike orb: a round hitbox smaller than the drawing', () => {
    const g = room([{ type: 'saw', x: 8, y: 6, r: 1 }, { type: 'orb', x: 14, y: 6, r: 1 }]);
    expect(hit(g, 8, 6 - 0.8 - r + 0.05)).toBe(true);
    expect(hit(g, 8, 6 - 0.8 - r - 0.05)).toBe(false);
    expect(hit(g, 14, 6 - 0.72 - r + 0.05)).toBe(true);
    expect(hit(g, 14, 6 - 0.72 - r - 0.05)).toBe(false);
  });

  test('a 45° slope may be grazed only while flying along it; against it is a crash', () => {
    // The floor rises 45° from x = 6 to x = 10 (y 10 → 6): the wave going up along it.
    const g = room([], '2 r20', '10 r6 u4 r10');
    // Centre 0.1 above the slope's line: inside the hit circle, but the wave flies along it.
    const x = 8;
    const y = profileY(g.floor, x, 'floor') - 0.1;
    expect(capsuleHits(g, x, y, y, r, -1, 1)).toBe(false);
    // Going down there is a crash.
    expect(capsuleHits(g, x, y, y, r, 1, 1)).toBe(true);
    // A mini wave (2:1) cannot graze a 45° slope.
    expect(capsuleHits(g, x, y, y, WAVE.miniRadius, -1, 2)).toBe(true);
    // Crossing the line is a crash even when aligned.
    expect(capsuleHits(g, x, y + 0.2, y + 0.2, r, -1, 1)).toBe(true);
    // Passing over the corner at the top of the slope while still grazing: no crash.
    expect(capsuleHits(g, 10.05, 6 - 0.15, 6 - 0.15, r, -1, 1)).toBe(false);
    // Flying into the flat ceiling of a step is still a crash.
    const step = room([], '2 r8 +3 r12', '10 r20');
    expect(capsuleHits(step, 8 - r + 0.05, 3, 3, r, -1, 1)).toBe(true);
  });

  test('leaving the playfield is a crash', () => {
    const g = room([], '0.5 r20', '11.5 r20');
    expect(capsuleHits(g, 5, 0.1, 0.1, r, -1, 1)).toBe(true);
  });

  test('profiles: tokens, 45° slopes and stairs', () => {
    expect(parseProfile('2 r3 d2 +1 u1 -1 r1')).toEqual([[0, 2], [3, 2], [5, 4], [5, 5], [6, 4], [6, 3], [7, 3]]);
    expect(() => parseProfile('2 x3')).toThrow();
    const g = room([], '2 r5 +2 r15', '10 r20');
    // On a vertical step the lower ceiling counts.
    expect(profileY(g.ceil, 5, 'ceil')).toBe(4);
  });
});

// ── Game states, records, skins, texts ───────────────────────────────────────

/** Flies the wave straight into the floor (no input). */
function crash(game: Game) {
  for (let i = 0; i < 240 * 20 && game.phase === 'playing'; i++) stepGame(game, { holding: false, tap: false }, STEP);
}

describe('game', () => {
  test('normal mode: a crash restarts at sector 1, section 1 with a new shuffle', () => {
    const game = createGame({ rng: createRng(9), mode: 'normal', jump: { sector: 2, section: 4 } });
    expect(game.where).toEqual({ sector: 2, section: 3 });
    expect(keepsRecords(game)).toBe(false);
    stepGame(game, { holding: false, tap: true }, STEP);
    expect(game.phase).toBe('playing');
    const firstRun = game.run;
    crash(game);
    expect(game.phase).toBe('dead');
    expect(game.result?.sector).toBe(2);
    // Locked a moment, then a tap starts again from the very start.
    stepGame(game, { holding: false, tap: true }, STEP);
    expect(game.phase).toBe('dead');
    for (let i = 0; i < 240; i++) stepGame(game, { holding: false, tap: false }, STEP);
    stepGame(game, { holding: true, tap: true }, STEP);
    expect(game.phase).toBe('playing');
    expect(game.attempt).toBe(2);
    expect(game.run).not.toBe(firstRun);
    expect(game.where).toEqual({ sector: 1, section: 1 });
    expect(keepsRecords(game)).toBe(true);
  });

  test('practice: a crash goes back to the sector’s checkpoint of the same run', () => {
    const game = createGame({ rng: createRng(4), mode: 'practice', jump: { sector: 2, section: 3 } });
    const run = game.run;
    expect(game.checkpoint).toBe(run.sectors[1]!.x0);
    stepGame(game, { holding: false, tap: true }, STEP);
    crash(game);
    for (let i = 0; i < 240; i++) stepGame(game, { holding: false, tap: false }, STEP);
    stepGame(game, { holding: false, tap: true }, STEP);
    expect(game.run).toBe(run);
    expect(game.wave.x).toBeLessThan(run.sectors[1]!.x0);
    expect(game.wave.x).toBeGreaterThan(run.sectors[1]!.x0 - 3);
    expect(keepsRecords(game)).toBe(false);
  });

  test('practice by section: the checkpoint follows each section', () => {
    const game = createGame({ rng: createRng(4), mode: 'practice', checkpointBy: 'section', jump: { sector: 1, section: 2 } });
    expect(game.checkpoint).toBe(jumpX(game.run, 1, 2));
  });

  test('the solver’s pilot flies the last section of the run to the end, and the result says how far', { timeout: 60_000 }, () => {
    const lastSector = SECTORS.length;
    const count = SECTION_LIBRARY[lastSector]!.length;
    const game = createGame({ rng: createRng(12), mode: 'normal', jump: { sector: lastSector, section: count } });
    stepGame(game, { holding: false, tap: true }, STEP);
    const pilot = createAutopilot();
    for (let i = 0; i < 240 * 30 && game.phase === 'playing'; i++) stepGame(game, { holding: pilot.advise(game.run, game.wave), tap: false }, STEP);
    expect(game.phase).toBe('finished');
    expect(game.result).toEqual({ sector: lastSector, section: count, percent: 100 });
    expect(resultOf(game).percent).toBe(100);
  });
});

describe('records', () => {
  test('only a run that got further is kept; only lifexp-waverush-* keys', () => {
    const storage = memoryStorage();
    expect(readBest(storage)).toBeNull();
    expect(saveBest(storage, { sector: 1, section: 1, percent: 0 }).isNew).toBe(false);
    expect(saveBest(storage, { sector: 1, section: 4, percent: 9 }).isNew).toBe(true);
    expect(saveBest(storage, { sector: 1, section: 2, percent: 4 })).toEqual({ best: { sector: 1, section: 4, percent: 9 }, isNew: false });
    expect(saveBest(storage, { sector: 2, section: 1, percent: 30 }).isNew).toBe(true);
    expect(readBest(storage)).toEqual({ sector: 2, section: 1, percent: 30 });
    expect(countAttempt(storage)).toBe(1);
    expect(countAttempt(storage)).toBe(2);
    expect(readAttempts(storage)).toBe(2);
    saveSkin(storage, 'teal');
    expect(readSkin(storage)).toBe('teal');
    expect(readCheckpointBy(storage)).toBe('sector');
    saveCheckpointBy(storage, 'section');
    expect(readCheckpointBy(storage)).toBe('section');
    for (const key of storage.data.keys()) expect(key.startsWith('lifexp-waverush-')).toBe(true);
    for (const key of Object.values(KEYS)) expect(key.startsWith('lifexp-waverush-')).toBe(true);
  });

  test('broken or blocked storage reads as empty and never throws', () => {
    const storage = memoryStorage();
    storage.data.set(KEYS.best, '{nope');
    storage.data.set(KEYS.attempts, '"x"');
    expect(readBest(storage)).toBeNull();
    expect(readAttempts(storage)).toBe(0);
    expect(readBest(blockedStorage)).toBeNull();
    expect(saveBest(blockedStorage, { sector: 1, section: 1, percent: 1 }).isNew).toBe(true);
    expect(readProgress(blockedStorage)).toEqual({ demonComplete: false, finaleComplete: false });
    expect(readSkin(null)).toBeNull();
  });
});

describe('achievements', () => {
  test('finishing the Demon unlocks once: the achievement, the last skin; the finale has its own', () => {
    const storage = memoryStorage();
    expect(readProgress(storage)).toEqual({ demonComplete: false, finaleComplete: false });
    const crown = SKINS[SKINS.length - 1]!;
    expect(isUnlocked(crown, readProgress(storage))).toBe(false);
    expect(unlock(storage, 'demonComplete')).toBe(true);
    expect(unlock(storage, 'demonComplete')).toBe(false);
    expect(readProgress(storage)).toEqual({ demonComplete: true, finaleComplete: false });
    expect(isUnlocked(crown, readProgress(storage))).toBe(true);
    expect(unlock(storage, 'finaleComplete')).toBe(true);
    expect(readProgress(storage)).toEqual({ demonComplete: true, finaleComplete: true });
    for (const key of storage.data.keys()) expect(key.startsWith('lifexp-waverush-')).toBe(true);
    expect(unlock(blockedStorage, 'demonComplete')).toBe(true);
  });
});

describe('skins', () => {
  test('ten skins; all free except the last, which needs the whole Demon sector', () => {
    expect(SKINS).toHaveLength(10);
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(10);
    expect(new Set(SKINS.map((s) => s.shape)).size).toBe(10);
    const last = SKINS[SKINS.length - 1]!;
    for (const skin of SKINS.slice(0, -1)) expect(isUnlocked(skin, { demonComplete: false })).toBe(true);
    expect(isUnlocked(last, { demonComplete: false })).toBe(false);
    expect(isUnlocked(last, { demonComplete: true })).toBe(true);
  });

  test('a stored locked or unknown skin falls back to the default', () => {
    const last = SKINS[SKINS.length - 1]!;
    expect(resolveSkin(last.id, { demonComplete: false })).toBe(DEFAULT_SKIN);
    expect(resolveSkin(last.id, { demonComplete: true })).toBe(last);
    expect(resolveSkin('nope', { demonComplete: false })).toBe(DEFAULT_SKIN);
    expect(resolveSkin('teal', { demonComplete: false }).id).toBe('teal');
  });
});

describe('texts and switches', () => {
  test('?lang picks Polish or English, Polish by default; both have every text', () => {
    expect(pickLang('?lang=en')).toBe('en');
    expect(pickLang('?lang=pl')).toBe('pl');
    expect(pickLang('?lang=de')).toBe('pl');
    expect(pickLang('')).toBe('pl');
    for (const key of TEXT_KEYS) {
      expect(textsOf('en')[key], key).toBeTruthy();
      expect(textsOf('pl')[key], key).toBeTruthy();
    }
    expect(translator('pl')('result', { sector: 2, section: 3, percent: 41 })).toBe('Sektor 2, sekcja 3 · 41% trasy');
    expect(translator('en')('attempt', { n: 7 })).toBe('Attempt 7');
    expect(translator('pl')('achDemon')).toBe('Pogromca Demona');
    expect(translator('en')('achDemon')).toBe('Demon Slayer');
  });

  test('?sector, ?section and ?autopilot only work together with ?seed', () => {
    expect(parseSwitches('?seed=5&sector=3&section=4')).toEqual({ seed: 5, jump: { sector: 3, section: 4 }, autopilot: null });
    expect(parseSwitches('?seed=5&sector=2&autopilot=2')).toEqual({ seed: 5, jump: { sector: 2, section: 1 }, autopilot: 2 });
    expect(parseSwitches('?sector=3&section=4&autopilot=3')).toEqual({ seed: null, jump: null, autopilot: null });
    expect(parseSwitches('?seed=x')).toEqual({ seed: null, jump: null, autopilot: null });
  });

  test('a shuffle keeps every item', () => {
    expect(sorted(shuffle(range(1, 20), createRng(3)))).toEqual(range(1, 20));
  });
});
