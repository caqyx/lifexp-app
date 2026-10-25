import { describe, expect, it } from 'vitest';
import { AI_HISTORY_TEXT_MAX, aiErrorKind, historyForAi, readTurnResponse, readUsage } from './ai';

const usage = { tokensUsedToday: 100, tokensLimitDaily: 20000, remainingPercent: 99 };

describe('Ex-us AI turn', () => {
  it('tells the Functions error codes apart', () => {
    expect(aiErrorKind('unauthenticated')).toBe('no-access');
    expect(aiErrorKind('permission-denied')).toBe('no-access');
    expect(aiErrorKind('resource-exhausted')).toBe('budget');
    expect(aiErrorKind('invalid-argument')).toBe('invalid');
    expect(aiErrorKind('unavailable')).toBe('unavailable');
    expect(aiErrorKind('deadline-exceeded')).toBe('unavailable');
    expect(aiErrorKind('internal')).toBe('network');
    expect(aiErrorKind('not-found')).toBe('failed');
  });

  it('reads the usage and the answer, and nothing that has another shape', () => {
    expect(readUsage(usage)).toEqual(usage);
    expect(readUsage({ ...usage, remainingPercent: 140 })?.remainingPercent).toBe(100);
    expect(readUsage({ tokensUsedToday: '1' })).toBeUndefined();
    expect(readUsage(null)).toBeUndefined();
    expect(readTurnResponse({ reply: 'Hej', actions: [{ command: 'balance', args: {} }, { command: 3 }, { command: 'x', args: { a: 'b', n: 2 } }], usage })).toEqual({
      reply: 'Hej',
      actions: [
        { command: 'balance', args: {} },
        { command: 'x', args: { a: 'b' } },
      ],
      usage,
    });
    expect(readTurnResponse({ reply: 'Hej', usage })).toEqual({ reply: 'Hej', actions: [], usage });
    expect(readTurnResponse({ reply: 1, usage })).toBeNull();
    expect(readTurnResponse({ reply: 'Hej' })).toBeNull();
    expect(readTurnResponse('Hej')).toBeNull();
  });

  it('sends only the last 8 turns of the AI conversation, cut', () => {
    const turns = [
      { from: 'exus' as const, text: 'Cześć! Wpisz /pomoc' },
      { from: 'me' as const, text: '/dzis' },
      { from: 'exus' as const, text: 'Punkty: 10' },
      ...Array.from({ length: 10 }, (_, i) => ({ from: i % 2 ? ('exus' as const) : ('me' as const), text: `t${i}`, ai: true })),
      { from: 'exus' as const, text: '   ', ai: true },
      { from: 'me' as const, text: 'x'.repeat(5000), ai: true },
    ];
    const history = historyForAi(turns);
    expect(history).toHaveLength(8);
    expect(history[0]).toEqual({ role: 'model', text: 't3' });
    expect(history.at(-1)).toEqual({ role: 'user', text: 'x'.repeat(AI_HISTORY_TEXT_MAX) });
    expect(history.map((h) => h.text).join(' ')).not.toContain('/dzis');
    expect(historyForAi([])).toEqual([]);
  });
});
