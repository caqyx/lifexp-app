// @ts-check
// A section's own stretches for the validators and the pilots (stage r-2): speed portals,
// gravity flips and size portals inside the section, inverted controls. The game applies
// them through the run (level.js speedAt / invertedAt, game.js passPortals); a proof of
// one section applies the same through this wrapper round the game's own step.
import { speedFactorAt } from './level.js';

/**
 * @typedef {import('./game.js').Vehicle} Vehicle
 * @typedef {import('./geometry.js').Geometry} Geometry
 * @typedef {(v: Vehicle, holding: boolean, speed: number, dt: number) => Vehicle | null} RawStep
 */

/**
 * The section's speed at local x and a step with its stretches applied.
 * @param {Geometry} g @param {number} base the tier's speed @param {RawStep} step null on a crash
 */
export function sectionStepper(g, base, step) {
  const plain = !g.speeds.length && !g.portals.length && !g.invert.length;
  /** @param {number} x */
  const speedAt = (x) => base * speedFactorAt(g, x);
  /** @param {Vehicle} v @param {boolean} holding @param {number} dt @returns {Vehicle | null} */
  const stepIn = (v, holding, dt) => {
    if (plain) return step(v, holding, base, dt);
    const inverted = g.invert.some((r) => v.x >= r.from && v.x < r.to);
    const next = step(v, inverted ? !holding : holding, speedAt(v.x), dt);
    if (!next) return null;
    let out = next;
    for (const p of g.portals) {
      if (p.x <= v.x || p.x > next.x) continue;
      if (p.kind === 'flip') out = { ...out, gravity: /** @type {1 | -1} */ (-out.gravity) };
      else out = { ...out, mini: p.kind === 'mini' };
    }
    return out;
  };
  return { plain, speedAt, step: stepIn };
}
