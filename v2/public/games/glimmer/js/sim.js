// @ts-check
// Świetlik (Glimmer): the whole game as one state object and pure updates on it — no DOM,
// no clock, randomness only from the game's seeded generator. `updateGame(game, input, DT)`
// advances one fixed step; js/main.js calls it as often as real time asks and js/render.js
// only reads the state. Everything that moves lives in fixed pools (no allocation per step):
// shots (sparks, drops, orbs, petals, seekers, bouncers, mines, comets and their embers,
// splitters, snake links), beams (a line that warns, then burns — or, as a marker, only
// warns: the path of a comet), walls (a bar with a gap that sweeps across) and zones (a
// circle that warns, then shrinks: outside it hurts). The director (js/director.js) decides what
// comes; the patterns (js/patterns.js) put it in the arena.

import { DT, PLAYER, POOLS, SCORE, SPAWN_CLEAR, SPEED_GROWTH } from './config.js';
import { createRng } from './rng.js';
import { createDirector, updateDirector } from './director.js';

/**
 * @typedef {'spark' | 'drop' | 'orb' | 'petal' | 'seeker' | 'node' | 'bouncer' | 'mine' | 'comet' | 'ember' | 'splitter' | 'link'} ShotKind
 * @typedef {{
 *   alive: boolean, delay: number, x: number, y: number, vx: number, vy: number, ax: number, ay: number,
 *   r: number, kind: ShotKind, turn: number, speed: number, life: number, age: number,
 *   grazed: boolean, harmless: boolean, bounces: number, inside: boolean, wave: number, freq: number, phase: number,
 * }} Shot
 * @typedef {{
 *   alive: boolean, px: number, py: number, angle: number, spin: number, half: number,
 *   warn: number, warnTotal: number, active: number, sweep: number, marker: boolean,
 * }} Beam
 * @typedef {{
 *   alive: boolean, cx: number, cy: number, r0: number, r1: number,
 *   warn: number, warnTotal: number, active: number, activeTotal: number,
 * }} Zone
 * @typedef {{
 *   alive: boolean, horizontal: boolean, pos: number, vel: number, thick: number,
 *   gapA: number, gapB: number, warn: number, warnTotal: number,
 * }} Wall
 * @typedef {'hit' | 'graze' | 'ring' | 'over' | 'mercy' | 'pop'} EventType
 * @typedef {{ type: EventType, x: number, y: number, value: number }} GameEvent
 * @typedef {{ mx: number, my: number, dragX: number, dragY: number, focus: boolean }} Input
 * @typedef {{ width: number, height: number, seed: number, hp?: number, start?: number, pattern?: string }} GameOptions
 */

export const EVENT_RING = 128;

/** @returns {Shot} */
function shotSlot() {
  return {
    alive: false, delay: 0, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, r: 2, kind: 'spark', turn: 0, speed: 0, life: 0, age: 0,
    grazed: false, harmless: false, bounces: 0, inside: false, wave: 0, freq: 0, phase: 0,
  };
}

/** @returns {Beam} */
function beamSlot() {
  return { alive: false, px: 0, py: 0, angle: 0, spin: 0, half: 3, warn: 0, warnTotal: 1, active: 0, sweep: 0, marker: false };
}

/** @returns {Zone} */
function zoneSlot() {
  return { alive: false, cx: 0, cy: 0, r0: 0, r1: 0, warn: 0, warnTotal: 1, active: 0, activeTotal: 1 };
}

/** @returns {Wall} */
function wallSlot() {
  return { alive: false, horizontal: true, pos: 0, vel: 0, thick: 8, gapA: 0, gapB: 0, warn: 0, warnTotal: 1 };
}

/** A new input with nothing pressed. @returns {Input} */
export function createInput() {
  return { mx: 0, my: 0, dragX: 0, dragY: 0, focus: false };
}

