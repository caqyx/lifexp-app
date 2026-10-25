// What the client may send to exusTurn (docs/v2/PLAN.md 6.9). Anything else is
// `invalid-argument`; the error names the bad fields, never their values.
import { HttpsError } from 'firebase-functions/https';
import { z } from 'zod';
import {
  MAX_CLIENT_VERSION_CHARS,
  MAX_CONTEXT_BYTES,
  MAX_HISTORY_TEXT_CHARS,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
} from './config';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

const contextSchema = z
  .custom<Record<string, unknown>>(isPlainObject, { message: 'context must be an object' })
  .refine((ctx) => Buffer.byteLength(JSON.stringify(ctx), 'utf8') <= MAX_CONTEXT_BYTES, {
    message: `context is larger than ${MAX_CONTEXT_BYTES} bytes`,
  });

export const turnInputSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        // Older turns are only background: cut, not rejected.
        text: z.string().transform((t) => t.slice(0, MAX_HISTORY_TEXT_CHARS)),
      }),
    )
    .max(MAX_HISTORY_TURNS)
    .default([]),
  context: contextSchema.default({}),
  lang: z.enum(['pl', 'en']),
  clientVersion: z.string().max(MAX_CLIENT_VERSION_CHARS),
});

export type TurnInput = z.infer<typeof turnInputSchema>;
export type HistoryTurn = TurnInput['history'][number];

export function parseTurnInput(data: unknown): TurnInput {
  const result = turnInputSchema.safeParse(data);
  if (result.success) return result.data;
  const fields = [...new Set(result.error.issues.map((i) => i.path.join('.') || '(root)'))];
  throw new HttpsError('invalid-argument', `Invalid exusTurn input: ${fields.join(', ')}.`);
}
