// Ex-us command parsing (docs/v2/PLAN.md 6.3): "/zadanie Kupić mleko jutro M" →
// the command and its arguments, in any order. Each slot of a command has a type
// with a recognizer; the most specific slots take their tokens first and whatever
// is left becomes the one text slot. Missing slots are not an error here: the
// preview card is an editable form that shows what is missing.

import { fold } from './recognizers';

export interface Tokenized {
  /** "zadanie" for "/zadanie …"; null when the text is not a command. */
  command: string | null;
  /** Positional tokens, quotes removed, in order. */
  tokens: string[];
  /** `key=value` arguments (keys lower-case). */
  named: Record<string, string>;
  /** `--flag` arguments (lower-case, without dashes). */
  flags: string[];
}

const QUOTES: Record<string, string> = { '"': '"', '„': '”', '“': '”', '«': '»' };
const UNIT = /^(zł|zl|pln|pkt)$/i;
const DIGITS = /^\d+([.,]\d+)?$/;

/** Splits on whitespace, keeping quoted parts ("…", „…”) together. */
function split(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (i >= text.length) break;
    let token = '';
    while (i < text.length && !/\s/.test(text[i]!)) {
      const close = QUOTES[text[i]!];
      if (close) {
        const end = text.indexOf(close, i + 1);
        if (end > i) {
          token += text.slice(i + 1, end);
          i = end + 1;
          continue;
        }
      }
      token += text[i];
      i++;
    }
    out.push(token);
  }
  return out;
}

/**
 * "12 zł" → "12zł", "1 500 PLN" → "1500PLN": a unit written apart sticks to its
 * number, and thousands groups stick together when a unit follows them.
 */
function joinUnits(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    let j = i;
    let joined = tokens[i]!;
    if (/^\d{1,3}$/.test(joined)) {
      let k = i + 1;
      let groups = joined;
      while (k < tokens.length && /^\d{3}([.,]\d{1,2})?$/.test(tokens[k]!)) groups += tokens[k++];
      if (k > i + 1 && k < tokens.length && UNIT.test(tokens[k]!)) {
        joined = groups;
        j = k - 1;
      }
    }
    if (DIGITS.test(joined) && j + 1 < tokens.length && UNIT.test(tokens[j + 1]!)) {
      joined += tokens[j + 1];
      j++;
    }
    out.push(joined);
    i = j;
  }
  return out;
}

export function tokenize(input: string): Tokenized {
  const text = input.trim();
  const parts = split(text);
  let command: string | null = null;
  if (parts[0]?.startsWith('/')) command = parts.shift()!.slice(1).toLowerCase() || null;
  const named: Record<string, string> = {};
  const flags: string[] = [];
  const rest: string[] = [];
  for (const part of parts) {
    const kv = /^([\p{L}][\p{L}\d_-]*)=(.*)$/u.exec(part);
    if (kv) named[kv[1]!.toLowerCase()] = kv[2]!;
    else if (/^--[\p{L}\d-]+$/u.test(part)) flags.push(part.slice(2).toLowerCase());
    else if (part) rest.push(part);
  }
  return { command, tokens: joinUnits(rest), named, flags };
}

// ── Slot filling ──

export type SlotType = 'enum' | 'date' | 'duration' | 'money' | 'points' | 'number' | 'entity' | 'text';

/** A token → its value, or undefined when it is not one. */
export type Recognizer<T> = (token: string) => T | undefined;

export interface SlotDef<T = unknown> {
  name: string;
  type: SlotType;
  required: boolean;
  /** Not used for the text and entity slots. */
  recognize?: Recognizer<T>;
  /** Looks from the last token backwards: a name may hold numbers, the amount comes last. */
  fromEnd?: boolean;
  /** Also read from `key=value` (keys in lower case, without Polish letters). */
  keys?: readonly string[];
  /** Takes only its `key=value`, never a loose token. */
  namedOnly?: boolean;
  /** A text slot that takes the first loose token (quote it for several words); the next text slot gets the rest. */
  leading?: boolean;
  /** Set by `--flag` (lower-case, without dashes): true when any of these was written. */
  flags?: readonly string[];
  /** The one text slot that gets everything after the command as typed, untouched (spacing, quotes, `a=b`, units). */
  raw?: boolean;
}

