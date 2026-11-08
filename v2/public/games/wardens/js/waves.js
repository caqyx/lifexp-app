// @ts-check
// Strażnicy Doliny: the waves of each map. A wave is a few groups of one enemy type
// each, walking in at their own pace; the groups start a little apart so they mix.
// Everything here is a pure function of the map and the wave number: the same map
// always brings the same waves (the balance test relies on it).

/** @typedef {import('./config.js').EnemyType} EnemyType */
/** @typedef {{ types: readonly EnemyType[], waves: number, bosses: boolean, difficulty: number }} CustomWaves */
/** @typedef {import('./maps.js').MapDef} MapDef */
/** @typedef {{ type: EnemyType, count: number, gap: number, delay: number }} Group */
/** @typedef {{ number: number, groups: readonly Group[], boss: boolean }} Wave */
/** @typedef {{ at: number, type: EnemyType }} Spawn */

/** Seconds between the starts of a wave's groups. */
const GROUP_STAGGER = 2.6;

/**
 * What a map's style changes: when fliers and armor arrive and how many.
 * @param {MapDef['id']} id
 */
function styleOf(id) {
  if (id === 'canyon') return { mothFrom: 3, shellFrom: 7, splitFrom: 8, mothExtra: 1, shellExtra: 0, ...NEW_FROM.canyon };
  if (id === 'marsh') return { mothFrom: 5, shellFrom: 4, splitFrom: 7, mothExtra: 0, shellExtra: 1, ...NEW_FROM.marsh };
  return { mothFrom: 5, shellFrom: 6, splitFrom: 9, mothExtra: 0, shellExtra: 0, ...NEW_FROM.meadow };
}

/**
 * The wave from which each of the td-4 kinds joins a map's waves (Infinity: never on that
 * map before endless play). Each comes after the towers that counter it are affordable.
 */
const NEW_FROM = {
  meadow: { batFrom: 7, berserkFrom: 10, shieldFrom: 12, ironFrom: Infinity, shamanFrom: Infinity, burrowFrom: Infinity },
  canyon: { batFrom: 9, berserkFrom: Infinity, shieldFrom: 6, ironFrom: 14, shamanFrom: 12, burrowFrom: 10 },
  marsh: { batFrom: 9, berserkFrom: 14, shieldFrom: 7, ironFrom: 8, shamanFrom: 10, burrowFrom: 12 },
};

/**
 * The boss of a boss wave: the Colossus, but on the marsh the Brood mother comes at three
 * fifths of the way, and in endless play they take turns.
 * @param {MapDef} map @param {number} n @returns {EnemyType}
 */
export function bossOf(map, n) {
  if (n > map.waves) return ((n - map.waves) / 5) % 2 === 1 ? 'broodmother' : 'colossus';
  return map.id === 'marsh' && n < map.waves ? 'broodmother' : 'colossus';
}

/**
 * The waves at which a boss comes: the last one and one at about three fifths of
 * the way; in endless play every fifth wave after the map's last.
 * @param {MapDef} map @param {number} n
 */
export function isBossWave(map, n) {
  if (n > map.waves) return (n - map.waves) % 5 === 0;
  return n === map.waves || n === Math.ceil(map.waves * 0.6);
}

/**
 * Wave `n` (from 1) of a map; past the map's last wave (endless play) the same rules
 * go on with the counts capped and the health still growing.
 * @param {MapDef} map @param {number} n @returns {Wave}
 */
