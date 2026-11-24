// Świetlik's pure parts (docs/v2/PLAN.md 9.1, stage gl-1): the game is plain ES modules in
// public/games/glimmer (no build step, its own CSP), and these tests import the same files
// the game runs: the seeded generator, the step (movement, hits, grazes, score), the
// patterns' fairness, the director's pacing, the records and the texts.
import { describe, expect, test } from 'vitest';
import { DIRECTOR, DT, PLAYER, SAFE_RADIUS, SCORE, SPAWN_CLEAR } from '../public/games/glimmer/js/config.js';
import { createRng, int, next, range } from '../public/games/glimmer/js/rng.js';
import {
  addBeam,
  addShot,
  addWall,
  createGame,
  createInput,
  distanceToLine,
  speedFactor,
  touchesBeam,
  touchesWall,
  updateGame,
} from '../public/games/glimmer/js/sim.js';
import { MIN_GAP, PATTERNS, PATTERN_IDS, RING_GAP, runPattern, type PatternId } from '../public/games/glimmer/js/patterns.js';
import { choosePattern, gapAt, inBreather, levelAt } from '../public/games/glimmer/js/director.js';
import { BEST_KEY, SETTINGS_KEY, readBest, readSettings, saveBest, saveSettings } from '../public/games/glimmer/js/records.js';
import { TEXT_KEYS, clockText, pickLang, testParams, translator } from '../public/games/glimmer/js/i18n.js';

type Game = ReturnType<typeof createGame>;
type Input = ReturnType<typeof createInput>;

/** A game with nothing coming (the director never starts a pattern). */
function quietGame(options: Partial<Parameters<typeof createGame>[0]> = {}): Game {
  const game = createGame({ width: 180, height: 360, seed: 1, ...options });
  game.director.nextAt = Infinity;
  return game;
}

/** Steps the game `seconds` long; `move` sets the input before each step. */
function play(game: Game, seconds: number, move: (input: Input, game: Game, step: number) => void = () => {}) {
  const input = createInput();
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps && game.phase === 'play'; i++) {
    move(input, game, i);
    updateGame(game, input, DT);
  }
  return game;
}

/** A dodging bot from a seed: wanders, and steps away from the nearest shot. */
function wander(seed: number) {
  const rng = createRng(seed);
  let mx = 0;
  let my = 0;
  return (input: Input, game: Game, step: number) => {
    if (step % 30 === 0) {
      mx = int(rng, -1, 1);
      my = int(rng, -1, 1);
    }
    const p = game.player;
    let nearest = Infinity;
    for (const s of game.shots) {
      if (!s.alive || s.delay > 0 || s.harmless) continue;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < nearest && d < 28) {
        nearest = d;
        mx = Math.sign(p.x - s.x);
        my = Math.sign(p.y - s.y);
      }
    }
    input.mx = mx;
    input.my = my;
    input.focus = nearest < 14;
  };
}

