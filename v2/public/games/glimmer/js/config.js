// @ts-check
// Świetlik (Glimmer): every number of the game in one place. Distances are art pixels of
// the arena (the canvas is the arena: a whole number of device pixels per art pixel, the
// short side about ARENA_SHORT long), times are seconds. The balance these give is checked
// by v2/tests/glimmer.test.ts and documented in docs/v2/PLAN.md 9.1 (gl-1).

/** One simulation step (fixed: the same moves give the same run). */
export const DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 8;
/** The arena's short side in art pixels (the long side follows the screen). */
export const ARENA_SHORT = 180;

export const PLAYER = {
  /** The hitbox: a small circle in the middle of the sprite (shown while focusing). */
  hitRadius: 1.5,
  /** Keyboard speed, and while focusing (Shift / the focus button). */
  speed: 105,
  focusSpeed: 42,
  /** A finger moves the wisp this many art pixels per art pixel of drag (focus: half). */
  dragGain: 1.25,
  hp: 3,
  /** After a hit: no further hits for this long (the wisp blinks). */
  invulnerable: 1.8,
  /** A hit clears the arena's shots this close to the wisp (a moment to recover). */
  mercyRadius: 30,
  /** A shot that passes this close (beyond the hitbox) is a graze, once per shot. */
  grazeRadius: 9,
};

export const SCORE = { perSecond: 10, perGraze: 15 };

/** Nothing new appears this close to the wisp (shots come from outside or from afar). */
export const SAFE_RADIUS = 46;
/**
 * A shot that comes due (its delay over) this close to the wisp fizzles instead: nothing
 * ever appears on top of it, wherever it moved since the pattern began.
 */
export const SPAWN_CLEAR = 24;

export const POOLS = { shots: 1200, beams: 32, walls: 12, zones: 2 };

/**
 * The director: a new pattern every `gap` seconds (shrinking with time down to minGap), a
 * breather every `breatherEvery` seconds, combos (two patterns at once) after comboFrom.
 */
export const DIRECTOR = {
  firstAt: 1.2,
  gap: 2.9,
  minGap: 1.05,
  gapShrink: 1 / 55,
  breatherEvery: 32,
  breather: 3.5,
  comboFrom: 75,
  comboChance: 0.35,
};

/** Shots get this much faster over time, up to the cap (× their base speed). */
export const SPEED_GROWTH = { perSecond: 1 / 160, cap: 1.9 };
