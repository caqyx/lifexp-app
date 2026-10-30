// @ts-check
// The validator's entry point (docs/v2/PLAN.md 9.1, stage f-1): is an authored Flip Rush
// section fair for a human? The search and the replays are the Rush engine's beam
// validator (../../_engine/beam.js) flying this game's ball or spider (physics.js) through
// the section's solids and hazards. A path is a hold for every physics step; its changes
// (presses and releases) keep the tier's minimum interval and rate, and the path survives
// every tap — press and release together — shifted early and late by the tolerance (a
// press held through a landing still acts there, so an early press is the genre's
// buffered press). Used by v2/tests/flip-rush-sections.test.ts on every section, in every
// state the run can fly it in.
import { solveBeam } from '../../_engine/beam.js';
import { checkSection, widestGapAt } from '../../_engine/geometry.js';
import { changesOf } from '../../_engine/limits.js';
import { overlapsSolid, sectionWorld } from '../../_engine/solids.js';
import { JOINT, bodyOf, sectionStyle, tierOf, tierSpeed } from './config.js';
import { geometryOf } from './run.js';
import { createBody, roomy, stepBody } from './physics.js';

/**
 * @typedef {import('./config.js').SectorDef} SectorDef
 * @typedef {import('../../_engine/geometry.js').SectionData} SectionData
 * @typedef {{ gravity: 1 | -1, mini: boolean }} State
 * @typedef {{ y: number, vy: number }} Entry
 * @typedef {{ entry: Entry, problem: string | null, changes: number, holds: Int8Array | null }} EntryResult
 */

/**
 * The states a section can be entered in: both gravities always (the ball and the spider
 * flip it themselves); mini only for a section marked `mini`.
 * @param {SectorDef} _sector @param {SectionData} [data]
 * @returns {State[]}
 */
export function statesOf(_sector, data) {
  const mini = data?.mini === true;
  return [{ gravity: 1, mini }, { gravity: -1, mini }];
}

/** The tier a section flies at. @param {SectionData} data @param {SectorDef} sector @param {number} number */
export function tierKeyOf(data, sector, number) {
  return data.tier ?? sectionStyle(sector, number).tier;
}

/** The opening a tier needs everywhere, in cells. @param {string} tier @param {boolean} [mini] */
export function minGapOf(tier, mini = false) {
  return tierOf(tier).clearance * 2 * bodyOf(mini).half;
}

/**
 * Where a section is proven from, in gravity `g`: running on the surface gravity pulls
 * toward, or in the air across the joint, at rest or already falling.
 * @param {boolean} mini @param {1 | -1} g @returns {Entry[]}
 */
