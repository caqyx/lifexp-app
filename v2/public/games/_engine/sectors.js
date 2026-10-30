// @ts-check
// How a Rush game's sectors are described (docs/v2/PLAN.md 9.1, stages w-1, w-2 and s-1):
// shuffle groups, portal rules and Demon bands. The same shape serves Wave Rush and Ship
// Rush; each game's config.js lists its own sectors.

/**
 * @typedef {{ kind: 'gravity' | 'mini', count: number, span?: number, band?: number }} PortalRule
 *   gravity: `count` flips upside down, each with its own portal back `span` sections
 *   later, at section boundaries (within `band` when given), so a sector always ends
 *   upright. mini: one pair around each of the band's sections marked `mini` (in its own
 *   open lead-in and lead-out), so mini is only ever flown where it was designed and
 *   proven; `count` must equal the number of those sections.
 * @typedef {{ from: number, to: number, tier: string, theme: string, key: string }} Band
 *   Demon: the sections from..to (numbers) fly at their own tier, look and checkpoint.
 * @typedef {{
 *   id: number, key: string, tier: string, theme: string,
 *   groups: number[][], portals: PortalRule[], bands?: Band[], fixed?: boolean, alternate?: boolean,
 * }} SectorDef
 *   `groups`: section numbers (1-based) shuffled among themselves and played in this
 *   order (`fixed`: not shuffled at all, the finale; `alternate`: each group dealt out by
 *   vehicle in turns, level.js `orderSections`).
 */

/** @param {number} from @param {number} to */
export const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * The band a section number belongs to, or null.
 * @param {SectorDef} sector @param {number} number
 */
export function bandOf(sector, number) {
  return sector.bands?.find((b) => number >= b.from && number <= b.to) ?? null;
}

/**
 * The tier and look of a section of a sector (its band's, or the sector's).
 * @param {SectorDef} sector @param {number} number
 */
export function sectionStyle(sector, number) {
  const band = bandOf(sector, number);
  return { tier: band ? band.tier : sector.tier, theme: band ? band.theme : sector.theme };
}
