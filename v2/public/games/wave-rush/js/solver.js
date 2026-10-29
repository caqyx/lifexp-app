// @ts-check
// The validator (docs/v2/PLAN.md 9.1, stage w-1): proves that a section can be flown by
// a human, not only by a bot. Owner's rule: every authored section must have a path that
// (1) changes input no more often than the tier's minimum interval, (2) survives each
// tap (press + release) shifted ±tolerance, (3) has at most maxRate changes in any one
// second; the corridor height (4) is checked on the data (geometry.checkSection).
//
// How: time is cut into decisions of n physics steps (n·STEP s). The wave moves exactly
// one lattice row per decision, ±slope only (it never moves sideways), so its positions
// form a grid: decision i × row j × direction. A backward pass finds, for every state,
// the fewest input changes that reach the end without touching anything, where "touch"
// uses the hit circle swept vertically over ±2·vy·tolerance (the band a mistimed tap can
// move the wave by) and changes are only allowed after the minimum interval. A path is
// then read forward and replayed through the game's own physics (physics.js,
// geometry.js) with the exact hit circle, nominal and with every tap shifted early and
// late: only a replay that survives all of them counts as the proof.
import { JOINT, PLAY_H, STEP } from './config.js';
import { createWave, holdFor, stepWave, waveRadius, waveSlope } from './physics.js';

/**
 * @typedef {(x: number, ya: number, yb: number, r: number, dir: number, slope: number) => boolean} HitTest
 * @typedef {{ minInterval: number, tolerance: number, maxRate: number }} Limits
 * @typedef {{ hits: HitTest, x0: number, x1: number, speed: number, mini: boolean, limits: Limits, yAnchor?: number, band?: number, bandFrom?: number, bandTo?: number, strict?: boolean }} SolveSpec
 *   band: the tolerance band's scale; bandFrom/bandTo: where it applies; strict: the band may not graze.
 * @typedef {{ spec: SolveSpec, n: number, dx: number, dy: number, rows: number, jMin: number, steps: number, cap: number, cost: Uint16Array, free: Uint8Array }} Table
 * @typedef {{ dirs: Int8Array, changes: number, entryY: number }} Plan
 */

const INF = 0xffff;
/** Costs: an input change outweighs any number of tight moves (fewest changes first, then room). */
const CHANGE = 1024;
/** @param {number} free 1 = free but close to something, 2 = with room to spare */
const moveCost = (free) => (free === 2 ? 0 : 1);
/** A decision moves the wave at most this many cells up or down (the grid's row height). */
const MAX_ROW = 0.1;

/** @param {number} speed @param {number} slope */
export function stepsPerDecision(speed, slope) {
  return Math.min(4, Math.max(1, Math.floor(MAX_ROW / (speed * slope * STEP))));
}

/**
 * The backward pass over the decision grid.
 * @param {SolveSpec} spec
 * @returns {Table}
 */
export function buildTable(spec) {
  const slope = waveSlope(spec.mini);
  const r = waveRadius(spec.mini);
  const n = stepsPerDecision(spec.speed, slope);
  const dx = spec.speed * n * STEP;
  const dy = dx * slope;
  const anchor = spec.yAnchor ?? 0;
  const jMin = Math.ceil((0 - anchor) / dy);
  const jMax = Math.floor((PLAY_H - anchor) / dy);
  const rows = jMax - jMin + 1;
  const steps = Math.ceil((spec.x1 - spec.x0) / dx - 1e-9);
  const cap = Math.max(1, Math.ceil(spec.limits.minInterval / (n * STEP) - 1e-9));
  const band = (spec.band ?? 1) * toleranceBand(spec.speed, spec.mini, spec.limits.tolerance);
  const free = freeMoves(spec, { n, dx, dy, rows, jMin, steps, anchor, r, slope, band });
  const width = rows * 2 * (cap + 1);
  const cost = new Uint16Array((steps + 1) * width).fill(INF);
  cost.fill(0, steps * width);
  for (let i = steps - 1; i >= 0; i--) {
    for (let row = 0; row < rows; row++) {
      for (let d = 0; d < 2; d++) {
        const dir = d === 0 ? -1 : 1;
        const base = (i * rows + row) * 2;
        const goOn = free[base + d] ? row + dir : -1;
        const turn = free[base + 1 - d] ? row - dir : -1;
        const goOnCost = moveCost(/** @type {number} */ (free[base + d]));
        const turnCost = CHANGE + moveCost(/** @type {number} */ (free[base + 1 - d]));
        for (let c = 0; c <= cap; c++) {
          let best = INF;
          if (goOn >= 0 && goOn < rows) {
            const next = /** @type {number} */ (cost[(((i + 1) * rows + goOn) * 2 + d) * (cap + 1) + Math.min(c + 1, cap)]);
            if (next !== INF) best = next + goOnCost;
          }
          if (c >= cap && turn >= 0 && turn < rows) {
            const via = /** @type {number} */ (cost[(((i + 1) * rows + turn) * 2 + (1 - d)) * (cap + 1) + 1]);
            if (via !== INF && via + turnCost < best) best = via + turnCost;
          }
          cost[((i * rows + row) * 2 + d) * (cap + 1) + c] = Math.min(best, INF);
        }
      }
    }
  }
  return { spec, n, dx, dy, rows, jMin, steps, cap, cost, free };
}

