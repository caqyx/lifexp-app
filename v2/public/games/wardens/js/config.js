// @ts-check
// Strażnicy Doliny (Valley Wardens): every number of the game in one place — towers,
// enemies, the economy and the clock. Pure data; js/sim.js reads it. The balance these
// numbers give is checked by v2/tests/wardens-balance.test.ts (a scripted build wins
// every map, doing nothing loses) and documented in docs/v2/PLAN.md 9.1 (td-1).

/** One simulation step, in seconds (fixed timestep: the same run gives the same result). */
export const DT = 1 / 60;
/** At most this many steps per animation frame (a stalled tab does not fast-forward). */
export const MAX_STEPS_PER_FRAME = 240;

export const START_LIVES = 20;
/** Seconds between a cleared wave and the next one starting by itself. */
export const BREAK_SECONDS = 25;
/** Gold for every whole second left on the break when the player calls the wave early. */
export const EARLY_GOLD_PER_SECOND = 1;
/** A sold tower gives back this share of what was spent on it. */
export const SELL_REFUND = 0.7;
/** Lives left at the end that earn three and two stars (one star: any win). */
export const STAR_LIVES = { three: 18, two: 10 };

/** @typedef {'archer' | 'mortar' | 'frost' | 'ballista' | 'banner' | 'flamer' | 'tesla' | 'sniper' | 'alchemist'} TowerType */
/** @typedef {'first' | 'strongest' | 'closest'} Priority */
/**
 * One tower type, by level (index 0 = level 1). Ranges and radii in tiles, times in seconds.
 * @typedef {{
 *   cost: readonly number[],
 *   range: readonly number[],
 *   interval: readonly number[],
 *   damage: readonly number[],
 *   hitsGround: boolean,
 *   hitsAir: boolean,
 *   attack: 'arrow' | 'shell' | 'pulse' | 'bolt' | 'aura' | 'flame' | 'chain' | 'snipe' | 'flask',
 *   projectileSpeed?: number,
 *   flight?: number,
 *   radius?: readonly number[],
 *   slow?: readonly number[],
 *   slowTime?: readonly number[],
 *   pierceArmor?: boolean,
 *   buff?: readonly number[],
 *   cone?: number,
 *   burnDps?: readonly number[],
 *   burnTime?: number,
 *   jumps?: readonly number[],
 *   jumpRange?: number,
 *   jumpFalloff?: number,
 *   critEvery?: number,
 *   critMultiplier?: number,
 *   poisonDps?: readonly number[],
 *   poisonTime?: number,
 *   shred?: readonly number[],
 *   shredTime?: number,
 * }} TowerDef
 */

export const TOWER_TYPES = /** @type {const} */ (['archer', 'mortar', 'frost', 'ballista', 'banner', 'flamer', 'tesla', 'sniper', 'alchemist']);
export const LEVELS = 3;
export const PRIORITIES = /** @type {const} */ (['first', 'strongest', 'closest']);

