// The Ex-us command schema for the AI backend (docs/v2/PLAN.md 6.8 point 5),
// built from the v2 registry: every CommandSpec with `aiExposed: true`, its
// Polish description (i18n `exus.commands.<id>`) and its slots, plus the AI-only
// `edit-pending`. The result is committed as functions/src/exus/schema.gen.json.
//
// Regenerate:   npm run gen:exus-schema --prefix v2
// Stale check:  tools/exus-schema.test.ts (part of `npm run check --prefix v2`)
import { COMMANDS } from '@/domain/exus/commands';
import type { SlotDef } from '@/domain/exus/parse';
import pl from '@/i18n/pl.json';

export const SCHEMA_PATH = '../functions/src/exus/schema.gen.json';
export const REGEN_COMMAND = 'npm run gen:exus-schema --prefix v2';

export interface GenSlot {
  name: string;
  type: SlotDef['type'] | 'flag' | 'ref';
  required: boolean;
  /** Allowed values of an enum slot (compared without case and Polish letters). */
  choices?: string[];
  /** `key=value` names the user may type for it. */
  keys?: string[];
  /** The text after the command as typed (longer cap). */
  raw?: true;
  /** A `ref` slot's allowed values. */
  pattern?: string;
}

export interface GenCommand {
  id: string;
  description: string;
  risk: 'read' | 'write' | 'destructive';
  slots: GenSlot[];
  /** edit-pending only: also takes any slot of the pending card's command. */
  pendingSlots?: true;
}

export interface ExusSchema {
  $comment: string;
  commands: GenCommand[];
}

/**
 * AI-only (PLAN.md 6.7, U10): changes a card not yet confirmed. `ref` is p1..p3
 * from `context.pendingActions`; the other args are slots of that card's command,
 * which the server checks against the card it finds in the context.
 */
export const EDIT_PENDING: GenCommand = {
  id: 'edit-pending',
  description: 'Zmień niezatwierdzoną kartę z poprzedniej tury (ref p1..p3 z pendingActions) — podaj tylko zmieniane pola',
  risk: 'write',
  slots: [{ name: 'ref', type: 'ref', required: true, pattern: '^p[1-3]$' }],
  pendingSlots: true,
};

// Slots do not depend on the day for their shape; a fixed day keeps the output stable.
const FIXED_DAY = '2026-01-01';

function genSlot(s: SlotDef): GenSlot {
  const out: GenSlot = { name: s.name, type: s.flags ? 'flag' : s.type, required: s.required };
  if (s.type === 'enum' && s.choices) out.choices = [...s.choices];
  const keys = [...(s.keys ?? []), ...(s.flags ?? [])];
  if (keys.length > 0) out.keys = keys;
  if (s.raw) out.raw = true;
  return out;
}

export function buildExusSchema(): ExusSchema {
  const descriptions = pl.exus.commands as Record<string, string>;
  const commands = COMMANDS.filter((c) => c.aiExposed).map((c): GenCommand => {
    const description = descriptions[c.id];
    if (!description) throw new Error(`Missing i18n exus.commands.${c.id}`);
    return { id: c.id, description, risk: c.risk, slots: c.slots(FIXED_DAY).map(genSlot) };
  });
  return {
    $comment: `GENERATED from v2/src/domain/exus/commands.ts by v2/tools/exus-schema.ts. Do not edit. Regenerate: ${REGEN_COMMAND}`,
    commands: [...commands, EDIT_PENDING],
  };
}

export function serializeExusSchema(schema: ExusSchema = buildExusSchema()): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}
