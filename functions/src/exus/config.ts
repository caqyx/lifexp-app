// Every knob of exusTurn in one place (docs/v2/PLAN.md 6.9, 6.12).
// Budgets start LOW on purpose: raise them here and redeploy
// (`npm run deploy` in functions/, which targets functions:lifexp-v2 only).

import { ThinkingLevel } from '@google/genai';

/**
 * The Gemini model. One constant, so a model change is one line.
 * gemini-2.5-flash was shut down on 2026-10-16; Google points to gemini-3.5-flash.
 * Thinking is kept at the lowest Gemini 3 level (`thinkingLevel`; Gemini 3 has
 * no `thinkingBudget: 0`) because thought tokens count against the budget and
 * a turn only has to pick a reply and at most three actions. Temperature stays
 * at the model default, as Google advises for Gemini 3.
 */
export const MODEL_NAME = 'gemini-3.5-flash';
export const THINKING_LEVEL = ThinkingLevel.MINIMAL;
/** Caps one answer, and with it how far one call can overshoot a budget. */
export const MAX_OUTPUT_TOKENS = 1024;

/** Tokens one account may use per Warsaw day (prompt + context + history + answer). */
export const USER_DAILY_TOKENS = 20_000;
/** Fuse for all accounts together per Warsaw day. */
export const GLOBAL_DAILY_TOKENS = 200_000;
/** Day keys follow the user's day, not UTC. */
export const BUDGET_TIME_ZONE = 'Europe/Warsaw';

/** Same location family as the Firestore database (eur3). */
export const REGION = 'europe-west1';
export const MAX_INSTANCES = 5;
export const MEMORY = '256MiB' as const;
export const TIMEOUT_SECONDS = 60;

// Input limits (validated with zod in input.ts).
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_HISTORY_TURNS = 8;
/** Each history turn is cut to this length, not rejected. */
export const MAX_HISTORY_TEXT_CHARS = 1000;
/** Serialized context (PLAN.md 6.7 aims at 1-2k tokens; this is the hard stop). */
export const MAX_CONTEXT_BYTES = 16 * 1024;
export const MAX_CLIENT_VERSION_CHARS = 64;

// Output limits (validated in output.ts).
export const MAX_ACTIONS = 3;
export const MAX_REPLY_CHARS = 4000;
export const MAX_ARGS = 10;
export const MAX_ARG_VALUE_CHARS = 500;
/** A `raw` slot (the bug report) is the whole text after the command, as long as a message. */
export const MAX_RAW_ARG_CHARS = MAX_MESSAGE_CHARS;
