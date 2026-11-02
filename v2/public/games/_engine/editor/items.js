// @ts-check
// The level editor's items (docs/v2/PLAN.md 9.1, stages r-3 and r-4): what a tool places,
// where an item is and how far it reaches, picking one, moving it and turning, mirroring
// or scaling it. Pure functions on the games' own section data (geometry.js), so the
// tests use them as the editor does.
import { JOINT } from '../world.js';
import { SCALE, buildGeometry, profileY } from '../geometry.js';

/**
 * @typedef {import('../geometry.js').SectionData} SectionData
 * @typedef {SectionData['hazards'][number]} Item
 * @typedef {[number, number, number, number]} Box x0, y0, x1, y1 (local x)
 * @typedef {{ turn: boolean, flipX: boolean, flipY: boolean, scale: 'xy' | 'u' | 'y' | null }} Can
 *   What an item type can do: turn (any angle), mirror across or up and down, and be
 *   scaled per axis, uniformly (it stays round) or only in height (a portal's gate).
 * @typedef {{ rot?: number, turnBy?: number, flipX?: boolean, flipY?: boolean, sx?: number, sy?: number, gate?: boolean }} Change
 *   rot: the turn to set; turnBy: to add; flipX / flipY: mirror once more; sx / sy: the
 *   scale to set; gate: a portal only at its height (true) or across the corridor.
 */

/** Item types and what they can do (stage r-4; README.md says the same). */
const CAN = /** @type {Record<string, Can>} */ ({
  spike: { turn: true, flipX: true, flipY: true, scale: 'xy' },
  halfSpike: { turn: true, flipX: true, flipY: true, scale: 'xy' },
  block: { turn: true, flipX: true, flipY: true, scale: 'xy' },
  pillar: { turn: true, flipX: true, flipY: true, scale: 'xy' },
  saw: { turn: true, flipX: false, flipY: false, scale: 'u' },
  mine: { turn: true, flipX: false, flipY: false, scale: 'u' },
  orb: { turn: true, flipX: false, flipY: false, scale: 'u' },
  ring: { turn: false, flipX: false, flipY: false, scale: 'u' },
  pad: { turn: false, flipX: false, flipY: true, scale: null },
  portal: { turn: false, flipX: false, flipY: false, scale: 'y' },
});
const NONE = /** @type {Can} */ ({ turn: false, flipX: false, flipY: false, scale: null });

/** @param {Item} item @returns {Can} */
export const canOf = (item) => CAN[item.type] ?? NONE;

/** @param {number} v */
const tidy = (v) => Math.round(v * 1e6) / 1e6;

/**
 * A value on the grid (step 1, ½, ¼), or to a hundredth with no grid (0).
 * @param {number} v @param {number} grid
 */
export const snapTo = (v, grid) => tidy(grid > 0 ? Math.round(v / grid) * grid : Math.round(v * 100) / 100);

/**
 * The item a tool places at (x, y), or null: anywhere on the board, snapped to the grid.
 * Spikes, pillars and pads face away from the nearer of the floor and the ceiling.
 * @param {string} tool @param {Record<string, string | number | boolean>} opt @param {number} x @param {number} y @param {SectionData} s
 * @param {number} [grid]
 * @returns {Item | null}
 */
export function itemFor(tool, opt, x, y, s, grid = 1) {
  const g = buildGeometry({ ...s, hazards: [] });
  const top = profileY(g.ceil, x, 'ceil');
  const bottom = profileY(g.floor, x, 'floor');
  const low = y > (top + bottom) / 2;
  const on = /** @type {'floor' | 'ceil'} */ (low ? 'floor' : 'ceil');
  /** @param {number} v */
  const sn = (v) => snapTo(v, grid);
  /** @param {number} v */
  const inside = (v) => Math.min(s.length, Math.max(0, v));
  const move = opt.move ? { move: { dx: 0, dy: 2, every: 8 } } : {};
  switch (tool) {
    case 'spike': {
      const count = Number(opt.count ?? 2);
      // y is the base: on the floor a tap near it stands the row on it.
      return { type: 'spike', x: inside(sn(x - count / 2)), y: sn(y), dir: low ? 'up' : 'down', count };
    }
    case 'block': {
      const [w = 1, h = 1] = String(opt.size ?? '1×1').split('×').map(Number);
      return { type: 'block', x: inside(sn(x - w / 2)), y: sn(y - h / 2), w, h };
    }
    case 'pillar': {
      const h = Number(opt.h ?? 3);
      const base = sn(y);
      return { type: 'pillar', x: inside(sn(x - 0.5)), on, h, y: tidy(low ? base - h : base) };
    }
    case 'saw':
    case 'mine':
    case 'orb':
      return { type: tool, x: inside(sn(x)), y: sn(y), r: Number(opt.r ?? 0.8), ...move };
    case 'ring':
      return /** @type {Item} */ ({ type: 'ring', kind: String(opt.kind ?? 'jump'), x: inside(sn(x)), y: sn(y) });
    case 'pad':
      return /** @type {Item} */ ({ type: 'pad', kind: String(opt.kind ?? 'jump'), x: inside(sn(x - 0.5)), on, y: sn(y) });
    case 'flip':
    case 'mini':
    case 'big':
      return { type: 'portal', x: inside(sn(x)), kind: tool };
    case 'speed':
      return /** @type {Item} */ ({ type: 'speed', x: inside(sn(x)), k: String(opt.k ?? 'fast') });
    case 'dark':
    case 'invert': {
      const from = inside(sn(x));
      return { type: tool, from, to: Math.min(s.length, from + 8) };
    }
    default:
      return null;
  }
}

