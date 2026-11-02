// The Rush level editor's pure parts (docs/v2/PLAN.md 9.1, stages r-3 and r-4): the level
// file (version 2, version 1 still read; checked import with every problem and where it
// is, export and back, the verified mark), placing, picking, moving, turning, mirroring and
// scaling items — and the game's hit shapes turning with them — its texts, and a level
// played by each game as a run of its own.
import { describe, expect, test } from 'vitest';
import { itemBox, itemFor, moveItem, pickItem, placed, transformItem } from '../public/games/_engine/editor/items.js';
import { FORMAT, changedLevel, checkLevel, emptyLevel, fromJson, playHash, toJson, type Level } from '../public/games/_engine/editor/format.js';
import { verifiedWord } from '../public/games/_engine/editor/play.js';
import { buildGeometry, capsuleHitsHazard, type SectionData } from '../public/games/_engine/geometry.js';
import { isSolid, sectionWorld, settle } from '../public/games/_engine/solids.js';
import { createGame, stepGame, type Game } from '../public/games/_engine/game.js';
import { stateAt, endModeOf } from '../public/games/_engine/level.js';
import { STEP } from '../public/games/_engine/world.js';
import { mixedRules } from '../public/games/_engine/editor/vehicles.js';
import { RULES as WAVE_RULES } from '../public/games/wave-rush/js/game.js';
import { RULES as SHIP_RULES } from '../public/games/ship-rush/js/game.js';
import { RULES as FLIP_RULES } from '../public/games/flip-rush/js/game.js';
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
      expect(level).toMatchObject({ format: FORMAT, version: 2, game: palette.id, tier: palette.tiers[0], verified: false });
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
    const flip: Level = { format: FORMAT, version: 2, game: 'flip-rush', name: 'Flip 5', tier: 'insane', verified: false, sections: pick(FLIP_LIBRARY, 5) };
    const back = fromJson(toJson(flip), FLIP);
    expect(back.problems).toEqual([]);
    expect(back.level!.sections.map((s) => s.hazards)).toEqual(flip.sections.map((s) => s.hazards));
    const ship: Level = { format: FORMAT, version: 2, game: 'ship-rush', name: 'Demon', tier: 'easyDemon', verified: true, sections: pick(SHIP_LIBRARY, 6) };
    expect(fromJson(toJson(ship), SHIP).problems).toEqual([]);
    expect(fromJson(toJson(ship), SHIP).level!.verified).toBe(true);
    expect(JSON.parse(toJson(flip)).verified).toBe(false);
  });

  test('version 1 files still load (as version 2, not verified); version 2 adds turns, mirrors, scales, free heights and gates', () => {
    const v1 = { format: FORMAT, version: 1, game: 'flip-rush', name: 'Old', tier: 'hard', sections: [{ length: 30, ceil: '2 r30', floor: '10 r30', mode: 'ball', hazards: [{ type: 'spike', x: 8, on: 'floor', count: 3 }, { type: 'pillar', x: 14, on: 'floor', h: 3 }] }] };
    const read = fromJson(JSON.stringify(v1), FLIP);
    expect(read.problems).toEqual([]);
    expect(read.level).toMatchObject({ version: 2, verified: false, name: 'Old' });
    expect(read.level!.sections[0]!.hazards).toEqual(v1.sections[0]!.hazards);
    // Version 1 had none of the new fields.
    const turnedV1 = { ...v1, sections: [{ ...v1.sections[0]!, hazards: [{ type: 'spike', x: 8, on: 'floor', rot: 90 }] }] };
    expect(checkLevel(turnedV1, FLIP).problems.map((p) => `${p.path} ${p.key}`)).toEqual(['sections[0].hazards[0].rot errField']);
    expect(keysOf(checkLevel({ ...v1, verified: true }, FLIP).problems)).toEqual(['errField']);
    expect(keysOf(checkLevel({ ...v1, version: 3 }, FLIP).problems)).toEqual(['errVersion']);
    const v2 = {
      ...v1,
      version: 2,
      verified: false,
      sections: [
        {
          ...v1.sections[0]!,
          hazards: [
            { type: 'spike', x: 8, y: 6, dir: 'up', count: 2, rot: 45, fx: true, sx: 1.5, sy: 0.5 },
            { type: 'block', x: 12, y: 4, w: 2, h: 1, rot: 90, fy: true },
            { type: 'pillar', x: 16, on: 'floor', h: 2, y: 3 },
            { type: 'saw', x: 20, y: 6, r: 0.8, sx: 2, sy: 2, rot: 30 },
            { type: 'ring', x: 22, y: 6, kind: 'jump', sx: 1.5, sy: 1.5 },
            { type: 'pad', x: 24, on: 'floor', kind: 'jump', y: 5, fy: true },
            { type: 'portal', x: 26, kind: 'flip', y: 6, sy: 0.75 },
          ],
        },
      ],
    };
    expect(fromJson(JSON.stringify(v2), FLIP).problems).toEqual([]);
    const bad = { ...v2, verified: 'yes', sections: [{ ...v2.sections[0]!, hazards: [{ type: 'block', x: 12, y: 4, w: 2, h: 1, rot: 400, sx: 9, fx: 1 }] }] };
    expect(checkLevel(bad, FLIP).problems.map((p) => `${p.path} ${p.key}`).sort()).toEqual(
      ['verified errBoolean', 'sections[0].hazards[0].rot errTurn', 'sections[0].hazards[0].sx errScale', 'sections[0].hazards[0].fx errBoolean'].sort(),
    );
  });

  test('any change takes the verification away (renaming does not); the game’s word names the level by its play data', () => {
    const level = { ...emptyLevel(SHIP, 'Mine'), verified: true };
    const hash = playHash(level);
    expect(changedLevel(level, (l) => (l.name = 'Other'), { keepVerified: true }).verified).toBe(true);
    expect(playHash({ ...level, name: 'Other' })).toBe(hash);
    const moved = changedLevel(level, (l) => l.sections[0]!.hazards.push({ type: 'spike', x: 8, on: 'floor' }));
    expect(moved.verified).toBe(false);
    expect(playHash(moved)).not.toBe(hash);
    expect(changedLevel(level, (l) => (l.tier = 'hard')).verified).toBe(false);
    // The same level, written in another key order, is the same level.
    const reordered = { ...level, sections: level.sections.map((s) => ({ hazards: s.hazards, mode: s.mode, floor: s.floor, ceil: s.ceil, length: s.length, id: s.id })) };
    expect(playHash(reordered)).toBe(hash);
    expect(verifiedWord(level)).toEqual({ game: 'ship-rush', hash });
    // What the game reads back (checked again) hashes the same as the editor's level.
    expect(playHash(fromJson(toJson(level), SHIP).level!)).toBe(hash);
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

  test('anything goes anywhere, snapped to the grid; spikes, pillars and pads face away from the nearer surface', () => {
    expect(itemFor('spike', { count: 3 }, 8.4, 9.7, open)).toEqual({ type: 'spike', x: 7, y: 10, dir: 'up', count: 3 });
    expect(itemFor('spike', { count: 1 }, 8.4, 2.2, open)).toEqual({ type: 'spike', x: 8, y: 2, dir: 'down', count: 1 });
    // In the air: a floating row of spikes, a floating block at a chosen height.
    expect(itemFor('spike', { count: 2 }, 12, 7.3, open)).toEqual({ type: 'spike', x: 11, y: 7, dir: 'up', count: 2 });
    expect(itemFor('block', { size: '2×1' }, 10, 4.2, open)).toEqual({ type: 'block', x: 9, y: 4, w: 2, h: 1 });
    expect(itemFor('block', { size: '2×1' }, 10, 4.2, open, 0.25)).toEqual({ type: 'block', x: 9, y: 3.75, w: 2, h: 1 });
    expect(itemFor('block', { size: '1×1' }, 10.13, 4.27, open, 0)).toEqual({ type: 'block', x: 9.63, y: 3.77, w: 1, h: 1 });
    expect(itemFor('pillar', { h: 3 }, 12.7, 9.8, open)).toEqual({ type: 'pillar', x: 12, on: 'floor', h: 3, y: 7 });
    expect(itemFor('pillar', { h: 2 }, 12.7, 6.2, open)).toEqual({ type: 'pillar', x: 12, on: 'floor', h: 2, y: 4 });
    expect(itemFor('saw', { r: 0.8, move: true }, 15.3, 5.8, open, 0.5)).toEqual({ type: 'saw', x: 15.5, y: 6, r: 0.8, move: { dx: 0, dy: 2, every: 8 } });
    expect(itemFor('pad', { kind: 'gravity' }, 10.2, 2.2, open)).toEqual({ type: 'pad', kind: 'gravity', x: 10, on: 'ceil', y: 2 });
    expect(itemFor('flip', {}, 10.2, 6, open)).toEqual({ type: 'portal', x: 10, kind: 'flip' });
    expect(itemFor('dark', {}, 25, 6, open)).toEqual({ type: 'dark', from: 25, to: 30 });
    for (const tool of ['spike', 'block', 'pillar', 'saw', 'ring', 'pad', 'flip', 'speed', 'dark']) {
      const item = itemFor(tool, {}, 14, 6, open)!;
      expect(fromJson(JSON.stringify({ ...JSON.parse(toJson(emptyLevel(FLIP, 'x'))), sections: [{ ...open, hazards: [item] }] }), FLIP).problems, tool).toEqual([]);
    }
  });

  test('picking takes the smallest item under the finger, else the nearest within half a cell', () => {
    const s = { ...open, hazards: [itemFor('spike', { count: 3 }, 9.5, 9.7, open)!, itemFor('saw', { r: 1 }, 18, 6, open)!, itemFor('dark', {}, 12, 6, open)!, itemFor('block', {}, 14, 6, open)!] };
    expect(pickItem(s, 9.5, 9.4)).toBe(0);
    expect(pickItem(s, 18.2, 5.9)).toBe(1);
    expect(pickItem(s, 13, 3)).toBe(2);
    // The block is inside the dark stretch: the smaller one wins.
    expect(pickItem(s, 14, 6)).toBe(3);
    expect(pickItem(s, 27, 0)).toBe(-1);
    expect(itemBox(s.hazards[0]!, s)).toEqual([8, 9, 11, 10]);
  });

  test('moving: an item off its surface gets its height; a stretch moves along only', () => {
    const onFloor = { type: 'spike' as const, x: 8, on: 'floor' as const, count: 2 };
    expect(placed(onFloor, open)).toEqual({ type: 'spike', x: 8, y: 10, dir: 'up', count: 2 });
    expect(moveItem(onFloor, 1, -3, open)).toEqual({ type: 'spike', x: 9, y: 7, dir: 'up', count: 2 });
    expect(moveItem(onFloor, 2, 0, open)).toEqual({ ...onFloor, x: 10 });
    expect(moveItem({ type: 'pillar', x: 4, on: 'ceil', h: 3 }, 0, 1, open)).toEqual({ type: 'pillar', x: 4, on: 'ceil', h: 3, y: 3 });
    expect(moveItem({ type: 'dark', from: 4, to: 9 }, 2, 5, open)).toEqual({ type: 'dark', from: 6, to: 11 });
    expect(moveItem({ type: 'portal', x: 4, kind: 'flip' }, 1, 2, open)).toEqual({ type: 'portal', x: 5, kind: 'flip' });
  });

  test('turning, mirroring and scaling go as far as each item can; the identity leaves no fields', () => {
    const spike = { type: 'spike' as const, x: 8, y: 10, dir: 'up' as const };
    expect(transformItem(spike, { turnBy: 90 }, open)).toEqual({ ...spike, rot: 90 });
    expect(transformItem({ ...spike, rot: 270 }, { turnBy: 90 }, open)).toEqual(spike);
    expect(transformItem(spike, { turnBy: -90 }, open)).toEqual({ ...spike, rot: 270 });
    expect(transformItem(spike, { flipY: true }, open)).toEqual({ ...spike, fy: true });
    expect(transformItem({ ...spike, fy: true }, { flipY: true }, open)).toEqual(spike);
    expect(transformItem(spike, { sx: 9, sy: 0.1 }, open)).toEqual({ ...spike, sx: 4, sy: 0.25 });
    // Round things stay round; a pad only turns over; a portal scales only as a gate.
    const saw = { type: 'saw' as const, x: 8, y: 6, r: 1 };
    expect(transformItem(saw, { sx: 2 }, open)).toEqual({ ...saw, sx: 2, sy: 2 });
    expect(transformItem(saw, { flipX: true }, open)).toEqual(saw);
    const pad = { type: 'pad' as const, x: 8, on: 'floor' as const, kind: 'jump' as const };
    expect(transformItem(pad, { turnBy: 90, sx: 2, flipY: true }, open)).toEqual({ ...pad, fy: true });
    const portal = { type: 'portal' as const, x: 8, kind: 'flip' as const };
    expect(transformItem(portal, { sy: 2 }, open)).toEqual(portal);
    const gate = transformItem(portal, { gate: true }, open);
    expect(gate).toEqual({ ...portal, y: 6 });
    expect(transformItem(gate, { sy: 0.5 }, open)).toEqual({ ...portal, y: 6, sy: 0.5 });
    expect(transformItem({ ...portal, y: 6, sy: 0.5 }, { gate: false }, open)).toEqual(portal);
    expect(transformItem({ type: 'dark', from: 1, to: 5 }, { turnBy: 90, sx: 2 }, open)).toEqual({ type: 'dark', from: 1, to: 5 });
  });
});

