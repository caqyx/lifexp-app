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
import { createCustomWave, createSpawns, createWave } from './waves.js';

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
 *   wave: number, px: number, py: number,
 *   baseSpeed: number, shield: number, buried: boolean,
 *   burnDps: number, burnLeft: number, poisonDps: number, poisonLeft: number,
 *   shred: number, shredLeft: number, healCd: number, brood: number,
 * }} Enemy
 * @typedef {{
 *   type: TowerType, level: number, pad: number, x: number, y: number,
 *   cooldown: number, priority: Priority, spent: number, buff: number,
 *   aim: number, fired: number, shots: number,
 * }} Tower
 * @typedef {{
 *   alive: boolean, kind: 'arrow' | 'shell' | 'bolt' | 'flask', x: number, y: number,
 *   sx: number, sy: number, tx: number, ty: number, targetSlot: number, targetId: number,
 *   speed: number, damage: number, pierce: boolean, radius: number, t: number, flight: number,
 *   px: number, py: number, level: number,
 * }} Projectile
 * @typedef {'hit' | 'kill' | 'leak' | 'shot' | 'pulse' | 'blast' | 'build' | 'upgrade' | 'sell' | 'wave' | 'cleared' | 'early'
 *   | 'flame' | 'chain' | 'snipe' | 'splash' | 'heal' | 'shieldBreak' | 'burrow' | 'surface' | 'brood'} EventType
 * @typedef {{ type: EventType, x: number, y: number, value: number, kind: string, x2: number, y2: number }} GameEvent
 * @typedef {'build' | 'wave' | 'won' | 'lost'} Phase
 * @typedef {import('./waves.js').CustomWaves} CustomWaves
 * @typedef {{
 *   endless?: boolean, lives?: number, gold?: number, waves?: number, start?: number,
 *   custom?: CustomWaves | null, infiniteGold?: boolean, difficulty?: number,
 * }} GameOptions
 * (custom: a custom game's own waves from the player's choice of kinds; infiniteGold: towers
 * cost nothing; difficulty: enemy health × this.)
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
    flash: 0, wave: 0, px: 0, py: 0,
    baseSpeed: 0, shield: 0, buried: false, burnDps: 0, burnLeft: 0, poisonDps: 0, poisonLeft: 0,
    shred: 0, shredLeft: 0, healCd: 0, brood: 0,
  };
}

/** @returns {Projectile} */
function createProjectileSlot() {
  return {
    alive: false, kind: 'arrow', x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, targetSlot: -1, targetId: 0,
    speed: 0, damage: 0, pierce: false, radius: 0, t: 0, flight: 0, px: 0, py: 0, level: 1,
  };
}

/** @returns {GameEvent} */
function createEventSlot() {
  return { type: 'hit', x: 0, y: 0, value: 0, kind: '', x2: 0, y2: 0 };
}

/**
 * A new game on a map. `waves` and `lives`/`gold` exist for the test switches only.
 * @param {MapDef} map @param {GameOptions} [options]
 */
