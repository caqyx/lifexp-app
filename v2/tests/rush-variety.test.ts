// Stage r-2 (owner: later sectors were "the same, just faster"): new mechanics in the Rush
// engine — speed portals, moving hazards, gravity flips and size portals inside a section,
// dark stretches, inverted controls — each proven by the validators exactly as the game
// plays it; each later sector of Ship Rush and Flip Rush brings a new one; and no two
// sections of a game are near-duplicates.
import { describe, expect, test } from 'vitest';
import { buildGeometry, capsuleHitsHazard, movedAt, type SectionData } from '../public/games/_engine/geometry.js';
import { invertedAt, speedAt, stateAt } from '../public/games/_engine/level.js';
import { createRng } from '../public/games/_engine/rng.js';
import { sectionStepper } from '../public/games/_engine/stretch.js';
import { stepGame } from '../public/games/_engine/game.js';
import { SPEED_FACTORS } from '../public/games/_engine/world.js';
import * as flipConfig from '../public/games/flip-rush/js/config.js';
import { buildRun as buildFlipRun } from '../public/games/flip-rush/js/run.js';
import { proveEntry as proveFlip } from '../public/games/flip-rush/js/prove.js';
import * as shipConfig from '../public/games/ship-rush/js/config.js';
import { createGame as createShipGame } from '../public/games/ship-rush/js/game.js';
import { proveEntry as proveShip } from '../public/games/ship-rush/js/prove.js';
import { buildRun as buildShipRun } from '../public/games/ship-rush/js/run.js';
import { SECTION_LIBRARY as FLIP } from '../public/games/flip-rush/js/sections/index.js';
import { SECTION_LIBRARY as SHIP } from '../public/games/ship-rush/js/sections/index.js';
import { SECTION_LIBRARY as WAVE } from '../public/games/wave-rush/js/sections/index.js';
import { SECTION_LIBRARY as ROBOT } from '../public/games/robot-rush/js/sections/index.js';

const open = (hazards: SectionData['hazards'], mode?: 'ball' | 'spider'): SectionData => ({ id: `t-${Math.random()}`, length: 30, ceil: '2 r30', floor: '10 r30', hazards, ...(mode ? { mode } : {}) });

