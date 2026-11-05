// @ts-check
// Strażnicy Doliny: the waves of each map. A wave is a few groups of one enemy type
// each, walking in at their own pace; the groups start a little apart so they mix.
// Everything here is a pure function of the map and the wave number: the same map
// always brings the same waves (the balance test relies on it).

/** @typedef {import('./config.js').EnemyType} EnemyType */
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
  if (id === 'canyon') return { mothFrom: 3, shellFrom: 7, splitFrom: 8, mothExtra: 1, shellExtra: 0 };
  if (id === 'marsh') return { mothFrom: 5, shellFrom: 4, splitFrom: 7, mothExtra: 0, shellExtra: 1 };
  return { mothFrom: 5, shellFrom: 6, splitFrom: 9, mothExtra: 0, shellExtra: 0 };
}

/**
 * The waves at which a Colossus comes: the last one and one at about three fifths of
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
  if (boss) add('colossus', map.id === 'marsh' && n >= map.waves ? 2 : 1, 6);
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