/** What `fillSlots` reads besides the tokens: the `--flags`, and the text after the command as typed. */
export interface Extras {
  flags?: readonly string[];
  rest?: string;
}

/** Most specific first: a date never ends up as part of a task's text. */
const SPECIFICITY: readonly SlotType[] = ['enum', 'date', 'duration', 'money', 'points', 'number', 'entity', 'text'];

export function fillSlots(
  tokens: readonly string[],
  slots: readonly SlotDef[],
  named: Readonly<Record<string, string>> = {},
  extras: Extras = {},
): Record<string, unknown> {
  const used = new Set<number>();
  const out: Record<string, unknown> = {};
  // A raw slot is the whole text as typed; a flag slot is true when its flag was written.
  const raw = slots.find((s) => s.raw);
  if (raw) {
    const rest = extras.rest?.trim();
    if (rest) out[raw.name] = rest;
    return out;
  }
  for (const slot of slots) {
    if (slot.flags?.some((f) => extras.flags?.includes(f))) out[slot.name] = true;
  }
  const ordered = [...slots].sort((a, b) => SPECIFICITY.indexOf(a.type) - SPECIFICITY.indexOf(b.type));
  // `key=value` first: it is explicit, so it never competes with a loose token.
  const byKey = new Map(Object.entries(named).map(([k, v]) => [fold(k), v]));
  for (const slot of slots) {
    const raw = slot.keys?.map((k) => byKey.get(k)).find((v) => v !== undefined);
    if (raw === undefined) continue;
    const value = slot.recognize ? slot.recognize(raw) : raw.trim() || undefined;
    if (value !== undefined) out[slot.name] = value;
  }
  for (const slot of ordered) {
    if (slot.type === 'text' || slot.type === 'entity' || !slot.recognize || slot.namedOnly || slot.name in out) continue;
    const order = tokens.map((_, j) => j);
    if (slot.fromEnd) order.reverse();
    for (const j of order) {
      if (used.has(j)) continue;
      const value = slot.recognize(tokens[j]!);
      if (value !== undefined) {
        used.add(j);
        out[slot.name] = value;
        break;
      }
    }
  }
  // A leading slot ("title") takes the first token that is left; quotes keep several words together.
  for (const slot of slots) {
    if (!slot.leading || slot.name in out) continue;
    const j = tokens.findIndex((_, i) => !used.has(i));
    if (j >= 0) {
      used.add(j);
      out[slot.name] = tokens[j];
    }
  }
  // Whatever is left is the one free-text slot (or the entity, named by its words).
  const text = slots.find((s) => (s.type === 'text' || s.type === 'entity') && !s.namedOnly && !(s.name in out));
  if (text) {
    const rest = tokens.filter((_, i) => !used.has(i)).join(' ');
    if (rest) out[text.name] = rest;
  }
  return out;
}

/** The slots whose `key=value` was written but could not be read (e.g. "kwota=abc"). */
export function unreadNamed(slots: readonly SlotDef[], named: Readonly<Record<string, string>>, args: Record<string, unknown>): string[] {
  const keys = new Set(Object.keys(named).map(fold));
  return slots.filter((s) => s.keys?.some((k) => keys.has(k)) && args[s.name] === undefined).map((s) => s.name);
}

/** The required slots `args` has no value for: what the card marks as missing. */
export function missingSlots(slots: readonly SlotDef[], args: Record<string, unknown>): string[] {
  return slots.filter((s) => s.required && args[s.name] === undefined).map((s) => s.name);
}