/** @type {Readonly<Record<TowerType, TowerDef>>} */
export const TOWERS = {
  // Fast single target, hits fliers; weak against armor.
  archer: {
    cost: [45, 40, 70],
    range: [2.4, 2.6, 2.9],
    interval: [0.5, 0.42, 0.34],
    damage: [6, 9, 13],
    hitsGround: true,
    hitsAir: true,
    attack: 'arrow',
    projectileSpeed: 14,
  },
  // Slow splash on the ground; cannot reach fliers.
  mortar: {
    cost: [75, 65, 110],
    range: [2.9, 3.1, 3.4],
    interval: [1.9, 1.75, 1.6],
    damage: [15, 24, 38],
    radius: [0.95, 1.05, 1.2],
    hitsGround: true,
    hitsAir: false,
    attack: 'shell',
    flight: 0.7,
  },
  // A pulse that slows everything around it (bosses resist half) and scratches it.
  frost: {
    cost: [55, 50, 80],
    range: [1.9, 2.1, 2.35],
    interval: [1.1, 1.0, 0.9],
    damage: [2, 4, 6],
    slow: [0.35, 0.45, 0.55],
    slowTime: [1.4, 1.7, 2.0],
    hitsGround: true,
    hitsAir: true,
    attack: 'pulse',
  },
  // Long range, heavy, through armor; slow to reload.
  ballista: {
    cost: [95, 85, 140],
    range: [4.0, 4.5, 5.0],
    interval: [2.1, 1.9, 1.7],
    damage: [40, 64, 100],
    hitsGround: true,
    hitsAir: true,
    attack: 'bolt',
    projectileSpeed: 20,
    pierceArmor: true,
  },
  // Does not attack: towers in its range hit harder (the strongest banner counts, no stacking).
  banner: {
    cost: [65, 60, 95],
    range: [1.6, 1.8, 2.05],
    interval: [0, 0, 0],
    damage: [0, 0, 0],
    buff: [0.25, 0.35, 0.5],
    hitsGround: false,
    hitsAir: false,
    attack: 'aura',
  },
  // A short cone of fire on the ground: everything in it burns for a while (the burn goes
  // through armor) and shields catch fire and fall. Good against crowds and shields.
  flamer: {
    cost: [70, 60, 95],
    range: [1.55, 1.7, 1.9],
    interval: [0.35, 0.32, 0.28],
    damage: [3, 5, 8],
    cone: 0.6,
    burnDps: [5, 8, 13],
    burnTime: 2,
    hitsGround: true,
    hitsAir: false,
    attack: 'flame',
  },
  // Lightning that jumps from enemy to enemy (fliers too), weaker at each jump; it
  // breaks shields. Good against swarms of bats and shards.
  tesla: {
    cost: [90, 80, 125],
    range: [2.3, 2.5, 2.7],
    interval: [1.0, 0.9, 0.8],
    damage: [14, 21, 32],
    jumps: [3, 4, 6],
    jumpRange: 1.4,
    jumpFalloff: 0.8,
    hitsGround: true,
    hitsAir: true,
    attack: 'chain',
  },
  // A nest with a long gun: very long range, hits at once, every third shot is critical.
  // For healers far down the road and for bosses. Armor counts.
  sniper: {
    cost: [110, 90, 150],
    range: [5.5, 6.2, 7.0],
    interval: [2.4, 2.1, 1.8],
    damage: [36, 56, 88],
    critEvery: 3,
    critMultiplier: 2.5,
    hitsGround: true,
    hitsAir: true,
    attack: 'snipe',
  },
  // Lobs a flask: poison (through armor, and the poisoned cannot be healed) and acid that
  // eats armor for a while. Against armored and healed enemies.
  alchemist: {
    cost: [80, 70, 110],
    range: [2.6, 2.8, 3.1],
    interval: [1.6, 1.45, 1.3],
    damage: [6, 9, 14],
    radius: [0.75, 0.85, 1.0],
    poisonDps: [6, 10, 16],
    poisonTime: 3,
    shred: [4, 6, 9],
    shredTime: 4,
    hitsGround: true,
    hitsAir: false,
    attack: 'flask',
    flight: 0.6,
  },
};

/**
 * @typedef {'crawler' | 'runner' | 'shellback' | 'moth' | 'splitter' | 'shard' | 'colossus'
 *   | 'ironclad' | 'shieldbearer' | 'shaman' | 'bat' | 'burrower' | 'berserker' | 'broodmother'} EnemyType
 */
/**
 * One enemy type. Speed in tiles a second; armor is taken off every hit (at least 1 gets
 * through) unless the attack pierces it; `lives` is what it costs when it gets through.
 * @typedef {{
 *   hp: number,
 *   speed: number,
 *   armor: number,
 *   gold: number,
 *   lives: number,
 *   radius: number,
 *   flying?: boolean,
 *   boss?: boolean,
 *   slowResist?: number,
 *   splits?: { type: EnemyType, count: number },
 *   shield?: number,
 *   heal?: { every: number, share: number, range: number },
 *   burrow?: readonly [number, number],
 *   rage?: number,
 *   brood?: { type: EnemyType, count: number, steps: number },
 * }} EnemyDef
 */

