// One Ex-us turn with the AI (docs/v2/PLAN.md 6.9): what is sent to exusTurn,
// what comes back, and how its failures are told apart. Pure; the call itself is
// data/functions.ts, the request is put together by features/exus.
import type { ExusContext } from './context';

/** exusTurn keeps the last 8 turns; each is cut on the server too. */
export const AI_HISTORY_TURNS = 8;
export const AI_HISTORY_TEXT_MAX = 1000;

export interface AiUsage {
  tokensUsedToday: number;
  tokensLimitDaily: number;
  /** 0 … 100. */
  remainingPercent: number;
}

export interface AiTurnRequest {
  message: string;
  history: { role: 'user' | 'model'; text: string }[];
  context: ExusContext;
  lang: 'pl' | 'en';
  clientVersion: string;
}

export interface AiTurnAction {
  command: string;
  args: Record<string, string>;
}

export interface AiTurnResponse {
  reply: string;
  actions: AiTurnAction[];
  usage: AiUsage;
}

/** Why a turn did not come back with a reply. */
export type AiErrorKind =
  /** Not signed in, or the account is not on the AI test list. */
  | 'no-access'
  /** The daily budget (the account's or everybody's) is used up. */
  | 'budget'
  | 'invalid'
  /** The model or the function is down for a moment. */
  | 'unavailable'
  /** The request never got an answer (no connection, blocked). */
  | 'network'
  | 'failed';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    /** From a `budget` error: the usage the server counted. */
    readonly usage?: AiUsage,
  ) {
    super(kind);
    this.name = 'AiError';
  }
}

/** The Functions error code (without "functions/") as one of ours. */
export function aiErrorKind(code: string): AiErrorKind {
  switch (code) {
    case 'unauthenticated':
    case 'permission-denied':
      return 'no-access';
    case 'resource-exhausted':
      return 'budget';
    case 'invalid-argument':
      return 'invalid';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'unavailable';
    // The SDK reports a request that got no response (offline, CORS, a crash) as "internal".
    case 'internal':
      return 'network';
    default:
      return 'failed';
  }
}

/** A usage object from the server, if it is one. */
export function readUsage(raw: unknown): AiUsage | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { tokensUsedToday, tokensLimitDaily, remainingPercent } = raw as Record<string, unknown>;
  const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!n(tokensUsedToday) || !n(tokensLimitDaily) || !n(remainingPercent)) return undefined;
  return { tokensUsedToday, tokensLimitDaily, remainingPercent: Math.min(100, Math.max(0, remainingPercent)) };
}

/** The answer of exusTurn, as far as it has the right shape; anything else is a failed turn. */
export function readTurnResponse(raw: unknown): AiTurnResponse | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { reply, actions, usage } = raw as Record<string, unknown>;
  const parsedUsage = readUsage(usage);
  if (typeof reply !== 'string' || !parsedUsage) return null;
  const list = Array.isArray(actions) ? actions : [];
  const parsedActions = list.flatMap((a: unknown): AiTurnAction[] => {
    const { command, args } = (typeof a === 'object' && a !== null ? a : {}) as Record<string, unknown>;
    if (typeof command !== 'string' || typeof args !== 'object' || args === null) return [];
    const strings = Object.entries(args).filter((e): e is [string, string] => typeof e[1] === 'string');
    return [{ command, args: Object.fromEntries(strings) }];
  });
  return { reply, actions: parsedActions, usage: parsedUsage };
}

/** A chat message as the history sees it: only turns of the AI conversation count. */
export interface ChatTurn {
  from: 'me' | 'exus';
  text: string;
  /** A message to or from the AI (not a command, its reply, or a card). */
  ai?: boolean;
}

/** The last AI turns before the new message, oldest first, each cut. */
export function historyForAi(messages: readonly ChatTurn[]): AiTurnRequest['history'] {
  return messages
    .filter((m) => m.ai && m.text.trim() !== '')
    .slice(-AI_HISTORY_TURNS)
    .map((m) => ({ role: m.from === 'me' ? 'user' : 'model', text: m.text.slice(0, AI_HISTORY_TEXT_MAX) }));
}