/** A storage in memory. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('the seeded generator', () => {
  test('the same seed gives the same numbers; another seed others', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = Array.from({ length: 20 }, () => next(a));
    expect(Array.from({ length: 20 }, () => next(b))).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => next(c))).not.toEqual(seqA);
    for (const x of seqA) expect(x).toBeGreaterThanOrEqual(0);
    for (const x of seqA) expect(x).toBeLessThan(1);
  });

  test('range and int stay in their bounds', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const r = range(rng, -3, 5);
      expect(r).toBeGreaterThanOrEqual(-3);
      expect(r).toBeLessThan(5);
      const n = int(rng, 2, 4);
      expect([2, 3, 4]).toContain(n);
    }
  });
});

describe('geometry', () => {
  test('distance to a line, at any angle', () => {
    expect(distanceToLine(5, 3, 0, 0, 0)).toBeCloseTo(3);
    expect(distanceToLine(3, 9, 0, 0, Math.PI / 2)).toBeCloseTo(3);
    expect(distanceToLine(1, 1, 0, 0, Math.PI / 4)).toBeCloseTo(0);
  });

  test('a wall hits outside its gap only, across its thickness', () => {
    const game = quietGame();
    const wall = addWall(game, true, 100, 0, 60, 90, { thick: 8, warn: 0 });
    if (!wall) throw new Error('no wall');
    expect(touchesWall(wall, 30, 100, 1.5)).toBe(true);
    expect(touchesWall(wall, 75, 100, 1.5)).toBe(false); // in the gap
    expect(touchesWall(wall, 61, 100, 1.5)).toBe(true); // brushing the gap's edge
    expect(touchesWall(wall, 30, 110, 1.5)).toBe(false); // beside the bar
  });

  test('a beam burns only once its warning is over', () => {
    const game = quietGame();
    const beam = addBeam(game, 0, 50, 0, { half: 4, warn: 0.5, active: 0.5 });
    if (!beam) throw new Error('no beam');
    expect(touchesBeam(beam, 90, 52, 1.5)).toBe(false);
    beam.warn = 0;
    expect(touchesBeam(beam, 90, 52, 1.5)).toBe(true);
    expect(touchesBeam(beam, 90, 60, 1.5)).toBe(false);
  });
});

describe('the step', () => {
  test('keys move at full speed, focus slower; the wisp stays in the arena', () => {
    const game = quietGame();
    const x0 = game.player.x;
    play(game, 0.5, (input) => {
      input.mx = 1;
    });
    expect(game.player.x - x0).toBeCloseTo(PLAYER.speed * 0.5, 0);
    const x1 = game.player.x;
    play(game, 0.5, (input) => {
      input.mx = -1;
      input.focus = true;
    });
    expect(x1 - game.player.x).toBeCloseTo(PLAYER.focusSpeed * 0.5, 0);
    play(game, 5, (input) => {
      input.mx = 1;
      input.my = 1;
    });
    expect(game.player.x).toBeLessThanOrEqual(game.width - 4);
    expect(game.player.y).toBeLessThanOrEqual(game.height - 4);
  });

  test('a drag moves the wisp by the drag (relative), half as far while focusing', () => {
    const game = quietGame();
    const input = createInput();
    const { x, y } = game.player;
    input.dragX = 10;
    input.dragY = -4;
    updateGame(game, input, DT);
    expect(game.player.x - x).toBeCloseTo(10 * PLAYER.dragGain);
    expect(game.player.y - y).toBeCloseTo(-4 * PLAYER.dragGain);
    expect(input.dragX).toBe(0); // used up
    input.dragX = 10;
    input.focus = true;
    const x2 = game.player.x;
    updateGame(game, input, DT);
    expect(game.player.x - x2).toBeCloseTo(5 * PLAYER.dragGain);
  });

  test('the score is the time survived, plus a bonus per graze', () => {
    const game = play(quietGame(), 10);
    expect(game.score).toBe(10 * SCORE.perSecond);
    expect(game.phase).toBe('play');
  });

  test('a shot passing close is one graze (counted once), not a hit', () => {
    const game = quietGame();
    const p = game.player;
    // Passes 6 px from the wisp: outside the hitbox, inside the graze ring.
    addShot(game, 'spark', p.x - 60, p.y + 6, 60, 0, { r: 2 });
    play(game, 2.5);
    expect(game.grazes).toBe(1);
    expect(game.player.hp).toBe(PLAYER.hp);
    expect(game.score).toBe(Math.floor(2.5 * SCORE.perSecond) + SCORE.perGraze);
  });

  test('a hit costs a heart, then the wisp cannot be hit for a while; nearby shots clear', () => {
    const game = quietGame();
    const p = game.player;
    addShot(game, 'spark', p.x, p.y, 0, 0, { r: 2 });
    const near = addShot(game, 'orb', p.x + 15, p.y, 0, 0, { r: 2.5 });
    const far = addShot(game, 'orb', p.x + 60, p.y, 0, 0, { r: 2.5 });
    updateGame(game, createInput(), DT);
    expect(game.player.hp).toBe(PLAYER.hp - 1);
    expect(game.player.invulnerable).toBeGreaterThan(0);
    expect(near?.alive).toBe(false);
    expect(far?.alive).toBe(true);
    // Another shot right away: no second heart.
    addShot(game, 'spark', p.x, p.y, 0, 0, { r: 2 });
    play(game, 1);
    expect(game.player.hp).toBe(PLAYER.hp - 1);
    // Once the blinking is over, it hurts again.
    play(game, PLAYER.invulnerable);
    addShot(game, 'spark', game.player.x, game.player.y, 0, 0, { r: 2 });
    updateGame(game, createInput(), DT);
    expect(game.player.hp).toBe(PLAYER.hp - 2);
  });

  test('the last heart ends the run; nothing moves after it', () => {
    const game = quietGame({ hp: 1 });
    addShot(game, 'spark', game.player.x, game.player.y, 0, 0, { r: 2 });
    updateGame(game, createInput(), DT);
    expect(game.phase).toBe('over');
    const { time, score } = game;
    play(game, 1);
    expect(game.time).toBe(time);
    expect(game.score).toBe(score);
  });

  test('beams and walls hurt only once they are live', () => {
    const game = quietGame();
    const p = game.player;
    addBeam(game, 0, p.y, 0, { half: 3, warn: 0.6, active: 0.3 });
    play(game, 0.5);
    expect(game.player.hp).toBe(PLAYER.hp);
    play(game, 0.2);
    expect(game.player.hp).toBe(PLAYER.hp - 1);

    const game2 = quietGame();
    const q = game2.player;
    addWall(game2, true, q.y, 0, 0, 10, { warn: 0.5 });
    play(game2, 0.4);
    expect(game2.player.hp).toBe(PLAYER.hp);
    play(game2, 0.2);
    expect(game2.player.hp).toBe(PLAYER.hp - 1);
  });

  test('a delayed shot that comes due on top of the wisp fizzles', () => {
    const game = quietGame();
    const p = game.player;
    const shot = addShot(game, 'spark', p.x + 5, p.y, 0, 0, { r: 2, delay: 0.3 });
    const other = addShot(game, 'spark', p.x + 80, p.y, 0, 0, { r: 2, delay: 0.3 });
    play(game, 0.4);
    expect(shot?.alive).toBe(false);
    expect(other?.alive).toBe(true);
    expect(game.player.hp).toBe(PLAYER.hp);
  });

  test('shots speed up with time, up to a cap', () => {
    expect(speedFactor(0)).toBe(1);
    expect(speedFactor(120)).toBeGreaterThan(speedFactor(60));
    expect(speedFactor(100000)).toBeLessThanOrEqual(1.9);
  });
});

describe('the patterns are fair', () => {
  const corners = (game: Game) => [
    [game.width / 2, game.height / 2],
    [4, 4],
    [game.width - 4, 4],
    [4, game.height - 4],
    [game.width - 4, game.height - 4],
    [game.width / 2, 4],
  ];

  test.each(PATTERN_IDS.map((id) => [id]))('%s: nothing new within reach of the wisp, wherever it is', (id) => {
    for (const [w, h] of [[180, 390], [390, 180]] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const probe = createGame({ width: w, height: h, seed });
        for (const [x, y] of corners(probe)) {
          const game = quietGame({ width: w, height: h, seed });
          game.player.x = x as number;
          game.player.y = y as number;
          runPattern(game, id as PatternId, 3);
          for (const s of game.shots) {
            if (!s.alive || s.harmless) continue;
            expect(Math.hypot(s.x - game.player.x, s.y - game.player.y)).toBeGreaterThanOrEqual(SAFE_RADIUS);
          }
          // Beams and walls warn first, long enough to see.
          for (const b of game.beams) if (b.alive) expect(b.warn).toBeGreaterThanOrEqual(0.65);
          for (const wall of game.walls) if (wall.alive) expect(wall.warn).toBeGreaterThanOrEqual(0.65);
        }
      }
    }
  });

  test('walls always leave a gap wider than the wisp, inside the arena, and come from outside', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const level of [0, 2, 5, 12]) {
        const game = quietGame({ width: 180, height: 390, seed });
        runPattern(game, 'walls', level);
        const walls = game.walls.filter((w) => w.alive);
        expect(walls.length).toBeGreaterThan(0);
        for (const w of walls) {
          const along = w.horizontal ? game.width : game.height;
          const across = w.horizontal ? game.height : game.width;
          expect(w.gapB - w.gapA).toBeGreaterThanOrEqual(MIN_GAP);
          expect(MIN_GAP).toBeGreaterThan(PLAYER.hitRadius * 2 + 12);
          expect(w.gapA).toBeGreaterThanOrEqual(0);
          expect(w.gapB).toBeLessThanOrEqual(along);
          expect(w.pos < 0 || w.pos > across).toBe(true);
        }
      }
    }
  });

  test('every ring has a gap of at least RING_GAP missing orbs', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const game = quietGame({ seed });
      runPattern(game, 'ring', 4);
      const byRing = new Map<number, number[]>();
      for (const s of game.shots) {
        if (!s.alive || s.kind !== 'orb') continue;
        const key = Math.round(s.delay * 100);
        const list = byRing.get(key) ?? [];
        list.push(Math.atan2(s.vy, s.vx));
        byRing.set(key, list);
      }
      expect(byRing.size).toBeGreaterThan(0);
      for (const angles of byRing.values()) {
        const count = angles.length + RING_GAP;
        const sorted = angles.map((a) => (a + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
        let widest = (sorted[0] as number) + Math.PI * 2 - (sorted[sorted.length - 1] as number);
        for (let i = 1; i < sorted.length; i++) widest = Math.max(widest, (sorted[i] as number) - (sorted[i - 1] as number));
        expect(widest).toBeGreaterThan(((RING_GAP + 0.5) * Math.PI * 2) / count);
      }
    }
  });

  test('a sweep covers a wedge, never the whole arena', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const game = quietGame({ seed });
      runPattern(game, 'sweep', 20);
      const beam = game.beams.find((b) => b.alive);
      expect(Math.abs(beam?.sweep ?? 9)).toBeLessThanOrEqual(1.1 + 1e-9);
    }
  });

  test('over long runs no shot ever comes due near the wisp', () => {
    for (const seed of [3, 8, 21]) {
      const game = createGame({ width: 180, height: 390, seed, hp: 1e6, start: 60 });
      const input = createInput();
      const move = wander(seed);
      const waiting = new Set<object>();
      for (let step = 0; step < 90 / DT; step++) {
        for (const s of game.shots) if (s.alive && s.delay > 0) waiting.add(s);
        move(input, game, step);
        updateGame(game, input, DT);
        for (const s of waiting) {
          const shot = s as Game['shots'][number];
          if (shot.delay > 0) continue;
          waiting.delete(s);
          if (!shot.alive || shot.harmless) continue;
          expect(Math.hypot(shot.x - game.player.x, shot.y - game.player.y)).toBeGreaterThanOrEqual(SPAWN_CLEAR);
        }
      }
    }
  });
});

describe('the director', () => {
  test('the same seed and moves replay the same run; another seed differs', () => {
    const run = (seed: number) => {
      const game = createGame({ width: 180, height: 390, seed, hp: 50 });
      play(game, 120, wander(99));
      return { score: game.score, hp: game.player.hp, grazes: game.grazes, x: game.player.x, y: game.player.y, patterns: game.patternsStarted, shots: game.shotCount };
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });

  test('patterns unlock over time; the first ones are the simple ones', () => {
    const early = PATTERN_IDS.filter((id) => PATTERNS[id].from === 0);
    expect(early).toEqual(expect.arrayContaining(['aimed', 'rain', 'ring']));
    const game = quietGame();
    for (let i = 0; i < 200; i++) expect(PATTERNS[choosePattern(game, 5, '')].from).toBeLessThanOrEqual(5);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(choosePattern(game, 300, ''));
    expect([...seen].sort()).toEqual([...PATTERN_IDS].sort());
  });

  test('never the same pattern twice in a row', () => {
    const game = quietGame();
    for (let i = 0; i < 300; i++) expect(choosePattern(game, 200, 'beams')).not.toBe('beams');
  });

  test('it gets harder smoothly: shorter gaps, higher levels, more at once later', () => {
    expect(gapAt(0)).toBe(DIRECTOR.gap);
    expect(gapAt(60)).toBeLessThan(gapAt(30));
    expect(gapAt(10000)).toBe(DIRECTOR.minGap);
    expect(levelAt(80)).toBeGreaterThan(levelAt(40));
    const busy = (start: number) => {
      let total = 0;
      let patterns = 0;
      for (const seed of [1, 2, 3, 4]) {
        const game = createGame({ width: 180, height: 390, seed, hp: 1e6, start });
        let shots = 0;
        play(game, 60, (input, g) => {
          shots += g.shotCount;
          input.mx = 0;
        });
        total += shots;
        patterns += game.patternsStarted;
      }
      return { shots: total, patterns };
    };
    const first = busy(0);
    const later = busy(150);
    expect(later.patterns).toBeGreaterThan(first.patterns);
    expect(later.shots).toBeGreaterThan(first.shots * 1.5);
  });

  test('breathers: every half minute a few seconds with no new pattern', () => {
    expect(inBreather(10)).toBe(false);
    expect(inBreather(DIRECTOR.breatherEvery + 1)).toBe(true);
    expect(inBreather(DIRECTOR.breatherEvery + DIRECTOR.breather + 0.5)).toBe(false);
    const game = createGame({ width: 180, height: 390, seed: 4, hp: 1e6 });
    let last = 0;
    play(game, 140, (_input, g) => {
      if (g.patternsStarted !== last) {
        last = g.patternsStarted;
        // The pattern started on the step before: never inside a breather.
        expect(inBreather(g.time)).toBe(false);
      }
    });
    expect(game.patternsStarted).toBeGreaterThan(30);
  });

  test('a bot that dodges lives much longer than one that stands still', () => {
    let still = 0;
    let dodging = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      still += play(createGame({ width: 180, height: 390, seed }), 600).time;
      dodging += play(createGame({ width: 180, height: 390, seed }), 600, wander(seed)).time;
    }
    expect(dodging).toBeGreaterThan(still * 1.8);
    // Not endless for a careless bot either: the run ends.
    expect(dodging / 5).toBeLessThan(600);
  });
});

describe('records and settings', () => {
  test('the best run is kept only when beaten; garbage reads as none', () => {
    const storage = memoryStorage();
    const best = readBest(storage);
    expect(best).toEqual({ score: 0, time: 0 });
    expect(saveBest(storage, best, 120, 11.7)).toBe(true);
    expect(JSON.parse(storage.data.get(BEST_KEY) ?? '{}')).toEqual({ score: 120, time: 11 });
    expect(saveBest(storage, best, 90, 30)).toBe(false);
    expect(readBest(storage)).toEqual({ score: 120, time: 11 });
    storage.setItem(BEST_KEY, '{"score":"lots","time":-3}');
    expect(readBest(storage)).toEqual({ score: 0, time: 0 });
    storage.setItem(BEST_KEY, 'not json');
    expect(readBest(storage)).toEqual({ score: 0, time: 0 });
    expect(readBest(null)).toEqual({ score: 0, time: 0 });
  });

  test('"fewer effects" is kept', () => {
    const storage = memoryStorage();
    expect(readSettings(storage)).toEqual({ calm: false });
    saveSettings(storage, { calm: true });
    expect(storage.data.has(SETTINGS_KEY)).toBe(true);
    expect(readSettings(storage)).toEqual({ calm: true });
  });

  test('a blocked storage does not break the game', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const best = readBest(blocked);
    expect(saveBest(blocked, best, 50, 5)).toBe(true);
    expect(readSettings(blocked)).toEqual({ calm: false });
  });
});

describe('texts and test switches', () => {
  test('Polish and English have the same keys', () => {
    expect([...TEXT_KEYS.en].sort()).toEqual([...TEXT_KEYS.pl].sort());
  });

  test('language, placeholders and the clock', () => {
    expect(pickLang('?lang=en')).toBe('en');
    expect(pickLang('?lang=de')).toBe('pl');
    expect(translator('pl')('title')).toBe('Świetlik');
    expect(translator('en')('title')).toBe('Glimmer');
    expect(translator('pl')('overScore', { score: 42 })).toBe('42 pkt');
    expect(clockText(0)).toBe('0:00');
    expect(clockText(65.9)).toBe('1:05');
  });

  test('the switches work only with ?test=1, within bounds', () => {
    expect(testParams('?seed=5&hp=1')).toEqual({ on: false, seed: null, hp: null, start: null, speed: null });
    expect(testParams('?test=1&seed=5&hp=0&start=99999&speed=50')).toEqual({ on: true, seed: 5, hp: 1, start: 3600, speed: 20 });
    expect(testParams('?test=1&seed=abc').seed).toBeNull();
  });
});