/**
 * The box an item takes up (local x), for picking and marking it.
 * @param {Item} item @param {SectionData} s
 * @returns {Box}
 */
export function itemBox(item, s) {
  /** @type {Record<string, any>} */
  const a = item;
  if (a.from !== undefined) return [a.from, JOINT.ceil, a.to, JOINT.floor];
  const g = buildGeometry({ ...s, hazards: [item] });
  if (a.type === 'portal' || a.type === 'speed') {
    const p = g.portals[0];
    return [a.x - 0.45, p?.y0 ?? profileY(g.ceil, a.x, 'ceil'), a.x + 0.45, p?.y1 ?? profileY(g.floor, a.x, 'floor')];
  }
  const b = g.boosters[0];
  if (b) {
    if (b.type === 'ring') {
      const r = 0.85 * (b.scale ?? 1);
      return [b.x - r, b.y - r, b.x + r, b.y + r];
    }
    return b.dir === 'up' ? [b.x - 0.5, b.y - 0.4, b.x + 0.5, b.y] : [b.x - 0.5, b.y, b.x + 0.5, b.y + 0.4];
  }
  /** @type {Box} */
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const h of g.hazards) {
    const hb = h.shape === 'circle' ? [h.x - h.r, h.y - h.r, h.x + h.r, h.y + h.r] : h.bbox;
    box[0] = Math.min(box[0], /** @type {number} */ (hb[0]));
    box[1] = Math.min(box[1], /** @type {number} */ (hb[1]));
    box[2] = Math.max(box[2], /** @type {number} */ (hb[2]));
    box[3] = Math.max(box[3], /** @type {number} */ (hb[3]));
  }
  return Number.isFinite(box[0]) ? box : [a.x ?? 0, 5.5, (a.x ?? 0) + 1, 6.5];
}

/**
 * The index of the item at (x, y) — the smallest whose box (a little grown) holds it —
 * else the nearest within half a cell, or −1.
 * @param {SectionData} s @param {number} x @param {number} y
 */
export function pickItem(s, x, y) {
  let best = -1;
  let bestArea = Infinity;
  let near = -1;
  let nearD = 0.5;
  s.hazards.forEach((h, i) => {
    const [x0, y0, x1, y1] = itemBox(h, s);
    const grow = 0.15;
    const dx = Math.max(0, x0 - grow - x, x - x1 - grow);
    const dy = Math.max(0, y0 - grow - y, y - y1 - grow);
    if (dx === 0 && dy === 0) {
      const area = (x1 - x0) * (y1 - y0);
      if (area <= bestArea) {
        bestArea = area;
        best = i;
      }
    } else if (Math.hypot(dx, dy) < nearD) {
      nearD = Math.hypot(dx, dy);
      near = i;
    }
  });
  return best >= 0 ? best : near;
}

/**
 * The item with its height written out (stage r-4: free placement): a spike, a pillar or
 * a pad that stood on its surface gets the y it stood at, so it can move off it.
 * @param {Item} item @param {SectionData} s
 * @returns {Item}
 */
export function placed(item, s) {
  /** @type {Record<string, any>} */
  const a = { ...item };
  const g = buildGeometry({ ...s, hazards: [] });
  if ((a.type === 'spike' || a.type === 'halfSpike') && a.on) {
    const x = a.x + 0.5;
    a.y = a.on === 'floor' ? profileY(g.floor, x, 'floor') : profileY(g.ceil, x, 'ceil');
    a.dir = a.on === 'floor' ? 'up' : 'down';
    delete a.on;
  } else if (a.type === 'pillar' && a.y === undefined) {
    const x = a.x + (a.w ?? 1) / 2;
    a.y = a.on === 'floor' ? profileY(g.floor, x, 'floor') - a.h : profileY(g.ceil, x, 'ceil');
  } else if (a.type === 'pad' && a.y === undefined) {
    const x = a.x + 0.5;
    a.y = a.on === 'floor' ? profileY(g.floor, x, 'floor') : profileY(g.ceil, x, 'ceil');
  }
  return /** @type {Item} */ (a);
}