/**
 * A new run in an arena of `width` × `height` art pixels. `start` (the test switch) begins
 * the clock later: the harder minutes at once.
 * @param {GameOptions} options
 */
export function createGame(options) {
  const width = Math.max(120, Math.round(options.width));
  const height = Math.max(120, Math.round(options.height));
  return {
    width,
    height,
    rng: createRng(options.seed),
    seed: options.seed,
    phase: /** @type {'play' | 'over'} */ ('play'),
    time: options.start ?? 0,
    startTime: options.start ?? 0,
    player: { x: width / 2, y: height * 0.62, hp: options.hp ?? PLAYER.hp, maxHp: options.hp ?? PLAYER.hp, invulnerable: 0, focus: false, moving: false, face: 1 },
    grazes: 0,
    hits: 0,
    score: 0,
    shots: Array.from({ length: POOLS.shots }, shotSlot),
    beams: Array.from({ length: POOLS.beams }, beamSlot),
    walls: Array.from({ length: POOLS.walls }, wallSlot),
    zones: Array.from({ length: POOLS.zones }, zoneSlot),
    /** Until then no other beam, wall or zone pattern starts (a grid, a pinwheel or a zone is on). */
    areaLockUntil: -Infinity,
    director: createDirector(options.start ?? 0),
    events: Array.from({ length: EVENT_RING }, () => /** @type {GameEvent} */ ({ type: 'hit', x: 0, y: 0, value: 0 })),
    eventSeq: 0,
    /** How many shots are out (for the page and the tests). */
    shotCount: 0,
    /** The last pattern started (for the page's debug data and the tests). */
    lastPattern: '',
    patternsStarted: 0,
    /** A test switch (?test=1&pattern=): only this pattern comes. */
    forcePattern: options.pattern ?? '',
  };
}

/** @typedef {ReturnType<typeof createGame>} Game */

/** @param {Game} game @param {EventType} type @param {number} x @param {number} y @param {number} value */
export function emit(game, type, x, y, value) {
  const e = /** @type {GameEvent} */ (game.events[game.eventSeq % EVENT_RING]);
  e.type = type;
  e.x = x;
  e.y = y;
  e.value = value;
  game.eventSeq += 1;
}

/** Shots move faster as the run goes on (× this). @param {number} time */
export function speedFactor(time) {
  return Math.min(SPEED_GROWTH.cap, 1 + time * SPEED_GROWTH.perSecond);
}

// ── Pools ──────────────────────────────────────────────────────────────────────

/** @template {{ alive: boolean }} T @param {T[]} pool @returns {T | null} */
function free(pool) {
  for (let i = 0; i < pool.length; i++) {
    const item = /** @type {T} */ (pool[i]);
    if (!item.alive) return item;
  }
  return null;
}

/**
 * Puts a shot in the arena (after `delay` seconds; until then it is not there at all).
 * @param {Game} game @param {ShotKind} kind @param {number} x @param {number} y @param {number} vx @param {number} vy
 * `bounces`: how often it bounces off the arena's edges once inside; `wave`, `freq`, `phase`:
 * a sideways sway (px/s across its path, as wave·cos(freq·age + phase)).
 * @param {{ r?: number, delay?: number, ax?: number, ay?: number, turn?: number, life?: number, harmless?: boolean, bounces?: number, wave?: number, freq?: number, phase?: number }} [more]
 */
export function addShot(game, kind, x, y, vx, vy, more = {}) {
  const s = free(game.shots);
  if (!s) return null;
  s.alive = true;
  s.kind = kind;
  s.x = x;
  s.y = y;
  s.vx = vx;
  s.vy = vy;
  s.ax = more.ax ?? 0;
  s.ay = more.ay ?? 0;
  s.r = more.r ?? 2;
  s.delay = more.delay ?? 0;
  s.turn = more.turn ?? 0;
  s.speed = Math.hypot(vx, vy);
  s.life = more.life ?? Infinity;
  s.age = 0;
  s.grazed = false;
  s.harmless = more.harmless === true;
  s.bounces = more.bounces ?? 0;
  s.inside = false;
  s.wave = more.wave ?? 0;
  s.freq = more.freq ?? 0;
  s.phase = more.phase ?? 0;
  return s;
}

