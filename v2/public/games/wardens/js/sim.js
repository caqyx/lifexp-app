// @ts-check
// Strażnicy Doliny: the whole game as one state object and pure updates on it — no DOM,
// no clock, no randomness. `updateGame(state, DT)` advances one fixed step; the page
// (js/main.js) calls it as often as real time (× the speed) asks, and js/render.js only
// reads the state. The player's actions (build, upgrade, sell, priority, call a wave)
// are functions here too, so the headless balance test plays exactly the same game.
// Hot paths (every step) allocate nothing: enemies, projectiles and events live in pools.

import {
  BREAK_SECONDS,
  EARLY_GOLD_PER_SECOND,
  ENEMIES,
  HP_GROWTH,
  LEVELS,
  SELL_REFUND,
  STAR_LIVES,
  START_LIVES,
  TOWERS,
  WAVE_BONUS_BASE,
  WAVE_BONUS_STEP,
} from './config.js';
import { createPath, pointAt } from './maps.js';
import { createSpawns, createWave } from './waves.js';

/** @typedef {import('./config.js').TowerType} TowerType */
/** @typedef {import('./config.js').EnemyType} EnemyType */
/** @typedef {import('./config.js').Priority} Priority */
/** @typedef {import('./maps.js').MapDef} MapDef */
/** @typedef {import('./maps.js').Path} Path */
/** @typedef {import('./waves.js').Wave} Wave */
/** @typedef {import('./waves.js').Spawn} Spawn */

/**
 * @typedef {{
 *   alive: boolean, id: number, type: EnemyType, hp: number, maxHp: number,
 *   dist: number, x: number, y: number, speed: number, armor: number,
 *   flying: boolean, boss: boolean, radius: number, gold: number, lives: number,
 *   slowFactor: number, slowLeft: number, slowResist: number, flash: number,
 *   wave: number,
 * }} Enemy
 * @typedef {{
 *   type: TowerType, level: number, pad: number, x: number, y: number,
 *   cooldown: number, priority: Priority, spent: number, buff: number,
 *   aim: number, fired: number,
 * }} Tower
 * @typedef {{
 *   alive: boolean, kind: 'arrow' | 'shell' | 'bolt', x: number, y: number,
 *   sx: number, sy: number, tx: number, ty: number, targetSlot: number, targetId: number,
 *   speed: number, damage: number, pierce: boolean, radius: number, t: number, flight: number,
 * }} Projectile
 * @typedef {'hit' | 'kill' | 'leak' | 'shot' | 'pulse' | 'blast' | 'build' | 'upgrade' | 'sell' | 'wave' | 'cleared' | 'early'} EventType
 * @typedef {{ type: EventType, x: number, y: number, value: number, kind: string }} GameEvent
 * @typedef {'build' | 'wave' | 'won' | 'lost'} Phase
 * @typedef {{ endless?: boolean, lives?: number, gold?: number, waves?: number }} GameOptions
 */

export const MAX_ENEMIES = 320;
export const MAX_PROJECTILES = 240;
export const EVENT_RING = 256;

/** Endless play past the map's last wave: health grows by this factor more each wave. */
const ENDLESS_GROWTH = 1.07;
/** A hit flashes the enemy white for this long (seconds). */
const FLASH_TIME = 0.12;

const scratch = { x: 0, y: 0 };

// ── Creating ─────────────────────────────────────────────────────────────────

/** @returns {Enemy} */
function createEnemySlot() {
  return {
    alive: false, id: 0, type: 'crawler', hp: 0, maxHp: 0, dist: 0, x: 0, y: 0, speed: 0, armor: 0,
    flying: false, boss: false, radius: 0, gold: 0, lives: 0, slowFactor: 1, slowLeft: 0, slowResist: 0,
    flash: 0, wave: 0,
  };
}

/** @returns {Projectile} */
function createProjectileSlot() {
  return {
    alive: false, kind: 'arrow', x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, targetSlot: -1, targetId: 0,
    speed: 0, damage: 0, pierce: false, radius: 0, t: 0, flight: 0,
  };
}

/** @returns {GameEvent} */
function createEventSlot() {
  return { type: 'hit', x: 0, y: 0, value: 0, kind: '' };
}