describe('turned, mirrored and scaled items in the game (stage r-4)', () => {
  const base: SectionData = { id: 'tx', length: 30, ceil: '2 r30', floor: '10 r30', hazards: [], mode: 'ship' };
  const one = (item: SectionData['hazards'][number]) => buildGeometry({ ...base, hazards: [item] });
  const hit = (item: SectionData['hazards'][number], x: number, y: number, r: number) => one(item).hazards.some((h) => capsuleHitsHazard(h, x, y, y, r));
  const up = { type: 'spike' as const, x: 10, y: 10, dir: 'up' as const };

  test('a turned spike is a turned triangle: its hit shape turns with it', () => {
    // Upright, the tip is at (10.5, 9); turned 90° clockwise it points right, tip at (11, 9.5).
    const turned = one({ ...up, rot: 90 }).hazards[0]!;
    expect(turned.shape === 'poly' ? turned.vis : null).toEqual([[10, 9], [11, 9.5], [10, 10]]);
    expect(hit(up, 10.5, 9.9, 0.05)).toBe(true);
    expect(hit({ ...up, rot: 90 }, 10.5, 9.9, 0.05)).toBe(false);
    expect(hit(up, 10.7, 9.5, 0.03)).toBe(false);
    expect(hit({ ...up, rot: 90 }, 10.7, 9.5, 0.03)).toBe(true);
    // Any angle: 45° leans the tip right and up.
    const leaning = one({ ...up, rot: 45 }).hazards[0]!;
    expect(leaning.shape === 'poly' ? leaning.vis[1]![0] : 0).toBeGreaterThan(10.5);
  });

  test('a mirrored spike hangs: flipped up and down it points down from the same box', () => {
    expect(hit(up, 10.5, 9.15, 0.05)).toBe(false);
    expect(hit({ ...up, fy: true }, 10.5, 9.15, 0.05)).toBe(true);
    expect(hit({ ...up, fy: true }, 10.5, 9.9, 0.05)).toBe(false);
    const flipped = one({ ...up, fy: true }).hazards[0]!;
    expect(flipped.bbox).toEqual(one(up).hazards[0]!.bbox);
  });

  test('a scaled spike is bigger to touch; a scaled row scales as one', () => {
    // Scaled about its centre: twice as tall, its hit tip from 9.25 up to 9.
    expect(hit(up, 10.5, 9.05, 0.1)).toBe(false);
    expect(hit({ ...up, sy: 2 }, 10.5, 9.05, 0.1)).toBe(true);
    const row = one({ ...up, count: 2, sx: 2 }).hazards;
    expect(row.map((h) => h.bbox[0])).toEqual([9, 11]);
  });

  test('a scaled block is a scaled solid to ride on; a block turned by a right angle too; any other angle is deadly', () => {
    const block = { type: 'block' as const, x: 10, y: 8, w: 2, h: 1 };
    const ride = (item: SectionData['hazards'][number], x: number) => settle(sectionWorld(one(item)), 7.5, x, 7.7, 0.4, 0.5);
    expect(ride(block, 12.6).landed).toBe(false);
    expect(ride({ ...block, sx: 2 }, 12.6)).toMatchObject({ landed: true, crash: false, y: 7.6 });
    // Turned 90°: 1 wide, 2 high about its centre (11, 8.5) — its top at 7.5.
    const standing = one({ ...block, rot: 90 }).hazards[0]!;
    expect(standing.bbox).toEqual([10.5, 7.5, 11.5, 9.5]);
    expect(isSolid(standing)).toBe(true);
    const tilted = one({ ...block, rot: 30 }).hazards[0]!;
    expect(isSolid(tilted)).toBe(false);
    expect(sectionWorld(one({ ...block, rot: 30 })).hazard(11, 8.5, 8.5, 0.1)).toBe(true);
    expect(sectionWorld(one(block)).hazard(11, 8.5, 8.5, 0.1)).toBe(false);
  });

  test('round hazards grow with scale; orbs reach further; a turned pad faces the other way; a gate portal has a height', () => {
    const saw = one({ type: 'saw', x: 10, y: 6, r: 1, sx: 2, sy: 2 }).hazards[0]!;
    expect(saw.shape === 'circle' && saw.r).toBe(2);
    expect(one({ type: 'ring', x: 10, y: 6, kind: 'jump', sx: 2, sy: 2 }).boosters[0]).toMatchObject({ scale: 2 });
    expect(one({ type: 'pad', x: 10, on: 'floor', kind: 'jump', y: 6, fy: true }).boosters[0]).toMatchObject({ dir: 'down', y: 6 });
    expect(one({ type: 'pad', x: 10, on: 'floor', kind: 'jump' }).boosters[0]).toMatchObject({ dir: 'up', y: 10 });
    expect(one({ type: 'portal', x: 10, kind: 'flip', y: 6, sy: 0.5 }).portals[0]).toEqual({ x: 10, kind: 'flip', y0: 5.25, y1: 6.75 });
    expect(one({ type: 'portal', x: 10, kind: 'flip' }).portals[0]).toEqual({ x: 10, kind: 'flip' });
  });

  test('items with no transform fields are exactly as before (the official sections)', () => {
    const plain = one({ type: 'block', x: 10, y: 8, w: 2, h: 1 }).hazards[0]!;
    expect(plain).toEqual({ type: 'block', shape: 'poly', pts: [[10, 8], [12, 8], [12, 9], [10, 9]], vis: [[10, 8], [12, 8], [12, 9], [10, 9]], dir: 'none', bbox: [10, 8, 12, 9] });
    expect(one(up).hazards[0]).toEqual({ type: 'spike', shape: 'poly', pts: [[10.2, 10], [10.5, 9.25], [10.8, 10]], vis: [[10, 10], [10.5, 9], [11, 10]], dir: 'up', bbox: [10, 9, 11, 10] });
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

  test('the validator (CI, official sections) says roughly where a section fails: an open section passes, a wall fails with x', () => {
    const open = emptyLevel(FLIP, 'x').sections[0]!;
    const sector = { id: 1, key: 'custom', tier: 'hard', theme: '', groups: [[1]], portals: [] };
    expect(flipProblems({ ...open, id: 'ed-open', tier: 'hard' }, sector, 1)).toEqual([]);
    const wall = { ...open, id: 'ed-wall', tier: 'hard', hazards: [{ type: 'spike' as const, x: 8, on: 'floor' as const, count: 6 }, { type: 'spike' as const, x: 8, on: 'ceil' as const, count: 6 }] };
    const problems = flipProblems(wall, sector, 1);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => /x≈\d/.test(p))).toBe(true);
  });
});