/**
 * A beam through (px, py) at `angle`: it warns for `warn` seconds, then burns for `active`
 * seconds, turning by `spin` radians a second while it burns. A `marker` only warns (it
 * shows where something will pass) and never burns.
 * @param {Game} game @param {number} px @param {number} py @param {number} angle
 * @param {{ half?: number, warn?: number, active?: number, spin?: number, marker?: boolean }} [more]
 */
export function addBeam(game, px, py, angle, more = {}) {
  const b = free(game.beams);
  if (!b) return null;
  b.alive = true;
  b.px = px;
  b.py = py;
  b.angle = angle;
  b.spin = more.spin ?? 0;
  b.half = more.half ?? 3;
  b.warn = b.warnTotal = more.warn ?? 0.9;
  b.active = more.active ?? 0.5;
  b.sweep = b.spin * b.active;
  b.marker = more.marker === true;
  return b;
}

/**
 * A zone round (cx, cy): it warns for `warn` seconds at radius r0, then shrinks to r1 over
 * `active` seconds; all that time, outside it hurts.
 * @param {Game} game @param {number} cx @param {number} cy @param {number} r0 @param {number} r1 @param {number} warn @param {number} active
 */
export function addZone(game, cx, cy, r0, r1, warn, active) {
  const z = free(game.zones);
  if (!z) return null;
  z.alive = true;
  z.cx = cx;
  z.cy = cy;
  z.r0 = r0;
  z.r1 = r1;
  z.warn = z.warnTotal = warn;
  z.active = z.activeTotal = active;
  return z;
}

/** A zone's radius now. @param {Zone} z */
export function zoneRadius(z) {
  if (z.warn > 0) return z.r0;
  return z.r1 + (z.r0 - z.r1) * Math.max(0, z.active / z.activeTotal);
}

/**
 * A wall (a bar across the arena with a gap from gapA to gapB) that warns, then sweeps:
 * horizontal ones move down or up (`vel` in y), vertical ones left or right.
 * @param {Game} game @param {boolean} horizontal @param {number} pos @param {number} vel @param {number} gapA @param {number} gapB
 * @param {{ thick?: number, warn?: number }} [more]
 */
export function addWall(game, horizontal, pos, vel, gapA, gapB, more = {}) {
  const w = free(game.walls);
  if (!w) return null;
  w.alive = true;
  w.horizontal = horizontal;
  w.pos = pos;
  w.vel = vel;
  w.gapA = gapA;
  w.gapB = gapB;
  w.thick = more.thick ?? 8;
  w.warn = w.warnTotal = more.warn ?? 0.9;
  return w;
}

// ── Geometry ───────────────────────────────────────────────────────────────────

/** Distance from a point to the infinite line through (px, py) at `angle`. */
export function distanceToLine(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ px, /** @type {number} */ py, /** @type {number} */ angle) {
  return Math.abs((x - px) * Math.sin(angle) - (y - py) * Math.cos(angle));
}

/** Whether a circle at (x, y) of radius r touches a wall's bar (outside its gap). @param {Wall} w @param {number} x @param {number} y @param {number} r */
export function touchesWall(w, x, y, r) {
  const across = w.horizontal ? y : x;
  const along = w.horizontal ? x : y;
  if (Math.abs(across - w.pos) > w.thick / 2 + r) return false;
  return along - r < w.gapA || along + r > w.gapB;
}

/** Whether a live zone hurts a circle at (x, y) of radius r (any part of it outside). @param {Zone} z @param {number} x @param {number} y @param {number} r */
export function outsideZone(z, x, y, r) {
  return z.warn <= 0 && z.active > 0 && Math.hypot(x - z.cx, y - z.cy) + r > zoneRadius(z);
}

