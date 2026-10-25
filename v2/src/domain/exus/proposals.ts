// AI proposals in the chat (docs/v2/PLAN.md 6.6 row 3, 6.7): what the next turn
// is told about the cards still waiting and about what the person did with the
// earlier ones. The backend keeps nothing, so this is how it knows. Pure.
import { PENDING_ACTIONS_MAX, RECENT_ACTIONS_MAX, type PendingCard, type RecentAction } from './context';
import { formatMoneyInput } from '@/lib/money';
import type { FieldDef, RawValue } from './form';

/** A card the person has not run or skipped yet: its command and what its fields hold now. */
export interface LiveProposal {
  /** The chat's message id of the card. */
  id: number;
  command: string;
  fields: readonly FieldDef[];
  raw: Readonly<Record<string, RawValue>>;
}

export interface PendingProposals {
  /** p1..p3 for the context, in the order of the chat. */
  cards: PendingCard[];
  /** p1 → the card's message id, for edit-pending in the answer. */
  byRef: Map<string, number>;
}

/** The field values as the person would type them (an amount in zł, not grosze); empty fields are left out. */
function shownArgs(fields: readonly FieldDef[], raw: Readonly<Record<string, RawValue>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { slot, kind } of fields) {
    const value = raw[slot.name];
    if (value === null || value === undefined || value === false) continue;
    const text = kind === 'money' && typeof value === 'number' ? `${formatMoneyInput(value)} zł` : String(value).trim();
    if (text) out[slot.name] = text;
  }
  return out;
}

/** The newest waiting cards (at most 3), oldest of them p1. */
export function pendingProposals(live: readonly LiveProposal[]): PendingProposals {
  const kept = live.slice(-PENDING_ACTIONS_MAX);
  const byRef = new Map<string, number>();
  const cards = kept.map((p, i) => {
    const ref = `p${i + 1}`;
    byRef.set(ref, p.id);
    return { ref, command: p.command, args: shownArgs(p.fields, p.raw) };
  });
  return { cards, byRef };
}

/** What happened to a proposal, added to the last RECENT_ACTIONS_MAX. */
export function withRecent(list: readonly RecentAction[], entry: RecentAction): RecentAction[] {
  return [...list, entry].slice(-RECENT_ACTIONS_MAX);
}
