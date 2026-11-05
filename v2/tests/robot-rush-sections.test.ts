// Robot Rush (docs/v2/PLAN.md 9.1, stage rr-b): the proof that every authored section is
// fair for a human, in every state the run can play it in (upright; mini where a section
// is marked so — the robot's gravity flips are inside its sections and proven there), from
// every entry across the joint: running on the floor, or in the air, falling or still. CI
// fails on a section nobody could play (the validator: public/games/_engine/beam.js with
// robot-rush/js/prove.js, every tap shifted and every hold made shorter and longer).
import { describe, expect, test } from 'vitest';
import { FINALE, FINALE_ID, SECTORS } from '../public/games/robot-rush/js/config.js';
import { sectionProblems } from '../public/games/robot-rush/js/prove.js';
import { SECTION_LIBRARY } from '../public/games/robot-rush/js/sections/index.js';

describe('every Robot Rush section is passable for a human', () => {
  for (const sector of SECTORS) {
    test(`sector ${sector.id} (${sector.key}): every section, every state, every entry`, { timeout: 300_000 }, () => {
      const problems = SECTION_LIBRARY[sector.id]!.flatMap((data, i) => sectionProblems(data, sector, i + 1));
      expect(problems).toEqual([]);
    });
  }
});

describe('the finale is passable for a human', () => {
  test('every stretch, every state, every entry', { timeout: 300_000 }, () => {
    const problems = SECTION_LIBRARY[FINALE_ID]!.flatMap((data, i) => sectionProblems(data, FINALE, i + 1));
    expect(problems).toEqual([]);
  });
});
