import { describe, expect, it } from 'vitest';
import { resolveAction } from './aiAction';
import { COMMANDS, type CommandId, type CommandSpec } from './commands';
import type { ContextRefs } from './context';

const TODAY = '2026-10-25';
const spec = (id: CommandId): CommandSpec => COMMANDS.find((c) => c.id === id)!;
const refs: ContextRefs = {
  g1: { kind: 'goal', id: 'goal-id', name: 'Rower' },
  t1: { kind: 'task', id: 'task-id', name: 'Wypracowanie z polskiego' },
  a1: { kind: 'activity', id: 'learning', name: 'Nauka (JS, Unity, C#)' },
};
const resolve = (id: CommandId, args: Record<string, string>) => resolveAction({ command: id, args }, refs, spec(id), TODAY);

describe('resolveAction', () => {
  it('turns a ref into the name the handler matches by', () => {
    expect(resolve('complete-task', { task: 't1' })).toEqual({
      ok: true,
      args: { task: 'Wypracowanie z polskiego' },
      missing: [],
      unread: [],
    });
    expect(resolve('log-activity', { type: 'a1', duration: '1h30' })).toEqual({
      ok: true,
      args: { type: 'Nauka (JS, Unity, C#)', duration: 90 },
      missing: [],
      unread: [],
    });
  });

  it('rejects a ref that is not in the map, or of the wrong kind', () => {
    expect(resolve('complete-task', { task: 't9' })).toEqual({ ok: false, error: 'unknown-ref', ref: 't9', slot: 'task' });
    expect(resolve('deposit-goal', { goal: 't1', amount: '20 zł' })).toEqual({ ok: false, error: 'wrong-ref', ref: 't1', slot: 'goal' });
  });

  it('passes a name instead of a ref through, for the handler to match', () => {
    const r = resolve('deposit-goal', { goal: 'rower', amount: '20 zł' });
    expect(r).toEqual({ ok: true, args: { goal: 'rower', amount: { kind: 'money', grosze: 2000 } }, missing: [], unread: [] });
  });

  it('reads each value with its slot recognizer, like key=value in a typed command', () => {
    const r = resolve('create-task', { text: 'Mleko', due: '2026-10-27', size: 'l' });
    expect(r).toEqual({ ok: true, args: { text: 'Mleko', due: '2026-10-27', size: 'L' }, missing: [], unread: [] });
    expect(resolve('create-chore', { name: 'Śmieci', points: '10', once: 'true' })).toMatchObject({
      ok: true,
      args: { name: 'Śmieci', points: 10, once: true },
    });
  });

  it('keeps missing slots missing, for the form card', () => {
    expect(resolve('create-task', { text: 'Mleko' })).toEqual({ ok: true, args: { text: 'Mleko' }, missing: ['due'], unread: [] });
    // A value the recognizer cannot read is missing too, and named as unread.
    expect(resolve('create-task', { text: 'Mleko', due: 'kiedyś' })).toEqual({
      ok: true,
      args: { text: 'Mleko' },
      missing: ['due'],
      unread: ['due'],
    });
  });

  it('a ref-looking word in a plain text slot stays text', () => {
    expect(resolve('create-task', { text: 'g7', due: '2026-10-27' })).toMatchObject({ ok: true, args: { text: 'g7' } });
  });

  it('ignores args that are not slots of the command', () => {
    expect(resolve('balance', { amount: '5' })).toEqual({ ok: true, args: {}, missing: [], unread: [] });
  });
});