describe('the new mechanics in the engine', () => {
  test('a speed portal sets the tier’s speed × its factor to the section’s end', () => {
    expect(SPEED_FACTORS).toEqual({ slow: 0.8, normal: 1, fast: 1.25, veryFast: 1.5 });
    const g = buildGeometry(open([{ type: 'speed', x: 10, k: 'fast' }, { type: 'speed', x: 20, k: 'slow' }]));
    const s = sectionStepper(g, 10, (v) => v);
    expect([s.speedAt(5), s.speedAt(12), s.speedAt(25)]).toEqual([10, 12.5, 8]);
  });

  test('a moving saw swings with the vehicle’s place: where it is, it hits; where it was, it does not', () => {
    const g = buildGeometry(open([{ type: 'saw', x: 12, y: 6, r: 1, move: { dx: 0, dy: 2, every: 8 } }]));
    const saw = g.hazards[0]!;
    // At x = 12 the swing is at sin(2π·1.5) = 0: in the middle; at x = 14 at sin(2π·1.75) = −1: up by 2.
    expect(movedAt(saw as never, 12).y).toBeCloseTo(6, 6);
    expect(movedAt(saw as never, 14).y).toBeCloseTo(4, 6);
    expect(capsuleHitsHazard(saw, 12, 6, 6, 0.3)).toBe(true);
    expect(capsuleHitsHazard(saw, 14, 4, 4, 0.3)).toBe(false); // the saw sits at x 12, the body is 2 away
    expect(capsuleHitsHazard(saw, 12.6, 6, 6, 0.3)).toBe(true);
  });

  test('a section’s own flip portals turn gravity over and back, in the run and in the proof', () => {
    const g = buildGeometry(open([{ type: 'portal', x: 8, kind: 'flip' }, { type: 'portal', x: 20, kind: 'flip' }]));
    const s = sectionStepper(g, 10, (v, _h, speed, dt) => ({ ...v, x: v.x + speed * dt }));
    let v = { x: 7.99, y: 6, dir: 1, gravity: 1 as 1 | -1, mini: false, ship: true, vy: 0 };
    v = s.step(v, false, 0.01)!;
    expect(v.gravity).toBe(-1);
    v = s.step({ ...v, x: 19.99 }, false, 0.01)!;
    expect(v.gravity).toBe(1);
    const unpaired = buildGeometry(open([{ type: 'portal', x: 8, kind: 'flip' }]));
    expect(unpaired.portals).toHaveLength(1);
  });

  test('inverted controls: the game turns the input over inside the stretch', () => {
    const g = buildGeometry(open([{ type: 'invert', from: 5, to: 15 }]));
    const seen: boolean[] = [];
    const s = sectionStepper(g, 10, (v, h, speed, dt) => { seen.push(h); return { ...v, x: v.x + speed * dt }; });
    const v = { x: 4, y: 6, dir: 1, gravity: 1 as 1 | -1, mini: false, ship: true, vy: 0 };
    s.step(v, true, 0.01);
    s.step({ ...v, x: 6 }, true, 0.01);
    expect(seen).toEqual([true, false]);
  });

  test('the run carries a section’s portals: speedAt, stateAt and invertedAt read them', () => {
    const run = buildShipRun(createRng(1));
    const piece = run.pieces.find((p) => p.g.speeds.length)!;
    const sp = piece.g.speeds[0]!;
    expect(speedAt(run, piece.x0 + sp.x + 0.5)).toBeCloseTo(piece.speed * SPEED_FACTORS[sp.k], 6);
    expect(run.portals.some((p) => p.kind === 'speed' && Math.abs(p.x - (piece.x0 + sp.x)) < 1e-9)).toBe(true);
    const flips = run.pieces.find((p) => p.g.portals.some((q) => q.kind === 'flip'))!;
    const [a, b] = flips.g.portals.filter((q) => q.kind === 'flip');
    const g0 = stateAt(run, flips.x0 + 1).gravity;
    expect(stateAt(run, flips.x0 + (a!.x + b!.x) / 2).gravity).toBe(-g0);
    expect(stateAt(run, flips.x0 + b!.x + 0.5).gravity).toBe(g0);
    const inv = run.pieces.find((p) => p.g.invert.length)!;
    expect(invertedAt(run, inv.x0 + inv.g.invert[0]!.from + 0.5)).toBe(true);
    expect(invertedAt(run, inv.x0 + 1)).toBe(false);
  });

  test('the game applies them: crossing a speed portal the vehicle speeds up; in an inverted stretch holding sinks the ship', () => {
    const game = createShipGame({ rng: createRng(1), mode: 'practice', jump: { sector: 6, section: 3 } });
    stepGame(game, { holding: false, tap: true }, 1 / 240);
    const piece = game.run.pieces.find((p) => p.g.id === 'd-03')!;
    // Put the ship in the inverted stretch, mid-air, and hold: it falls.
    game.wave = { ...game.wave, x: piece.x0 + 7, y: 6, vy: 0, gravity: 1 };
    for (let i = 0; i < 24; i++) stepGame(game, { holding: true, tap: false }, 1 / 240);
    expect(game.wave.vy).toBeGreaterThan(0);
  });
});

describe('the validators play them exactly', () => {
  test('a saw swinging into the only way through is caught; out of step with it, the same section is fair', () => {
    const blocked = open([{ type: 'pillar', x: 10, on: 'floor', h: 4 }, { type: 'pillar', x: 10, on: 'ceil', h: 2.6 }, { type: 'saw', x: 10.5, y: 5.4, r: 0.7, move: { dx: 0, dy: 0.01, every: 50 } }]);
    expect(proveShip(blocked, 'hard', { gravity: 1, mini: false }, { y: 6, vy: 0 }).problem).not.toBeNull();
    const swinging = open([{ type: 'saw', x: 14, y: 6, r: 1, move: { dx: 0, dy: 2.4, every: 9 } }]);
    expect(proveShip(swinging, 'hard', { gravity: 1, mini: false }, { y: 6, vy: 0 }).problem).toBeNull();
  });

  test('Flip Rush: a gravity flip pair inside a section is proven; a spider over a bed after the flip back must be ready', () => {
    const flip = open([{ type: 'portal', x: 9, kind: 'flip' }, { type: 'spike', x: 15, on: 'ceil', count: 2 }, { type: 'portal', x: 21, kind: 'flip' }], 'spider');
    expect(proveFlip(flip, 'hard', { gravity: 1, mini: false }, { y: 9.7, vy: 0 }).problem).toBeNull();
  });

  test('Flip Rush: a speed portal changes the spacing the proof plays at', () => {
    const fast = open([{ type: 'speed', x: 4, k: 'veryFast' }, { type: 'spike', x: 12, on: 'floor', count: 3 }, { type: 'spike', x: 17, on: 'ceil', count: 3 }], 'ball');
    const r = proveFlip(fast, 'hard', { gravity: 1, mini: false }, { y: 9.7, vy: 0 });
    expect(r.problem).toBeNull();
  });
});

