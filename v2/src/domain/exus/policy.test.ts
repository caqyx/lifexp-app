import { describe, expect, it } from 'vitest';
import { whatToDo } from './policy';

describe('whatToDo', () => {
  it.each([
    ['read', [], 'run'],
    ['write', [], 'run'],
    ['destructive', [], 'confirm'],
    ['read', ['command'], 'ask-missing'],
    ['write', ['text', 'due'], 'ask-missing'],
    ['destructive', ['task'], 'ask-missing'],
  ] as const)('%s with missing %j → %s', (risk, missing, decision) => {
    expect(whatToDo(risk, missing)).toBe(decision);
  });
});
