// @ts-check
// The fixed-step clock and the tap buffer (docs/v2/PLAN.md 9.1, stage w-1), shared by the
// Rush games: physics always runs at STEP, whatever the screen's refresh rate.
import { INPUT_BUFFER_MS, MAX_FRAME, STEP } from './world.js';

/**
 * Fixed timestep: adds a frame's time to the accumulator and says how many steps to
 * run. A 60, 120 or 144 Hz screen runs the same number of steps per second.
 * @param {number} accumulator @param {number} frameSeconds
 */
export function advanceClock(accumulator, frameSeconds) {
  let acc = accumulator + Math.min(Math.max(frameSeconds, 0), MAX_FRAME);
  let steps = 0;
  while (acc >= STEP - 1e-12) {
    acc -= STEP;
    steps += 1;
  }
  acc = Math.max(0, acc);
  return { steps, accumulator: acc, alpha: acc / STEP };
}

/**
 * Is a tap made at `pressedAt` still waiting to be used at `now`? (milliseconds)
 * @param {number | null} pressedAt @param {number} now
 */
export function isBuffered(pressedAt, now) {
  return pressedAt !== null && now - pressedAt >= 0 && now - pressedAt <= INPUT_BUFFER_MS;
}
