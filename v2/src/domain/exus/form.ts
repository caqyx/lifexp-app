// The form card of a command with missing slots (docs/v2/PLAN.md 6.6, row 2), the pure
// part: which control each slot gets, what the card starts with, and whether what is
// in it is a command that can run. Every value is read by the slot's own recognizer,
// so the card accepts exactly what the typed command would. Nothing here draws.
import { formatMoneyInput } from '@/lib/money';
import type { SlotDef } from './parse';
import type { Amount } from './recognizers';

export type FieldKind =
  /** One line of text (text and entity slots). */
  | 'text'
  /** The raw slot: everything after the command. */
  | 'textarea'
  | 'date'
  /** An amount in złoty (grosze). */
  | 'money'
  /** An amount whose unit decides what it is ("1500 zł", "5000 pkt"): typed as text. */
  | 'amount'
  /** Whole minutes or points. */
  | 'number'
  | 'choice'
  | 'flag';

export interface FieldDef {
  slot: SlotDef;
  kind: FieldKind;
}

/** What a field holds while it is edited: text, a number (or null), or a checkbox. */
export type RawValue = string | number | boolean | null;

/** A bare "1" read as grosze means the slot is a plain złoty amount, not the zł/pkt kind. */
const plainMoney = (slot: SlotDef) => typeof slot.recognize?.('1') === 'number';

function kindOf(slot: SlotDef): FieldKind | null {
  if (slot.raw) return 'textarea';
  if (slot.flags) return 'flag';
  switch (slot.type) {
    case 'text':
    case 'entity':
      return 'text';
    case 'date':
      return slot.recognize ? 'date' : null;
    case 'money':
      return slot.recognize ? (plainMoney(slot) ? 'money' : 'amount') : null;
    case 'duration':
    case 'number':
    case 'points':
      return slot.recognize ? 'number' : null;
    case 'enum':
      return slot.recognize && slot.choices ? 'choice' : null;
  }
}

/** One field per slot, in the command's order; null when some slot has no sensible control (the reply then names what is missing). */
export function fieldsFor(slots: readonly SlotDef[]): FieldDef[] | null {
  const fields: FieldDef[] = [];
  for (const slot of slots) {
    const kind = kindOf(slot);
    if (!kind) return null;
    fields.push({ slot, kind });
  }
  return fields;
}

/** An amount as it is typed: "1500,00 zł", "5000 pkt", or a bare number. */
export function amountText(amount: Amount): string {
  if (amount.kind === 'money') return `${formatMoneyInput(amount.grosze)} zł`;
  if (amount.kind === 'points') return `${amount.points} pkt`;
  return String(amount.value);
}

/** The card starts with what the parser understood. */
export function initialValues(fields: readonly FieldDef[], args: Record<string, unknown>): Record<string, RawValue> {
  const out: Record<string, RawValue> = {};
  for (const { slot, kind } of fields) {
    const arg = args[slot.name];
    switch (kind) {
      case 'money':
      case 'number':
        out[slot.name] = typeof arg === 'number' ? arg : null;
        break;
      case 'amount':
        out[slot.name] = typeof arg === 'object' && arg !== null ? amountText(arg as Amount) : '';
        break;
      case 'flag':
        out[slot.name] = arg === true;
        break;
      default:
        out[slot.name] = typeof arg === 'string' ? arg : '';
    }
  }
  return out;
}

export type FieldError = 'required' | 'invalid';

/** The value a field holds, or why it cannot be one; an empty optional field is `{}`. */
export function readField({ slot, kind }: FieldDef, raw: RawValue | undefined): { value?: unknown; error?: FieldError } {
  const empty = (): { error?: FieldError } => (slot.required ? { error: 'required' } : {});
  const recognize = (token: string) => {
    const value = slot.recognize?.(token);
    return value === undefined ? { error: 'invalid' as const } : { value };
  };
  switch (kind) {
    case 'flag':
      return raw === true ? { value: true } : {};
    case 'text':
    case 'textarea': {
      const text = typeof raw === 'string' ? raw.trim() : '';
      return text ? { value: text } : empty();
    }
    case 'money':
      return typeof raw === 'number' ? recognize(formatMoneyInput(raw)) : empty();
    case 'number':
      return typeof raw === 'number' ? recognize(String(raw)) : empty();
    case 'date':
    case 'choice': {
      const text = typeof raw === 'string' ? raw.trim() : '';
      return text ? recognize(text) : empty();
    }
    case 'amount': {
      // "1 500 zł" is one token, as the tokenizer joins it.
      const text = typeof raw === 'string' ? raw.replace(/\s+/g, '') : '';
      return text ? recognize(text) : empty();
    }
  }
}

export interface FormReading {
  /** The arguments of the command, as the parser would have given them. */
  args: Record<string, unknown>;
  errors: Record<string, FieldError>;
}

export function readForm(fields: readonly FieldDef[], raw: Readonly<Record<string, RawValue>>): FormReading {
  const args: Record<string, unknown> = {};
  const errors: Record<string, FieldError> = {};
  for (const field of fields) {
    const read = readField(field, raw[field.slot.name]);
    if (read.error) errors[field.slot.name] = read.error;
    else if (read.value !== undefined) args[field.slot.name] = read.value;
  }
  return { args, errors };
}
