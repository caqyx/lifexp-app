// Flappy Bird's pure parts (docs/v2/PLAN.md 9.1, stage g-3): the game is plain ES
// modules in public/games/flappy (no build step, its own CSP), and these tests import
// the same files the game runs.
import { describe, expect, test } from 'vitest';
import { createParticles, flashAlpha, shakeOffset, spawnBurst, squashScale, updateParticles } from '../public/games/flappy/js/effects.js';
import { createGame, handlePress, stepGame, type Game } from '../public/games/flappy/js/game.js';
import { pickLang, translator } from '../public/games/flappy/js/i18n.js';
import {
  BIRD,
  DIFFICULTY,
  GROUND_Y,
  INPUT_BUFFER_MS,
  MAX_FRAME,
  PIPE,
  RESTART_LOCK,
  STEP,
  WORLD_HEIGHT,
  WORLD_WIDTH_MAX,
  WORLD_WIDTH_MIN,
  advanceClock,
  birdTilt,
  checkCollision,
  collectPoints,
  createBird,
  createRng,
  difficultyAt,
  fitWorld,
  flapBird,
  gapBounds,
  isBuffered,
  nextPipeX,
  parseSeed,
  scrollPipes,
  spawnPipe,
  stepBird,
  updateBest,
  worldWidthFor,
} from '../public/games/flappy/js/logic.js';

const WIDTH = 300;

/** Runs `seconds` of fixed steps. */
function run(game: Game, seconds: number, onStep?: (g: Game) => Game) {
  let g = game;
  const events: string[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    const step = stepGame(onStep ? onStep(g) : g, STEP);
    g = step.game;
    events.push(...step.events);
  }
  return { game: g, events };
}

describe('physics', () => {
  test('gravity pulls the bird down, up to the fall limit', () => {
    let bird = createBird(WIDTH);
    const y0 = bird.y;
    bird = stepBird(bird, STEP);
    expect(bird.vy).toBeCloseTo(BIRD.gravity * STEP);
    expect(bird.y).toBeGreaterThan(y0);
    for (let i = 0; i < 240; i++) bird = stepBird(bird, STEP);
    expect(bird.vy).toBe(BIRD.maxFall);
  });

  test('a flap sends it up, then it falls again', () => {
    let bird = flapBird(createBird(WIDTH));
    expect(bird.vy).toBe(BIRD.flapVelocity);
    const y0 = bird.y;
    bird = stepBird(bird, 0.1);
    expect(bird.y).toBeLessThan(y0);
    for (let i = 0; i < 120; i++) bird = stepBird(bird, STEP);
    expect(bird.vy).toBeGreaterThan(0);
  });

  test('the ceiling stops the bird instead of letting it leave the screen', () => {
    let bird = { ...createBird(WIDTH), y: BIRD.radius + 1, vy: BIRD.flapVelocity };
    bird = stepBird(bird, STEP);
    expect(bird.y).toBe(BIRD.radius);
    expect(bird.vy).toBeGreaterThanOrEqual(0);
  });

  test('the tilt follows the speed: nose up after a flap, down in a dive', () => {
    expect(birdTilt(BIRD.flapVelocity)).toBeLessThan(0);
    expect(birdTilt(BIRD.maxFall)).toBeGreaterThan(1.2);
    expect(birdTilt(0)).toBeLessThan(birdTilt(400));
  });
});

