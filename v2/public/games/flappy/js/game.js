// @ts-check
// The game's states and one step of play (docs/v2/PLAN.md 9.1, stage g-3), built
// from the rules in logic.js. Pure: a step takes a game and returns the next one with
// what happened (events), which main.js turns into sound-free feedback and the HUD.
//
//   ready ──press──▶ playing ──hits a pipe──▶ dying ──lands──▶ over ──press──▶ ready
//                        └──────hits the ground───────────────▶ over
import {
  RESTART_LOCK,
  checkCollision,
  collectPoints,
  createBird,
  difficultyAt,
  flapBird,
  nextPipeX,
  scrollPipes,
  spawnPipe,
  stepBird,
  updateBest,
  GROUND_Y,
  BIRD,
  DIFFICULTY,
} from './logic.js';

/** @typedef {import('./logic.js').Bird} Bird */
/** @typedef {import('./logic.js').Pipe} Pipe */
/** @typedef {'ready' | 'playing' | 'dying' | 'over'} GameState */
/** @typedef {'flap' | 'score' | 'hit' | 'over' | 'restart'} GameEvent */

/**
 * @typedef {{
 *   state: GameState,
 *   width: number,
 *   bird: Bird,
 *   pipes: Pipe[],
 *   score: number,
 *   best: number,
 *   newBest: boolean,
 *   stateTime: number,
 *   distance: number,
 *   lastDx: number,
 *   rng: () => number,
 * }} Game
 */

/**
 * A game on the ready screen.
 * @param {number} width @param {() => number} rng @param {number} best
 * @returns {Game}
 */
export function createGame(width, rng, best) {
  return {
    state: 'ready',
    width,
    bird: createBird(width),
    pipes: [],
    score: 0,
    best,
    newBest: false,
    stateTime: 0,
    distance: 0,
    lastDx: 0,
    rng,
  };
}

/**
 * @param {Game} game @param {GameState} state
 * @returns {Game}
 */
function enterState(game, state) {
  return { ...game, state, stateTime: 0 };
}

/**
 * A tap, a click or Space. `consumed: false` = not usable now (e.g. right after a
 * death), so the caller keeps it buffered and offers it again on the next step.
 * @param {Game} game
 * @returns {{ game: Game, consumed: boolean, events: GameEvent[] }}
 */
export function handlePress(game) {
  switch (game.state) {
    case 'ready':
      return { game: { ...enterState(game, 'playing'), bird: flapBird(game.bird) }, consumed: true, events: ['flap'] };
    case 'playing':
      return { game: { ...game, bird: flapBird(game.bird) }, consumed: true, events: ['flap'] };
    case 'over':
      if (game.stateTime < RESTART_LOCK) return { game, consumed: false, events: [] };
      return { game: createGame(game.width, game.rng, game.best), consumed: true, events: ['restart'] };
    default:
      return { game, consumed: false, events: [] };
  }
}

/**
 * New pipes at the right edge, as many as the spacing asks for.
 * @param {Game} game
 * @returns {Pipe[]}
 */
function spawnPipes(game) {
  const pipes = [...game.pipes];
  const { gap } = difficultyAt(game.score);
  for (let x = nextPipeX(pipes, game.width); x !== null; x = nextPipeX(pipes, game.width)) {
    const previous = pipes[pipes.length - 1];
    pipes.push(spawnPipe(x, previous ? previous.gapY : null, gap, game.rng));
  }
  return pipes;
}

/**
 * The death: the best score is settled here, so it is kept even if the page closes mid-fall.
 * @param {Game} game @param {GameState} state
 * @returns {Game}
 */
function endRun(game, state) {
  const best = updateBest(game.best, game.score);
  return { ...enterState(game, state), best, newBest: game.score > game.best };
}

/**
 * One step while playing: the bird, the pipes, points, then the collision.
 * @param {Game} game @param {number} dt
 * @returns {{ game: Game, events: GameEvent[] }}
 */
function stepPlaying(game, dt) {
  /** @type {GameEvent[]} */
  const events = [];
  const { speed } = difficultyAt(game.score);
  const dx = speed * dt;
  const bird = stepBird(game.bird, dt);
  const scrolled = scrollPipes(game.pipes, dx);
  const points = collectPoints(bird, spawnPipes({ ...game, pipes: scrolled }));
  if (points.gained > 0) events.push('score');
  let next = { ...game, bird, pipes: points.pipes, score: game.score + points.gained, distance: game.distance + dx, lastDx: dx };

  const hit = checkCollision(bird, next.pipes);
  if (hit === 'pipe') {
    next = endRun(next, 'dying');
    events.push('hit');
  } else if (hit === 'ground') {
    next = endRun({ ...next, bird: restOnGround(bird) }, 'over');
    events.push('hit', 'over');
  }
  return { game: next, events };
}

/** @param {Bird} bird @returns {Bird} */
function restOnGround(bird) {
  return { ...bird, y: GROUND_Y - BIRD.radius, vy: 0 };
}

/**
 * After hitting a pipe the bird drops to the ground; the world stands still.
 * @param {Game} game @param {number} dt
 * @returns {{ game: Game, events: GameEvent[] }}
 */
function stepDying(game, dt) {
  const bird = stepBird(game.bird, dt);
  if (bird.y + BIRD.radius < GROUND_Y) return { game: { ...game, bird, lastDx: 0 }, events: [] };
  return { game: { ...enterState(game, 'over'), bird: restOnGround(bird), lastDx: 0 }, events: ['over'] };
}

/**
 * On the ready screen the ground keeps moving, so the world looks alive.
 * @param {Game} game @param {number} dt
 * @returns {Game}
 */
function driftReady(game, dt) {
  const dx = DIFFICULTY.speedStart * dt;
  return { ...game, distance: game.distance + dx, lastDx: dx };
}

/**
 * One fixed step of the whole game.
 * @param {Game} game @param {number} dt
 * @returns {{ game: Game, events: GameEvent[] }}
 */
export function stepGame(game, dt) {
  const aged = { ...game, stateTime: game.stateTime + dt };
  switch (aged.state) {
    case 'playing':
      return stepPlaying(aged, dt);
    case 'dying':
      return stepDying(aged, dt);
    case 'ready':
      return { game: driftReady(aged, dt), events: [] };
    default:
      return { game: { ...aged, lastDx: 0 }, events: [] };
  }
}
