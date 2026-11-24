// Świetlik's second set of obstacles (docs/v2/PLAN.md 9.1, stage gl-2): snake, bouncers,
// splitters, mines, comet, pinwheel, grid and zone — each pattern's shape, its fairness
// (where things appear, warnings, gaps, a safe way through) and how the director keeps the
// area hazards apart. The rules shared with the first set are in glimmer.test.ts.
//
// The game's own module order: sim.js first (it pulls in the director and the patterns).
import { describe, expect, test } from 'vitest';
import { DT, PLAYER, SAFE_RADIUS, SPAWN_CLEAR } from '../public/games/glimmer/js/config.js';
import { createRng, int } from '../public/games/glimmer/js/rng.js';
import {
  addShot,
  addZone,
  createGame,
  createInput,
  distanceToLine,
  outsideZone,
  touchesBeam,
  updateGame,
  zoneRadius,
} from '../public/games/glimmer/js/sim.js';
import { PATTERNS, PATTERN_IDS, runPattern, type PatternId } from '../public/games/glimmer/js/patterns.js';
import { GRID_SPACING, MIN_WARN, OBSTACLES, PINWHEEL_SWEEP, ZONE_MAX_SHRINK, ZONE_MIN_RADIUS } from '../public/games/glimmer/js/obstacles.js';
import { areaBusy, choosePattern } from '../public/games/glimmer/js/director.js';

type Game = ReturnType<typeof createGame>;
type Input = ReturnType<typeof createInput>;
type Shot = Game['shots'][number];

const SHAPES = [
  [180, 390],
  [390, 180],
  [180, 180],
] as const;
const NEW: readonly PatternId[] = ['snake', 'bouncers', 'splitters', 'mines', 'comet', 'pinwheel', 'grid', 'zone'];

function quietGame(width = 180, height = 390, seed = 1): Game {
  const game = createGame({ width, height, seed, hp: 1e6 });
  game.director.nextAt = Infinity;
  return game;
}

function step(game: Game, seconds: number, move: (input: Input, game: Game) => void = () => {}) {
  const input = createInput();
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    move(input, game);
    updateGame(game, input, DT);
  }
}

const alive = (game: Game, kind?: string) => game.shots.filter((s) => s.alive && (kind === undefined || s.kind === kind));

