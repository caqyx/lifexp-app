// Rush, one game with modes (docs/v2/PLAN.md 9.1, stage rr-a): the picker reads each mode's
// progress where that mode has always kept it — the same storage keys as when Wave, Ship
// and Flip Rush were games of their own — so a player's records, skins, achievements,
// finale and editor saves carry over untouched; a mode's page is next to the picker.
import { describe, expect, test } from 'vitest';
import { MODES, modeById, modeHref, progressOf } from '../public/games/rush/js/modes.js';
import { PICKER_KEYS, pickerTextsOf } from '../public/games/rush/js/i18n.js';
import { APP_TEXT_KEYS } from '../public/games/_engine/app.js';
import { translator as waveTexts } from '../public/games/wave-rush/js/i18n.js';
import { translator as shipTexts } from '../public/games/ship-rush/js/i18n.js';
import { translator as flipTexts } from '../public/games/flip-rush/js/i18n.js';
import { translator as robotTexts } from '../public/games/robot-rush/js/i18n.js';

/** A device's storage as a player of the separate games left it. */
function storageOf(entries: Record<string, unknown>) {
  const data = new Map(Object.entries(entries).map(([k, v]) => [k, JSON.stringify(v)]));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), length: data.size };
}

describe('the modes', () => {
  test('Wave, Ship, Flip and Robot Rush, each its own page next to the picker; ?mode= and the language pass on', () => {
    expect(MODES.map((m) => [m.id, m.dir])).toEqual([['wave', 'wave-rush'], ['ship', 'ship-rush'], ['flip', 'flip-rush'], ['robot', 'robot-rush']]);
    expect(modeById('ship')?.dir).toBe('ship-rush');
    expect(modeById('cube')).toBeNull();
    expect(modeHref(MODES[0]!, '?lang=en&mode=wave')).toBe('../wave-rush/index.html?lang=en');
    expect(modeHref(MODES[2]!, '')).toBe('../flip-rush/index.html');
  });

  test('progress is read from the keys the separate games wrote (nothing to migrate, nothing lost)', () => {
    const storage = storageOf({
      'lifexp-waverush-best': { sector: 4, section: 2, percent: 57 },
      'lifexp-shiprush-best': { sector: 6, section: 9, percent: 100 },
      'lifexp-shiprush-progress': { demonComplete: true, finaleComplete: false },
      'lifexp-shiprush-finale-best': { sector: 1, section: 3, percent: 41 },
      'lifexp-fliprush-progress': { demonComplete: true, finaleComplete: true },
      'lifexp-fliprush-skin': 'spark',
    });
    const [wave, ship, flip] = MODES;
    expect(progressOf(wave!, storage)).toEqual({ best: 57, finale: 'locked', finaleBest: null });
    expect(progressOf(ship!, storage)).toEqual({ best: 100, finale: 'open', finaleBest: 41 });
    expect(progressOf(flip!, storage)).toEqual({ best: null, finale: 'done', finaleBest: null });
    // The player's skin, as the mode itself would wear it.
    expect(flip!.skin(flip!.records.readSkin(storage), flip!.records.readProgress(storage)).id).toBe('spark');
    // Every mode keeps its own keys: no key is shared, none was renamed.
    expect(MODES.map((m) => m.records.KEYS.best)).toEqual(['lifexp-waverush-best', 'lifexp-shiprush-best', 'lifexp-fliprush-best', 'lifexp-robotrush-best']);
    expect(MODES.map((m) => m.records.KEYS.editorSlots)).toEqual(['lifexp-waverush-editor-slots', 'lifexp-shiprush-editor-slots', 'lifexp-fliprush-editor-slots', 'lifexp-robotrush-editor-slots']);
    // Nothing is read without a storage.
    expect(progressOf(wave!, null)).toEqual({ best: null, finale: 'locked', finaleBest: null });
  });

  test('texts in both languages; every mode has the way back to the picker', () => {
    for (const key of PICKER_KEYS) {
      expect(pickerTextsOf('pl')[key]).toBeTruthy();
      expect(pickerTextsOf('en')[key]).toBeTruthy();
    }
    expect(APP_TEXT_KEYS).toContain('modes');
    for (const texts of [waveTexts, shipTexts, flipTexts, robotTexts]) {
      expect(texts('pl')('modes')).toContain('Rush');
      expect(texts('en')('modes')).toContain('Rush');
    }
  });
});
