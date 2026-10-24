import { describe, expect, it } from 'vitest';
import { createUndoStack, UNDO_MAX } from './undo';

const undo = (what: string) => ({ what, run: () => Promise.resolve() });

describe('the undo stack', () => {
  it('pops the newest first, then says it is empty', () => {
    const stack = createUndoStack();
    stack.push(undo('a'));
    stack.push(undo('b'));
    expect(stack.pop()?.what).toBe('b');
    expect(stack.pop()?.what).toBe('a');
    expect(stack.pop()).toBeNull();
  });

  it(`keeps only the last ${UNDO_MAX}`, () => {
    const stack = createUndoStack();
    const first = stack.push(undo('0'));
    for (let i = 1; i <= UNDO_MAX; i++) stack.push(undo(String(i)));
    expect(stack.size).toBe(UNDO_MAX);
    expect(stack.take(first.id)).toBeNull();
    expect(stack.pop()?.what).toBe(String(UNDO_MAX));
  });

  it('takes an entry out by id once, so it cannot be undone twice', () => {
    const stack = createUndoStack();
    const a = stack.push(undo('a'));
    const b = stack.push(undo('b'));
    expect(stack.take(b.id)?.what).toBe('b');
    expect(stack.take(b.id)).toBeNull();
    expect(stack.pop()?.id).toBe(a.id);
    expect(stack.take(a.id)).toBeNull();
  });

  it('forgets everything on a new conversation, and the old toasts find nothing to take', () => {
    const stack = createUndoStack();
    const a = stack.push(undo('a'));
    stack.push(undo('b'));
    stack.clear();
    expect(stack.size).toBe(0);
    expect(stack.pop()).toBeNull();
    expect(stack.take(a.id)).toBeNull();
    stack.push(undo('c'));
    expect(stack.pop()?.what).toBe('c');
  });
});
