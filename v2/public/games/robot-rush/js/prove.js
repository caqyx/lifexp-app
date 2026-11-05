// @ts-check
// The validator's entry point (docs/v2/PLAN.md 9.1, stage rr-b): is an authored Robot Rush
// section fair for a human? The search and the replays are the Rush engine's beam
// validator (../../_engine/beam.js) flying this game's robot (physics.js) through the
// section's solids and hazards. A path is a hold for every physics step; its changes
// (presses and releases) keep the tier's minimum interval and rate, and the path survives
// every tap shifted early and late by the tolerance AND every release shifted alone (a
// hold a little short or long: the robot's jump height is the hold's length). Used by
// v2/tests/robot-rush-sections.test.ts on every section, in every state the run can fly
// it in.
import { sectionStepper } from '../../_engine/stretch.js';
import { solveBeam } from '../../_engine/beam.js';
import { checkSection, widestGapAt } from '../../_engine/geometry.js';
import { changesOf } from '../../_engine/limits.js';
import { overlapsSolid, sectionWorld } from '../../_engine/solids.js';
import { JOINT, robotOf, sectionStyle, tierOf, tierSpeed } from './config.js';
import { geometryOf } from './run.js';
import { createRobot, roomy, stepRobot } from './physics.js';

/**
 * @typedef {import('./config.js').SectorDef} SectorDef
 * @typedef {import('../../_engine/geometry.js').SectionData} SectionData
 * @typedef {{ gravity: 1 | -1, mini: boolean }} State
 * @typedef {{ y: number, vy: number }} Entry
 * @typedef {{ entry: Entry, problem: string | null, changes: number, holds: Int8Array | null, x: number | null }} EntryResult
 */

/**
 * The states a section can be entered in: upright, and upside down where the sector has
 * gravity portals at its joints (from sector 3; the finale only upright); mini only for a
 * section marked `mini`.
 * @param {SectorDef} sector @param {SectionData} [data]
 * @returns {State[]}
 */
export function statesOf(sector, data) {
  const mini = data?.mini === true;
  const flips = sector.portals.some((p) => p.kind === 'gravity');
  return flips ? [{ gravity: 1, mini }, { gravity: -1, mini }] : [{ gravity: 1, mini }];
}

/** The tier a section flies at. @param {SectionData} data @param {SectorDef} sector @param {number} number */
export function tierKeyOf(data, sector, number) {
  return data.tier ?? sectionStyle(sector, number).tier;
}

/** The opening a tier needs everywhere, in cells. @param {string} tier @param {boolean} [mini] */
export function minGapOf(tier, mini = false) {
  return tierOf(tier).clearance * 2 * robotOf(mini).half;
}

/**
 * Where a section is proven from, in gravity `g`: running on its ground, or in the air
 * across the joint (falling after a jump, or just turned over by a gravity portal).
 * @param {boolean} mini @param {1 | -1} g @returns {Entry[]}
 */
export function entriesOf(mini, g) {
  const half = robotOf(mini).half;
  const ground = g > 0 ? JOINT.floor - half : JOINT.ceil + half;
  const other = g > 0 ? JOINT.ceil + half : JOINT.floor - half;
  return [
    { y: ground, vy: 0 },
    { y: other, vy: 0 },
    { y: 6, vy: 0 },
    { y: g > 0 ? 8 : 4, vy: 6 * g },
  ];
}

/**
 * The narrowest opening of a section: sampled finely and at every step and hazard edge.
 * @param {SectionData} data
 */
export function narrowestGap(data) {
  const g = geometryOf(data);
  const xs = [...g.ceil.map((p) => p[0]), ...g.floor.map((p) => p[0]), ...g.hazards.flatMap((h) => [/** @type {number} */ (h.bbox[0]), /** @type {number} */ (h.bbox[2])])];
  for (let x = 0; x <= g.length; x += 0.05) xs.push(x);
  let least = Infinity;
  for (const x of xs) if (x >= 0 && x <= g.length) least = Math.min(least, widestGapAt(g, x));
  return least;
}

/**
 * Problems with a section's data (empty when it is well formed): the engine's checks, the
 * robot named, no slope, the opening checked at every step too.
 * @param {SectionData} data @param {number} minGap
 */
export function checkRobotSection(data, minGap) {
  const problems = checkSection(data, minGap);
  if (problems.length) return problems;
  if (data.mode !== 'robot') problems.push(`${data.id}: not the robot`);
  const g = geometryOf(data);
  for (const seg of [...g.ceilSegs, ...g.floorSegs]) {
    if (seg.slope !== null && seg.slope !== 0) problems.push(`${data.id}: a slope at x=${seg.x0} (level runs and steps only)`);
  }
  const gap = narrowestGap(data);
  if (gap < minGap - 1e-9) problems.push(`${data.id}: an opening ${gap.toFixed(2)} high (< ${minGap.toFixed(2)})`);
  return problems;
}

