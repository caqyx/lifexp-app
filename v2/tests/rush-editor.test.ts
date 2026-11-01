// The Rush level editor's pure parts (docs/v2/PLAN.md 9.1, stage r-3): the level file
// (checked import with every problem and where it is, export and back), placing and
// picking items, its texts, and a level played by each game as a run of its own.
import { describe, expect, test } from 'vitest';
import { anchorOf, itemFor, nearestItem } from '../public/games/_engine/editor/editor.js';
import { FORMAT, checkLevel, emptyLevel, fromJson, toJson, type Level } from '../public/games/_engine/editor/format.js';
import { EDITOR_KEYS, editorTextsOf } from '../public/games/_engine/editor/i18n.js';
import { customSector } from '../public/games/_engine/editor/play.js';
import { PALETTE as WAVE } from '../public/games/wave-rush/js/palette.js';
import { PALETTE as SHIP } from '../public/games/ship-rush/js/palette.js';
import { PALETTE as FLIP } from '../public/games/flip-rush/js/palette.js';
import { buildCustom as flipCustom } from '../public/games/flip-rush/js/run.js';
import { buildCustom as shipCustom } from '../public/games/ship-rush/js/run.js';
import { buildCustom as waveCustom } from '../public/games/wave-rush/js/run.js';
import { SECTORS as FLIP_SECTORS } from '../public/games/flip-rush/js/config.js';
import { sectionProblems as flipProblems } from '../public/games/flip-rush/js/prove.js';
import { SECTION_LIBRARY as FLIP_LIBRARY } from '../public/games/flip-rush/js/sections/index.js';
import { SECTION_LIBRARY as SHIP_LIBRARY } from '../public/games/ship-rush/js/sections/index.js';

const keysOf = (problems: { key: string }[]) => problems.map((p) => p.key);

describe('the level file', () => {
  test('a new level is one open section of the game’s first vehicle, and survives export and import', () => {
    for (const palette of [WAVE, SHIP, FLIP]) {
      const level = emptyLevel(palette, 'Test');
      expect(level).toMatchObject({ format: FORMAT, version: 1, game: palette.id, tier: palette.tiers[0] });
      expect(level.sections[0]).toMatchObject({ length: 30, ceil: '2 r30', floor: '10 r30', mode: palette.modes[0], hazards: [] });
      const back = fromJson(toJson(level), palette);
      expect(back.problems).toEqual([]);
      expect(back.level).toEqual(level);
    }
  });

  test('official sections with every new item (speed, portals, moving, dark, invert, orbs, pads) go out and back unchanged', () => {
    const pick = (lib: Record<number, Level['sections']>, s: number) =>
      lib[s]!.map((d) => {
        const copy = { ...d };
        delete copy.deco;
        delete copy.tier;
        return copy;
      });
    const flip: Level = { format: FORMAT, version: 1, game: 'flip-rush', name: 'Flip 5', tier: 'insane', sections: pick(FLIP_LIBRARY, 5) };
    const back = fromJson(toJson(flip), FLIP);
    expect(back.problems).toEqual([]);
    expect(back.level!.sections.map((s) => s.hazards)).toEqual(flip.sections.map((s) => s.hazards));
    const ship: Level = { format: FORMAT, version: 1, game: 'ship-rush', name: 'Demon', tier: 'easyDemon', sections: pick(SHIP_LIBRARY, 6) };
    expect(fromJson(toJson(ship), SHIP).problems).toEqual([]);
  });

  test('broken files say what is wrong and where', () => {
    expect(keysOf(fromJson('{oops', FLIP).problems)).toEqual(['errJson']);
    expect(keysOf(fromJson('[]', FLIP).problems)).toEqual(['errNotObject']);
    const good = JSON.parse(toJson(emptyLevel(FLIP, 'x')));
    const wrongGame = checkLevel({ ...good, game: 'ship-rush' }, FLIP);
    expect(wrongGame.level).toBeNull();
    expect(wrongGame.problems).toEqual([{ path: 'game', key: 'errGame', values: { expected: 'flip-rush', got: 'ship-rush' } }]);
    const bad = {
      ...good,
      tier: 'impossible',
      sections: [
        {
          ...good.sections[0],
          length: 5,
          hazards: [
            { type: 'laser', x: 3 },
            { type: 'spike', x: 'eight', on: 'floor' },
            { type: 'saw', x: 99, y: 6, r: 1 },
            { type: 'ring', x: 9, y: 6, kind: 'warp' },
            { type: 'block', x: 9, y: 6, w: 1 },
            { type: 'dark', from: 9, to: 4 },
          ],
        },
      ],
    };
    const r = checkLevel(bad, FLIP);
    expect(r.level).toBeNull();
    const paths = r.problems.map((p) => `${p.path} ${p.key}`);
    expect(paths).toEqual(
      expect.arrayContaining([
        'tier errTier',
        'sections[0].length errLength',
        'sections[0].hazards[0].type errType',
        'sections[0].hazards[1].x errNumber',
        'sections[0].hazards[2].x errInside',
        'sections[0].hazards[3].kind errWord',
        'sections[0].hazards[4].h errMissing',
        'sections[0].hazards[5].to errRange',
      ]),
    );
  });

  test('a game only takes its own items: orbs in Flip Rush, inverted controls in Ship Rush, nothing moving in Wave Rush', () => {
    const level = (palette: typeof FLIP, hazards: unknown[]) => ({ ...JSON.parse(toJson(emptyLevel(palette, 'x'))), sections: [{ length: 30, ceil: '2 r30', floor: '10 r30', hazards }] });
    expect(keysOf(checkLevel(level(SHIP, [{ type: 'ring', x: 9, y: 6, kind: 'jump' }]), SHIP).problems)).toEqual(['errType']);
    expect(keysOf(checkLevel(level(FLIP, [{ type: 'invert', from: 5, to: 9 }]), FLIP).problems)).toEqual(['errType']);
    expect(keysOf(checkLevel(level(WAVE, [{ type: 'saw', x: 9, y: 6, r: 1, move: { dx: 0, dy: 2, every: 8 } }]), WAVE).problems)).toEqual(['errNoMove']);
    expect(checkLevel(level(SHIP, [{ type: 'saw', x: 9, y: 6, r: 1, move: { dx: 0, dy: 2, every: 8 } }]), SHIP).problems).toEqual([]);
  });
});

