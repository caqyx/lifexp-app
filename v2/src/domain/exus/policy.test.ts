import { describe, expect, it } from 'vitest';
import { COMMANDS } from './commands';
import { needsInternet, whatToDo } from './policy';

describe('whatToDo', () => {
  it.each([
    ['read', [], 'run'],
    ['write', [], 'run'],
    ['destructive', [], 'confirm'],
    ['read', ['command'], 'ask-missing'],
    ['write', ['text', 'due'], 'form'],
    ['destructive', ['task'], 'form'],
  ] as const)('%s with missing %j → %s', (risk, missing, decision) => {
    expect(whatToDo(risk, missing)).toBe(decision);
  });
});

describe('needsInternet', () => {
  it('is the commands that move money or points in a transaction, not the single queued writes', () => {
    for (const id of ['create-goal', 'add-money', 'lend', 'repay', 'log-activity', 'settle-chores', 'complete-task'] as const) expect(needsInternet(id), id).toBe(true);
    for (const id of ['create-task', 'create-note', 'complete-chore', 'create-chore', 'money-limit', 'daily-limit', 'help', 'report-bug'] as const) expect(needsInternet(id), id).toBe(false);
  });

  it('is never a read command', () => {
    for (const spec of COMMANDS.filter((c) => c.risk === 'read')) expect(needsInternet(spec.id), spec.id).toBe(false);
  });
});
