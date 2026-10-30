// Ship Rush (docs/v2/PLAN.md 9.1, stage s-1): the proof that every authored section is
// fair for a human, in every state the run can fly it in (both gravities where a sector
// has gravity portals, mini where a section is marked so), from every entry across the
// joint — resting on its floor, held under its ceiling, or in the air climbing, level or
// falling. CI fails on a section nobody could fly (the validator: public/games/_engine/
// beam.js with ship-rush/js/prove.js).
import { describe, expect, test } from 'vitest';
import { SECTORS } from '../public/games/ship-rush/js/config.js';
import { sectionProblems } from '../public/games/ship-rush/js/prove.js';
import { SECTION_LIBRARY } from '../public/games/ship-rush/js/sections/index.js';

describe('every Ship Rush section is passable for a human', () => {
  for (const sector of SECTORS) {
    test(`sector ${sector.id} (${sector.key}): every section, every state, every entry`, { timeout: 300_000 }, () => {
      const problems = SECTION_LIBRARY[sector.id]!.flatMap((data, i) => sectionProblems(data, sector, i + 1));
      expect(problems).toEqual([]);
    });
  }
});