/** The widest angular gap (radians) between shots leaving one point together. */
function widestGap(shots: Shot[]) {
  const angles = shots.map((s) => (Math.atan2(s.vy, s.vx) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
  let widest = (angles[0] as number) + Math.PI * 2 - (angles[angles.length - 1] as number);
  for (let i = 1; i < angles.length; i++) widest = Math.max(widest, (angles[i] as number) - (angles[i - 1] as number));
  return widest;
}

describe('the second set in the director', () => {
  test('eight new patterns, unlocked after the first set, one after another', () => {
    expect(NEW.every((id) => PATTERN_IDS.includes(id))).toBe(true);
    expect(Object.keys(OBSTACLES)).toEqual(NEW);
    const froms = NEW.map((id) => PATTERNS[id].from);
    expect(froms).toEqual([...froms].sort((a, b) => a - b));
    expect(Math.min(...froms)).toBeGreaterThan(PATTERNS.seekers.from);
    // Only the grid, the pinwheel and the zone are exclusive.
    expect(PATTERN_IDS.filter((id) => PATTERNS[id].exclusive)).toEqual(['pinwheel', 'grid', 'zone']);
  });

  test('the rules: no area patterns while one is locked, no exclusive ones while busy', () => {
    const game = quietGame();
    for (let i = 0; i < 400; i++) {
      expect(PATTERNS[choosePattern(game, 600, '', { noArea: true })].area).toBeFalsy();
      expect(PATTERNS[choosePattern(game, 600, '', { noExclusive: true })].exclusive).toBeFalsy();
    }
  });

  test('every pattern replays the same from the same seed', () => {
    for (const id of NEW) {
      const run = (seed: number) => {
        const game = quietGame(180, 390, seed);
        runPattern(game, id, 3);
        step(game, 0.5);
        return JSON.stringify([alive(game).map((s) => [s.kind, s.x.toFixed(3), s.y.toFixed(3)]), game.beams.filter((b) => b.alive).map((b) => [b.px, b.py, b.angle]), game.zones.filter((z) => z.alive).map((z) => [z.cx, z.cy])]);
      };
      expect(run(7)).toBe(run(7));
      expect(run(7)).not.toBe(run(8));
    }
  });

  test('over long runs a grid, a pinwheel or a zone comes alone: never in a combo, never with walls, a zone never with beams', () => {
    for (const seed of [2, 5, 9]) {
      const game = createGame({ width: 180, height: 390, seed, hp: 1e6, start: 100 });
      let last = 0;
      let exclusives = 0;
      step(game, 260, (_input, g) => {
        const started = g.patternsStarted - last;
        if (started > 0) {
          last = g.patternsStarted;
          if (PATTERNS[g.lastPattern as PatternId].exclusive) {
            exclusives += 1;
            expect(started).toBe(1);
          }
        }
        if (g.zones.some((z) => z.alive)) {
          expect(g.walls.some((w) => w.alive)).toBe(false);
          expect(g.beams.some((b) => b.alive && !b.marker)).toBe(false);
        }
        if (g.time < g.areaLockUntil) expect(g.walls.some((w) => w.alive)).toBe(false);
      });
      expect(exclusives).toBeGreaterThan(3);
    }
  });
});

test('the test switch: only the chosen pattern comes (an exclusive one when the arena is free)', () => {
  for (const id of NEW) {
    const game = createGame({ width: 180, height: 390, seed: 4, hp: 1e6, pattern: id });
    const seen = new Set<string>();
    let last = 0;
    step(game, 30, (_i, g) => {
      if (g.patternsStarted !== last) {
        last = g.patternsStarted;
        seen.add(g.lastPattern);
      }
    });
    expect([...seen]).toEqual([id]);
    expect(game.patternsStarted).toBeGreaterThan(3);
  }
});

describe('snake', () => {
  test('links come from outside, one after another, swaying along one curve within a few pixels of a straight path', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const game = quietGame(180, 390, seed);
      runPattern(game, 'snake', 1);
      const links = alive(game, 'link');
      expect(links.length).toBeGreaterThanOrEqual(8);
      const head = links[0] as Shot;
      const start = { x: head.x, y: head.y };
      const angle = Math.atan2(head.vy, head.vx);
      for (const l of links) {
        expect(l.x < 0 || l.y < 0 || l.x > game.width || l.y > game.height).toBe(true);
        expect(Math.hypot(l.x - game.player.x, l.y - game.player.y)).toBeGreaterThanOrEqual(SAFE_RADIUS);
      }
      let widest = 0;
      step(game, 2.5, (_i, g) => {
        if (!head.alive || head.delay > 0) return;
        widest = Math.max(widest, distanceToLine(head.x, head.y, start.x, start.y, angle));
        void g;
      });
      // The sway: within 2 · wave / freq (≈ 29 px) of the aimed line, never more.
      expect(widest).toBeGreaterThan(5);
      expect(widest).toBeLessThanOrEqual((2 * head.wave) / head.freq + 1);
    }
  });
});

describe('bouncers', () => {
  test('a bouncer turns back off the edges as often as it may, then leaves', () => {
    const game = quietGame();
    game.player.x = 20;
    game.player.y = 20;
    const b = addShot(game, 'bouncer', 90, 300, 80, 0, { r: 3, bounces: 2, life: 30 }) as Shot;
    let turns = 0;
    let vx = b.vx;
    step(game, 12, () => {
      if (!b.alive) return;
      if (Math.sign(b.vx) !== Math.sign(vx)) turns += 1;
      vx = b.vx;
      if (b.bounces > 0) expect(b.x).toBeLessThanOrEqual(game.width - b.r + 80 * DT + 1e-9);
    });
    expect(turns).toBe(2);
    expect(b.alive).toBe(false); // flew off after the second turn
  });

  test('they come from outside, slow, a few at a time, and fade', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const game = quietGame(390, 180, seed);
      runPattern(game, 'bouncers', 6);
      const shots = alive(game, 'bouncer');
      expect(shots.length).toBeGreaterThanOrEqual(2);
      expect(shots.length).toBeLessThanOrEqual(5);
      for (const s of shots) {
        expect(s.x < 0 || s.y < 0 || s.x > game.width || s.y > game.height).toBe(true);
        expect(s.speed).toBeLessThan(PLAYER.speed);
        expect(s.life).toBeLessThan(10);
      }
    }
  });
});

