// @ts-check
// Flappy Bird's rules (docs/v2/PLAN.md 9.1, stage g-3): pure functions over plain
// objects, no DOM and no clock, so the game (main.js) and the unit tests
// (v2/tests/flappy.test.ts) share them. Units: world pixels and seconds. The world is
// WORLD_HEIGHT tall; its width follows the frame's shape (worldWidthFor).

/** One physics step: 120 per second whatever the screen's refresh rate. */
export const STEP = 1 / 120;
/** A longer frame (a stalled tab) is cut to this, so the game never jumps far ahead. */
export const MAX_FRAME = 0.25;

export const WORLD_HEIGHT = 640;
export const GROUND_HEIGHT = 84;
export const GROUND_Y = WORLD_HEIGHT - GROUND_HEIGHT;
/** Narrowest and widest world: portrait phones use the shape of the frame, wider frames are letterboxed. */
export const WORLD_WIDTH_MIN = 270;
export const WORLD_WIDTH_MAX = 600;

export const BIRD = {
  /** Drawn size. */
  radius: 15,
  /** The hit circle is a little smaller than the drawing: a graze is forgiven. */
  hitRadius: 12,
  gravity: 1750,
  flapVelocity: -500,
  maxFall: 760,
  /** Where it waits on the ready screen, as a share of the height. */
  startY: 0.42,
  /** Its x, as a share of the width. */
  x: 0.3,
};

export const PIPE = {
  width: 66,
  /** Horizontal distance between pipes: by distance, so a faster game keeps the same rhythm. */
  spacing: 230,
  /** Free space a gap keeps from the top and from the ground. */
  edgeMargin: 56,
  /** How far one gap may move from the previous one: a fair climb or drop. */
  maxShift: 170,
};

/** The ramp: from an easy start to a fair limit, reached at `rampScore` points. */
export const DIFFICULTY = { gapStart: 176, gapMin: 138, speedStart: 150, speedMax: 205, rampScore: 40 };

/** How long a press waits to be used (e.g. tapping just before "play again" accepts taps). */
export const INPUT_BUFFER_MS = 130;
/** After a death the game ignores taps this long, so a frantic tap does not skip the result. */
export const RESTART_LOCK = 0.55;

/** @param {number} value @param {number} min @param {number} max */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
/** @param {number} a @param {number} b @param {number} t */
export const lerp = (a, b, t) => a + (b - a) * t;

// ── Randomness ───────────────────────────────────────────────────────────────

/**
 * A small seeded generator (mulberry32): the same seed gives the same pipes, which the
 * browser test uses (?seed=); without a seed the game seeds it at random.
 * @param {number} seed
 * @returns {() => number} numbers in [0, 1)
 */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The `seed` of a query string, or null.
 * @param {string} search
 */
export function parseSeed(search) {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || !/^\d{1,9}$/.test(raw)) return null;
  return Number(raw);
}

// ── World size ───────────────────────────────────────────────────────────────

/**
 * The world's width for a frame of this shape (width / height).
 * @param {number} aspect
 */
export function worldWidthFor(aspect) {
  if (!Number.isFinite(aspect) || aspect <= 0) return WORLD_WIDTH_MIN;
  return clamp(aspect * WORLD_HEIGHT, WORLD_WIDTH_MIN, WORLD_WIDTH_MAX);
}

/**
 * How the world fits a frame: scale and the letterbox offset, in CSS pixels.
 * @param {number} frameWidth @param {number} frameHeight
 */
export function fitWorld(frameWidth, frameHeight) {
  const width = worldWidthFor(frameWidth / frameHeight);
  const scale = Math.min(frameWidth / width, frameHeight / WORLD_HEIGHT);
  return {
    width,
    scale,
    cssWidth: width * scale,
    cssHeight: WORLD_HEIGHT * scale,
  };
}

// ── The bird ─────────────────────────────────────────────────────────────────

/**
 * @typedef {{ x: number, y: number, vy: number }} Bird
 */

/** @param {number} worldWidth @returns {Bird} */
export function createBird(worldWidth) {
  return { x: Math.round(worldWidth * BIRD.x), y: WORLD_HEIGHT * BIRD.startY, vy: 0 };
}

/** @param {Bird} bird @returns {Bird} */
export function flapBird(bird) {
  return { ...bird, vy: BIRD.flapVelocity };
}

/**
 * Gravity, the fall limit and the ceiling (the bird stops under it instead of dying).
 * @param {Bird} bird @param {number} dt @returns {Bird}
 */
export function stepBird(bird, dt) {
  const vy = Math.min(bird.vy + BIRD.gravity * dt, BIRD.maxFall);
  const y = bird.y + vy * dt;
  if (y < BIRD.radius) return { ...bird, y: BIRD.radius, vy: Math.max(0, vy) };
  return { ...bird, y, vy };
}

/**
 * The bird's tilt in radians from its speed: nose up after a flap, diving when it falls fast.
 * @param {number} vy
 */
export function birdTilt(vy) {
  const t = clamp((vy - BIRD.flapVelocity) / (BIRD.maxFall - BIRD.flapVelocity), 0, 1);
  // Stays level-ish for most of the arc and noses down only near the full fall.
  return lerp(-0.42, 1.45, t * t * t);
}