export function createGame(map, options = {}) {
  const custom = options.custom ?? null;
  const endless = !custom && options.endless === true && map.endless === true;
  const ownWaves = custom ? custom.waves : map.waves;
  const totalWaves = endless ? Infinity : Math.max(1, Math.min(ownWaves, options.waves ?? ownWaves));
  const skipped = Math.max(0, Math.min((options.start ?? 1) - 1, endless ? 199 : totalWaves - 1));
  const game = {
    map,
    path: createPath(map),
    endless,
    /** A custom game's wave rules (null: the map's own waves). */
    custom,
    /** Towers cost nothing (custom mode). */
    infiniteGold: options.infiniteGold === true,
    /** Enemy health × this (custom mode). */
    difficulty: options.difficulty ?? 1,
    totalWaves,
    phase: /** @type {Phase} */ ('build'),
    paused: false,
    time: 0,
    gold: options.gold ?? map.startGold,
    lives: options.lives ?? START_LIVES,
    startLives: options.lives ?? START_LIVES,
    /** Waves started and waves cleared. */
    wave: skipped,
    cleared: skipped,
    waveTime: 0,
    /** Seconds until the next wave starts by itself; −1 = it waits for the player. */
    countdown: -1,
    spawns: /** @type {Spawn[]} */ ([]),
    spawnCursor: 0,
    nextWave: /** @type {Wave | null} */ (null),
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
  game.nextWave = waveFor(game, skipped + 1);
  return game;
}

/**
 * Wave `n` of a game: the map's own, or a custom game's from the chosen kinds.
 * @param {{ map: MapDef, custom: CustomWaves | null }} game @param {number} n @returns {Wave}
 */
export function waveFor(game, n) {
  return game.custom ? createCustomWave(game.custom, n) : createWave(game.map, n);
}

/** @typedef {ReturnType<typeof createGame>} Game */

// ── Events (read by the renderer, never by the rules) ───────────────────────

/** @param {Game} game @param {EventType} type @param {number} x @param {number} y @param {number} value @param {string} kind @param {number} [x2] @param {number} [y2] */
function emit(game, type, x, y, value, kind, x2 = 0, y2 = 0) {
  const event = /** @type {GameEvent} */ (game.events[game.eventSeq % EVENT_RING]);
  event.type = type;
  event.x = x;
  event.y = y;
  event.value = value;
  event.kind = kind;
  event.x2 = x2;
  event.y2 = y2;
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
  return Math.round(ENEMIES[type].hp * linear * endless * game.map.hpFactor * game.difficulty);
}

/**
 * Puts an enemy on the road `dist` tiles from its start (0 = the entrance).
 * @param {Game} game @param {EnemyType} type @param {number} dist @param {number} wave
 */
export function spawnEnemy(game, type, dist, wave) {
  const enemy = freeSlot(game.enemies);
  if (!enemy) return;
  const def = ENEMIES[type];
  enemy.alive = true;
  enemy.id = game.nextEnemyId++;
  enemy.type = type;
  enemy.maxHp = enemy.hp = enemyHp(game, type, wave);
  enemy.dist = Math.max(0, dist);
  enemy.speed = enemy.baseSpeed = def.speed;
  enemy.shield = def.shield ?? 0;
  enemy.buried = false;
  enemy.burnDps = enemy.burnLeft = enemy.poisonDps = enemy.poisonLeft = 0;
  enemy.shred = enemy.shredLeft = 0;
  enemy.healCd = def.heal ? def.heal.every : 0;
  enemy.brood = 0;
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
  enemy.px = enemy.x;
  enemy.py = enemy.y;
  game.aliveCount += 1;
}

/** @param {Game} game @param {number} dt */
function updateEnemies(game, dt) {
  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    enemy.px = enemy.x;
    enemy.py = enemy.y;
    updateSlow(enemy, dt);
    if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);
    const def = ENEMIES[enemy.type];
    if (def.rage) enemy.speed = enemy.baseSpeed * (1 + def.rage * (1 - Math.max(0, enemy.hp) / enemy.maxHp));
    enemy.dist += enemy.speed * enemy.slowFactor * dt;
    if (enemy.dist >= game.path.total) {
      leakEnemy(game, enemy);
      continue;
    }
    pointAt(game.path, enemy.dist, enemy);
    if (def.burrow) updateBurrow(game, enemy, def.burrow);
    if (def.heal) updateHeal(game, enemy, def.heal, dt);
    if (!updateEffects(game, enemy, dt)) continue;
  }
}

/**
 * A burrower is under the road between two shares of the road's length: nothing can hit it.
 * @param {Game} game @param {Enemy} enemy @param {readonly [number, number]} span
 */
function updateBurrow(game, enemy, span) {
  const under = enemy.dist >= span[0] * game.path.total && enemy.dist < span[1] * game.path.total;
  if (under === enemy.buried) return;
  enemy.buried = under;
  emit(game, under ? 'burrow' : 'surface', enemy.x, enemy.y, 0, enemy.type);
}