describe('splitters', () => {
  test('a splitter reaches a point far from the wisp just as its ring there comes due; the ring keeps a gap', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const game = quietGame(180, 390, seed);
      runPattern(game, 'splitters', 2);
      const big = alive(game, 'splitter');
      expect(big.length).toBeGreaterThanOrEqual(1);
      const pieces = alive(game, 'spark');
      for (const s of big) {
        const t = s.life;
        const at = { x: s.x + s.vx * t, y: s.y + s.vy * t };
        const mine = pieces.filter((p) => Math.hypot(p.x - at.x, p.y - at.y) < 0.01);
        expect(mine.length).toBeGreaterThanOrEqual(8);
        for (const p of mine) expect(p.delay).toBeCloseTo(s.delay + t, 6);
        expect(Math.hypot(at.x - game.player.x, at.y - game.player.y)).toBeGreaterThanOrEqual(SAFE_RADIUS + 24 - 1e-9);
        expect(widestGap(mine)).toBeGreaterThan((4 * Math.PI * 2) / (mine.length + 4));
      }
      // It flies in plainly: it lives at least 1.2 s before it bursts (and blinks first).
      for (const s of big) expect(s.life).toBeGreaterThanOrEqual(1.2);
    }
  });

  test('it bursts with a pop, where its ring starts', () => {
    const game = quietGame();
    runPattern(game, 'splitters', 0);
    const s = alive(game, 'splitter')[0] as Shot;
    const pops: number[] = [];
    step(game, s.life + 0.2, (_i, g) => {
      for (let q = Math.max(0, g.eventSeq - 4); q < g.eventSeq; q++) if (g.events[q % 128]?.type === 'pop') pops.push(q);
    });
    expect(new Set(pops).size).toBe(1);
  });
});

describe('mines', () => {
  test('mines are harmless, far from the wisp and apart; they warn (fuse ≥ 1.4 s) and go off as a ring with a gap', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const [w, h] of SHAPES) {
        const game = quietGame(w, h, seed);
        runPattern(game, 'mines', 4);
        const mines = alive(game, 'mine');
        expect(mines.length).toBeGreaterThanOrEqual(2);
        for (const m of mines) {
          expect(m.harmless).toBe(true);
          expect(m.life).toBeGreaterThanOrEqual(1.4);
          expect(Math.hypot(m.x - game.player.x, m.y - game.player.y)).toBeGreaterThanOrEqual(SAFE_RADIUS + 30);
          const ring = alive(game, 'orb').filter((o) => o.x === m.x && o.y === m.y);
          expect(ring.length).toBeGreaterThanOrEqual(8);
          for (const o of ring) expect(o.delay).toBeCloseTo(m.life, 6);
          expect(widestGap(ring)).toBeGreaterThan((4 * Math.PI * 2) / (ring.length + 4));
        }
      }
    }
  });

  test('a wisp that stands on a mine is not hit by its ring (the pieces fizzle there)', () => {
    const game = quietGame();
    runPattern(game, 'mines', 0);
    const m = alive(game, 'mine')[0] as Shot;
    game.player.x = m.x;
    game.player.y = m.y;
    step(game, m.life + 0.05);
    expect(game.hits).toBe(0);
    for (const s of alive(game, 'orb')) {
      if (s.delay <= 0) expect(Math.hypot(s.x - m.x, s.y - m.y)).toBeGreaterThanOrEqual(SPAWN_CLEAR - 1);
    }
  });
});