export function entriesOf(mini, g) {
  const half = bodyOf(mini).half;
  /** @type {Entry[]} */
  const out = [{ y: g > 0 ? JOINT.floor - half : JOINT.ceil + half, vy: 0 }];
  for (const y of [4, 6, 8]) for (const vy of [0, 6 * g]) out.push({ y, vy });
  return out;
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
 * Problems with a section's data (empty when it is well formed): the engine's checks, a
 * vehicle named, no slope, the opening checked at every step too.
 * @param {SectionData} data @param {number} minGap
 */
export function checkFlipSection(data, minGap) {
  const problems = checkSection(data, minGap);
  if (problems.length) return problems;
  if (data.mode !== 'ball' && data.mode !== 'spider') problems.push(`${data.id}: no vehicle (ball or spider)`);
  const g = geometryOf(data);
  for (const seg of [...g.ceilSegs, ...g.floorSegs]) {
    if (seg.slope !== null && seg.slope !== 0) problems.push(`${data.id}: a slope at x=${seg.x0} (level runs and steps only)`);
  }
  const gap = narrowestGap(data);
  if (gap < minGap - 1e-9) problems.push(`${data.id}: an opening ${gap.toFixed(2)} high (< ${minGap.toFixed(2)})`);
  return problems;
}

/** The search's tries: room to spare (cells) and the spacing of the input changes. @type {[number, 'min' | 'rateSafe'][]} */
const TRIES = [[1.4, 'min'], [1, 'min'], [0.7, 'min'], [0.45, 'min'], [0.7, 'rateSafe'], [0.3, 'min'], [0.15, 'min']];
/** How finely the beam keeps states, tried in turn. @type {import('../../_engine/beam.js').Grain[]} */
export const FLIP_GRAINS = [
  { bucket: 0.25, per: 3, spread: 0.8 },
  { bucket: 0.1, per: 6, spread: 0.3 },
];

/**
 * The beam validator's view of a body flying a world.
 * @param {import('../../_engine/solids.js').World} world @param {number} x0 @param {number} x1 @param {number} speed
 * @param {import('./config.js').Tier} limits @param {import('./physics.js').Body} start
 * @returns {import('../../_engine/beam.js').BeamSpec}
 */
export function beamSpec(world, x0, x1, speed, limits, start) {
  return {
    x0,
    x1,
    speed,
    limits,
    start,
    step(v, holding, dt) {
      const next = stepBody(v, holding, speed, dt, world);
      return next.crashed ? null : next.vehicle;
    },
    // The search's orbs reach less far by the way a mistimed press slips (and a step), so
    // a press it picks fires the real orb however it slips.
    search(v, holding, dt) {
      const next = stepBody(v, holding, speed, dt, world, speed * (limits.tolerance + 1 / 240));
      return next.crashed ? null : next.vehicle;
    },
    // The search's habit: keep a press down until it has acted, and a moment longer (so a
    // release that comes early still comes after it).
    allow: (v, holding) => holding || !v.held || (!v.queued && (v.sinceAct ?? 1) >= limits.tolerance + 1 / 240),
    // Room to spare: around the body (band) and along the way (a tap's timing slips the
    // spot where the body lands or leaves by up to this much across).
    safe: (v, band) => {
      if (!roomy(world, v, band)) return false;
      if (band <= 0) return true;
      const across = speed * limits.tolerance * Math.min(1.5, band);
      const { radius, half } = bodyOf(v.mini);
      if (overlapsSolid(world, v.x + across, v.y, half)) return false;
      return !world.hazard(v.x - across, v.y, v.y, radius) && !world.hazard(v.x + across, v.y, v.y, radius);
    },
    // Never merge a state that has used an orb or a pad with one that has not.
    tag: (v) => `${v.gravity}${v.grounded ? 'g' : ''}${v.queued ? 'q' : ''}|${v.spentRing ?? ''}|${v.spentPad ?? ''}`,
    fewest: true,
    released: true,
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
  const start = { ...createBody(0, entry.y, data.mode === 'spider' ? 'spider' : 'ball'), vy: entry.vy, gravity: state.gravity, mini: state.mini };
  const spec = beamSpec(sectionWorld(g), 0, g.length, tierSpeed(tier), tierOf(tier), start);
  let result = { holds: /** @type {Int8Array | null} */ (null), problem: /** @type {string | null} */ ('no path') };
  for (const grain of FLIP_GRAINS) {
    result = solveBeam(spec, { bands: TRIES, grain, ...options });
    if (result.holds) break;
  }
  return { entry, problem: result.problem, changes: result.holds ? changesOf(result.holds).length : -1, holds: result.holds };
}

/**
 * Everything wrong with a section (empty = fair): its data, then its proof from every
 * entry in every state.
 * @param {SectionData} data @param {SectorDef} sector @param {number} number its number in the sector (1-based)
 */
export function sectionProblems(data, sector, number) {
  const tier = tierKeyOf(data, sector, number);
  const problems = checkFlipSection(data, minGapOf(tier, data.mini === true));
  if (problems.length) return problems;
  for (const state of statesOf(sector, data)) {
    for (const entry of entriesOf(state.mini, state.gravity)) {
      const result = proveEntry(data, tier, state, entry);
      if (result.problem) problems.push(`${data.id} (${data.mode}, gravity ${state.gravity}${state.mini ? ', mini' : ''}) from y=${entry.y.toFixed(2)} vy=${entry.vy}: ${result.problem}`);
    }
  }
  return problems;
}