/** Whether a beam burns at a circle at (x, y) of radius r. @param {Beam} b @param {number} x @param {number} y @param {number} r */
export function touchesBeam(b, x, y, r) {
  return !b.marker && b.warn <= 0 && b.active > 0 && distanceToLine(x, y, b.px, b.py, b.angle) <= b.half + r;
}

// ── The step ──────────────────────────────────────────────────────────────────

/**
 * One fixed step: the wisp moves by the input, the director starts patterns, everything
 * moves, then hits and grazes are counted.
 * @param {Game} game @param {Input} input @param {number} [dt]
 */
export function updateGame(game, input, dt = DT) {
  if (game.phase !== 'play') return;
  game.time += dt;
  movePlayer(game, input, dt);
  updateDirector(game);
  updateShots(game, dt);
  updateBeams(game, dt);
  updateWalls(game, dt);
  updateZones(game, dt);
  collide(game);
  // (+1e-6: the clock adds up sixtieths, which floats round just below whole numbers.)
  game.score = Math.floor((game.time - game.startTime) * SCORE.perSecond + 1e-6) + game.grazes * SCORE.perGraze;
}

/** @param {Game} game @param {Input} input @param {number} dt */
function movePlayer(game, input, dt) {
  const p = game.player;
  p.focus = input.focus;
  const speed = input.focus ? PLAYER.focusSpeed : PLAYER.speed;
  let mx = input.mx;
  let my = input.my;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const gain = PLAYER.dragGain * (input.focus ? 0.5 : 1);
  const dx = mx * speed * dt + input.dragX * gain;
  const dy = my * speed * dt + input.dragY * gain;
  input.dragX = 0;
  input.dragY = 0;
  p.moving = Math.abs(dx) + Math.abs(dy) > 0.01;
  if (Math.abs(dx) > 0.01) p.face = dx < 0 ? -1 : 1;
  const m = 4;
  p.x = Math.min(game.width - m, Math.max(m, p.x + dx));
  p.y = Math.min(game.height - m, Math.max(m, p.y + dy));
  if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);
}

/** @param {Game} game @param {number} dt */
function updateShots(game, dt) {
  const p = game.player;
  let count = 0;
  for (const s of game.shots) {
    if (!s.alive) continue;
    if (s.delay > 0) {
      s.delay -= dt;
      if (s.delay <= 0 && !s.harmless && Math.hypot(s.x - p.x, s.y - p.y) < SPAWN_CLEAR) {
        s.alive = false;
        continue;
      }
      count += 1;
      continue;
    }
    s.age += dt;
    if (s.age >= s.life) {
      s.alive = false;
      // A mine or a splitter goes off (its pieces were placed, delayed, when it was laid).
      if (s.kind === 'mine' || s.kind === 'splitter') emit(game, 'pop', s.x, s.y, 0);
      continue;
    }
    if (s.turn > 0) {
      // A seeker turns toward the wisp, at most `turn` radians a second.
      const want = Math.atan2(p.y - s.y, p.x - s.x);
      const have = Math.atan2(s.vy, s.vx);
      let d = want - have;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const step = Math.max(-s.turn * dt, Math.min(s.turn * dt, d));
      s.vx = Math.cos(have + step) * s.speed;
      s.vy = Math.sin(have + step) * s.speed;
    }
    s.vx += s.ax * dt;
    s.vy += s.ay * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.wave !== 0 && s.speed > 0) {
      // Sway across its path (the path itself stays straight: a snake, a falling leaf).
      const side = s.wave * Math.cos(s.freq * s.age + s.phase) * dt;
      s.x += (-s.vy / s.speed) * side;
      s.y += (s.vx / s.speed) * side;
    }
    if (s.bounces > 0) bounce(game, s);
    // Gone once it is well outside and moving away.
    const margin = 24 + s.r;
    if ((s.x < -margin && s.vx <= 0) || (s.x > game.width + margin && s.vx >= 0) || (s.y < -margin && s.vy <= 0) || (s.y > game.height + margin && s.vy >= 0)) {
      s.alive = false;
      continue;
    }
    count += 1;
  }
  game.shotCount = count;
}

