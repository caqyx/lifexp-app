// @ts-check
// How the icon turns (docs/v2/PLAN.md 9.1, stage w-3). The wave's direction changes
// instantly — the trail has sharp corners and the hit circle flies strictly ±45° (mini
// ±63.4°) — but the drawn icon does not snap to the new angle: it turns quickly and
// smoothly toward it, render only. Exponential easing by real frame time, so 60, 120
// and 144 Hz screens turn alike: a 90° turn is visually done in about 100 ms.

/** The easing's time constant, in seconds. */
export const TURN_TAU = 0.04;

/** @param {number} angle */
function wrap(angle) {
  const a = (angle + Math.PI) % (Math.PI * 2);
  return (a < 0 ? a + Math.PI * 2 : a) - Math.PI;
}

/**
 * The signed difference from `from` to `to` the short way round, in (−π, π].
 * @param {number} from @param {number} to
 */
export function shortestArc(from, to) {
  return wrap(to - from);
}

/**
 * The drawn angle after a frame of `dt` seconds, turning toward `target`.
 * @param {number} angle @param {number} target @param {number} dt @param {number} [tau]
 */
export function easeAngle(angle, target, dt, tau = TURN_TAU) {
  if (!(dt > 0)) return angle;
  return wrap(angle + shortestArc(angle, target) * (1 - Math.exp(-dt / tau)));
}

/**
 * The angle the icon turns toward: the wave's direction of flight (steeper in mini),
 * or the ship's climb.
 * @param {{ dir: number, mini: boolean, ship: boolean, vy: number }} w @param {number} speed cells/s
 * @param {number} slope |dy/dx| of the wave now
 */
export function targetAngle(w, speed, slope) {
  if (w.ship) return Math.atan2(w.vy, speed) * 0.9;
  return Math.atan2(w.dir * slope, 1);
}