/**
 * free[(i·rows + row)·2 + d]: moving direction d (0 up, 1 down) from decision i, row
 * `row`, touches nothing during its n steps with the tolerance band (1), and even with
 * room to spare (2); 0 = blocked.
 * @param {SolveSpec} spec
 * @param {{ n: number, dx: number, dy: number, rows: number, jMin: number, steps: number, anchor: number, r: number, slope: number, band: number }} grid
 */
function freeMoves(spec, grid) {
  const free = new Uint8Array(grid.steps * grid.rows * 2);
  for (let i = 0; i < grid.steps; i++) {
    const x = spec.x0 + i * grid.dx;
    for (let row = 0; row < grid.rows; row++) {
      const y = grid.anchor + (row + grid.jMin) * grid.dy;
      if (y - grid.r <= 0 || y + grid.r >= PLAY_H) continue;
      for (let d = 0; d < 2; d++) {
        const dir = d === 0 ? -1 : 1;
        if (!clearMove(spec, grid, x, y, dir, grid.band, spec.strict === true)) continue;
        const roomy = clearMove(spec, grid, x, y, dir, grid.band * ROOM, true);
        free[(i * grid.rows + row) * 2 + d] = roomy ? 2 : 1;
      }
    }
  }
  return free;
}

/** "Room to spare": clear even with the band this much wider and no grazing. */
const ROOM = 1.6;

/**
 * Does one decision's move touch nothing, with this band around the wave?
 * @param {SolveSpec} spec @param {{ n: number, dy: number, r: number, slope: number }} grid
 * @param {number} x @param {number} y @param {number} dir @param {number} bandSize @param {boolean} strict
 */
function clearMove(spec, grid, x, y, dir, bandSize, strict) {
  const stepX = spec.speed * STEP;
  for (let k = 1; k <= grid.n; k++) {
    const yy = y + (dir * k * grid.dy) / grid.n;
    const xx = x + k * stepX;
    const band = xx >= (spec.bandFrom ?? -Infinity) && xx <= (spec.bandTo ?? Infinity) ? bandSize : 0;
    if (strict && band > 0) {
      // The band without grazing (a shifted tap may meet a slope going the other way).
      if (spec.hits(xx, yy, yy, grid.r, dir, grid.slope) || spec.hits(xx, yy - band, yy + band, grid.r, 0, grid.slope)) return false;
    } else if (spec.hits(xx, yy - band, yy + band, grid.r, dir, grid.slope)) return false;
  }
  return true;
}

/**
 * The row of the grid nearest to y.
 * @param {Table} table @param {number} y
 */
export function rowOf(table, y) {
  return Math.round((y - (table.spec.yAnchor ?? 0)) / table.dy) - table.jMin;
}

/** @param {Table} table @param {number} row */
export function rowY(table, row) {
  return (table.spec.yAnchor ?? 0) + (row + table.jMin) * table.dy;
}

/**
 * The fewest-changes path from a row at the start (either direction; the first is free).
 * @param {Table} table @param {number} row
 * @returns {Plan | null}
 */