/**
 * A new game on a map. `waves` and `lives`/`gold` exist for the test switches only.
 * @param {MapDef} map @param {GameOptions} [options]
 */
export function createGame(map, options = {}) {
  const endless = options.endless === true && map.endless === true;
  const totalWaves = endless ? Infinity : Math.max(1, Math.min(map.waves, options.waves ?? map.waves));
  return {
    map,
    path: createPath(map),
    endless,
    totalWaves,
    phase: /** @type {Phase} */ ('build'),
    paused: false,
    time: 0,
    gold: options.gold ?? map.startGold,
    lives: options.lives ?? START_LIVES,
    startLives: options.lives ?? START_LIVES,
    /** Waves started and waves cleared. */
    wave: 0,
    cleared: 0,
    waveTime: 0,
    /** Seconds until the next wave starts by itself; −1 = it waits for the player. */
    countdown: -1,
    spawns: /** @type {Spawn[]} */ ([]),
    spawnCursor: 0,
    nextWave: /** @type {Wave | null} */ (createWave(map, 1)),
    enemies: Array.from({ length: MAX_ENEMIES }, createEnemySlot),
    aliveCount: 0,
    nextEnemyId: 1,
    towers: /** @type {(Tower | null)[]} */ (map.pads.map(() => null)),
    pads: map.pads.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 })),
    projectiles: Array.from({ length: MAX_PROJECTILES }, createProjectileSlot),
    events: Array.from({ length: EVENT_RING }, createEventSlot),
    eventSeq: 0,
    stats: { kills: 0, leaked: 0, goldEarned: 0, spent: 0, bestWave: 0 },
  };
}

/** @typedef {ReturnType<typeof createGame>} Game */

// ── Events (read by the renderer, never by the rules) ───────────────────────

/** @param {Game} game @param {EventType} type @param {number} x @param {number} y @param {number} value @param {string} kind */
function emit(game, type, x, y, value, kind) {
  const event = /** @type {GameEvent} */ (game.events[game.eventSeq % EVENT_RING]);
  event.type = type;
  event.x = x;
  event.y = y;
  event.value = value;
  event.kind = kind;
  game.eventSeq += 1;
}

/**
 * The first unused object of a pool, or null when it is full (no closure, no allocation).
 * @template {{ alive: boolean }} T @param {T[]} pool @returns {T | null}
 */
function freeSlot(pool) {
  for (let i = 0; i < pool.length; i++) {
    const item = /** @type {T} */ (pool[i]);
    if (!item.alive) return item;
  }
  return null;
}

// ── The step ────────────────────────────────────────────────────────────────

/**
 * One fixed step of `dt` seconds.
 * @param {Game} game @param {number} dt
 */
export function updateGame(game, dt) {
  if (game.paused || game.phase === 'won' || game.phase === 'lost') return;
  game.time += dt;
  if (game.phase === 'build') {
    updateCountdown(game, dt);
    return;
  }
  game.waveTime += dt;
  updateSpawns(game);
  updateEnemies(game, dt);
  updateTowers(game, dt);
  updateProjectiles(game, dt);
  checkWaveCleared(game);
  checkDefeat(game);
}

/** @param {Game} game @param {number} dt */
function updateCountdown(game, dt) {
  if (game.countdown < 0) return;
  game.countdown = Math.max(0, game.countdown - dt);
  if (game.countdown === 0) startWave(game);
}

/** @param {Game} game */
function updateSpawns(game) {
  while (game.spawnCursor < game.spawns.length) {
    const spawn = /** @type {Spawn} */ (game.spawns[game.spawnCursor]);
    if (spawn.at > game.waveTime) break;
    spawnEnemy(game, spawn.type, 0, game.wave);
    game.spawnCursor += 1;
  }
}

/**
 * Health of an enemy type on a wave of this map.
 * @param {Game} game @param {EnemyType} type @param {number} wave
 */
export function enemyHp(game, type, wave) {
  const linear = 1 + HP_GROWTH * (wave - 1);
  const endless = wave > game.map.waves ? ENDLESS_GROWTH ** (wave - game.map.waves) : 1;
  return Math.round(ENEMIES[type].hp * linear * endless * game.map.hpFactor);
}