export function createWave(map, n) {
  const style = styleOf(map.id);
  const boss = isBossWave(map, n);
  const swarm = !boss && n % 4 === 0;
  /** @type {Group[]} */
  const groups = [];
  /** @param {EnemyType} type @param {number} count @param {number} gap */
  const add = (type, count, gap) => {
    if (count > 0) groups.push({ type, count, gap, delay: groups.length * GROUP_STAGGER });
  };
  if (!swarm) add('crawler', Math.min(16, 5 + n), Math.max(0.55, 1.05 - n * 0.025));
  if (n >= 3) add('runner', Math.min(18, (2 + Math.floor(n / 2)) * (swarm ? 2 : 1)), swarm ? 0.45 : 0.7);
  if (n >= style.mothFrom && (n % 2 === 1 || style.mothExtra > 0)) add('moth', Math.min(12, 2 + Math.floor(n / 3) + style.mothExtra), 0.9);
  if (n >= style.shellFrom) add('shellback', Math.min(9, 1 + Math.floor((n - style.shellFrom) / 2) + style.shellExtra), 1.6);
  if (n >= style.splitFrom) add('splitter', Math.min(8, 2 + Math.floor((n - style.splitFrom) / 2)), 1.3);
  const endless = n > map.waves;
  const since = (/** @type {number} */ from) => (endless ? n - Math.min(from, map.waves) : n - from);
  if (n >= style.shieldFrom || endless) add('shieldbearer', Math.min(6, 1 + Math.floor(since(style.shieldFrom) / 3)), 2.2);
  if ((n >= style.batFrom || endless) && n % 2 === 0) add('bat', Math.min(14, 4 + since(style.batFrom)), 0.28);
  if (n >= style.ironFrom || endless) add('ironclad', Math.min(5, 1 + Math.floor(since(style.ironFrom) / 3)), 2.6);
  if ((n >= style.shamanFrom || endless) && n % 3 !== 1) add('shaman', Math.min(3, 1 + Math.floor(since(style.shamanFrom) / 4)), 3);
  if (n >= style.burrowFrom || endless) add('burrower', Math.min(8, 2 + Math.floor(since(style.burrowFrom) / 2)), 1.1);
  if ((n >= style.berserkFrom || endless) && n % 2 === 1) add('berserker', Math.min(6, 1 + Math.floor(since(style.berserkFrom) / 2)), 1.8);
  if (boss) {
    const kind = bossOf(map, n);
    add(kind, kind === 'colossus' && map.id === 'marsh' && n >= map.waves ? 2 : 1, 6);
  }
  return { number: n, groups, boss };
}

/**
 * The wave's spawns in time order (from the wave's start, in seconds).
 * @param {Wave} wave @returns {Spawn[]}
 */
export function createSpawns(wave) {
  /** @type {Spawn[]} */
  const spawns = [];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) spawns.push({ at: group.delay + i * group.gap, type: group.type });
  }
  return spawns.sort((a, b) => a.at - b.at);
}

/**
 * The preview of a wave: how many of each type, in the order they first come.
 * @param {Wave} wave @returns {{ type: EnemyType, count: number }[]}
 */
export function describeWave(wave) {
  /** @type {{ type: EnemyType, count: number }[]} */
  const rows = [];
  for (const group of wave.groups) {
    const row = rows.find((r) => r.type === group.type);
    if (row) row.count += group.count;
    else rows.push({ type: group.type, count: group.count });
  }
  return rows;
}

/**
 * A custom game's wave `n` from the player's choice of kinds: deterministic (the same choice
 * always brings the same waves). The kinds join one by one in the order given (a new one
 * every two waves), counts grow with the wave, every fifth wave and the last bring a boss
 * when bosses are on, and the health factor is the game's (difficulty) business.
 * @param {CustomWaves} custom @param {number} n @returns {Wave}
 */
export function createCustomWave(custom, n) {
  const types = custom.types.length > 0 ? custom.types : /** @type {readonly EnemyType[]} */ (['crawler']);
  const boss = custom.bosses && (n % 5 === 0 || n === custom.waves);
  /** @type {Group[]} */
  const groups = [];
  const joined = Math.min(types.length, 1 + Math.floor((n - 1) / 2));
  for (let i = 0; i < joined; i++) {
    const type = /** @type {EnemyType} */ (types[(i + n - 1) % types.length]);
    const age = n - 1 - i * 2;
    const flock = type === 'bat';
    const count = Math.min(flock ? 16 : 12, (flock ? 5 : 3) + Math.floor(age * (flock ? 1 : 0.7)));
    groups.push({ type, count, gap: CUSTOM_GAP[type] ?? 1, delay: groups.length * GROUP_STAGGER });
  }
  if (boss) {
    const kind = /** @type {EnemyType} */ (Math.floor(n / 5) % 2 === 1 ? 'colossus' : 'broodmother');
    groups.push({ type: kind, count: 1, gap: 6, delay: groups.length * GROUP_STAGGER });
  }
  return { number: n, groups, boss };
}

/** Seconds between two of a kind in a custom wave. */
const CUSTOM_GAP = /** @type {Partial<Record<EnemyType, number>>} */ ({
  crawler: 0.9, runner: 0.6, shellback: 1.6, moth: 0.9, splitter: 1.3, ironclad: 2.4,
  shieldbearer: 2, shaman: 3, bat: 0.28, burrower: 1.1, berserker: 1.6,
});
