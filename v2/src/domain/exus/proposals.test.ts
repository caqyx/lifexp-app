import { describe, expect, it } from 'vitest';
import { COMMANDS, type CommandId } from './commands';
import { fieldsFor } from './form';
import { pendingProposals, withRecent, type LiveProposal } from './proposals';

const fields = (id: CommandId) => fieldsFor(COMMANDS.find((c) => c.id === id)!.slots('2026-10-25'))!;

describe('AI proposals for the next turn', () => {
  it('gives the newest three waiting cards p1..p3 with their fields as text', () => {
    const live: LiveProposal[] = [
      { id: 10, command: 'create-task', fields: fields('create-task'), raw: { text: 'Stare', due: '2026-10-26', size: '' } },
      { id: 11, command: 'create-task', fields: fields('create-task'), raw: { text: 'Mleko', due: '2026-10-26', size: 'M' } },
      { id: 12, command: 'create-chore', fields: fields('create-chore'), raw: { name: 'Śmieci', points: 10, once: false } },
      { id: 13, command: 'add-money', fields: fields('add-money'), raw: { amount: 1250, date: '', category: null, rest: ' obiad ' } },
    ];
    const { cards, byRef } = pendingProposals(live);
    expect(cards).toEqual([
      { ref: 'p1', command: 'create-task', args: { text: 'Mleko', due: '2026-10-26', size: 'M' } },
      { ref: 'p2', command: 'create-chore', args: { name: 'Śmieci', points: '10' } },
      { ref: 'p3', command: 'add-money', args: { amount: '12,50 zł', rest: 'obiad' } },
    ]);
    expect([...byRef]).toEqual([
      ['p1', 11],
      ['p2', 12],
      ['p3', 13],
    ]);
    expect(pendingProposals([])).toEqual({ cards: [], byRef: new Map() });
  });

  it('keeps the last five outcomes', () => {
    let list = withRecent([], { command: 'balance', status: 'executed' });
    for (let i = 0; i < 6; i++) list = withRecent(list, { command: `c${i}`, status: 'skipped' });
    expect(list).toHaveLength(5);
    expect(list[0]).toEqual({ command: 'c1', status: 'skipped' });
    expect(list.at(-1)).toEqual({ command: 'c5', status: 'skipped' });
  });
});
