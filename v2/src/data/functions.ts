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