/** The search's tries: room to spare (cells) and the spacing of the input changes. @type {[number, 'min' | 'rateSafe'][]} */
const TRIES = [[1.2, 'min'], [0.8, 'min'], [0.5, 'min'], [0.7, 'rateSafe'], [0.3, 'min'], [0.15, 'min']];
/** How finely the beam keeps states, tried in turn. @type {import('../../_engine/beam.js').Grain[]} */
export const ROBOT_GRAINS = [
  { bucket: 0.25, per: 3, spread: 0.8 },
  { bucket: 0.1, per: 6, spread: 0.3 },
];

/**
 * The beam validator's view of the robot flying a world.
 * @param {import('../../_engine/solids.js').World} world @param {number} x0 @param {number} x1 @param {number} speed
 * @param {import('./config.js').Tier} limits @param {import('./physics.js').Robot} start
 * @param {import('../../_engine/geometry.js').Geometry} [g] the section (local x) when its own stretches apply
 * @returns {import('../../_engine/beam.js').BeamSpec}
 */
export function beamSpec(world, x0, x1, speed, limits, start, g) {
  const real = g ? sectionStepper(g, speed, (v, h, sp, dt) => { const n = stepRobot(v, h, sp, dt, world); return n.crashed ? null : n.vehicle; }) : null;
  const strict = g ? sectionStepper(g, speed, (v, h, sp, dt) => { const n = stepRobot(v, h, sp, dt, world, sp * (limits.tolerance + 1 / 240)); return n.crashed ? null : n.vehicle; }) : null;
  return {
    x0,
    x1,
    speed,
    limits,
    start,
    step(v, holding, dt) {
      if (real) return real.step(v, holding, dt);
      const next = stepRobot(v, holding, speed, dt, world);
      return next.crashed ? null : next.vehicle;
    },
    ...(real && !real.plain ? { speedAt: real.speedAt } : {}),
    // The search's orbs reach less far by the way a mistimed press slips.
    search(v, holding, dt) {
      if (strict) return strict.step(v, holding, dt);
      const next = stepRobot(v, holding, speed, dt, world, speed * (limits.tolerance + 1 / 240));
      return next.crashed ? null : next.vehicle;
    },
    // Room to spare: around the body (band) and along the way (a tap's timing slips the
    // spot where the robot lands or leaves by up to this much across).
    safe: (v, band) => {
      if (!roomy(world, v, band)) return false;
      if (band <= 0) return true;
      const across = (real ? real.speedAt(v.x) : speed) * limits.tolerance * Math.min(1.5, band);
      const { radius, half } = robotOf(v.mini);
      if (overlapsSolid(world, v.x + across, v.y, half)) return false;
      return !world.hazard(v.x - across, v.y, v.y, radius) && !world.hazard(v.x + across, v.y, v.y, radius);
    },
    // Never merge states that differ in gravity, contact, burn left or the orb and pad used.
    tag: (v) => `${v.gravity}${v.grounded ? 'g' : ''}${(v.lift ?? 0) > 0 ? `b${Math.round((v.lift ?? 0) * 60)}` : ''}|${v.spentRing ?? ''}|${v.spentPad ?? ''}`,
    fewest: true,
    released: true,
    holdSlack: true,
  };
}

/**
 * Proves a section from one entry, in one state.
 * @param {SectionData} data @param {string} tier @param {State} state @param {Entry} entry
 * @param {{ verify?: boolean }} [options]
 * @returns {EntryResult}
 */
export function proveEntry(data, tier, state, entry, options = {}) {
  const g = geometryOf(data);
  const start = { ...createRobot(0, entry.y), vy: entry.vy, gravity: state.gravity, mini: state.mini };
  const spec = beamSpec(sectionWorld(g), 0, g.length, tierSpeed(tier), tierOf(tier), start, g);
  let result = { holds: /** @type {Int8Array | null} */ (null), problem: /** @type {string | null} */ ('no path'), x: /** @type {number | null} */ (null) };
  for (const grain of ROBOT_GRAINS) {
    result = solveBeam(spec, { bands: TRIES, grain, ...options });
    if (result.holds) break;
  }
  return { entry, problem: result.problem, changes: result.holds ? changesOf(result.holds).length : -1, holds: result.holds, x: result.x };
}

/**
 * Everything wrong with a section (empty = fair): its data, then its proof from every
 * entry in every state.
 * @param {SectionData} data @param {SectorDef} sector @param {number} number its number in the sector (1-based)
 */
export function sectionProblems(data, sector, number) {
  const tier = tierKeyOf(data, sector, number);
  const problems = checkRobotSection(data, minGapOf(tier, data.mini === true));
  if (problems.length) return problems;
  for (const state of statesOf(sector, data)) {
    for (const entry of entriesOf(state.mini, state.gravity)) {
      const result = proveEntry(data, tier, state, entry);
      if (result.problem) problems.push(`${data.id} (gravity ${state.gravity}${state.mini ? ', mini' : ''}) from y=${entry.y.toFixed(2)} vy=${entry.vy}: ${result.problem}${result.x !== null ? ` (x≈${result.x.toFixed(1)})` : ''}`);
    }
  }
  return problems;
}