describe('placing and picking', () => {
  const open = emptyLevel(FLIP, 'x').sections[0]!;

  test('spikes, pillars and pads go on the nearer surface; round things where tapped, snapped to half cells', () => {
    expect(itemFor('spike', { count: 3 }, 8.4, 9, open)).toEqual({ type: 'spike', x: 8, on: 'floor', count: 3 });
    expect(itemFor('spike', { count: 2 }, 8.4, 3, open)).toEqual({ type: 'spike', x: 8, on: 'ceil', count: 2 });
    expect(itemFor('pillar', { h: 3 }, 12.7, 8, open)).toEqual({ type: 'pillar', x: 12, on: 'floor', h: 3 });
    expect(itemFor('saw', { r: 0.8, move: true }, 15.3, 5.8, open)).toEqual({ type: 'saw', x: 15.5, y: 6, r: 0.8, move: { dx: 0, dy: 2, every: 8 } });
    expect(itemFor('pad', { kind: 'gravity' }, 10.2, 3, open)).toEqual({ type: 'pad', kind: 'gravity', x: 10, on: 'ceil' });
    expect(itemFor('flip', {}, 10.2, 6, open)).toEqual({ type: 'portal', x: 10, kind: 'flip' });
    expect(itemFor('dark', {}, 25, 6, open)).toEqual({ type: 'dark', from: 25, to: 28 });
    expect(itemFor('block', { size: '2×1' }, 10, 6, open)).toEqual({ type: 'block', x: 9, y: 5.5, w: 2, h: 1 });
  });

  test('the eraser picks the nearest item within reach, or nothing', () => {
    const s = { ...open, hazards: [itemFor('spike', { count: 3 }, 8, 9, open)!, itemFor('saw', { r: 1 }, 18, 6, open)!, itemFor('dark', {}, 12, 6, open)!] };
    expect(nearestItem(s, 9.5, 9.4)).toBe(0);
    expect(nearestItem(s, 18.2, 5.9)).toBe(1);
    expect(nearestItem(s, 13, 3)).toBe(2);
    expect(nearestItem(s, 26, 3)).toBe(-1);
    expect(anchorOf(s.hazards[0]!, s)).toEqual({ x: 9.5, y: 9.5, w: 3 });
  });
});

describe('texts and play', () => {
  test('both languages have every text, including every problem a file can have', () => {
    for (const key of EDITOR_KEYS) {
      expect(editorTextsOf('pl')[key], key).toBeTruthy();
      expect(editorTextsOf('en')[key], key).toBeTruthy();
    }
    for (const key of ['errJson', 'errGame', 'errType', 'errNoMove', 'errRange', 'errProfile']) expect(EDITOR_KEYS).toContain(key);
  });

  test('each game plays a level as one sector of its sections, in order, never shuffled, at its tier, in that tier’s look', () => {
    for (const [palette, build] of [[WAVE, waveCustom], [SHIP, shipCustom], [FLIP, flipCustom]] as const) {
      const level = emptyLevel(palette, 'x');
      level.sections.push({ ...level.sections[0]!, id: 'e-02', length: 20, ceil: '2 r20', floor: '10 r20' });
      level.tier = 'hard';
      const run = build(level);
      const sections = run.pieces.filter((p) => p.kind === 'section');
      expect(sections.map((p) => p.g.length)).toEqual([30, 20]);
      expect(sections.every((p) => p.tier === 'hard')).toBe(true);
    }
    expect(customSector({ ...emptyLevel(FLIP, 'x'), tier: 'normal' }, FLIP_SECTORS, null).theme).toBe('mine');
    expect(customSector({ ...emptyLevel(FLIP, 'x'), tier: 'insaneDemon' }, FLIP_SECTORS, null).theme).toBe('saws');
  });

  test('the editor’s check is the game’s validator: an open section passes, a wall fails with where', () => {
    const open = emptyLevel(FLIP, 'x').sections[0]!;
    const sector = { id: 1, key: 'custom', tier: 'hard', theme: '', groups: [[1]], portals: [] };
    expect(flipProblems({ ...open, id: 'ed-open', tier: 'hard' }, sector, 1)).toEqual([]);
    const wall = { ...open, id: 'ed-wall', tier: 'hard', hazards: [{ type: 'spike' as const, x: 8, on: 'floor' as const, count: 6 }, { type: 'spike' as const, x: 8, on: 'ceil' as const, count: 6 }] };
    const problems = flipProblems(wall, sector, 1);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => /x≈\d/.test(p))).toBe(true);
  });
});