// ── Pipes ────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ x: number, gapY: number, gap: number, scored: boolean }} Pipe
 */

/**
 * Gap size and speed at this score: eased so it tightens early and settles near the limit.
 * @param {number} score
 */
export function difficultyAt(score) {
  const t = clamp(score / DIFFICULTY.rampScore, 0, 1);
  const eased = 1 - (1 - t) * (1 - t);
  return {
    gap: lerp(DIFFICULTY.gapStart, DIFFICULTY.gapMin, eased),
    speed: lerp(DIFFICULTY.speedStart, DIFFICULTY.speedMax, eased),
  };
}

/**
 * Where the centre of a gap of this size may be.
 * @param {number} gap
 */
export function gapBounds(gap) {
  return { min: PIPE.edgeMargin + gap / 2, max: GROUND_Y - PIPE.edgeMargin - gap / 2 };
}

/**
 * A new pipe at `x`. Its gap stays within the bounds and within a fair shift of the previous one.
 * @param {number} x @param {number | null} previousGapY @param {number} gap @param {() => number} rng
 * @returns {Pipe}
 */
export function spawnPipe(x, previousGapY, gap, rng) {
  const bounds = gapBounds(gap);
  const low = previousGapY === null ? bounds.min : Math.max(bounds.min, previousGapY - PIPE.maxShift);
  const high = previousGapY === null ? bounds.max : Math.min(bounds.max, previousGapY + PIPE.maxShift);
  return { x, gapY: Math.round(lerp(low, high, rng())), gap, scored: false };
}

/**
 * Where the next pipe goes, or null while the last one is still far enough in.
 * @param {Pipe[]} pipes @param {number} worldWidth
 */
export function nextPipeX(pipes, worldWidth) {
  const last = pipes[pipes.length - 1];
  if (!last) return worldWidth + PIPE.width;
  return last.x + PIPE.spacing <= worldWidth + PIPE.width ? last.x + PIPE.spacing : null;
}

/**
 * Moves the pipes left and drops the ones that left the screen.
 * @param {Pipe[]} pipes @param {number} dx @returns {Pipe[]}
 */
export function scrollPipes(pipes, dx) {
  return pipes.map((p) => ({ ...p, x: p.x - dx })).filter((p) => p.x + PIPE.width > 0);
}

/**
 * Pipes the bird has just passed (its centre beyond the pipe's middle) count once.
 * @param {Bird} bird @param {Pipe[]} pipes
 */
export function collectPoints(bird, pipes) {
  let gained = 0;
  const next = pipes.map((p) => {
    if (p.scored || p.x + PIPE.width / 2 > bird.x) return p;
    gained += 1;
    return { ...p, scored: true };
  });
  return { pipes: next, gained };
}

// ── Collision ────────────────────────────────────────────────────────────────

/**
 * Does a circle touch an axis-aligned rectangle?
 * @param {number} cx @param {number} cy @param {number} r
 * @param {number} left @param {number} top @param {number} right @param {number} bottom
 */
export function circleHitsRect(cx, cy, r, left, top, right, bottom) {
  const nx = clamp(cx, left, right);
  const ny = clamp(cy, top, bottom);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

/**
 * What the bird hit: 'ground', 'pipe' or null. A pipe reaches far above the screen,
 * so flying over the top is not a way past it.
 * @param {Bird} bird @param {Pipe[]} pipes
 * @returns {'ground' | 'pipe' | null}
 */
export function checkCollision(bird, pipes) {
  const r = BIRD.hitRadius;
  if (bird.y + r >= GROUND_Y) return 'ground';
  for (const p of pipes) {
    const right = p.x + PIPE.width;
    if (bird.x + r < p.x || bird.x - r > right) continue;
    const top = p.gapY - p.gap / 2;
    const bottom = p.gapY + p.gap / 2;
    if (circleHitsRect(bird.x, bird.y, r, p.x, -1000, right, top)) return 'pipe';
    if (circleHitsRect(bird.x, bird.y, r, p.x, bottom, right, GROUND_Y)) return 'pipe';
  }
  return null;
}

// ── Time and input ───────────────────────────────────────────────────────────

/**
 * Fixed timestep: adds a frame's time to the accumulator and says how many steps to
 * run. A 60 Hz and a 120 Hz screen run the same number of steps per second.
 * @param {number} accumulator @param {number} frameSeconds
 */
export function advanceClock(accumulator, frameSeconds) {
  let acc = accumulator + clamp(frameSeconds, 0, MAX_FRAME);
  let steps = 0;
  while (acc >= STEP) {
    acc -= STEP;
    steps += 1;
  }
  return { steps, accumulator: acc, alpha: acc / STEP };
}

/**
 * Is a press made at `pressedAt` still waiting to be used at `now`? (milliseconds)
 * @param {number | null} pressedAt @param {number} now
 */
export function isBuffered(pressedAt, now) {
  return pressedAt !== null && now - pressedAt >= 0 && now - pressedAt <= INPUT_BUFFER_MS;
}

/**
 * The best score after a game.
 * @param {number} best @param {number} score
 */
export function updateBest(best, score) {
  return Math.max(best, score);
}
