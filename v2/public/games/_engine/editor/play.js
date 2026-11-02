// @ts-check
// "Testuj" and "Zweryfikuj" (docs/v2/PLAN.md 9.1, stages r-3 and r-4): the game plays a
// level from its editor as a one-sector level of its own sections, never shuffled, at the
// level's tier and in the look of the game's sector at that tier. The editor leaves the
// level in this tab's sessionStorage and opens the game's page with ?editor=1; the page
// reads it back here. A test is practice; a verification is normal mode from the start
// with no checkpoint, and finishing it leaves word for the editor (verifiedWord).
import { readJson } from '../records.js';
import { range } from '../sectors.js';
import { checkLevel, playHash } from './format.js';

/**
 * @typedef {import('./format.js').Level} Level
 * @typedef {import('./format.js').Palette} Palette
 * @typedef {import('../sectors.js').SectorDef} SectorDef
 */

/**
 * The sector a level plays as.
 * @param {Level} level @param {SectorDef[]} sectors @param {SectorDef | null} finale
 * @returns {SectorDef}
 */
export function customSector(level, sectors, finale) {
  const owner = sectors.find((s) => s.tier === level.tier) ?? sectors.find((s) => s.bands?.some((b) => b.tier === level.tier));
  const band = owner?.bands?.find((b) => b.tier === level.tier);
  const theme = band?.theme ?? owner?.theme ?? (finale && finale.tier === level.tier ? finale.theme : /** @type {SectorDef} */ (sectors[0]).theme);
  return { id: 1, key: 'custom', tier: level.tier, theme, groups: [range(1, level.sections.length)], portals: [], fixed: true };
}

/**
 * The level the editor left for this game (checked again), where to start and whether
 * this is its verification (from the start, normal mode, no checkpoints), or null.
 * @param {Palette} palette @param {string} search the page's query @param {string} key the game's editorPlay key
 * @returns {{ level: Level, from: number, verify: boolean } | null}
 */
export function readPlay(palette, search, key) {
  if (new URLSearchParams(search).get('editor') !== '1') return null;
  try {
    const raw = /** @type {any} */ (readJson(sessionStorage, key));
    if (!raw || raw.game !== palette.id) return null;
    const { level } = checkLevel(raw.level, palette);
    if (!level) return null;
    const verify = raw.verify === true;
    const from = !verify && Number.isInteger(raw.from) && raw.from >= 1 && raw.from <= level.sections.length ? raw.from : 1;
    return { level, from, verify };
  } catch {
    return null;
  }
}

/**
 * The game's word that a level was finished in its verification: what the editor looks
 * for when it opens (the same level, by its play data's hash).
 * @param {Level} level
 */
export const verifiedWord = (level) => ({ game: level.game, hash: playHash(level) });