describe('pipes', () => {
  test('gaps always stay within the bounds and within a fair shift of the previous one', () => {
    const rng = createRng(1);
    for (const score of [0, 10, 25, 40, 200]) {
      const { gap } = difficultyAt(score);
      const bounds = gapBounds(gap);
      let previous: number | null = null;
      for (let i = 0; i < 500; i++) {
        const pipe = spawnPipe(0, previous, gap, rng);
        expect(pipe.gapY).toBeGreaterThanOrEqual(Math.floor(bounds.min));
        expect(pipe.gapY).toBeLessThanOrEqual(Math.ceil(bounds.max));
        expect(pipe.gapY - pipe.gap / 2).toBeGreaterThanOrEqual(PIPE.edgeMargin - 1);
        expect(pipe.gapY + pipe.gap / 2).toBeLessThanOrEqual(GROUND_Y - PIPE.edgeMargin + 1);
        if (previous !== null) expect(Math.abs(pipe.gapY - previous)).toBeLessThanOrEqual(PIPE.maxShift + 1);
        previous = pipe.gapY;
      }
    }
  });

  test('the same seed gives the same pipes', () => {
    const a = createRng(42);
    const b = createRng(42);
    const gapsA = Array.from({ length: 5 }, () => spawnPipe(0, null, 160, a).gapY);
    const gapsB = Array.from({ length: 5 }, () => spawnPipe(0, null, 160, b).gapY);
    expect(gapsA).toEqual(gapsB);
    expect(new Set(gapsA).size).toBeGreaterThan(1);
  });

  test('pipes are spaced by distance and dropped once off screen', () => {
    expect(nextPipeX([], WIDTH)).toBe(WIDTH + PIPE.width);
    const first = { x: WIDTH + PIPE.width, gapY: 300, gap: 160, scored: false };
    expect(nextPipeX([first], WIDTH)).toBeNull();
    const moved = scrollPipes([first], PIPE.spacing);
    expect(nextPipeX(moved, WIDTH)).toBe(moved[0]!.x + PIPE.spacing);
    expect(scrollPipes([{ ...first, x: -PIPE.width + 1 }], 2)).toEqual([]);
  });

  test('difficulty ramps from an easy start to fair limits and stops there', () => {
    expect(difficultyAt(0)).toEqual({ gap: DIFFICULTY.gapStart, speed: DIFFICULTY.speedStart });
    const mid = difficultyAt(DIFFICULTY.rampScore / 2);
    expect(mid.gap).toBeLessThan(DIFFICULTY.gapStart);
    expect(mid.gap).toBeGreaterThan(DIFFICULTY.gapMin);
    expect(difficultyAt(1000)).toEqual({ gap: DIFFICULTY.gapMin, speed: DIFFICULTY.speedMax });
    // The tightest gap still leaves several bird heights.
    expect(DIFFICULTY.gapMin).toBeGreaterThan(BIRD.radius * 2 * 4);
  });
});

describe('collision', () => {
  const pipe = { x: 100, gapY: 300, gap: 160, scored: false };
  const at = (x: number, y: number) => ({ x, y, vy: 0 });

  test('through the gap is safe, the pipe above or below is not', () => {
    expect(checkCollision(at(130, 300), [pipe])).toBeNull();
    expect(checkCollision(at(130, 300 - 80 + BIRD.hitRadius - 2), [pipe])).toBe('pipe');
    expect(checkCollision(at(130, 300 + 80 - BIRD.hitRadius + 2), [pipe])).toBe('pipe');
  });

  test('flying over the top of the screen is no way past a pipe', () => {
    expect(checkCollision(at(130, BIRD.radius), [pipe])).toBe('pipe');
  });

  test('a graze at the corner is forgiven (the hit circle is smaller than the drawing)', () => {
    expect(checkCollision(at(100 - BIRD.radius + 1, 300 - 80 - 2), [pipe])).toBeNull();
  });

  test('the ground kills', () => {
    expect(checkCollision(at(30, GROUND_Y - BIRD.hitRadius), [])).toBe('ground');
    expect(checkCollision(at(30, GROUND_Y - BIRD.hitRadius - 1), [])).toBeNull();
  });
});