describe('comet', () => {
  test('its path is marked first (≥ MIN_WARN, never burns); the comet and its embers follow exactly that path, embers lit as it passes', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const [w, h] of SHAPES) {
        const game = quietGame(w, h, seed);
        runPattern(game, 'comet', 4);
        const markers = game.beams.filter((b) => b.alive && b.marker);
        const comets = alive(game, 'comet');
        expect(comets.length).toBe(markers.length);
        expect(comets.length).toBeGreaterThanOrEqual(1);
        comets.forEach((c, i) => {
          const m = markers[i] as Game['beams'][number];
          expect(m.warn).toBeGreaterThanOrEqual(MIN_WARN);
          expect(c.delay).toBeCloseTo(m.warn, 6);
          expect(distanceToLine(c.x, c.y, m.px, m.py, m.angle)).toBeLessThan(1e-6);
          expect(Math.atan2(c.vy, c.vx)).toBeCloseTo(m.angle, 6);
          // From outside the arena.
          expect(c.x < 0 || c.y < 0 || c.x > game.width || c.y > game.height).toBe(true);
          // A marker never hurts, even once its warning is over.
          m.warn = 0;
          expect(touchesBeam(m, m.px, m.py, 2)).toBe(false);
        });
        for (const e of alive(game, 'ember')) {
          const onSome = markers.some((m) => distanceToLine(e.x, e.y, m.px, m.py, m.angle) < 1e-6);
          expect(onSome).toBe(true);
          expect(e.delay).toBeGreaterThan(MIN_WARN);
          expect(e.life).toBeLessThanOrEqual(1.2);
        }
      }
    }
  });

  test('a wisp that steps off the marked path while it warns is not hit', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const game = quietGame(180, 390, seed);
      runPattern(game, 'comet', 0);
      const m = game.beams.find((b) => b.alive && b.marker) as Game['beams'][number];
      // Step 14 px away from the line, across it, within the warning (focus speed would do).
      const nx = -Math.sin(m.angle);
      const ny = Math.cos(m.angle);
      const side = (game.player.x - m.px) * nx + (game.player.y - m.py) * ny >= 0 ? 1 : -1;
      const d = distanceToLine(game.player.x, game.player.y, m.px, m.py, m.angle);
      if (d < 14) {
        game.player.x += nx * side * (14 - d);
        game.player.y += ny * side * (14 - d);
      }
      step(game, 4);
      expect(game.hits).toBe(0);
    }
  });
});

describe('pinwheel', () => {
  test('two crossed beams through a point far from the wisp; they warn, then turn less than a quarter turn, leaving safe wedges', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const [w, h] of SHAPES) {
        const game = quietGame(w, h, seed);
        runPattern(game, 'pinwheel', 20);
        const arms = game.beams.filter((b) => b.alive);
        expect(arms).toHaveLength(2);
        const [a, b] = arms as [Game['beams'][number], Game['beams'][number]];
        expect(a.px).toBe(b.px);
        expect(a.py).toBe(b.py);
        expect(Math.abs(b.angle - a.angle)).toBeCloseTo(Math.PI / 2, 6);
        expect(Math.hypot(a.px - game.player.x, a.py - game.player.y)).toBeGreaterThanOrEqual(SAFE_RADIUS + 30);
        for (const arm of arms) {
          expect(arm.warn).toBeGreaterThanOrEqual(MIN_WARN);
          expect(Math.abs(arm.sweep)).toBeLessThanOrEqual(PINWHEEL_SWEEP + 1e-9);
          // A safe wedge of at least 0.7 rad between the arms all the time.
          expect(Math.PI / 2 - Math.abs(arm.sweep)).toBeGreaterThan(0.7);
          // Turning slowly enough to walk with, out to the far corner.
          expect(Math.abs(arm.spin) * Math.hypot(game.width, game.height)).toBeLessThan(PLAYER.speed * 1.25);
        }
        expect(game.areaLockUntil).toBeGreaterThanOrEqual(game.time + a.warn + a.active - 1e-9);
      }
    }
  });

  test('a wisp that keeps to the middle of its wedge is never hit', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const game = quietGame(180, 390, seed);
      runPattern(game, 'pinwheel', 5);
      const arm = game.beams.find((b) => b.alive) as Game['beams'][number];
      const c = { x: arm.px, y: arm.py };
      step(game, 4, (input, g) => {
        // The middle of the quarter (from the arm) that holds the wisp, at its distance.
        const p = g.player;
        const rel = Math.atan2(p.y - c.y, p.x - c.x);
        const quarter = Math.PI / 2;
        const from = arm.angle + Math.floor((rel - arm.angle) / quarter) * quarter;
        const aim = from + quarter / 2;
        const dist = Math.max(30, Math.min(70, Math.hypot(p.x - c.x, p.y - c.y)));
        const tx = c.x + Math.cos(aim) * dist;
        const ty = c.y + Math.sin(aim) * dist;
        const l = Math.hypot(tx - p.x, ty - p.y);
        input.mx = l > 1 ? (tx - p.x) / l : 0;
        input.my = l > 1 ? (ty - p.y) / l : 0;
      });
      expect(game.hits).toBe(0);
    }
  });
});