export const ENEMY_TYPES = /** @type {const} */ ([
  'crawler', 'runner', 'shellback', 'moth', 'splitter', 'shard', 'colossus',
  'ironclad', 'shieldbearer', 'shaman', 'bat', 'burrower', 'berserker', 'broodmother',
]);
/** The kinds added with td-4 (each has its counters; see PLAN.md 9.1 td-4). */
export const NEW_ENEMY_TYPES = /** @type {const} */ (['ironclad', 'shieldbearer', 'shaman', 'bat', 'burrower', 'berserker', 'broodmother']);
/** The kinds a player can pick for a custom game (shards come from splitters, bosses are a switch). */
export const PICKABLE_ENEMIES = /** @type {const} */ (['crawler', 'runner', 'shellback', 'moth', 'splitter', 'ironclad', 'shieldbearer', 'shaman', 'bat', 'burrower', 'berserker']);
export const BOSS_TYPES = /** @type {const} */ (['colossus', 'broodmother']);

/** @type {Readonly<Record<EnemyType, EnemyDef>>} */
export const ENEMIES = {
  crawler: { hp: 30, speed: 1.0, armor: 0, gold: 4, lives: 1, radius: 0.26 },
  runner: { hp: 18, speed: 1.9, armor: 0, gold: 4, lives: 1, radius: 0.22 },
  shellback: { hp: 70, speed: 0.72, armor: 5, gold: 8, lives: 1, radius: 0.32 },
  moth: { hp: 26, speed: 1.3, armor: 0, gold: 5, lives: 1, radius: 0.26, flying: true },
  splitter: { hp: 48, speed: 0.9, armor: 0, gold: 4, lives: 1, radius: 0.3, splits: { type: 'shard', count: 2 } },
  shard: { hp: 16, speed: 1.45, armor: 0, gold: 2, lives: 1, radius: 0.18 },
  colossus: { hp: 420, speed: 0.42, armor: 4, gold: 60, lives: 5, radius: 0.46, boss: true, slowResist: 0.5 },
  // Plated slime: very high armor, slow. Counters: ballista (through armor), alchemist
  // (acid eats its armor), flamer and poison burns (through armor).
  ironclad: { hp: 95, speed: 0.6, armor: 12, gold: 11, lives: 2, radius: 0.34 },
  // Carries a shield that swallows arrows, bolts and shots until it breaks; a blast, fire,
  // lightning or a flask breaks it at once. Counters: mortar, flamer, tesla, alchemist.
  shieldbearer: { hp: 55, speed: 0.85, armor: 1, gold: 8, lives: 1, radius: 0.3, shield: 80 },
  // Heals everyone near it every few seconds (not the poisoned). Counters: sniper (reaches
  // it far down the road), alchemist (poison stops the healing), tesla.
  shaman: { hp: 45, speed: 0.8, armor: 0, gold: 9, lives: 1, radius: 0.27, heal: { every: 2.5, share: 0.12, range: 1.6 } },
  // Fast fliers in big flocks. Counters: tesla (jumps between them), frost, archers.
  bat: { hp: 11, speed: 2.3, armor: 0, gold: 2, lives: 1, radius: 0.18, flying: true },
  // Digs under the road for a stretch of it (nothing can hit it there). Counters: towers
  // after the stretch, the sniper's reach, frost before it digs.
  burrower: { hp: 60, speed: 1.15, armor: 2, gold: 7, lives: 1, radius: 0.27, burrow: [0.3, 0.55] },
  // Runs faster the more it is hurt (up to twice as fast). Counters: frost, the sniper's
  // and the ballista's single heavy hits (it dies before it rages).
  berserker: { hp: 80, speed: 0.9, armor: 2, gold: 9, lives: 2, radius: 0.3, rage: 1.0 },
  // A boss: a huge slime mother that drops crawlers each time it loses a quarter of its
  // health. Counters: splash (mortar, flamer) for the brood, heavy hits for her.
  broodmother: { hp: 520, speed: 0.38, armor: 3, gold: 70, lives: 5, radius: 0.48, boss: true, slowResist: 0.5, brood: { type: 'crawler', count: 3, steps: 4 } },
};

/** Enemy health grows with the wave: hp × (1 + HP_GROWTH × (wave − 1)) × the map's factor. */
export const HP_GROWTH = 0.25;
/** Gold for clearing a wave: WAVE_BONUS_BASE + WAVE_BONUS_STEP × wave. */
export const WAVE_BONUS_BASE = 12;
export const WAVE_BONUS_STEP = 2;