export function readPlan(table, row) {
  const { rows, cap, cost, steps } = table;
  if (row < 0 || row >= rows) return null;
  const at = (/** @type {number} */ i, /** @type {number} */ j, /** @type {number} */ d, /** @type {number} */ c) =>
    /** @type {number} */ (cost[((i * rows + j) * 2 + d) * (cap + 1) + c]);
  let d = at(0, row, 0, cap) <= at(0, row, 1, cap) ? 0 : 1;
  if (at(0, row, d, cap) === INF) return null;
  const dirs = new Int8Array(steps);
  let j = row;
  let c = cap;
  let changes = 0;
  for (let i = 0; i < steps; i++) {
    const dir = d === 0 ? -1 : 1;
    const here = at(i, j, d, c);
    const goOn = j + dir;
    const move = /** @type {number} */ (table.free[(i * rows + j) * 2 + d]);
    if (move > 0 && goOn >= 0 && goOn < rows && at(i + 1, goOn, d, Math.min(c + 1, cap)) + moveCost(move) === here) {
      dirs[i] = dir;
      j = goOn;
      c = Math.min(c + 1, cap);
      continue;
    }
    // Only a change can be this cheap.
    d = 1 - d;
    j -= dir;
    c = 1;
    dirs[i] = -dir;
    if (i > 0) changes += 1;
  }
  return { dirs, changes, entryY: rowY(table, row) };
}

// ── Replay ───────────────────────────────────────────────────────────────────

/**
 * A plan as a direction per physics step.
 * @param {Plan} plan @param {number} n
 */
export function planSteps(plan, n) {
  const out = new Int8Array(plan.dirs.length * n);
  for (let i = 0; i < plan.dirs.length; i++) out.fill(/** @type {number} */ (plan.dirs[i]), i * n, (i + 1) * n);
  return out;
}

/** Step indices where the direction changes (not the first). @param {Int8Array} dirs */
export function changesOf(dirs) {
  const out = [];
  for (let s = 1; s < dirs.length; s++) if (dirs[s] !== dirs[s - 1]) out.push(s);
  return out;
}

/**
 * Flies a direction-per-step input through the game's physics; true when it survives.
 * The input is given as holds for this gravity, the way a player gives it.
 * @param {SolveSpec} spec @param {number} y @param {Int8Array} dirs @param {1 | -1} gravity
 * @param {number} [from] first step @param {number} [to] step to stop at
 * @param {{ x: number, y: number } | null} [startAt]
 */
export function replay(spec, y, dirs, gravity, from = 0, to = dirs.length, startAt = null) {
  const r = waveRadius(spec.mini);
  const slope = waveSlope(spec.mini);
  let wave = { ...createWave(startAt ? startAt.x : spec.x0, startAt ? startAt.y : y), gravity, mini: spec.mini };
  if (spec.hits(wave.x, wave.y, wave.y, r, /** @type {number} */ (dirs[from] ?? 1), slope)) return false;
  for (let s = from; s < to; s++) {
    wave = stepWave(wave, holdFor(/** @type {number} */ (dirs[s]), gravity), spec.speed, STEP);
    if (spec.hits(wave.x, wave.y, wave.y, r, wave.dir, slope)) return false;
  }
  return true;
}

/**
 * The wave's position before each step of a nominal replay (for windows of a shifted one).
 * @param {SolveSpec} spec @param {number} y @param {Int8Array} dirs @param {1 | -1} gravity
 */
function trace(spec, y, dirs, gravity) {
  const xs = new Float64Array(dirs.length + 1);
  const ys = new Float64Array(dirs.length + 1);
  let wave = { ...createWave(spec.x0, y), gravity, mini: spec.mini };
  xs[0] = wave.x;
  ys[0] = wave.y;
  for (let s = 0; s < dirs.length; s++) {
    wave = stepWave(wave, holdFor(/** @type {number} */ (dirs[s]), gravity), spec.speed, STEP);
    xs[s + 1] = wave.x;
    ys[s + 1] = wave.y;
  }
  return { xs, ys };
}

/**
 * The same input with one tap moved by `shift` steps: the change at `changes[k]` and
 * the next one (the tap keeps its length); the last change moves alone.
 * @param {Int8Array} dirs @param {number[]} changes @param {number} k @param {number} shift
 */
export function shiftTap(dirs, changes, k, shift) {
  const out = Int8Array.from(dirs);
  const moved = [/** @type {number} */ (changes[k])];
  if (k + 1 < changes.length) moved.push(/** @type {number} */ (changes[k + 1]));
  for (const at of moved) {
    const before = /** @type {number} */ (dirs[at - 1]);
    const after = /** @type {number} */ (dirs[at]);
    if (shift > 0) out.fill(before, at, Math.min(dirs.length, at + shift));
    else out.fill(after, Math.max(0, at + shift), at);
  }
  return out;
}

