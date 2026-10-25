import { describe, expect, it } from 'vitest';
import { HISTORY_MAX, parseHistory, serializeHistory, trimHistory } from './history';

const msg = (i: number) => ({ from: (i % 2 ? 'me' : 'exus') as 'me' | 'exus', text: `m${i}` });

describe('trimHistory', () => {
  it('keeps the newest messages', () => {
    const many = Array.from({ length: HISTORY_MAX + 5 }, (_, i) => msg(i));
    const kept = trimHistory(many);
    expect(kept).toHaveLength(HISTORY_MAX);
    expect(kept[0]!.text).toBe('m5');
    expect(kept.at(-1)!.text).toBe(`m${HISTORY_MAX + 4}`);
    expect(trimHistory([msg(1), msg(2), msg(3)], 2).map((m) => m.text)).toEqual(['m2', 'm3']);
    expect(trimHistory([])).toEqual([]);
  });
});

describe('serializeHistory', () => {
  const done = { title: 'Do wykonania: /zadanie', rows: [{ label: 'treść', value: 'Mleko' }] };

  it('keeps text and a run card, and leaves out a live card and passing messages', () => {
    expect(
      serializeHistory([
        { from: 'exus', text: 'Cześć', passing: true },
        { from: 'me', text: '/zadanie Mleko' },
        { from: 'exus', text: '', live: true },
        { from: 'exus', text: '', done },
        { from: 'exus', text: 'Pominięto.' },
      ]),
    ).toEqual([
      { from: 'me', text: '/zadanie Mleko' },
      { from: 'exus', text: '', done },
      { from: 'exus', text: 'Pominięto.' },
    ]);
  });

  it('never keeps more than the limit', () => {
    expect(serializeHistory(Array.from({ length: 250 }, (_, i) => msg(i)))).toHaveLength(HISTORY_MAX);
  });

  it('round-trips through JSON', () => {
    const stored = serializeHistory([{ from: 'me', text: 'a' }, { from: 'exus', text: '', done }]);
    expect(parseHistory(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });
});

describe('parseHistory', () => {
  it('reads what is a message and drops the rest', () => {
    expect(
      parseHistory([
        { from: 'me', text: 'ok' },
        { from: 'robot', text: 'x' },
        { from: 'me' },
        { from: 'exus', text: '' },
        null,
        'text',
        { from: 'exus', text: '', done: { title: 'T', rows: [{ label: 'a', value: 'b' }, { label: 1 }] } },
        { from: 'exus', text: 'x', done: 'broken' },
      ]),
    ).toEqual([
      { from: 'me', text: 'ok' },
      { from: 'exus', text: '', done: { title: 'T', rows: [{ label: 'a', value: 'b' }] } },
    ]);
  });

  it.each([[undefined], [null], [42], ['x'], [{}]])('%j is no history', (raw) => {
    expect(parseHistory(raw)).toEqual([]);
  });

  it('cuts a list that grew past the limit', () => {
    expect(parseHistory(Array.from({ length: 300 }, (_, i) => msg(i)))).toHaveLength(HISTORY_MAX);
  });

  it('keeps the AI flag of a turn (sent as history, rendered as Markdown), and only a true one', () => {
    const kept = serializeHistory([
      { from: 'me', text: 'Cześć', ai: true },
      { from: 'exus', text: '**Hej**', ai: true },
      { from: 'exus', text: 'pisze…', ai: true, passing: true },
      { from: 'me', text: '/dzis' },
    ]);
    expect(kept).toEqual([
      { from: 'me', text: 'Cześć', ai: true },
      { from: 'exus', text: '**Hej**', ai: true },
      { from: 'me', text: '/dzis' },
    ]);
    expect(parseHistory(kept)).toEqual(kept);
    expect(parseHistory([{ from: 'exus', text: 'x', ai: 'yes' }])).toEqual([{ from: 'exus', text: 'x' }]);
  });
});