/**
 * Puts an enemy on the road `dist` tiles from its start (0 = the entrance).
 * @param {Game} game @param {EnemyType} type @param {number} dist @param {number} wave
 */
function spawnEnemy(game, type, dist, wave) {
  const enemy = freeSlot(game.enemies);
  if (!enemy) return;
  const def = ENEMIES[type];
  enemy.alive = true;
  enemy.id = game.nextEnemyId++;
  enemy.type = type;
  enemy.maxHp = enemy.hp = enemyHp(game, type, wave);
  enemy.dist = Math.max(0, dist);
  enemy.speed = def.speed;
  enemy.armor = def.armor;
  enemy.flying = def.flying === true;
  enemy.boss = def.boss === true;
  enemy.radius = def.radius;
  enemy.gold = def.gold;
  enemy.lives = def.lives;
  enemy.slowFactor = 1;
  enemy.slowLeft = 0;
  enemy.slowResist = def.slowResist ?? 0;
  enemy.flash = 0;
  enemy.wave = wave;
  pointAt(game.path, enemy.dist, enemy);
  game.aliveCount += 1;
}

/** @param {Game} game @param {number} dt */
function updateEnemies(game, dt) {
  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    updateSlow(enemy, dt);
    if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.dist += enemy.speed * enemy.slowFactor * dt;
    if (enemy.dist >= game.path.total) {
      leakEnemy(game, enemy);
      continue;
    }
    pointAt(game.path, enemy.dist, enemy);
  }
}

/** @param {Enemy} enemy @param {number} dt */
function updateSlow(enemy, dt) {
  if (enemy.slowLeft <= 0) return;
  enemy.slowLeft -= dt;
  if (enemy.slowLeft <= 0) {
    enemy.slowLeft = 0;
    enemy.slowFactor = 1;
  }
}

/** @param {Game} game @param {Enemy} enemy */
function leakEnemy(game, enemy) {
  enemy.alive = false;
  game.aliveCount -= 1;
  game.lives -= enemy.lives;
  game.stats.leaked += 1;
  emit(game, 'leak', enemy.x, enemy.y, enemy.lives, enemy.type);
}

// ── Towers ──────────────────────────────────────────────────────────────────

/** @param {Game} game @param {number} dt */
function updateTowers(game, dt) {
  for (const tower of game.towers) {
    if (!tower || TOWERS[tower.type].attack === 'aura') continue;
    if (tower.fired > 0) tower.fired = Math.max(0, tower.fired - dt);
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;
    const fired = fireTower(game, tower);
    // A tower with nothing in range stays ready (it fires the moment something comes).
    tower.cooldown = fired ? TOWERS[tower.type].interval[tower.level - 1] ?? 1 : 0;
  }
}

/**
 * Whether a tower's attack can reach an enemy at all (fliers vs. ground).
 * @param {import('./config.js').TowerDef} def @param {Enemy} enemy
 */
export function canHit(def, enemy) {
  return enemy.flying ? def.hitsAir : def.hitsGround;
}

/**
 * The slot of the enemy a tower aims at by its priority, or −1.
 * first = furthest along the road, strongest = most health, closest = nearest the tower.
 * @param {Game} game @param {Tower} tower
 */
