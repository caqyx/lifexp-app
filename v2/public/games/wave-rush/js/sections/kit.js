// @ts-check
// Small helpers for writing sections by hand (docs/v2/PLAN.md 9.1, stage w-2). They
// only spell out profile strings: every number in a section is still chosen by hand.

import { JOINT } from '../config.js';

/** @param {number} n */
const fmt = (n) => String(Math.round(n * 1000) / 1000);

/**
 * A run from height `from` to `to` at 45°, then flat for the rest of `length`.
 * @param {number} from @param {number} to @param {number} length
 */
function slopeThenFlat(from, to, length) {
  const rise = Math.abs(to - from);
  const parts = [];
  if (rise > 0) parts.push(`${to > from ? 'd' : 'u'}${fmt(rise)}`);
  if (length - rise > 1e-9) parts.push(`r${fmt(length - rise)}`);
  return parts.join(' ');
}

/**
 * A diagonal tunnel: from the joint, both walls close in at 45° to a corridor `gap`
 * high centred on `centre`, then follow `legs` (cells: positive goes down, negative up,
 * `0` + `flat` for a level stretch) and open back out to the joint.
 * @param {{ lead?: number, centre?: number, gap: number, legs: (number | string)[], tail?: number }} spec
 *   legs: numbers are 45° legs; a string `'r3'` is a level stretch of 3 cells.
 * @returns {{ ceil: string, floor: string, length: number, legsAt: number }}
 *   legsAt: the x where the first leg starts.
 */
export function tunnel(spec) {
  const lead = spec.lead ?? 5;
  const tail = spec.tail ?? 3;
  let centre = spec.centre ?? 6;
  const top = centre - spec.gap / 2;
  const bottom = centre + spec.gap / 2;
  const funnel = Math.max(Math.abs(top - JOINT.ceil), Math.abs(JOINT.floor - bottom));
  const ceil = [`${JOINT.ceil}`, `r${lead}`, slopeThenFlat(JOINT.ceil, top, funnel)];
  const floor = [`${JOINT.floor}`, `r${lead}`, slopeThenFlat(JOINT.floor, bottom, funnel)];
  let length = lead + funnel;
  const legsAt = length;
  for (const leg of spec.legs) {
    if (typeof leg === 'string') {
      ceil.push(leg);
      floor.push(leg);
      length += Number(leg.slice(1));
      continue;
    }
    const token = `${leg > 0 ? 'd' : 'u'}${fmt(Math.abs(leg))}`;
    ceil.push(token);
    floor.push(token);
    centre += leg;
    length += Math.abs(leg);
  }
  const out = Math.max(Math.abs(centre - spec.gap / 2 - JOINT.ceil), Math.abs(JOINT.floor - centre - spec.gap / 2));
  ceil.push(slopeThenFlat(centre - spec.gap / 2, JOINT.ceil, out), `r${tail}`);
  floor.push(slopeThenFlat(centre + spec.gap / 2, JOINT.floor, out), `r${tail}`);
  length += out + tail;
  return { ceil: ceil.filter(Boolean).join(' '), floor: floor.filter(Boolean).join(' '), length: Math.round(length * 1000) / 1000, legsAt };
}

/**
 * A room taller than the joint (ceiling `top`, floor `bottom`) with 45° steps in and out.
 * @param {{ lead?: number, top: number, bottom: number, inner: number, tail?: number }} spec
 * @returns {{ ceil: string, floor: string, length: number, innerAt: number }}
 */
export function room(spec) {
  const lead = spec.lead ?? 4;
  const tail = spec.tail ?? 3;
  const funnel = Math.max(Math.abs(spec.top - JOINT.ceil), Math.abs(spec.bottom - JOINT.floor));
  const ceil = [`${JOINT.ceil}`, `r${lead}`, slopeThenFlat(JOINT.ceil, spec.top, funnel), `r${spec.inner}`, slopeThenFlat(spec.top, JOINT.ceil, funnel), `r${tail}`];
  const floor = [`${JOINT.floor}`, `r${lead}`, slopeThenFlat(JOINT.floor, spec.bottom, funnel), `r${spec.inner}`, slopeThenFlat(spec.bottom, JOINT.floor, funnel), `r${tail}`];
  return { ceil: ceil.filter(Boolean).join(' '), floor: floor.filter(Boolean).join(' '), length: lead + funnel * 2 + spec.inner + tail, innerAt: lead + funnel };
}

/**
 * Parts (each starting and ending at the joint) one after another, as one section.
 * @param {...{ ceil: string, floor: string, length: number }} parts
 * @returns {{ ceil: string, floor: string, length: number, at: number[] }} at: where each part starts
 */
export function join(...parts) {
  const at = [];
  let length = 0;
  const ceil = [];
  const floor = [];
  for (const [i, part] of parts.entries()) {
    at.push(length);
    const c = part.ceil.split(' ');
    const f = part.floor.split(' ');
    ceil.push(...(i === 0 ? c : c.slice(1)));
    floor.push(...(i === 0 ? f : f.slice(1)));
    length += part.length;
  }
  return { ceil: ceil.join(' '), floor: floor.join(' '), length: Math.round(length * 1000) / 1000, at };
}

/**
 * An open stretch of the joint corridor.
 * @param {number} length
 */
export function open(length) {
  return { ceil: `${JOINT.ceil} r${length}`, floor: `${JOINT.floor} r${length}`, length };
}