/** A bouncer: once wholly inside, it turns back off the edges, `bounces` times. @param {Game} game @param {Shot} s */
function bounce(game, s) {
  const r = s.r;
  if (!s.inside) {
    s.inside = s.x >= r && s.y >= r && s.x <= game.width - r && s.y <= game.height - r;
    return;
  }
  if ((s.x < r && s.vx < 0) || (s.x > game.width - r && s.vx > 0)) {
    s.vx = -s.vx;
    s.bounces -= 1;
  } else if ((s.y < r && s.vy < 0) || (s.y > game.height - r && s.vy > 0)) {
    s.vy = -s.vy;
    s.bounces -= 1;
  }
}

/** @param {Game} game @param {number} dt */
function updateZones(game, dt) {
  for (const z of game.zones) {
    if (!z.alive) continue;
    if (z.warn > 0) {
      z.warn -= dt;
      continue;
    }
    z.active -= dt;
    if (z.active <= 0) z.alive = false;
  }
}

/** @param {Game} game @param {number} dt */
function updateBeams(game, dt) {
  for (const b of game.beams) {
    if (!b.alive) continue;
    if (b.warn > 0) {
      b.warn -= dt;
      continue;
    }
    b.active -= dt;
    b.angle += b.spin * dt;
    if (b.active <= 0) b.alive = false;
  }
}

/** @param {Game} game @param {number} dt */
function updateWalls(game, dt) {
  for (const w of game.walls) {
    if (!w.alive) continue;
    if (w.warn > 0) {
      w.warn -= dt;
      continue;
    }
    w.pos += w.vel * dt;
    const span = w.horizontal ? game.height : game.width;
    if ((w.vel > 0 && w.pos > span + w.thick) || (w.vel < 0 && w.pos < -w.thick)) w.alive = false;
  }
}

/** Hits (unless still blinking from the last) and grazes. @param {Game} game */
function collide(game) {
  const p = game.player;
  const r = PLAYER.hitRadius;
  let hit = false;
  for (const s of game.shots) {
    if (!s.alive || s.delay > 0 || s.harmless) continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d <= s.r + r) {
      hit = true;
      continue;
    }
    if (!s.grazed && d <= s.r + PLAYER.grazeRadius) {
      s.grazed = true;
      game.grazes += 1;
      emit(game, 'graze', s.x, s.y, 0);
    }
  }
  for (const b of game.beams) if (b.alive && touchesBeam(b, p.x, p.y, r)) hit = true;
  for (const w of game.walls) if (w.alive && w.warn <= 0 && touchesWall(w, p.x, p.y, r)) hit = true;
  for (const z of game.zones) if (z.alive && outsideZone(z, p.x, p.y, r)) hit = true;
  if (hit && p.invulnerable <= 0) hurt(game);
}

/** @param {Game} game */
function hurt(game) {
  const p = game.player;
  p.hp -= 1;
  game.hits += 1;
  p.invulnerable = PLAYER.invulnerable;
  emit(game, 'hit', p.x, p.y, p.hp);
  // A moment to recover: the nearest shots burst away.
  let cleared = 0;
  for (const s of game.shots) {
    if (!s.alive || s.delay > 0 || s.harmless) continue;
    if (Math.hypot(s.x - p.x, s.y - p.y) > PLAYER.mercyRadius) continue;
    s.alive = false;
    cleared += 1;
    emit(game, 'mercy', s.x, s.y, 0);
  }
  if (p.hp <= 0) {
    p.hp = 0;
    game.phase = 'over';
    emit(game, 'over', p.x, p.y, game.score);
  }
  return cleared;
}
