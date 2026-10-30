// @ts-check
// The world both Rush games share (docs/v2/PLAN.md 9.1, stages w-1 and s-1): Wave Rush and
// Ship Rush fly through the same grid, joints and camera, so a section of either is built,
// placed, drawn and proven by the same engine (this folder). Units: one block = 1 × 1 cell,
// y grows downwards, time is in seconds.

/** One physics step: 240 per second whatever the screen's refresh rate. */
export const STEP = 1 / 240;
/** A longer frame (a stalled tab) is cut to this, so the game never jumps far ahead. */
export const MAX_FRAME = 0.25;

/** The playfield: the vehicle lives in y 0..PLAY_H; leaving it is a crash. */
export const PLAY_H = 12;
/** The band always on screen (terrain fills whatever is above and below it). */
export const VIEW_TOP = -1.5;
export const VIEW_H = 15;
/** A portrait phone still shows at least this many cells ahead and behind (letterboxed band). */
export const MIN_VIEW_W = 18;
/** Where the vehicle sits on screen: a share of the visible width, at most this many cells in. */
export const CAMERA_LEAD = { share: 0.3, max: 9 };

/** Every section starts and ends with this open corridor, so any order joins up. */
export const JOINT = { ceil: 2, floor: 10, lead: 2 };
/** Nothing that can hurt stands closer than this to a section's ends. */
export const JOINT_CLEAR = 2.5;

/** Speed 1.0 in cells per second (the feel of a classic "normal speed" level). */
export const BASE_SPEED = 10.4;

/** After a crash taps are ignored this long, so a frantic tap does not skip the result. */
export const RESTART_LOCK = 0.45;
/** A tap this close before the lock ends still counts. */
export const INPUT_BUFFER_MS = 130;
/** Where a run starts: this many open cells before sector 1. */
export const START_PAD = 8;
/** A respawn starts this far before its checkpoint (inside the open joint). */
export const RESPAWN_BACK = 2;