describe('grid', () => {
  test('lines both ways, at least GRID_SPACING apart, warning first; cells far wider than the wisp; a second wave between them later', () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const [w, h] of SHAPES) {
        for (const level of [1, 6]) {
          const game = quietGame(w, h, seed);
          runPattern(game, 'grid', level);
          const lines = game.beams.filter((b) => b.alive);
          expect(lines.length).toBeGreaterThanOrEqual(4);
          for (const b of lines) expect(b.warn).toBeGreaterThanOrEqual(MIN_WARN);
          const byWave = new Map<number, typeof lines>();
          for (const b of lines) byWave.set(Math.round(b.warn * 100), [...(byWave.get(Math.round(b.warn * 100)) ?? []), b]);
          expect(byWave.size).toBe(level > 3.5 ? 2 : 1);
          for (const wave of byWave.values()) {
            const xs = wave.filter((b) => b.angle !== 0).map((b) => b.px).sort((a, b) => a - b);
            const ys = wave.filter((b) => b.angle === 0).map((b) => b.py).sort((a, b) => a - b);
            for (const list of [xs, ys]) for (let i = 1; i < list.length; i++) expect((list[i] as number) - (list[i - 1] as number)).toBeGreaterThanOrEqual(GRID_SPACING - 1e-9);
            // Wide cells: room for the wisp many times over.
            expect(GRID_SPACING - 2 * 3 - 2 * PLAYER.hitRadius).toBeGreaterThan(30);
          }
        }
      }
    }
  });

  test('from anywhere, a few pixels of movement lead out of every line of a wave, within its warning', () => {
    const game = quietGame(390, 180, 3);
    runPattern(game, 'grid', 6);
    const lines = game.beams.filter((b) => b.alive);
    const waves = [...new Set(lines.map((b) => b.warn))].sort((a, b) => a - b);
    for (const warnAt of waves) {
      const wave = lines.filter((b) => b.warn === warnAt);
      for (let x = 2; x < game.width; x += 5) {
        for (let y = 2; y < game.height; y += 5) {
          // Nearest safe spot along the axes (lines are straight across): never far.
          let best = Infinity;
          for (let d = 0; d <= 20 && best === Infinity; d += 0.5) {
            for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]] as const) {
              const px = x + dx;
              const py = y + dy;
              if (wave.every((b) => distanceToLine(px, py, b.px, b.py, b.angle) > b.half + PLAYER.hitRadius)) best = d;
            }
          }
          expect(best * Math.SQRT2).toBeLessThan(PLAYER.focusSpeed * MIN_WARN);
        }
      }
    }
  });
});

