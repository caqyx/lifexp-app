import { describe, expect, it } from 'vitest';
import { DEFAULT_ON_MODULES, isModuleOn, surveyModules, toggleModule } from './modules';

const choice = (enabledModules: string[] | null, disabledModules: string[] | null = null, optInModules?: string[] | null) => ({
  enabledModules,
  disabledModules,
  optInModules,
});

describe('isModuleOn', () => {
  it('has everything on until the person chose (v1 isModuleEnabled)', () => {
    for (const id of ['chores', 'money', 'notes', 'stats', 'games', 'aichat']) expect(isModuleOn(id, choice(null))).toBe(true);
  });

  it("follows v1's list for v1's modules", () => {
    const c = choice(['chores', 'stats', 'notes']);
    expect(isModuleOn('chores', c)).toBe(true);
    expect(isModuleOn('money', c)).toBe(false);
    expect(isModuleOn('games', c)).toBe(false);
  });

  it('B9: an account that chose the Planner before 24.08 has Notes', () => {
    expect(isModuleOn('notes', choice(['chores', 'planner']))).toBe(true);
    expect(isModuleOn('notes', choice(['chores']))).toBe(false);
  });

  it("keeps v1's list the truth while v1 can still change it", () => {
    // v2 turned money off, then v1 turned it back on: only enabledModules knows.
    expect(isModuleOn('money', choice(['money'], ['money']))).toBe(true);
  });

  it('has the reader off for every account until it is turned on (opt-in)', () => {
    expect(isModuleOn('reader', choice(null))).toBe(false);
    expect(isModuleOn('reader', choice(null, null, null))).toBe(false);
    expect(isModuleOn('reader', choice(['chores', 'money'], []))).toBe(false);
    // Neither v1's list nor "not turned off" turns it on: only optInModules does.
    expect(isModuleOn('reader', choice(['reader'], []))).toBe(false);
    expect(isModuleOn('reader', choice(null, null, ['reader']))).toBe(true);
  });

  it('turns on a module v1 does not know unless it is listed as off', () => {
    expect(isModuleOn('future', choice(['chores']))).toBe(true);
    expect(isModuleOn('future', choice(['chores'], ['future']))).toBe(false);
  });
});

describe('toggleModule', () => {
  it("writes v1's list without the Planner, Notes kept, and what is off (M3)", () => {
    expect(toggleModule(choice(['chores', 'money', 'planner', 'stats', 'aichat']), 'money', false)).toEqual({
      enabledModules: ['chores', 'stats', 'notes', 'aichat'],
      disabledModules: ['money', 'games'],
      optInModules: [],
    });
  });

  it('starts from everything on when nothing was chosen', () => {
    expect(toggleModule(choice(null), 'games', false)).toEqual({
      enabledModules: ['chores', 'money', 'stats', 'notes', 'aichat'],
      disabledModules: ['games'],
      optInModules: [],
    });
  });

  it('turns a module back on', () => {
    expect(toggleModule(choice(['chores'], ['money', 'notes', 'stats', 'games', 'aichat']), 'money', true)).toEqual({
      enabledModules: ['chores', 'money'],
      disabledModules: ['notes', 'stats', 'games', 'aichat'],
      optInModules: [],
    });
  });

  it('turns the reader on in optInModules only: v1 never sees its id', () => {
    const on = toggleModule(choice(['chores', 'money', 'games', 'stats', 'notes', 'aichat']), 'reader', true);
    expect(on).toEqual({
      enabledModules: ['chores', 'money', 'games', 'stats', 'notes', 'aichat'],
      disabledModules: [],
      optInModules: ['reader'],
    });
    expect(isModuleOn('reader', on)).toBe(true);
    const off = toggleModule(on, 'reader', false);
    expect(off.optInModules).toEqual([]);
    expect(off.enabledModules).not.toContain('reader');
    expect(off.disabledModules).not.toContain('reader');
    expect(isModuleOn('reader', off)).toBe(false);
  });

  it('keeps the reader as it was when another module changes', () => {
    expect(toggleModule(choice(null, null, ['reader']), 'money', false).optInModules).toEqual(['reader']);
    expect(toggleModule(choice(null), 'money', false).optInModules).toEqual([]);
  });
});

describe('surveyModules', () => {
  it("writes the survey in v1's order, with what was unticked as off", () => {
    expect(surveyModules(['notes', 'chores', 'aichat'])).toEqual({
      enabledModules: ['chores', 'notes', 'aichat'],
      disabledModules: ['money', 'stats', 'games'],
    });
  });

  it('offers only the modules on by default (the reader waits for Settings)', () => {
    expect(DEFAULT_ON_MODULES).not.toContain('reader');
    expect(surveyModules([...DEFAULT_ON_MODULES])).toEqual({
      enabledModules: ['chores', 'money', 'games', 'stats', 'notes', 'aichat'],
      disabledModules: [],
    });
  });
});