describe('each later sector brings something new (owner)', () => {
  const has = (list: SectionData[], test: (h: SectionData['hazards'][number]) => boolean) => list.some((d) => d.hazards.some(test));
  const moving = (h: SectionData['hazards'][number]) => 'move' in h && h.move !== undefined;

  test('Ship Rush: speed portals in sector 3, moving blades in 4, flips and size portals inside sections in 5, inverted controls and the dark in the Demon', () => {
    expect(has(SHIP[3]!, (h) => h.type === 'speed')).toBe(true);
    expect(has(SHIP[2]!, (h) => h.type === 'speed')).toBe(false);
    expect(has(SHIP[4]!, moving)).toBe(true);
    expect(has(SHIP[5]!, (h) => h.type === 'portal' && h.kind === 'flip')).toBe(true);
    expect(has(SHIP[5]!, (h) => h.type === 'portal' && h.kind === 'mini')).toBe(true);
    expect(has(SHIP[6]!, (h) => h.type === 'invert')).toBe(true);
    expect(has(SHIP[6]!, (h) => h.type === 'dark')).toBe(true);
  });

  test('Flip Rush: pads from 1, orbs from 2, speed portals from 3, moving saws and spider mazes in 4, flips and the dark in 5, all in the Demon', () => {
    expect(has(FLIP[1]!, (h) => h.type === 'pad')).toBe(true);
    expect(has(FLIP[2]!, (h) => h.type === 'ring')).toBe(true);
    expect(has(FLIP[3]!, (h) => h.type === 'speed')).toBe(true);
    expect(has(FLIP[4]!, moving)).toBe(true);
    expect(FLIP[4]!.filter((d) => d.mode === 'spider' && d.hazards.filter((h) => h.type === 'block').length >= 2).length).toBeGreaterThanOrEqual(2);
    expect(has(FLIP[5]!, (h) => h.type === 'portal' && h.kind === 'flip')).toBe(true);
    expect(has(FLIP[5]!, (h) => h.type === 'dark')).toBe(true);
    for (const t of ['speed', 'portal', 'dark', 'ring', 'pad', 'block']) expect(has(FLIP[6]!, (h) => h.type === t), t).toBe(true);
    expect(has(FLIP[6]!, moving)).toBe(true);
  });

  test('Flip Rush sectors 4–6 change vehicle at nearly every joint', () => {
    const run = buildFlipRun(createRng(3));
    expect(flipConfig.SECTORS.slice(2).every((s) => s.alternate)).toBe(true);
    expect(run.portals.filter((p) => p.kind === 'ship' && p.sector === 5).length).toBeGreaterThan(20);
    expect(shipConfig.SECTORS).toHaveLength(6);
  });
});

/** A section's shape for comparing: its items by type, kind and side at whole-cell places from the first, and its profiles. */
function signature(d: SectionData) {
  const items = d.hazards as Record<string, unknown>[];
  const xs = items.map((h) => (h.x as number | undefined) ?? (h.from as number | undefined) ?? 0);
  const x0 = Math.min(...xs);
  const out = new Set<string>();
  items.forEach((h, i) =>
    out.add(`${h.type}:${h.kind ?? h.k ?? ''}:${h.on ?? ''}:${h.dir ?? ''}:${Math.round(xs[i]! - x0)}:${h.y !== undefined ? Math.round(h.y as number) : ''}:${h.count ?? h.h ?? h.w ?? ''}`),
  );
  out.add(`ceil:${d.ceil}`);
  out.add(`floor:${d.floor}`);
  return out;
}

describe.each([
  ['Wave Rush', WAVE],
  ['Ship Rush', SHIP],
  ['Flip Rush', FLIP],
  ['Robot Rush', ROBOT],
])('%s: no near-duplicate sections', (_name, library) => {
  test('no two sections, in any sectors or the finale, share 60% or more of their shape', () => {
    const all = Object.values(library).flat();
    const sigs = all.map(signature);
    const twins: string[] = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = sigs[i]!;
        const b = sigs[j]!;
        let both = 0;
        for (const x of a) if (b.has(x)) both++;
        if (both / (a.size + b.size - both) >= 0.6) twins.push(`${all[i]!.id} ~ ${all[j]!.id}`);
      }
    }
    expect(twins).toEqual([]);
  });
});
