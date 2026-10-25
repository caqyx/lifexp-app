// Callable Cloud Functions of v2 (codebase lifexp-v2, docs/v2/PLAN.md 6.12) on the
// one Firebase app (data/firebase.ts). Loaded on first use: the Functions SDK is
// its own chunk. The functions live in europe-west1 (next to the eur3 database);
// v1's old callables are elsewhere and never called from here.
import { connectFunctionsEmulator, getFunctions, httpsCallable, type FunctionsError } from 'firebase/functions';
import { AiError, aiErrorKind, readTurnResponse, readUsage, type AiTurnRequest, type AiTurnResponse } from '@/domain/exus/ai';
import { app, emulator } from './firebase';

export const FUNCTIONS_REGION = 'europe-west1';

const functions = getFunctions(app, FUNCTIONS_REGION);
if (emulator) connectFunctionsEmulator(functions, emulator.host, emulator.functionsPort);

const exusTurn = httpsCallable<AiTurnRequest, unknown>(functions, 'exusTurn', { timeout: 60_000 });

const isFunctionsError = (error: unknown): error is FunctionsError =>
  typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string';

/** One turn of Ex-us with the AI; rejects with an AiError that says why not. */
export async function callExusTurn(request: AiTurnRequest): Promise<AiTurnResponse> {
  let raw: unknown;
  try {
    raw = (await exusTurn(request)).data;
  } catch (error) {
    if (!isFunctionsError(error)) throw new AiError('failed');
    const kind = aiErrorKind(error.code.replace(/^functions\//, ''));
    const details = error.details as { usage?: unknown } | undefined;
    throw new AiError(kind, kind === 'budget' ? readUsage(details?.usage) : undefined);
  }
  const response = readTurnResponse(raw);
  if (!response) throw new AiError('failed');
  return response;
}

// ── The parent's e-mail code on the server (stage 6-4) ──

/** What the functions say went wrong (`details.reason`), or 'failed' for anything else. */
export type ParentCodeReason = 'invalid' | 'rateLimited' | 'sendFailed' | 'noPending' | 'expired' | 'wrongCode' | 'locked' | 'failed';

const PARENT_REASONS: readonly ParentCodeReason[] = ['invalid', 'rateLimited', 'sendFailed', 'noPending', 'expired', 'wrongCode', 'locked'];

const sendParentEmailCode = httpsCallable<{ email: string; lang: string }, unknown>(functions, 'sendParentEmailCode', { timeout: 30_000 });
const verifyParentEmailCode = httpsCallable<{ code: string; lang: string }, unknown>(functions, 'verifyParentEmailCode', { timeout: 30_000 });

async function parentCall(call: () => Promise<unknown>): Promise<ParentCodeReason | null> {
  try {
    await call();
    return null;
  } catch (error) {
    const reason = isFunctionsError(error) ? (error.details as { reason?: unknown } | undefined)?.reason : undefined;
    return PARENT_REASONS.find((r) => r === reason) ?? 'failed';
  }
}

/** Sends the code to `email`; null when it is on its way. */
export function callSendParentEmailCode(email: string, lang: string): Promise<ParentCodeReason | null> {
  return parentCall(() => sendParentEmailCode({ email, lang }));
}

/** Checks the code; null when the address is verified. */
export function callVerifyParentEmailCode(code: string, lang: string): Promise<ParentCodeReason | null> {
  return parentCall(() => verifyParentEmailCode({ code, lang }));
}