/**
 * The item moved by (dx, dy) cells (a stretch and a portal across the corridor only along).
 * @param {Item} item @param {number} dx @param {number} dy @param {SectionData} s
 * @returns {Item}
 */
export function moveItem(item, dx, dy, s) {
  /** @type {Record<string, any>} */
  const a = dy ? placed(item, s) : { ...item };
  if (a.from !== undefined) {
    a.from = tidy(a.from + dx);
    a.to = tidy(a.to + dx);
  } else a.x = tidy(a.x + dx);
  if (a.y !== undefined && dy) a.y = tidy(a.y + dy);
  return /** @type {Item} */ (a);
}

/** Where an item's numbers put it: x (a stretch's start) and y, if it has one. @param {Item} item @param {SectionData} s */
export function placeOf(item, s) {
  /** @type {Record<string, any>} */
  const a = placed(item, s);
  return { x: /** @type {number} */ (a.from ?? a.x), y: /** @type {number | undefined} */ (a.y) };
}

/** @param {number} v */
const clampScale = (v) => tidy(Math.min(SCALE.max, Math.max(SCALE.min, v)));

/**
 * The item turned, mirrored or scaled as `change` says, as far as its type can be (the
 * rest of it as it was). Identity fields are left out, so an item never turned has none.
 * @param {Item} item @param {Change} change @param {SectionData} s
 * @returns {Item}
 */
export function transformItem(item, change, s) {
  const can = canOf(item);
  /** @type {Record<string, any>} */
  const a = { ...item };
  if (can.turn && (change.rot !== undefined || change.turnBy !== undefined)) {
    const rot = change.rot ?? (a.rot ?? 0) + (change.turnBy ?? 0);
    a.rot = tidy(((rot % 360) + 360) % 360);
  }
  if (can.flipX && change.flipX) a.fx = !a.fx;
  if (can.flipY && change.flipY) a.fy = !a.fy;
  if (a.type === 'portal' && change.gate !== undefined) {
    if (change.gate && a.y === undefined) {
      const g = buildGeometry({ ...s, hazards: [] });
      a.y = snapTo((profileY(g.ceil, a.x, 'ceil') + profileY(g.floor, a.x, 'floor')) / 2, 0.5);
    } else if (!change.gate) {
      delete a.y;
      delete a.sy;
    }
  }
  if (can.scale === 'u' && (change.sx !== undefined || change.sy !== undefined)) {
    const v = clampScale(/** @type {number} */ (change.sx ?? change.sy));
    a.sx = v;
    a.sy = v;
  } else if (can.scale === 'xy') {
    if (change.sx !== undefined) a.sx = clampScale(change.sx);
    if (change.sy !== undefined) a.sy = clampScale(change.sy);
  } else if (can.scale === 'y' && change.sy !== undefined && a.y !== undefined) a.sy = clampScale(change.sy);
  if (!a.rot) delete a.rot;
  if (!a.fx) delete a.fx;
  if (!a.fy) delete a.fy;
  if (a.sx === 1) delete a.sx;
  if (a.sy === 1) delete a.sy;
  return /** @type {Item} */ (a);
}

/** An item moved along by dx cells (into another section's x). @param {Item} item @param {number} dx @returns {Item} */
export function shiftX(item, dx) {
  /** @type {Record<string, any>} */
  const a = { ...item };
  if (a.from !== undefined) {
    a.from = tidy(a.from + dx);
    a.to = tidy(a.to + dx);
  } else a.x = tidy(a.x + dx);
  return /** @type {Item} */ (a);
}

/** The item kept inside a section of `length` cells. @param {Item} item @param {number} length @returns {Item} */
export function keepInside(item, length) {
  /** @type {Record<string, any>} */
  const a = { ...item };
  if (a.from !== undefined) {
    const span = Math.min(length, a.to - a.from);
    a.from = tidy(Math.min(length - span, Math.max(0, a.from)));
    a.to = tidy(a.from + span);
  } else a.x = tidy(Math.min(length, Math.max(0, a.x)));
  if (a.y !== undefined) a.y = tidy(Math.min(13.5, Math.max(-1.5, a.y)));
  return /** @type {Item} */ (a);
}