/**
 * A healer mends everyone near it (itself too) every few seconds; the poisoned are not
 * mended. @param {Game} game @param {Enemy} healer @param {{ every: number, share: number, range: number }} heal @param {number} dt
 */
function updateHeal(game, healer, heal, dt) {
  healer.healCd -= dt;
  if (healer.healCd > 0) return;
  healer.healCd = heal.every;
  const r2 = heal.range * heal.range;
  let mended = 0;
  for (const other of game.enemies) {
    if (!other.alive || other.poisonLeft > 0 || other.hp >= other.maxHp) continue;
    if ((other.x - healer.x) ** 2 + (other.y - healer.y) ** 2 > r2) continue;
    other.hp = Math.min(other.maxHp, other.hp + other.maxHp * heal.share);
    mended += 1;
  }
  if (mended > 0) emit(game, 'heal', healer.x, healer.y, heal.range, healer.type);
}

/**
 * Burning and poison (both through armor) and the acid on its armor wearing off. Returns
 * false when the enemy died of them. @param {Game} game @param {Enemy} enemy @param {number} dt
 */
function updateEffects(game, enemy, dt) {
  if (enemy.shredLeft > 0) {
    enemy.shredLeft -= dt;
    if (enemy.shredLeft <= 0) enemy.shred = enemy.shredLeft = 0;
  }
  let dot = 0;
  if (enemy.burnLeft > 0) {
    dot += enemy.burnDps * Math.min(dt, enemy.burnLeft);
    enemy.burnLeft -= dt;
  }
  if (enemy.poisonLeft > 0) {
    dot += enemy.poisonDps * Math.min(dt, enemy.poisonLeft);
    enemy.poisonLeft -= dt;
  }
  if (dot <= 0) return true;
  enemy.hp -= dot;
  if (enemy.hp > 0) {
    afterHurt(game, enemy);
    return true;
  }
  killEnemy(game, enemy);
  return false;
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
  if (enemy.buried) return false;
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
  tower.shots += 1;
  if (def.attack === 'flame') fireFlame(game, tower, damage);
  else if (def.attack === 'chain') fireChain(game, tower, slot, damage);
  else if (def.attack === 'snipe') {
    const crit = def.critEvery !== undefined && tower.shots % def.critEvery === 0;
    const amount = crit ? damage * (def.critMultiplier ?? 1) : damage;
    emit(game, 'snipe', target.x, target.y, crit ? 1 : 0, tower.type, tower.x, tower.y);
    applyDamage(game, target, amount, false, 'snipe');
  } else if (def.attack === 'shell' || def.attack === 'flask') {
    const flight = def.flight ?? 0.7;
    pointAt(game.path, Math.min(game.path.total, target.dist + target.speed * target.slowFactor * flight), scratch);
    launchProjectile(game, def.attack, tower, scratch.x, scratch.y, -1, 0, damage, false, def.radius?.[lvl] ?? 1, flight, 0);
  } else {
    const kind = def.attack === 'bolt' ? 'bolt' : 'arrow';
    launchProjectile(game, kind, tower, target.x, target.y, slot, target.id, damage, def.pierceArmor === true, 0, 0, def.projectileSpeed ?? 12);
  }
  emit(game, 'shot', tower.x, tower.y, tower.aim, tower.type);
  return true;
}

/**
 * The flamer: everything on the ground in a cone toward the aim, within range, is hit and
 * set burning. @param {Game} game @param {Tower} tower @param {number} damage
 */
