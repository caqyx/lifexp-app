// Flip Rush (docs/v2/PLAN.md 9.1, stage f-1): the proof that every authored section is fair
// for a human, in every state the run can play it in (both gravities, since every section
// may follow a flip; mini where a section is marked so), from every entry across the joint
// — resting on the ground of its gravity, or in the air falling or still, at several
// heights (a vehicle portal or a gravity flip can hand it over anywhere). CI fails on a
// section nobody could play (the validator: public/games/_engine/beam.js with
// flip-rush/js/prove.js).
import { describe, expect, test } from 'vitest';
import { FINALE, FINALE_ID, SECTORS } from '../public/games/flip-rush/js/config.js';
import { sectionProblems } from '../public/games/flip-rush/js/prove.js';
import { SECTION_LIBRARY } from '../public/games/flip-rush/js/sections/index.js';

describe('every Flip Rush section is passable for a human', () => {
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
