// @ts-check
// The ball and the spider (docs/v2/PLAN.md 9.1, stage f-1), written for this game from
// the genre's behaviour (stage f-0 research), not from anyone's code.
//
// Both fall toward their gravity (0.6 of a cube's, up to a top speed) and rest and run
// on whatever stops them. The input is a TAP:
// - a press is queued while it is held, and acts the moment the vehicle is on the ground
//   (at once if it already is; a press made in the air acts on landing, if still held);
//   it acts once — holding on does nothing more, a new press is needed. (The page also
//   keeps a very short tap alive briefly, so a quick tap just before landing counts.)
// - BALL: on the ground, a press flips gravity and kicks the ball toward the other side,
//   where it lands and rolls on.
// - SPIDER: on the ground, a press snaps it at once to the first solid surface straight
//   across (above it if gravity pulled down, below if up) and flips gravity. The way
//   across is instant: only the spot it lands on counts — a hazard there is a crash; a
//   hazard it passes is not. With no surface across, the spider is lost (a crash).
// - ORBS and PADS (stage f-2, boosters.js): an orb fires on a fresh press while touched
//   (before the ground takes the press), a pad on touch; both set the vertical speed.
// Collision, as for the ship (../../_engine/solids.js `settle`): a solid's top and
// underside carry the body; coming in from the side — a block's, a pillar's, a step's —
// is a crash; any hazard touching the body's circle is a crash; leaving the playfield is a
// crash. Walking off a ledge, the vehicle falls.
import { createVehicle } from '../../_engine/game.js';
import { roomyAt, settle } from '../../_engine/solids.js';
import { boostOf, padAt, ringAt } from './boosters.js';
import { PLAY_H, SNAP, STREAK_TIME, bodyOf } from './config.js';

/** How long an orb's or a pad's flash lasts, seconds (drawing only). */
export const BURST_TIME = 0.3;

export { advanceClock, isBuffered } from '../../_engine/clock.js';

/**
 * @typedef {import('../../_engine/game.js').Vehicle} Body
 * @typedef {import('../../_engine/solids.js').World} World
 */

const EPS = 1e-9;

/**
 * A ball or a spider at (x, y), at rest in the air (it will fall to the floor).
 * @param {number} x @param {number} y @param {'ball' | 'spider'} [mode]
 * @returns {Body}
 */
export function createBody(x, y, mode = 'ball') {
  return { ...createVehicle(x, y), mode, held: false, queued: false, grounded: false, streak: 0, streakFrom: y };
}

/**
 * Where the spider lands snapping across: the first solid surface straight across from
 * its body toward `gravity` (+1 down, −1 up), or null when there is none.
 * @param {World} world @param {number} x @param {number} y @param {number} half @param {1 | -1} gravity
 */
export function snapTarget(world, x, y, half, gravity) {
  let best = gravity > 0 ? Infinity : -Infinity;
  for (const s of world.solids.get(Math.floor(x)) ?? []) {
    if (x + half <= s.x0 + EPS || x - half >= s.x1 - EPS) continue;
    if (gravity > 0 && s.y0 >= y + half - EPS) best = Math.min(best, s.y0);
    if (gravity < 0 && s.y1 <= y - half + EPS) best = Math.max(best, s.y1);
  }
  if (!Number.isFinite(best)) return null;
  return gravity > 0 ? best - half : best + half;
}

/**
 * One fixed step of the ball or the spider in a world.
 * @param {Body} body @param {boolean} holding @param {number} speed cells/s @param {number} dt @param {World} world
 * @param {number} [ringShrink] cells off every orb's reach (the validator's search only)
 * @returns {{ vehicle: Body, crashed: boolean }}
 */
export function stepBody(body, holding, speed, dt, world, ringShrink = 0) {
  const kind = bodyOf(body.mini);
  const spider = body.mode === 'spider';
  // A press waits while it is held; letting go drops it.
  let queued = holding ? body.queued === true || body.held !== true : false;
  /** @type {1 | -1} */
  let gravity = body.gravity;
  let vy = body.vy;
  let y = body.y;
  let streak = Math.max(0, (body.streak ?? 0) - dt);
  let streakFrom = body.streakFrom ?? y;
  let sinceAct = (body.sinceAct ?? 1) + dt;
  let grounded = body.grounded === true;
  let spentRing = body.spentRing;
  let spentPad = body.spentPad;
  let burst = Math.max(0, (body.burst ?? 0) - dt);
  let burstAt = body.burstAt;
  const x = body.x + speed * dt;
  // An orb takes a fresh press before the ground does.
  const ring = queued ? ringAt(world, x, y, body.mini, spentRing, ringShrink) : null;
  if (ring) {
    queued = false;
    sinceAct = 0;
    ({ gravity, vy } = boostOf('ring', ring.kind, gravity, body.mini));
    grounded = false;
    spentRing = ring.id;
    burst = BURST_TIME;
    burstAt = { x: ring.x, y: ring.y, type: 'ring', kind: ring.kind };
  } else if (queued && grounded) {
    queued = false;
    sinceAct = 0;
    gravity = /** @type {1 | -1} */ (-gravity);
    if (spider) {
      const target = snapTarget(world, x, y, kind.half, gravity);
      if (target === null) return { vehicle: { ...body, x, gravity, queued, held: holding, grounded: false }, crashed: true };
      streakFrom = y;
      streak = STREAK_TIME;
      y = target;
      vy = 0;
    } else {
      vy = kind.kick * gravity;
    }
  }
  // Fall toward gravity, up to the top speed (in gravity's frame: positive is falling).
  const fall = Math.min(kind.terminal, vy * gravity + kind.gravity * dt);
  vy = fall * gravity;
  const moved = settle(world, y, x, y + vy * dt, kind.half, SNAP);
  grounded = gravity > 0 ? moved.landed : moved.bumped;
  if ((moved.landed && vy > 0) || (moved.bumped && vy < 0)) vy = 0;
  // A pad fires on touch.
  const pad = padAt(world, x, moved.y, kind.half, spentPad);
  if (pad) {
    ({ gravity, vy } = boostOf('pad', pad.kind, gravity, body.mini));
    grounded = false;
    spentPad = pad.id;
    burst = BURST_TIME;
    burstAt = { x: pad.x, y: pad.y, type: 'pad', kind: pad.kind };
  }
  const outside = moved.y - kind.half < 0 || moved.y + kind.half > PLAY_H;
  /** @type {Body} */
  const vehicle = { ...body, x, y: moved.y, vy, dir: vy < 0 ? -1 : 1, gravity, held: holding, queued, grounded, streak, streakFrom, sinceAct, spentRing, spentPad, burst, burstAt };
  return { vehicle, crashed: moved.crash || outside || world.hazard(x, moved.y, moved.y, kind.radius) };
}

/**
 * The search's "room to spare" (prove.js): the engine's rule for this body.
 * @param {World} world @param {Body} body @param {number} band
 */
export function roomy(world, body, band) {
  const kind = bodyOf(body.mini);
  return roomyAt(world, body.x, body.y, kind.half, kind.radius, band);
}
