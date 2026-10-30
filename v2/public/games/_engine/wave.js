// @ts-check
// The wave, the Rush games' other vehicle (docs/v2/PLAN.md 9.1, stages w-1 and s-2): Wave
// Rush is flown as the wave, and Ship Rush's finale has wave stretches. The wave has no
// horizontal state: the level scrolls at the piece's speed, and the wave only ever goes up
// or down at its slope — up while held, down while released (the other way round upside
// down); it never moves sideways in the air.

export const WAVE = {
  /** Hit circle radius; the drawing is larger, so a near miss looks like one. */
  radius: 0.3,
  miniRadius: 0.2,
  /** |dy/dx|: 45° normally, 2:1 (≈63.4°) in mini. */
  slope: 1,
  miniSlope: 2,
  /** Drawn size (cells). */
  size: 1.05,
  miniSize: 0.68,
};

/** @param {boolean} mini */
export const waveRadius = (mini) => (mini ? WAVE.miniRadius : WAVE.radius);
/** @param {boolean} mini */
export const waveSlope = (mini) => (mini ? WAVE.miniSlope : WAVE.slope);

/**
 * Which way the wave goes for this input: holding climbs, unless gravity is flipped.
 * @param {boolean} holding @param {1 | -1} gravity
 */
export function directionFor(holding, gravity) {
  return holding ? -gravity : gravity;
}

/**
 * The input that makes the wave go `dir` (the solver plans in directions).
 * @param {number} dir @param {1 | -1} gravity
 */
export function holdFor(dir, gravity) {
  return dir === -gravity;
}

/**
 * One fixed step of the wave: forward at `speed` cells/s, up or down at the slope. No
 * clamping: leaving the playfield is a crash, found by the collision check.
 * @template {{ x: number, y: number, dir: number, gravity: 1 | -1, mini: boolean }} W
 * @param {W} wave @param {boolean} holding @param {number} speed @param {number} dt
 * @returns {W}
 */
export function stepWaveOnly(wave, holding, speed, dt) {
  const dir = directionFor(holding, wave.gravity);
  const dx = speed * dt;
  return { ...wave, dir, x: wave.x + dx, y: wave.y + dir * waveSlope(wave.mini) * dx };
}
