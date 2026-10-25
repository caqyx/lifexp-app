// The server's check of what the model answered (docs/v2/PLAN.md 6.9). The
// client only ever gets a reply string and actions with a known command and
// text arguments; anything malformed becomes a safe generic reply, so model
// text that failed the check never leaks and never turns into a 500.
import { z } from 'zod';
import { isAllowedCommand } from './commands';
import { MAX_ACTIONS, MAX_ARG_VALUE_CHARS, MAX_ARGS, MAX_REPLY_CHARS } from './config';
import type { TurnInput } from './input';
import { parseJson } from './model';

export interface ExusAction {
  command: string;
  args: Record<string, string>;
}

export interface ValidatedOutput {
  reply: string;
  actions: ExusAction[];
  /** Why the answer was replaced or trimmed, for logs (no model text). */
  issues: { malformed: boolean; droppedUnknown: number; droppedInvalid: number; trimmed: number };
}

export const SAFE_REPLY: Record<TurnInput['lang'], string> = {
  pl: 'Coś poszło nie tak po mojej stronie. Spróbuj napisać to jeszcze raz, innymi słowami.',
  en: 'Something went wrong on my side. Please try again in other words.',
};

const ARG_NAME = /^[a-z][A-Za-z0-9_-]{0,31}$/;
const scalar = z.union([z.string(), z.number(), z.boolean()]).transform(String);

/** The model sends name/value pairs (schema dialect); a plain object is accepted too. */
const argsSchema = z
  .union([
    z.array(z.object({ name: z.string(), value: scalar })),
    z.record(z.string(), scalar).transform((o) => Object.entries(o).map(([name, value]) => ({ name, value }))),
  ])
  .refine((pairs) => pairs.length <= MAX_ARGS)
  .refine((pairs) => pairs.every((p) => ARG_NAME.test(p.name) && p.value.length <= MAX_ARG_VALUE_CHARS))
  .refine((pairs) => new Set(pairs.map((p) => p.name)).size === pairs.length)
  .transform((pairs) => Object.fromEntries(pairs.map((p) => [p.name, p.value])) as Record<string, string>);

const actionSchema = z.object({ command: z.string(), args: argsSchema.default({}) });

const answerSchema = z.object({
  reply: z.string(),
  actions: z.array(z.unknown()).default([]),
});

export function validateOutput(raw: { text: string; json: unknown }, lang: TurnInput['lang']): ValidatedOutput {
  const issues = { malformed: false, droppedUnknown: 0, droppedInvalid: 0, trimmed: 0 };
  const parsed = answerSchema.safeParse(raw.json !== undefined ? raw.json : parseJson(raw.text));
  const reply = parsed.success ? parsed.data.reply.trim().slice(0, MAX_REPLY_CHARS) : '';
  if (!parsed.success || reply === '') {
    return { reply: SAFE_REPLY[lang], actions: [], issues: { ...issues, malformed: true } };
  }
  const actions: ExusAction[] = [];
  for (const item of parsed.data.actions) {
    const action = actionSchema.safeParse(item);
    if (!action.success) issues.droppedInvalid++;
    else if (!isAllowedCommand(action.data.command)) issues.droppedUnknown++;
    else actions.push(action.data);
  }
  issues.trimmed = Math.max(0, actions.length - MAX_ACTIONS);
  return { reply, actions: actions.slice(0, MAX_ACTIONS), issues };
}