function fireFlame(game, tower, damage) {
  const def = TOWERS[tower.type];
  const lvl = tower.level - 1;
  const range = def.range[lvl] ?? 0;
  const cos = Math.cos(def.cone ?? 0.5);
  const ax = Math.cos(tower.aim);
  const ay = Math.sin(tower.aim);
  const burn = (def.burnDps?.[lvl] ?? 0) * (1 + tower.buff);
  for (const enemy of game.enemies) {
    if (!enemy.alive || !canHit(def, enemy)) continue;
    const dx = enemy.x - tower.x;
    const dy = enemy.y - tower.y;
    const d = Math.hypot(dx, dy);
    if (d > range + enemy.radius || (d > 0.3 && (dx * ax + dy * ay) / d < cos)) continue;
    enemy.burnDps = Math.max(enemy.burnDps, burn);
    enemy.burnLeft = Math.max(enemy.burnLeft, def.burnTime ?? 0);
    applyDamage(game, enemy, damage, false, 'flame');
  }
  emit(game, 'flame', tower.x, tower.y, tower.aim, tower.type, range, 0);
}

/**
 * The tesla: lightning hits the target and jumps on to the nearest enemy not yet hit,
 * weaker at each jump. @param {Game} game @param {Tower} tower @param {number} slot @param {number} damage
 */
function fireChain(game, tower, slot, damage) {
  const def = TOWERS[tower.type];
  const jumps = def.jumps?.[tower.level - 1] ?? 0;
  const r2 = (def.jumpRange ?? 1) ** 2;
  let current = /** @type {Enemy} */ (game.enemies[slot]);
  let fromX = tower.x;
  let fromY = tower.y;
  let amount = damage;
  const hitIds = chainHit;
  hitIds.length = 0;
  for (let j = 0; j <= jumps; j++) {
    hitIds.push(current.id);
    emit(game, 'chain', current.x, current.y, j, tower.type, fromX, fromY);
    fromX = current.x;
    fromY = current.y;
    applyDamage(game, current, amount, false, 'chain');
    amount *= def.jumpFalloff ?? 1;
    let next = null;
    let best = Infinity;
    for (const enemy of game.enemies) {
      if (!enemy.alive || !canHit(def, enemy) || hitIds.includes(enemy.id)) continue;
      const d2 = (enemy.x - fromX) ** 2 + (enemy.y - fromY) ** 2;
      if (d2 <= r2 && d2 < best) {
        best = d2;
        next = enemy;
      }
    }
    if (!next) break;
    current = next;
  }
}

/** The ids hit by one chain of lightning (reused: no allocation per shot). */
const chainHit = /** @type {number[]} */ ([]);

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
    applyDamage(game, enemy, damage, false, 'pulse');
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

/** Attacks that a shield swallows (until it breaks), and those that break it at once. */
const SHIELD_BLOCKS = new Set(['arrow', 'bolt', 'snipe']);
const SHIELD_BREAKS = new Set(['shell', 'flame', 'chain', 'flask']);

/**
 * One hit: a shield first (it swallows arrows, bolts and shots; a blast, fire, lightning
 * or a flask breaks it), then armor (less any acid on it), at least 1 gets through.
 * @param {Game} game @param {Enemy} enemy @param {number} raw @param {boolean} pierce @param {string} kind
 */
function applyDamage(game, enemy, raw, pierce, kind) {
  if (enemy.shield > 0) {
    if (SHIELD_BREAKS.has(kind)) {
      enemy.shield = 0;
      emit(game, 'shieldBreak', enemy.x, enemy.y, 0, enemy.type);
    } else if (SHIELD_BLOCKS.has(kind)) {
      enemy.shield = Math.max(0, enemy.shield - raw);
      enemy.flash = FLASH_TIME;
      emit(game, enemy.shield > 0 ? 'hit' : 'shieldBreak', enemy.x, enemy.y, 0, enemy.type);
      return;
    }
  }
  const amount = damageAfterArmor(raw, Math.max(0, enemy.armor - enemy.shred), pierce);
  enemy.hp -= amount;
  enemy.flash = FLASH_TIME;
  emit(game, 'hit', enemy.x, enemy.y, amount, enemy.type);
  if (enemy.hp <= 0) killEnemy(game, enemy);
  else afterHurt(game, enemy);
}

/**
 * What an enemy does when it loses health: a brood mother drops her young each time she
 * loses another share of it. @param {Game} game @param {Enemy} enemy
 */
