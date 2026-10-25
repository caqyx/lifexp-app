// An action proposed by the AI (`{command, args}`, args as text) turned into the
// args a typed command would have (docs/v2/PLAN.md 6.6, 6.7), so it runs through
// the same policy, form card and handlers:
// - a ref from the context ("g1") becomes the name of what it points to, which
//   the handler's entity matching finds; a ref that is not in the map (or of the
//   wrong kind for the slot) rejects the whole action;
// - every other value is read by its slot's recognizer, exactly as `key=value`
//   in a typed command (fillSlots); a value the recognizer cannot read stays
//   missing, so the form card asks for it;
// - missing required slots stay missing (`missing`), they are not an error.
import type { CommandSpec } from './commands';
import type { ContextRefs, RefKind } from './context';
import { missingSlots, tokenize, type SlotDef } from './parse';
import { fold } from './recognizers';

export interface AiAction {
  command: string;
  args: Readonly<Record<string, string>>;
}

export type Resolved =
  | { ok: true; args: Record<string, unknown>; missing: string[]; unread: string[] }
  | { ok: false; error: 'unknown-ref' | 'wrong-ref'; ref: string; slot: string };

/** What the context's refs look like (domain/exus/context PREFIX). */
const REF = /^[gtcaln]\d+$/;

/** The kind of thing a slot names, by slot name; a ref of another kind does not fit it. */
const SLOT_KIND: Readonly<Record<string, RefKind>> = {
  goal: 'goal',
  task: 'task',
  chore: 'chore',
  loan: 'loan',
  note: 'note',
};

/** log-activity's `type` is a text slot that names an activity type. */
const kindOf = (spec: CommandSpec, slot: SlotDef): RefKind | undefined =>
  SLOT_KIND[slot.name] ?? (spec.id === 'log-activity' && slot.name === 'type' ? 'activity' : undefined);

function read(slot: SlotDef, value: string): unknown {
  if (slot.raw) return value.trim() ? value : undefined;
  if (slot.flags) return fold(value.trim()) === 'true' ? true : undefined;
  const text = value.trim();
  if (!slot.recognize) return text || undefined;
  // As typed: the tokenizer glues a unit to its number ("20 zł" → "20zł").
  const tokens = tokenize(text).tokens;
  return slot.recognize(text) ?? (tokens.length === 1 ? slot.recognize(tokens[0]!) : undefined);
}

export function resolveAction(action: AiAction, refs: ContextRefs, spec: CommandSpec, today: string): Resolved {
  const slots = spec.slots(today);
  const args: Record<string, unknown> = {};
  const unread: string[] = [];
  for (const slot of slots) {
    let value = action.args[slot.name];
    if (value === undefined) continue;
    const trimmed = value.trim();
    const expected = kindOf(spec, slot);
    if (REF.test(trimmed)) {
      const target = refs[trimmed];
      if (target && (!expected || target.kind === expected)) value = target.name;
      else if (target) return { ok: false, error: 'wrong-ref', ref: trimmed, slot: slot.name };
      // A ref-looking word in a slot that names a thing is a ref the model made up.
      else if (expected || slot.type === 'entity') return { ok: false, error: 'unknown-ref', ref: trimmed, slot: slot.name };
    }
    const parsed = read(slot, value);
    if (parsed === undefined) unread.push(slot.name);
    else args[slot.name] = parsed;
  }
  return { ok: true, args, missing: missingSlots(slots, args), unread };
}
