// @ts-check
// The Demon's ornament (docs/v2/PLAN.md 9.1, stage s-2; in the engine since f-2, for Ship
// Rush and Flip Rush): owner — "denser than Wave Rush's
// demons", deco that never hurts and never hides a hazard. Every Demon section keeps its
// hand-made deco and gets more, placed from the section's own id (the same every run):
// chains with eyes, stars, diamonds and debris hanging from level stretches of the
// ceiling, faint eyes high in tall openings, glowing trusses and wrecks far behind the
// corridor. Nothing goes within reach of a hazard, and nothing hangs into an opening
// lower than OPEN_ENOUGH, so the way through always reads; the painter draws all of it
// dimmer than the hazards, which also keep their halo.
import { buildGeometry, profileY, widestGapAt } from './geometry.js';

/**
 * @typedef {import('./geometry.js').SectionData} SectionData
 * @typedef {import('./geometry.js').DecoData} DecoData
 */

/** A chain only hangs where the opening below it is at least this high (cells). */
const OPEN_ENOUGH = 3.2;
/** Nothing is placed within this distance (cells) of a hazard across. */
const CLEAR = 1.2;
const ORNAMENTS = /** @type {const} */ (['eye', 'debris', 'star', 'diamond']);

/** A repeatable 0..1 from a string and a number. @param {string} id @param {number} n */
function rand(id, n) {
  let h = 2166136261;
  for (const ch of `${id}:${n}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Is x clear of every hazard, by `margin` across?
 * @param {import('./geometry.js').Geometry} g @param {number} x @param {number} margin
 */
function clearOfHazards(g, x, margin) {
  return (
    g.hazards.every((h) => x < /** @type {number} */ (h.bbox[0]) - margin || x > /** @type {number} */ (h.bbox[2]) + margin) &&
    g.boosters.every((b) => Math.abs(x - b.x) > 0.5 + margin)
  );
}

/**
 * Is the profile level over x ± w?
 * @param {import('./geometry.js').Pt[]} pts @param {number} x @param {number} w @param {'ceil' | 'floor'} side
 */
function levelAt(pts, x, w, side) {
  const y = profileY(pts, x, side);
  return Math.abs(profileY(pts, x - w, side) - y) < 1e-9 && Math.abs(profileY(pts, x + w, side) - y) < 1e-9;
}

/**
 * A section with its Demon ornament added.
 * @param {SectionData} data @param {number} density 1 = Easy Demon; more is denser
 * @param {{ high?: 'eye' | 'gear' }} [options] high: what hangs high in tall openings (Flip Rush: gears)
 * @returns {SectionData}
 */
export function ornament(data, density, options = {}) {
  const g = buildGeometry(data);
  /** @type {DecoData[]} */
  const deco = [...(data.deco ?? [])];
  const step = 2.8 / density;
  let n = 0;
  for (let x = 3 + rand(data.id, 0) * step; x < data.length - 3; x += step * (0.8 + rand(data.id, ++n) * 0.4)) {
    const gap = widestGapAt(g, x);
    // Chains from the ceiling, with an ornament.
    if (levelAt(g.ceil, x, 0.4, 'ceil') && clearOfHazards(g, x, CLEAR) && gap >= OPEN_ENOUGH) {
      const len = 0.35 + rand(data.id, n * 3 + 1) * Math.min(0.9, (gap - OPEN_ENOUGH) * 0.5 + 0.3);
      deco.push({ type: 'chain', x: Math.round(x * 10) / 10, len: Math.round(len * 100) / 100, ornament: ORNAMENTS[n % ORNAMENTS.length] });
    }
    // An eye high in a tall opening, faint (it is far behind).
    else if (rand(data.id, n * 3 + 2) < 0.4 * density && gap >= 4.2 && clearOfHazards(g, x, CLEAR)) {
      deco.push({ type: options.high ?? 'eye', x: Math.round(x * 10) / 10, y: profileY(g.ceil, x, 'ceil') + 1, size: 0.6 });
    }
  }
  // Trusses and wrecks far behind (only where the corridor is open; they are outlines).
  const behind = Math.round(1 + density);
  for (let k = 0; k < behind; k++) {
    const x = 4 + rand(data.id, 100 + k) * (data.length - 10);
    const top = profileY(g.ceil, x, 'ceil');
    const bottom = profileY(g.floor, x, 'floor');
    if (bottom - top < 4) continue;
    if (k % 2 === 0) deco.push({ type: 'frame', x: Math.round(x * 10) / 10, y: top + 0.6, w: 1, h: Math.round((bottom - top - 1.2) * 10) / 10 });
    else deco.push({ type: 'wreck', x: Math.round(x * 10) / 10, y: (top + bottom) / 2, size: 1.6 });
  }
  return { ...data, deco };
}