export function findTarget(game, tower) {
  const def = TOWERS[tower.type];
  const range = def.range[tower.level - 1] ?? 0;
  const r2 = range * range;
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < game.enemies.length; i++) {
    const enemy = /** @type {Enemy} */ (game.enemies[i]);
    if (!enemy.alive || !canHit(def, enemy)) continue;
    const d2 = (enemy.x - tower.x) ** 2 + (enemy.y - tower.y) ** 2;
    if (d2 > r2) continue;
    const score = tower.priority === 'strongest' ? enemy.hp * 1000 + enemy.dist : tower.priority === 'closest' ? -d2 : enemy.dist;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** @param {Game} game @param {Tower} tower @returns {boolean} whether it fired */
function fireTower(game, tower) {
  const def = TOWERS[tower.type];
  const lvl = tower.level - 1;
  const damage = (def.damage[lvl] ?? 0) * (1 + tower.buff);
  if (def.attack === 'pulse') return firePulse(game, tower, damage);
  const slot = findTarget(game, tower);
  if (slot < 0) return false;
  const target = /** @type {Enemy} */ (game.enemies[slot]);
  tower.aim = Math.atan2(target.y - tower.y, target.x - tower.x);
  tower.fired = 0.15;
  if (def.attack === 'shell') {
    const flight = def.flight ?? 0.7;
    pointAt(game.path, Math.min(game.path.total, target.dist + target.speed * target.slowFactor * flight), scratch);
    launchProjectile(game, 'shell', tower, scratch.x, scratch.y, -1, 0, damage, false, def.radius?.[lvl] ?? 1, flight, 0);
  } else {
    const kind = def.attack === 'bolt' ? 'bolt' : 'arrow';
    launchProjectile(game, kind, tower, target.x, target.y, slot, target.id, damage, def.pierceArmor === true, 0, 0, def.projectileSpeed ?? 12);
  }
  emit(game, 'shot', tower.x, tower.y, tower.aim, tower.type);
  return true;
}

/** @param {Game} game @param {Tower} tower @param {number} damage */
function firePulse(game, tower, damage) {
  const def = TOWERS[tower.type];
  const lvl = tower.level - 1;
  const range = def.range[lvl] ?? 0;
  const slow = def.slow?.[lvl] ?? 0;
  const slowTime = def.slowTime?.[lvl] ?? 0;
  let hit = false;
  for (const enemy of game.enemies) {
    if (!enemy.alive || !canHit(def, enemy)) continue;
    if ((enemy.x - tower.x) ** 2 + (enemy.y - tower.y) ** 2 > range * range) continue;
    hit = true;
    applySlow(enemy, slow, slowTime);
    applyDamage(game, enemy, damage, false);
  }
  if (hit) {
    tower.fired = 0.3;
    emit(game, 'pulse', tower.x, tower.y, range, tower.type);
  }
  return hit;
}

/**
 * Slows an enemy (bosses resist part of it); the stronger slow wins, the longer time wins.
 * @param {Enemy} enemy @param {number} slow @param {number} time
 */
export function applySlow(enemy, slow, time) {
  const factor = 1 - slow * (1 - enemy.slowResist);
  enemy.slowFactor = Math.min(enemy.slowFactor, factor);
  enemy.slowLeft = Math.max(enemy.slowLeft, time);
}

/**
 * The damage one hit does after armor: armor is taken off every hit, at least 1 gets
 * through, an attack that pierces ignores it.
 * @param {number} raw @param {number} armor @param {boolean} pierce
 */
export function damageAfterArmor(raw, armor, pierce) {
  return pierce ? raw : Math.max(1, raw - armor);
}

/** @param {Game} game @param {Enemy} enemy @param {number} raw @param {boolean} pierce */
function applyDamage(game, enemy, raw, pierce) {
  const amount = damageAfterArmor(raw, enemy.armor, pierce);
  enemy.hp -= amount;
  enemy.flash = FLASH_TIME;
  emit(game, 'hit', enemy.x, enemy.y, amount, enemy.type);
  if (enemy.hp <= 0) killEnemy(game, enemy);
}

/** @param {Game} game @param {Enemy} enemy */
function killEnemy(game, enemy) {
  enemy.alive = false;
  game.aliveCount -= 1;
  game.gold += enemy.gold;
  game.stats.goldEarned += enemy.gold;
  game.stats.kills += 1;
  emit(game, 'kill', enemy.x, enemy.y, enemy.gold, enemy.type);
  const splits = ENEMIES[enemy.type].splits;
  if (!splits) return;
  for (let i = 0; i < splits.count; i++) spawnEnemy(game, splits.type, enemy.dist - 0.2 * i, enemy.wave);
}

// ── Projectiles ─────────────────────────────────────────────────────────────

/**
 * @param {Game} game @param {Projectile['kind']} kind @param {Tower} from
 * @param {number} tx @param {number} ty @param {number} slot @param {number} id
 * @param {number} damage @param {boolean} pierce @param {number} radius @param {number} flight @param {number} speed
 */
function launchProjectile(game, kind, from, tx, ty, slot, id, damage, pierce, radius, flight, speed) {
  const p = freeSlot(game.projectiles);
  if (!p) return;
  p.alive = true;
  p.kind = kind;
  p.x = p.sx = from.x;
  p.y = p.sy = from.y;
  p.tx = tx;
  p.ty = ty;
  p.targetSlot = slot;
  p.targetId = id;
  p.damage = damage;
  p.pierce = pierce;
  p.radius = radius;
  p.flight = flight;
  p.speed = speed;
  p.t = 0;
}

/** @param {Game} game @param {number} dt */
function updateProjectiles(game, dt) {
  for (const p of game.projectiles) {
    if (!p.alive) continue;
    if (p.kind === 'shell') updateShell(game, p, dt);
    else updateHoming(game, p, dt);
  }
}

/** A shell flies to the point it was aimed at and bursts on the ground there. @param {Game} game @param {Projectile} p @param {number} dt */
function updateShell(game, p, dt) {
  p.t += dt;
  const k = Math.min(1, p.t / p.flight);
  p.x = p.sx + (p.tx - p.sx) * k;
  p.y = p.sy + (p.ty - p.sy) * k;
  if (k < 1) return;
  p.alive = false;
  const r2 = p.radius * p.radius;
  for (const enemy of game.enemies) {
    if (!enemy.alive || enemy.flying) continue;
    if ((enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2 <= r2) applyDamage(game, enemy, p.damage, false);
  }
  emit(game, 'blast', p.x, p.y, p.radius, 'mortar');
}

/** Arrows and bolts follow their target; if it is gone, they fly on to where it was. @param {Game} game @param {Projectile} p @param {number} dt */
function updateHoming(game, p, dt) {
  const target = p.targetSlot >= 0 ? game.enemies[p.targetSlot] : undefined;
  const tracking = target !== undefined && target.alive && target.id === p.targetId;
  if (tracking) {
    p.tx = target.x;
    p.ty = target.y;
  }
  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  const dist = Math.hypot(dx, dy);
  const step = p.speed * dt;
  if (dist > step) {
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
    return;
  }
  p.alive = false;
  if (tracking) applyDamage(game, target, p.damage, p.pierce);
}

// ── Waves ───────────────────────────────────────────────────────────────────

/** @param {Game} game */
function startWave(game) {
  game.wave += 1;
  game.stats.bestWave = Math.max(game.stats.bestWave, game.wave);
  const wave = createWave(game.map, game.wave);
  game.spawns = createSpawns(wave);
  game.spawnCursor = 0;
  game.waveTime = 0;
  game.countdown = -1;
  game.phase = 'wave';
  game.nextWave = game.wave < game.totalWaves ? createWave(game.map, game.wave + 1) : null;
  emit(game, 'wave', 0, 0, game.wave, wave.boss ? 'boss' : '');
}

/** Gold for clearing wave `n`. @param {number} n */
export function waveBonus(n) {
  return WAVE_BONUS_BASE + WAVE_BONUS_STEP * n;
}

/**
 * The early-call bonus right now: a whole gold coin for every whole second left on the
 * break (0 before the first wave, which waits for the player anyway).
 * @param {Game} game
 */
export function earlyBonus(game) {
  return game.phase === 'build' && game.countdown > 0 ? Math.floor(game.countdown) * EARLY_GOLD_PER_SECOND : 0;
}

/**
 * The player starts the next wave now; returns the early bonus paid, or −1 when no
 * wave can start (one is running, or the game is over).
 * @param {Game} game
 */
export function callWave(game) {
  if (game.phase !== 'build' || game.wave >= game.totalWaves) return -1;
  const bonus = earlyBonus(game);
  if (bonus > 0) {
    game.gold += bonus;
    game.stats.goldEarned += bonus;
    emit(game, 'early', 0, 0, bonus, '');
  }
  startWave(game);
  return bonus;
}

/** @param {Game} game */
function checkWaveCleared(game) {
  if (game.phase !== 'wave' || game.spawnCursor < game.spawns.length || game.aliveCount > 0) return;
  game.cleared += 1;
  const bonus = waveBonus(game.wave);
  game.gold += bonus;
  game.stats.goldEarned += bonus;
  emit(game, 'cleared', 0, 0, bonus, '');
  if (game.cleared >= game.totalWaves) {
    game.phase = 'won';
    return;
  }
  game.phase = 'build';
  game.countdown = BREAK_SECONDS;
}

/** @param {Game} game */
function checkDefeat(game) {
  if (game.lives > 0) return;
  game.lives = 0;
  game.phase = 'lost';
}

/**
 * Stars for a won map: three with ≥ 18 lives left, two with ≥ 10, else one (scaled to
 * the lives the game started with, for the test switch).
 * @param {number} lives @param {number} [startLives]
 */
export function starsFor(lives, startLives = START_LIVES) {
  const scale = startLives / START_LIVES;
  if (lives >= STAR_LIVES.three * scale) return 3;
  if (lives >= STAR_LIVES.two * scale) return 2;
  return lives > 0 ? 1 : 0;
}

// ── The player's actions ────────────────────────────────────────────────────

/** @param {TowerType} type */
export function buildCost(type) {
  return TOWERS[type].cost[0] ?? 0;
}

/** The price of the tower's next level, or null at the top. @param {Tower} tower */
export function upgradeCost(tower) {
  return tower.level >= LEVELS ? null : TOWERS[tower.type].cost[tower.level] ?? null;
}

/** @param {Tower} tower */
export function sellValue(tower) {
  return Math.floor(tower.spent * SELL_REFUND);
}

/** @param {Game} game @param {number} pad @param {TowerType} type @returns {boolean} */
export function buildTower(game, pad, type) {
  const spot = game.pads[pad];
  const cost = buildCost(type);
  if (!spot || game.towers[pad] || game.gold < cost || game.phase === 'won' || game.phase === 'lost') return false;
  game.gold -= cost;
  game.stats.spent += cost;
  game.towers[pad] = { type, level: 1, pad, x: spot.x, y: spot.y, cooldown: 0, priority: 'first', spent: cost, buff: 0, aim: -Math.PI / 2, fired: 0 };
  updateBuffs(game);
  emit(game, 'build', spot.x, spot.y, cost, type);
  return true;
}

/** @param {Game} game @param {number} pad @returns {boolean} */
export function upgradeTower(game, pad) {
  const tower = game.towers[pad];
  const cost = tower ? upgradeCost(tower) : null;
  if (!tower || cost === null || game.gold < cost || game.phase === 'won' || game.phase === 'lost') return false;
  game.gold -= cost;
  game.stats.spent += cost;
  tower.spent += cost;
  tower.level += 1;
  updateBuffs(game);
  emit(game, 'upgrade', tower.x, tower.y, tower.level, tower.type);
  return true;
}

/** @param {Game} game @param {number} pad @returns {number} the gold given back (0: nothing sold) */
export function sellTower(game, pad) {
  const tower = game.towers[pad];
  if (!tower || game.phase === 'won' || game.phase === 'lost') return 0;
  const value = sellValue(tower);
  game.gold += value;
  game.towers[pad] = null;
  updateBuffs(game);
  emit(game, 'sell', tower.x, tower.y, value, tower.type);
  return value;
}

/** @param {Game} game @param {number} pad @param {Priority} priority */
export function setPriority(game, pad, priority) {
  const tower = game.towers[pad];
  if (tower) tower.priority = priority;
}

/**
 * Each tower's bonus from the strongest banner in whose range it stands (banners do not
 * buff each other or stack). Runs when towers change, not every step.
 * @param {Game} game
 */
export function updateBuffs(game) {
  for (const tower of game.towers) {
    if (!tower) continue;
    tower.buff = 0;
    if (tower.type === 'banner') continue;
    for (const banner of game.towers) {
      if (!banner || banner.type !== 'banner') continue;
      const range = TOWERS.banner.range[banner.level - 1] ?? 0;
      if ((banner.x - tower.x) ** 2 + (banner.y - tower.y) ** 2 > range * range) continue;
      tower.buff = Math.max(tower.buff, TOWERS.banner.buff?.[banner.level - 1] ?? 0);
    }
  }
}

/** @param {Game} game @param {boolean} paused */
export function setPaused(game, paused) {
  game.paused = paused && game.phase !== 'won' && game.phase !== 'lost';
}
