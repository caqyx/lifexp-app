// /rozlicz right after a payout (found under CPU throttle in exus.spec): the listener
// still held entries the payout had deleted, so the command asked to pay them again
// instead of saying there is nothing to settle. Its question now reads the server.
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ChoreEntry } from '@/domain/chores';
import { initI18n, t } from '@/i18n';
import { today } from '@/stores/today';
import type { HandlerContext } from './handlers';

const server: { entries: ChoreEntry[] } = { entries: [] };
const settleChores = vi.fn((_uid: string, entries: readonly ChoreEntry[]) =>
  Promise.resolve(entries.length ? { points: entries.reduce((s, e) => s + e.points, 0), grosze: 1800, fromISO: 'a', toISO: 'b' } : null),
);

vi.mock('@/services/chores', () => ({
  createChoreDef: vi.fn(),
  deleteChoreDef: vi.fn(),
  deleteChoreEntry: vi.fn(),
  ensureChoreDefs: vi.fn(),
  logChore: vi.fn(),
  removeCreatedChoreDef: vi.fn(),
  settleChores,
  unpaidEntriesNow: () => Promise.resolve(server.entries),
}));

initI18n('pl');
const { CHORE_HANDLERS } = await import('./choreHandlers');
const settle = CHORE_HANDLERS['settle-chores'];

const entry = (id: string, points: number): ChoreEntry => ({
  id,
  choreId: 'x',
  name: 'Zmywanie',
  emoji: '',
  points,
  dateISO: '2026-10-25',
  monthKey: '2026-10',
  createdAt: null,
});
const ctx = { uid: 'u1', profile: { rateChores: { zloty: null, points: null } } } as unknown as HandlerContext;

beforeEach(() => {
  settleChores.mockClear();
});

describe('/rozlicz reads the unpaid entries from the server', () => {
  test('a listener still holding paid entries does not make it ask again', async () => {
    // The store (listener) has not caught up with the payout's deletes yet.
    today.value = { ...today.value, choreEntries: [entry('e1', 10), entry('e2', 30)] };
    server.entries = [];
    await settle.ready!(ctx);
    expect(t('exus.chore.nothingToSettle')).toBe('Nie ma nic do rozliczenia.');
    expect(settle.check!({}, ctx)).toBe('Nie ma nic do rozliczenia.');
  });

  test('the question and the payout use what the server has, not the store', async () => {
    today.value = { ...today.value, choreEntries: [] };
    server.entries = [entry('e3', 7)];
    await settle.ready!(ctx);
    expect(settle.check!({}, ctx)).toBeNull();
    expect(settle.effect!({}, ctx)).toContain('Rozliczysz 7 pkt z wpisów: 1.');
    await settle.run({}, ctx);
    expect(settleChores.mock.calls[0]?.[1].map((e) => e.id)).toEqual(['e3']);
  });
});
