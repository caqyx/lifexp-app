// Per-command check of the arguments the model proposed, against the slots in
// schema.gen.json. Values stay text: the client reads them with the same slot
// recognizers as a typed command, and a missing or dropped slot only means the
// form card asks for it (PLAN.md 6.6), so a bad argument is dropped, not the action.
//   - names that are not a slot of the command: dropped
//   - empty values, values over the length cap: dropped
//   - enum with known choices: must be one of them (case and Polish letters
//     ignored), sent back spelled as the choice; otherwise dropped
//   - flag: true/false only
//   - edit-pending: `ref` must be a pending card from context.pendingActions;
//     the other args are checked against THAT card's command; no ref or nothing
//     to change = the action is dropped
import { EDIT_PENDING, commandSpec, type SchemaCommand, type SchemaSlot } from './commands';
import { MAX_ARG_VALUE_CHARS, MAX_RAW_ARG_CHARS } from './config';

export interface ArgPair {
  name: string;
  value: string;
}

/** ref -> command id of the cards still waiting for the user (context.pendingActions). */
export type PendingCards = ReadonlyMap<string, string>;

export interface ArgCheck {
  /** null: the action itself is invalid and must be dropped. */
  args: Record<string, string> | null;
  dropped: number;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');

function checkValue(slot: SchemaSlot, raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
  if (value.length > (slot.raw ? MAX_RAW_ARG_CHARS : MAX_ARG_VALUE_CHARS)) return null;
  if (slot.choices) return slot.choices.find((c) => fold(c) === fold(value)) ?? null;
  if (slot.type === 'flag') return fold(value) === 'true' ? 'true' : fold(value) === 'false' ? 'false' : null;
  if (slot.pattern && !new RegExp(slot.pattern).test(value)) return null;
  return value;
}

function checkAgainst(slots: readonly SchemaSlot[], pairs: readonly ArgPair[]): { args: Record<string, string>; dropped: number } {
  const byName = new Map(slots.map((s) => [s.name, s]));
  const args: Record<string, string> = {};
  let dropped = 0;
  for (const { name, value } of pairs) {
    const slot = byName.get(name);
    const ok = slot ? checkValue(slot, value) : null;
    if (ok === null) dropped++;
    else args[name] = ok;
  }
  return { args, dropped };
}

export function checkArgs(command: SchemaCommand, pairs: readonly ArgPair[], pending: PendingCards): ArgCheck {
  if (command.id !== EDIT_PENDING) return checkAgainst(command.slots, pairs);

  const ref = pairs.find((p) => p.name === 'ref')?.value.trim() ?? '';
  const target = pending.get(ref);
  const targetSpec = target && target !== EDIT_PENDING ? commandSpec(target) : undefined;
  const refSlot = command.slots.find((s) => s.name === 'ref');
  if (!targetSpec || !refSlot || checkValue(refSlot, ref) === null) return { args: null, dropped: pairs.length };

  const { args, dropped } = checkAgainst(targetSpec.slots, pairs.filter((p) => p.name !== 'ref'));
  if (Object.keys(args).length === 0) return { args: null, dropped: pairs.length };
  return { args: { ref, ...args }, dropped };
}

/** The pending cards the client sent in its context, as far as they are well formed. */
export function pendingCards(context: Record<string, unknown>): PendingCards {
  const list = Array.isArray(context.pendingActions) ? context.pendingActions : [];
  const cards = new Map<string, string>();
  for (const item of list) {
    const { ref, command } = (item ?? {}) as { ref?: unknown; command?: unknown };
    if (typeof ref === 'string' && typeof command === 'string') cards.set(ref, command);
  }
  return cards;
}