describe('scoring', () => {
  test('a pipe counts once, when the bird passes its middle', () => {
    const bird = { x: 100, y: 300, vy: 0 };
    const ahead = { x: 80, gapY: 300, gap: 160, scored: false };
    expect(collectPoints(bird, [ahead]).gained).toBe(0);
    const passed = collectPoints(bird, [{ ...ahead, x: 100 - PIPE.width / 2 }]);
    expect(passed.gained).toBe(1);
    expect(collectPoints(bird, passed.pipes).gained).toBe(0);
  });

  test('the best score only goes up', () => {
    expect(updateBest(5, 3)).toBe(5);
    expect(updateBest(5, 8)).toBe(8);
  });
});

describe('fixed timestep', () => {
  test('60 Hz and 120 Hz screens run the same number of steps per second', () => {
    const count = (hz: number) => {
      let acc = 0;
      let steps = 0;
      for (let i = 0; i < hz; i++) {
        const tick = advanceClock(acc, 1 / hz);
        acc = tick.accumulator;
        steps += tick.steps;
      }
      return steps;
    };
    expect(count(60)).toBeGreaterThanOrEqual(119);
    expect(count(60)).toBeLessThanOrEqual(120);
    expect(count(120)).toBeGreaterThanOrEqual(119);
    expect(count(144)).toBeGreaterThanOrEqual(119);
  });

  test('a long stall is cut, and the remainder is carried as the interpolation', () => {
    const stalled = advanceClock(0, 5);
    expect(stalled.steps).toBe(Math.floor(MAX_FRAME / STEP + 1e-9));
    const partial = advanceClock(0, STEP * 1.5);
    expect(partial.steps).toBe(1);
    expect(partial.alpha).toBeCloseTo(0.5);
  });

  test('a whole game plays the same at 60 and 144 Hz', () => {
    const play = (hz: number) => {
      let game = handlePress(createGame(WIDTH, createRng(9), 0)).game;
      let acc = 0;
      for (let f = 0; f < hz * 3; f++) {
        const tick = advanceClock(acc, 1 / hz);
        acc = tick.accumulator;
        for (let s = 0; s < tick.steps; s++) game = stepGame(game, STEP).game;
      }
      return game;
    };
    const a = play(60);
    const b = play(144);
    expect(Math.abs(a.distance - b.distance)).toBeLessThan(DIFFICULTY.speedStart * STEP * 2);
  });
});

describe('input buffer', () => {
  test('a press waits a moment to be used, then expires', () => {
    expect(isBuffered(null, 1000)).toBe(false);
    expect(isBuffered(1000, 1000)).toBe(true);
    expect(isBuffered(1000, 1000 + INPUT_BUFFER_MS)).toBe(true);
    expect(isBuffered(1000, 1001 + INPUT_BUFFER_MS)).toBe(false);
  });
});

