// @ts-check
// Rush's modes (docs/v2/PLAN.md 9.1, stages rr-a and rr-b): each is a game of its own page, next to
// the picker — its sectors, records, skins, finale and editor saves stay its own, under the
// same storage keys as when it was a game on its own, so a player's progress carries over
// untouched. The picker reads them only through each mode's records.
import { records as waveRecords } from '../../wave-rush/js/records.js';
import { SKINS as WAVE_SKINS, resolveSkin as waveSkin } from '../../wave-rush/js/skins.js';
import { paintSkin as paintWave } from '../../wave-rush/js/preview.js';
import { translator as waveTexts } from '../../wave-rush/js/i18n.js';
import { records as shipRecords } from '../../ship-rush/js/records.js';
import { SKINS as SHIP_SKINS, resolveSkin as shipSkin } from '../../ship-rush/js/skins.js';
import { paintSkin as paintShip } from '../../ship-rush/js/preview.js';
import { translator as shipTexts } from '../../ship-rush/js/i18n.js';
import { records as flipRecords } from '../../flip-rush/js/records.js';
import { SKINS as FLIP_SKINS, resolveSkin as flipSkin } from '../../flip-rush/js/skins.js';
import { paintSkin as paintFlip } from '../../flip-rush/js/preview.js';
import { translator as flipTexts } from '../../flip-rush/js/i18n.js';
import { records as robotRecords } from '../../robot-rush/js/records.js';
import { SKINS as ROBOT_SKINS, resolveSkin as robotSkin } from '../../robot-rush/js/skins.js';
import { paintSkin as paintRobot } from '../../robot-rush/js/preview.js';
import { translator as robotTexts } from '../../robot-rush/js/i18n.js';

/**
 * @typedef {import('../../_engine/records.js').Records} Records
 * @typedef {import('../../_engine/records.js').GameStorage} GameStorage
 * @typedef {{
 *   id: string, dir: string, records: Records,
 *   skin: (id: string | null, progress: { demonComplete: boolean }) => any,
 *   paint: (ctx: CanvasRenderingContext2D, skin: any) => void,
 *   texts: (lang: 'pl' | 'en') => (key: any) => string,
 *   skins: readonly unknown[],
 * }} Mode
 *   id: the picker's name for it (?mode=…); dir: its page's folder next to the picker.
 */

/** The modes, in the picker's order. @type {readonly Mode[]} */
export const MODES = [
  { id: 'wave', dir: 'wave-rush', records: waveRecords, skin: waveSkin, paint: paintWave, texts: waveTexts, skins: WAVE_SKINS },
  { id: 'ship', dir: 'ship-rush', records: shipRecords, skin: shipSkin, paint: paintShip, texts: shipTexts, skins: SHIP_SKINS },
  { id: 'flip', dir: 'flip-rush', records: flipRecords, skin: flipSkin, paint: paintFlip, texts: flipTexts, skins: FLIP_SKINS },
  { id: 'robot', dir: 'robot-rush', records: robotRecords, skin: robotSkin, paint: paintRobot, texts: robotTexts, skins: ROBOT_SKINS },
];

/** @param {string | null} id */
export const modeById = (id) => MODES.find((m) => m.id === id) ?? null;

/**
 * Where a mode's page is from the picker, with the query passed on (the language; in the
 * tests the switches) and the picker's own `mode` left out.
 * @param {Mode} mode @param {string} search the picker's query
 */
export function modeHref(mode, search) {
  const params = new URLSearchParams(search);
  params.delete('mode');
  const query = params.toString();
  return `../${mode.dir}/index.html${query ? `?${query}` : ''}`;
}

/**
 * How far the player got in a mode, as the picker says it: the best run and the finale.
 * @param {Mode} mode @param {GameStorage | null} storage
 * @returns {{ best: number | null, finale: 'locked' | 'open' | 'done', finaleBest: number | null }}
 */
export function progressOf(mode, storage) {
  const best = mode.records.readBest(storage);
  const progress = mode.records.readProgress(storage);
  const finaleBest = mode.records.readBest(storage, mode.records.KEYS.finaleBest);
  const finale = progress.finaleComplete ? 'done' : progress.demonComplete ? 'open' : 'locked';
  return { best: best ? best.percent : null, finale, finaleBest: finaleBest ? finaleBest.percent : null };
}
