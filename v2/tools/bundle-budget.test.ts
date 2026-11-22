import { describe, expect, test } from 'vitest';
import { budgetProblems, INITIAL_CSS_BUDGET, INITIAL_JS_BUDGET, type BuiltChunk } from './bundle-budget';

const chunk = (over: Partial<BuiltChunk> & { fileName: string }): BuiltChunk => ({
  isEntry: false,
  size: 1000,
  imports: [],
  moduleIds: [],
  css: [],
  ...over,
});

const noCss = () => 0;

describe('bundle budget', () => {
  test('a small start is within budget; lazy chunks do not count', () => {
    const chunks = [
      chunk({ fileName: 'assets/index.js', isEntry: true, imports: ['assets/signals.js'], css: ['assets/index.css'] }),
      chunk({ fileName: 'assets/signals.js' }),
      chunk({ fileName: 'assets/firebase.js', size: 400 * 1024, moduleIds: ['/x/node_modules/firebase/app/dist/index.mjs'] }),
    ];
    expect(budgetProblems(chunks, () => 10 * 1024)).toEqual([]);
  });

  test('the entry and its static imports count together', () => {
    const half = Math.ceil(INITIAL_JS_BUDGET / 2) + 1;
    const chunks = [
      chunk({ fileName: 'assets/index.js', isEntry: true, size: half, imports: ['assets/shared.js'] }),
      chunk({ fileName: 'assets/shared.js', size: half, imports: ['assets/index.js'] }),
    ];
    const [problem, ...rest] = budgetProblems(chunks, noCss);
    expect(rest).toEqual([]);
    expect(problem).toMatch(/^start-up JS .* is over the budget/);
    expect(problem).toContain('assets/shared.js');
  });

  test('start-up CSS has its own budget', () => {
    const chunks = [chunk({ fileName: 'assets/index.js', isEntry: true, css: ['assets/index.css'] })];
    expect(budgetProblems(chunks, () => INITIAL_CSS_BUDGET + 1)).toEqual([
      expect.stringMatching(/^start-up CSS .* is over the budget/),
    ]);
  });

  test.each([
    ['/repo/v2/node_modules/@firebase/firestore/dist/index.esm2017.js', /Firebase/],
    ['/repo/v2/src/i18n/en.json', /English/],
    ['C:\\repo\\v2\\node_modules\\marked\\lib\\marked.esm.js', /Markdown/],
    ['/repo/v2/node_modules/pdfjs-dist/build/pdf.mjs', /reader/],
  ])('%s must not be in the start', (id, why) => {
    const chunks = [
      chunk({ fileName: 'assets/index.js', isEntry: true, imports: ['assets/dep.js'] }),
      chunk({ fileName: 'assets/dep.js', moduleIds: [id] }),
    ];
    expect(budgetProblems(chunks, noCss)).toEqual([expect.stringMatching(why)]);
  });

  test('exactly one entry', () => {
    expect(budgetProblems([chunk({ fileName: 'a.js' })], noCss)).toEqual(['expected one entry chunk, found 0']);
  });
});