describe('game states', () => {
  test('ready → a press flaps into play → a pipe scores → the ground ends it → a press restarts', () => {
    let game = createGame(WIDTH, createRng(3), 2);
    expect(game.state).toBe('ready');
    // Ready: nothing falls and no pipes come.
    game = run(game, 1).game;
    expect(game.bird.y).toBe(WORLD_HEIGHT * BIRD.startY);
    expect(game.pipes).toEqual([]);

    const press = handlePress(game);
    expect(press.events).toEqual(['flap']);
    game = press.game;
    expect(game.state).toBe('playing');

    // A perfect pilot: flap whenever the bird drops below the next gap's centre.
    const pilot = (g: Game) => {
      const ahead = g.pipes.find((p) => p.x + PIPE.width > g.bird.x - BIRD.radius);
      const target = ahead ? ahead.gapY : WORLD_HEIGHT * 0.45;
      return g.state === 'playing' && g.bird.y > target + 12 && g.bird.vy > 0 ? handlePress(g).game : g;
    };
    const played = run(game, 8, pilot);
    expect(played.events).toContain('score');
    expect(played.game.state).toBe('playing');
    expect(played.game.score).toBeGreaterThanOrEqual(3);

    // Without input it falls to the ground.
    const over = run(played.game, 3);
    expect(over.events).toContain('hit');
    expect(over.events).toContain('over');
    expect(over.game.state).toBe('over');
    expect(over.game.best).toBe(Math.max(2, played.game.score));
    expect(over.game.newBest).toBe(played.game.score > 2);
    expect(over.game.bird.y).toBe(GROUND_Y - BIRD.radius);

    // Right after the death a press is not used (stays buffered); later it restarts.
    const early = handlePress({ ...over.game, stateTime: 0 });
    expect(early.consumed).toBe(false);
    const again = handlePress({ ...over.game, stateTime: RESTART_LOCK });
    expect(again.events).toEqual(['restart']);
    expect(again.game.state).toBe('ready');
    expect(again.game.score).toBe(0);
    expect(again.game.best).toBe(over.game.best);
  });

  test('hitting a pipe: the bird drops to the ground, then the game is over', () => {
    let game = handlePress(createGame(WIDTH, createRng(3), 0)).game;
    game = { ...game, pipes: [{ x: game.bird.x - 10, gapY: 100, gap: 140, scored: false }] };
    const hit = stepGame(game, STEP);
    expect(hit.events).toEqual(['hit']);
    expect(hit.game.state).toBe('dying');
    const landed = run(hit.game, 2);
    expect(landed.events).toEqual(['over']);
    expect(landed.game.state).toBe('over');
  });

  test('a press while dying is not used', () => {
    const game = { ...createGame(WIDTH, createRng(3), 0), state: 'dying' as const };
    expect(handlePress(game).consumed).toBe(false);
  });
});

describe('world size', () => {
  test('portrait phones fill the frame; wide frames are letterboxed', () => {
    expect(worldWidthFor(360 / 800)).toBeCloseTo((360 / 800) * WORLD_HEIGHT);
    expect(worldWidthFor(800 / 360)).toBe(WORLD_WIDTH_MAX);
    expect(worldWidthFor(0)).toBe(WORLD_WIDTH_MIN);
    const phone = fitWorld(360, 730);
    expect(phone.cssWidth).toBeCloseTo(360);
    expect(phone.cssHeight).toBeCloseTo(730, 0);
    const wide = fitWorld(800, 360);
    expect(wide.cssHeight).toBeCloseTo(360);
    expect(wide.cssWidth).toBeLessThan(800);
  });

  test('?seed= is read only as a plain number', () => {
    expect(parseSeed('?seed=7')).toBe(7);
    expect(parseSeed('?lang=en&seed=12')).toBe(12);
    expect(parseSeed('')).toBeNull();
    expect(parseSeed('?seed=abc')).toBeNull();
  });
});

describe('effects', () => {
  test('squash, shake and flash fade out and stop', () => {
    expect(squashScale(0).x).toBeGreaterThan(1);
    expect(squashScale(0).y).toBeLessThan(1);
    expect(squashScale(1)).toEqual({ x: 1, y: 1 });
    expect(shakeOffset(5, createRng(1))).toEqual({ x: 0, y: 0 });
    expect(flashAlpha(0)).toBeGreaterThan(0);
    expect(flashAlpha(1)).toBe(0);
  });

  test('sparks come from a fixed pool and retire', () => {
    const pool = createParticles();
    spawnBurst(pool, 10, 10, createRng(1));
    const alive = pool.filter((p) => p.alive).length;
    expect(alive).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) updateParticles(pool, STEP);
    expect(pool.filter((p) => p.alive)).toHaveLength(0);
    expect(createParticles()).toHaveLength(pool.length);
  });
});

describe('language', () => {
  test('Polish unless ?lang=en', () => {
    expect(pickLang('?lang=en')).toBe('en');
    expect(pickLang('?lang=de')).toBe('pl');
    expect(pickLang('')).toBe('pl');
    expect(translator('en')('again')).toBe('Play again');
    expect(translator('pl')('again')).toBe('Jeszcze raz');
  });
});