describe('zone', () => {
  test('a zone starts round the wisp, warns, shrinks slower than a focused walk to a circle inside the arena', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const [w, h] of SHAPES) {
        for (const [x, y] of [[w / 2, h / 2], [4, 4], [w - 4, h - 4], [4, h - 4]]) {
          const game = quietGame(w, h, seed);
          game.player.x = x as number;
          game.player.y = y as number;
          runPattern(game, 'zone', 8);
          const z = game.zones.find((q) => q.alive) as Game['zones'][number];
          expect(z.warn).toBeGreaterThanOrEqual(MIN_WARN);
          expect(z.r1).toBeGreaterThanOrEqual(ZONE_MIN_RADIUS);
          expect(Math.hypot(game.player.x - z.cx, game.player.y - z.cy) + PLAYER.hitRadius).toBeLessThan(z.r0 - 20);
          expect((z.r0 - z.r1) / z.activeTotal).toBeLessThanOrEqual(ZONE_MAX_SHRINK + 1e-9);
          expect(ZONE_MAX_SHRINK).toBeLessThan(PLAYER.focusSpeed);
          expect(z.cx - z.r1).toBeGreaterThanOrEqual(0);
          expect(z.cy - z.r1).toBeGreaterThanOrEqual(0);
          expect(z.cx + z.r1).toBeLessThanOrEqual(game.width);
          expect(z.cy + z.r1).toBeLessThanOrEqual(game.height);
        }
      }
    }
  });

  test('outside hurts once it is live; a wisp that walks in (focused) is never hurt; one that stands at the edge is', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const walker = quietGame(180, 390, seed);
      runPattern(walker, 'zone', 4);
      const z = walker.zones.find((q) => q.alive) as Game['zones'][number];
      step(walker, z.warnTotal + z.activeTotal + 0.2, (input, g) => {
        const dx = z.cx - g.player.x;
        const dy = z.cy - g.player.y;
        const l = Math.hypot(dx, dy);
        input.focus = true;
        input.mx = l > 2 ? dx / l : 0;
        input.my = l > 2 ? dy / l : 0;
      });
      expect(walker.hits).toBe(0);
      expect(walker.zones.some((q) => q.alive)).toBe(false);
    }
    const stander = quietGame();
    const z = addZone(stander, 90, 200, 100, 40, 0.8, 4) as Game['zones'][number];
    stander.player.x = 90;
    stander.player.y = 200 - 80;
    expect(outsideZone(z, stander.player.x, stander.player.y, PLAYER.hitRadius)).toBe(false); // still warning
    step(stander, 3);
    expect(zoneRadius(z)).toBeLessThan(80);
    expect(stander.hits).toBeGreaterThan(0);
  });
});