/**
 * Most changes inside any one second.
 * @param {number[]} changes step indices
 */
export function peakRate(changes) {
  const window = Math.round(1 / STEP);
  let best = 0;
  let start = 0;
  for (let end = 0; end < changes.length; end++) {
    while (/** @type {number} */ (changes[end]) - /** @type {number} */ (changes[start]) >= window) start += 1;
    best = Math.max(best, end - start + 1);
  }
  return best;
}

/**
 * Checks a plan against all the human limits by replaying it.
 * @param {SolveSpec} spec @param {Plan} plan @param {number} n @param {1 | -1} gravity
 * @returns {string | null} what failed, or null
 */
export function verifyPlan(spec, plan, n, gravity) {
  const dirs = planSteps(plan, n);
  if (!replay(spec, plan.entryY, dirs, gravity)) return 'nominal path crashes';
  const changes = changesOf(dirs);
  const minGap = Math.ceil(spec.limits.minInterval / STEP - 1e-9);
  for (let k = 1; k < changes.length; k++) {
    if (/** @type {number} */ (changes[k]) - /** @type {number} */ (changes[k - 1]) < minGap) return 'changes too close';
  }
  if (peakRate(changes) > spec.limits.maxRate) return `rate ${peakRate(changes)}/s`;
  const shift = toleranceSteps(spec.limits.tolerance);
  const nominal = trace(spec, plan.entryY, dirs, gravity);
  for (let k = 0; k < changes.length; k++) {
    for (const sign of [-1, 1]) {
      const shifted = shiftTap(dirs, changes, k, sign * shift);
      const from = Math.max(0, /** @type {number} */ (changes[k]) - shift - 1);
      const last = k + 1 < changes.length ? /** @type {number} */ (changes[k + 1]) + shift + 2 : dirs.length;
      const to = Math.min(dirs.length, last);
      const startAt = { x: /** @type {number} */ (nominal.xs[from]), y: /** @type {number} */ (nominal.ys[from]) };
      if (!replay(spec, plan.entryY, shifted, gravity, from, to, startAt)) return `tap ${k + 1} ${sign < 0 ? 'early' : 'late'} crashes`;
    }
  }
  return null;
}

/**
 * Plans from a row and checks it; widens the band when the first plan is not robust.
 * @param {SolveSpec} spec @param {number} y @param {1 | -1} gravity @param {Map<string, Table>} tables by band
 * @returns {{ plan: Plan | null, n: number, problem: string | null }}
 */
export function proveFrom(spec, y, gravity, tables) {
  let problem = 'no path';
  let n = 1;
  for (const [band, strict] of /** @type {[number, boolean][]} */ ([[1, false], [1, true], [1.4, true]])) {
    const key = `${band}${strict ? 's' : ''}`;
    let table = tables.get(key);
    if (!table) {
      table = buildTable({ ...spec, band, strict });
      tables.set(key, table);
    }
    n = table.n;
    const plan = readPlan(table, rowOf(table, y));
    if (!plan) continue;
    const fail = verifyPlan(spec, plan, table.n, gravity);
    if (!fail) return { plan, n, problem: null };
    problem = fail;
  }
  return { plan: null, n, problem };
}

/**
 * The entries a section must be passable from: across the joint's open corridor, but
 * not closer to its walls than the tolerance band (a proven path keeps that band to the
 * walls up to its very end, so the next section's entries cover where it can leave).
 * @param {boolean} mini @param {number} band @param {number} [spacing]
 */
export function entryHeights(mini, band, spacing = 0.5) {
  const r = waveRadius(mini);
  const out = [];
  // (+ half a grid row: the entry is snapped to the grid)
  const top = JOINT.ceil + r + band + 0.12;
  const bottom = JOINT.floor - r - band - 0.12;
  for (let y = top; y <= bottom + 1e-9; y += spacing) out.push(y);
  if (/** @type {number} */ (out[out.length - 1]) < bottom - 1e-6) out.push(bottom);
  return out;
}

/** The band a mistimed tap can move the wave by, in cells. @param {number} speed @param {boolean} mini @param {number} tolerance */
export function toleranceBand(speed, mini, tolerance) {
  return 2 * speed * waveSlope(mini) * toleranceSteps(tolerance) * STEP;
}

/** The tolerance in whole physics steps (rounded up: never tested more leniently). @param {number} tolerance */
export function toleranceSteps(tolerance) {
  return Math.ceil(tolerance / STEP - 1e-9);
}