describe('every portal in every game (stage r-5)', () => {
  // A Wave Rush level: wave → (fast) → ship → spider → (up) → wave → (mini) → section 2 goes
  // on as it was (still the mini wave, upside down) → ball (gravity down) → the end.
  const waveLevel = (): Level => {
    const level = emptyLevel(WAVE, 'All portals');
    level.tier = 'easy';
    level.sections = [
      {
        id: 'e-01', length: 40, ceil: '2 r40', floor: '10 r40', mode: 'wave',
        hazards: [
          { type: 'speed', x: 5, k: 'fast' },
          { type: 'portal', x: 8, kind: 'ship' },
          { type: 'portal', x: 16, kind: 'spider' },
          { type: 'portal', x: 22, kind: 'up' },
          // Gravity goes up under the spider; it falls up, and halfway it is the wave.
          { type: 'portal', x: 23, kind: 'wave' },
          { type: 'portal', x: 30, kind: 'mini' },
        ],
      },
      {
        id: 'e-02', length: 30, ceil: '2 r30', floor: '10 r30', mode: 'wave',
        hazards: [
          { type: 'speed', x: 6, k: 'slow' },
          { type: 'portal', x: 10, kind: 'big' },
          { type: 'portal', x: 14, kind: 'down' },
          { type: 'portal', x: 18, kind: 'ball' },
        ],
      },
    ];
    return level;
  };

  /** Plays a run with a simple pilot: the wave and the ship keep to the middle; the ball and the spider are left alone. */
  const play = (game: Game) => {
    stepGame(game, { holding: false, tap: true }, STEP);
    const seen: string[] = [];
    for (let i = 0; i < 240 * 40 && game.phase === 'playing'; i++) {
      const w = game.wave;
      const mode = w.mode ?? (w.ship ? 'ship' : 'wave');
      if (w.x > 2 && seen[seen.length - 1] !== mode) seen.push(mode);
      const flying = mode === 'wave' || mode === 'ship';
      const holding = flying && (w.y > 6) === (w.gravity === 1);
      stepGame(game, { holding, tap: false }, STEP);
    }
    return seen;
  };

  test('the file takes every portal in every game; it goes out and back unchanged', () => {
    const level = waveLevel();
    const back = fromJson(toJson(level), WAVE);
    expect(back.problems).toEqual([]);
    expect(back.level!.sections.map((s) => s.hazards)).toEqual(level.sections.map((s) => s.hazards));
    for (const palette of [WAVE, SHIP, FLIP]) {
      expect(palette.modes.slice().sort()).toEqual(['ball', 'ship', 'spider', 'wave']);
      expect(palette.items).toEqual(expect.arrayContaining(['speed', 'portal']));
      for (const kind of ['flip', 'down', 'up', 'mini', 'big', 'wave', 'ship', 'ball', 'spider']) {
        const one = { ...JSON.parse(toJson(emptyLevel(palette, 'x'))), sections: [{ length: 30, ceil: '2 r30', floor: '10 r30', mode: 'ball', hazards: [{ type: 'portal', x: 12, kind, y: 6, sy: 0.5 }] }] };
        expect(checkLevel(one, palette).problems, `${palette.id} ${kind}`).toEqual([]);
      }
    }
    expect(keysOf(checkLevel({ ...JSON.parse(toJson(emptyLevel(WAVE, 'x'))), sections: [{ length: 30, ceil: '2 r30', floor: '10 r30', hazards: [{ type: 'portal', x: 12, kind: 'cube' }] }] }, WAVE).problems)).toEqual(['errWord']);
  });

  test('a Wave Rush level switches vehicle, speed, size and gravity inside sections, and carries it all over the joint', () => {
    const run = waveCustom(waveLevel());
    const [s1, s2] = run.pieces.filter((p) => p.kind === 'section');
    expect(endModeOf(s1!)).toBe('wave');
    // No vehicle portal at the joint: section 2 starts in the wave that section 1 ends in.
    expect(run.portals.filter((p) => p.kind === 'ship' && Math.abs(p.x - s2!.x0 - 1) < 1e-9)).toEqual([]);
    const at = (piece: typeof s1, x: number) => stateAt(run, piece!.x0 + x);
    expect(at(s1, 10)).toMatchObject({ mode: 'ship', gravity: 1, mini: false });
    expect(at(s1, 20)).toMatchObject({ mode: 'spider', gravity: 1 });
    expect(at(s1, 22.5)).toMatchObject({ mode: 'spider', gravity: -1 });
    expect(at(s1, 35)).toMatchObject({ mode: 'wave', gravity: -1, mini: true });
    expect(at(s2, 2)).toMatchObject({ mode: 'wave', gravity: -1, mini: true });
    expect(at(s2, 20)).toMatchObject({ mode: 'ball', gravity: 1, mini: false });

    // The game plays it to the end, in every vehicle.
    const game = createGame({ ...mixedRules(WAVE_RULES, WAVE.native), buildFinale: () => waveCustom(waveLevel()) }, { rng: () => 0, mode: 'normal', level: 'finale' });
    const seen = play(game);
    expect(game.phase).toBe('finished');
    expect(seen).toEqual(['wave', 'ship', 'spider', 'wave', 'ball']);
  });

  test('a section starting in another vehicle gets its vehicle portal at the joint; the same level plays in Ship Rush and Flip Rush', () => {
    const level = waveLevel();
    level.sections[1]!.mode = 'ship';
    const run = waveCustom(level);
    const s2 = run.pieces.filter((p) => p.kind === 'section')[1]!;
    expect(run.portals.some((p) => p.kind === 'ship' && p.mode === 'ship' && p.x > s2.x0 && p.x < s2.x0 + 2)).toBe(true);
    for (const [palette, rules, build] of [[SHIP, SHIP_RULES, shipCustom], [FLIP, FLIP_RULES, flipCustom]] as const) {
      const own = { ...waveLevel(), game: palette.id, tier: palette.tiers[0]! };
      const game = createGame({ ...mixedRules(rules, palette.native), buildFinale: () => build(own) }, { rng: () => 0, mode: 'normal', level: 'finale' });
      expect(play(game), palette.id).toEqual(['wave', 'ship', 'spider', 'wave', 'ball']);
      expect(game.phase, palette.id).toBe('finished');
    }
  });
});