describe('fairness with everything in', () => {
  test('a careful bot (dodges shots, steps off warned lines, keeps inside zones) lives long into the new obstacles', () => {
    const bot = (seed: number) => {
      const rng = createRng(seed);
      return (input: Input, g: Game) => {
        const p = g.player;
        let fx = (g.width / 2 - p.x) * 0.002 + (int(rng, -1, 1) * 0.001);
        let fy = (g.height / 2 - p.y) * 0.002;
        for (const s of g.shots) {
          if (!s.alive || s.delay > 0 || s.harmless) continue;
          const dx = p.x - s.x;
          const dy = p.y - s.y;
          const d = Math.hypot(dx, dy);
          if (d < 40) {
            fx += dx / (d * d + 1);
            fy += dy / (d * d + 1);
          }
        }
        for (const b of g.beams) {
          if (!b.alive) continue;
          const d = distanceToLine(p.x, p.y, b.px, b.py, b.angle);
          if (d < 22) {
            const nx = -Math.sin(b.angle);
            const ny = Math.cos(b.angle);
            const side = (p.x - b.px) * nx + (p.y - b.py) * ny >= 0 ? 1 : -1;
            fx += nx * side * 0.3;
            fy += ny * side * 0.3;
          }
        }
        for (const wall of g.walls) {
          if (!wall.alive) continue;
          const mid = (wall.gapA + wall.gapB) / 2;
          if (wall.horizontal) fx += Math.sign(mid - p.x) * 0.2;
          else fy += Math.sign(mid - p.y) * 0.2;
        }
        for (const z of g.zones) {
          if (!z.alive) continue;
          const d = Math.hypot(z.cx - p.x, z.cy - p.y);
          if (d > zoneRadius(z) - 22) {
            fx += ((z.cx - p.x) / (d + 1)) * 0.6;
            fy += ((z.cy - p.y) / (d + 1)) * 0.6;
          }
        }
        const l = Math.hypot(fx, fy);
        input.mx = l > 0.001 ? fx / l : 0;
        input.my = l > 0.001 ? fy / l : 0;
        input.focus = false;
      };
    };
    let still = 0;
    let careful = 0;
    const seen = new Set<string>();
    for (const [w, h] of [[180, 390], [390, 180]] as const) {
      for (const seed of [1, 2, 3, 4]) {
        const idle = createGame({ width: w, height: h, seed });
        step(idle, 600, () => {});
        still += idle.time;
        const game = createGame({ width: w, height: h, seed });
        const move = bot(seed);
        const input = createInput();
        for (let i = 0; i < 600 / DT && game.phase === 'play'; i++) {
          move(input, game);
          updateGame(game, input, DT);
          seen.add(game.lastPattern);
        }
        careful += game.time;
        // Every run reaches past the first obstacles of the second set.
        expect(game.time).toBeGreaterThan(PATTERNS.snake.from);
      }
    }
    expect(careful).toBeGreaterThan(still * 3);
    expect(careful / 8).toBeGreaterThan(65);
    for (const id of ['snake', 'bouncers', 'splitters'] as const) expect(seen.has(id)).toBe(true);
  });

  test('with many hearts, the careful bot meets every new obstacle and is rarely hit (every hazard can be avoided)', () => {
    const game = createGame({ width: 180, height: 390, seed: 11, hp: 1e6, start: 60 });
    const input = createInput();
    const met = new Set<string>();
    for (let i = 0; i < 240 / DT; i++) {
      const p = game.player;
      let fx = (game.width / 2 - p.x) * 0.002;
      let fy = (game.height / 2 - p.y) * 0.002;
      for (const s of game.shots) {
        if (!s.alive || s.delay > 0 || s.harmless) continue;
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d < 40) {
          fx += dx / (d * d + 1);
          fy += dy / (d * d + 1);
        }
      }
      for (const b of game.beams) {
        if (!b.alive) continue;
        const d = distanceToLine(p.x, p.y, b.px, b.py, b.angle);
        if (d < 22) {
          const nx = -Math.sin(b.angle);
          const ny = Math.cos(b.angle);
          const side = (p.x - b.px) * nx + (p.y - b.py) * ny >= 0 ? 1 : -1;
          fx += nx * side * 0.3;
          fy += ny * side * 0.3;
        }
      }
      for (const z of game.zones) {
        if (!z.alive) continue;
        const d = Math.hypot(z.cx - p.x, z.cy - p.y);
        if (d > zoneRadius(z) - 22) {
          fx += ((z.cx - p.x) / (d + 1)) * 0.6;
          fy += ((z.cy - p.y) / (d + 1)) * 0.6;
        }
      }
      for (const wall of game.walls) {
        if (!wall.alive) continue;
        const mid = (wall.gapA + wall.gapB) / 2;
        if (wall.horizontal) fx += Math.sign(mid - p.x) * 0.2;
        else fy += Math.sign(mid - p.y) * 0.2;
      }
      const l = Math.hypot(fx, fy);
      input.mx = l > 0.001 ? fx / l : 0;
      input.my = l > 0.001 ? fy / l : 0;
      updateGame(game, input, DT);
      met.add(game.lastPattern);
      if (areaBusy(game)) met.add('area');
    }
    for (const id of NEW) expect(met.has(id)).toBe(true);
    // A simple steering bot, from the second minute on at full density: fewer than one hit
    // every 4 s (a hit clears the area round it); a person who reads the warnings does better.
    expect(game.hits / 240).toBeLessThan(1 / 4);
  });
});
