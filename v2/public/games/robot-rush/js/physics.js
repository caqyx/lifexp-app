// @ts-check
// The robot (docs/v2/PLAN.md 9.1, stage rr-b), written for this game from the genre's
// behaviour (stage rr-b research), not from anyone's code.
//
// It falls toward its gravity (up to a top speed) and runs on whatever stops it. The input
// is a HOLD:
// - pressed on the ground, it jumps: its thrusters push it away from the ground at a
//   steady speed (config.js ROBOT.jump) for as long as the press is held, at most
//   ROBOT.boost seconds; letting go (or the time running out, or a bump against a
//   solid's underside) ends the push and gravity takes over. A short tap is a low hop, a
//   long hold a high jump.
// - held on, it jumps again the moment it lands (as the genre's robot does).
// - ORBS and PADS (Flip Rush's, ../../flip-rush/js/boosters.js): an orb fires on a fresh
//   press while touched, in the air; a pad on touch. Both set the vertical speed and end
//   the thrusters' push.
// Collision, as for the ball (../../_engine/solids.js `settle`): a solid's top (the
// underside, upside down) carries the robot; coming in from the side is a crash; any
// hazard touching its circle is a crash; leaving the playfield is a crash.
import { createVehicle } from '../../_engine/game.js';
import { roomyAt, settle } from '../../_engine/solids.js';
import { boostOf, padAt, ringAt } from '../../flip-rush/js/boosters.js';
import { PLAY_H, SNAP, robotOf } from './config.js';

/** How long an orb's or a pad's flash lasts, seconds (drawing only). */
export const BURST_TIME = 0.3;

export { advanceClock, isBuffered } from '../../_engine/clock.js';

/**
 * @typedef {import('../../_engine/game.js').Vehicle} Robot
 * @typedef {import('../../_engine/solids.js').World} World
 */

/**
 * A robot at (x, y), at rest in the air (it will fall to the floor).
 * @param {number} x @param {number} y
 * @returns {Robot}
 */
export function createRobot(x, y) {
  return { ...createVehicle(x, y), mode: 'robot', held: false, grounded: false, lift: 0 };
}

/**
 * One fixed step of the robot in a world.
 * @param {Robot} robot @param {boolean} holding @param {number} speed cells/s @param {number} dt @param {World} world
 * @param {number} [ringShrink] cells off every orb's reach (the validator's search only)
 * @returns {{ vehicle: Robot, crashed: boolean }}
 */
export function stepRobot(robot, holding, speed, dt, world, ringShrink = 0) {
  const kind = robotOf(robot.mini);
  const fresh = holding && robot.held !== true;
  /** @type {1 | -1} */
  let gravity = robot.gravity;
  let vy = robot.vy;
  let grounded = robot.grounded === true;
  let lift = holding ? (robot.lift ?? 0) : 0;
  let spentRing = robot.spentRing;
  let spentPad = robot.spentPad;
  let burst = Math.max(0, (robot.burst ?? 0) - dt);
  let burstAt = robot.burstAt;
  const x = robot.x + speed * dt;
  const y = robot.y;
  // An orb takes a fresh press in the air.
  const ring = fresh && !grounded ? ringAt(world, x, y, robot.mini, spentRing, ringShrink) : null;
  if (ring) {
    ({ gravity, vy } = boostOf('ring', ring.kind, gravity, robot.mini));
    lift = 0;
    spentRing = ring.id;
    burst = BURST_TIME;
    burstAt = { x: ring.x, y: ring.y, type: 'ring', kind: ring.kind };
  } else if (holding && grounded) {
    // A jump: the thrusters fire.
    lift = kind.boost;
    grounded = false;
  }
  if (lift > 0) {
    vy = -kind.jump * gravity;
    lift = Math.max(0, lift - dt);
  } else {
    // Fall toward gravity, up to the top speed (in gravity's frame: positive is falling).
    vy = Math.min(kind.terminal, vy * gravity + kind.gravity * dt) * gravity;
  }
  const moved = settle(world, y, x, y + vy * dt, kind.half, SNAP);
  grounded = gravity > 0 ? moved.landed : moved.bumped;
  const headHit = gravity > 0 ? moved.bumped : moved.landed;
  if ((moved.landed && vy > 0) || (moved.bumped && vy < 0)) vy = 0;
  // A bump overhead ends the push.
  if (headHit) lift = 0;
  // A pad fires on touch.
  const pad = padAt(world, x, moved.y, kind.half, spentPad);
  if (pad) {
    ({ gravity, vy } = boostOf('pad', pad.kind, gravity, robot.mini));
    grounded = false;
    lift = 0;
    spentPad = pad.id;
    burst = BURST_TIME;
    burstAt = { x: pad.x, y: pad.y, type: 'pad', kind: pad.kind };
  }
  const outside = moved.y - kind.half < 0 || moved.y + kind.half > PLAY_H;
  /** @type {Robot} */
  const vehicle = { ...robot, x, y: moved.y, vy, dir: vy < 0 ? -1 : 1, gravity, held: holding, grounded, lift, spentRing, spentPad, burst, burstAt };
  return { vehicle, crashed: moved.crash || outside || world.hazard(x, moved.y, moved.y, kind.radius) };
}

/**
 * The search's "room to spare" (prove.js): the engine's rule for the robot's body.
 * @param {World} world @param {Robot} robot @param {number} band
 */
export function roomy(world, robot, band) {
  const kind = robotOf(robot.mini);
  return roomyAt(world, robot.x, robot.y, kind.half, kind.radius, band);
}