function afterHurt(game, enemy) {
  const brood = ENEMIES[enemy.type].brood;
  if (!brood) return;
  const reached = Math.floor((1 - enemy.hp / enemy.maxHp) * brood.steps);
  while (enemy.brood < reached && enemy.brood < brood.steps - 1) {
    enemy.brood += 1;
    for (let i = 0; i < brood.count; i++) spawnEnemy(game, brood.type, enemy.dist - 0.25 * (i + 1), enemy.wave);
    emit(game, 'brood', enemy.x, enemy.y, brood.count, enemy.type);
  }
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
  p.x = p.sx = p.px = from.x;
  p.y = p.sy = p.py = from.y;
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
  p.level = from.level;
}

/** @param {Game} game @param {number} dt */
function updateProjectiles(game, dt) {
  for (const p of game.projectiles) {
    if (!p.alive) continue;
    p.px = p.x;
    p.py = p.y;
    if (p.kind === 'shell' || p.kind === 'flask') updateShell(game, p, dt);
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
  const flask = p.kind === 'flask';
  const def = TOWERS.alchemist;
  const lvl = p.level - 1;
  for (const enemy of game.enemies) {
    if (!enemy.alive || enemy.flying || enemy.buried) continue;
    if ((enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2 > r2) continue;
    if (flask) {
      enemy.poisonDps = Math.max(enemy.poisonDps, def.poisonDps?.[lvl] ?? 0);
      enemy.poisonLeft = Math.max(enemy.poisonLeft, def.poisonTime ?? 0);
      enemy.shred = Math.max(enemy.shred, def.shred?.[lvl] ?? 0);
      enemy.shredLeft = Math.max(enemy.shredLeft, def.shredTime ?? 0);
    }
    applyDamage(game, enemy, p.damage, false, p.kind);
  }
  emit(game, flask ? 'splash' : 'blast', p.x, p.y, p.radius, flask ? 'alchemist' : 'mortar');
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
  if (tracking && !target.buried) applyDamage(game, target, p.damage, p.pierce, p.kind);
}

// ── Waves ───────────────────────────────────────────────────────────────────

/** @param {Game} game */
function startWave(game) {
  game.wave += 1;
  game.stats.bestWave = Math.max(game.stats.bestWave, game.wave);
  const wave = waveFor(game, game.wave);
  game.spawns = createSpawns(wave);
  game.spawnCursor = 0;
  game.waveTime = 0;
  game.countdown = -1;
  game.phase = 'wave';
  game.nextWave = game.wave < game.totalWaves ? waveFor(game, game.wave + 1) : null;
  emit(game, 'wave', 0, 0, game.wave, wave.boss ? (wave.groups.some((g) => g.type === 'broodmother') ? 'brood' : 'boss') : '');
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

/** Whether the player can pay a price (always, with infinite gold). @param {Game} game @param {number} cost */
export function canPay(game, cost) {
  return game.infiniteGold || game.gold >= cost;
}

/** @param {Game} game @param {number} cost */
function pay(game, cost) {
  if (!game.infiniteGold) game.gold -= cost;
}

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
  if (!spot || game.towers[pad] || !canPay(game, cost) || game.phase === 'won' || game.phase === 'lost') return false;
  pay(game, cost);
  game.stats.spent += cost;
  game.towers[pad] = { type, level: 1, pad, x: spot.x, y: spot.y, cooldown: 0, priority: 'first', spent: cost, buff: 0, aim: -Math.PI / 2, fired: 0, shots: 0 };
  updateBuffs(game);
  emit(game, 'build', spot.x, spot.y, cost, type);
  return true;
}

/** @param {Game} game @param {number} pad @returns {boolean} */
export function upgradeTower(game, pad) {
  const tower = game.towers[pad];
  const cost = tower ? upgradeCost(tower) : null;
  if (!tower || cost === null || !canPay(game, cost) || game.phase === 'won' || game.phase === 'lost') return false;
  pay(game, cost);
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
