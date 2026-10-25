// exusTurn (docs/v2/PLAN.md 6.9): one stateless turn of Ex-us.
//   auth -> allowlist aiTestAccess/{uid} -> input -> token budget
//   -> ONE model call with a forced schema -> server validation -> usage write
//   <- { reply, actions, usage }
// It never writes LifeXP data: actions go back to the client, which shows each
// one as a card and runs it through the same pipeline as a typed command.
import { HttpsError, type CallableRequest } from 'firebase-functions/https';
import type { Firestore } from 'firebase-admin/firestore';
import { buildResponseSchema } from './commands';
import { parseTurnInput } from './input';
import type { ModelClient } from './model';
import { validateOutput, type ExusAction } from './output';
import { PROMPT_VERSION, buildContents, buildSystemPrompt } from './prompt';
import { checkBudget, dayKey, recordUsage, usageOf, type Usage } from './quota';

export interface TurnResult {
  reply: string;
  actions: ExusAction[];
  usage: Usage;
}

export interface TurnDeps {
  db: () => Firestore;
  model: () => ModelClient;
  now?: () => Date;
  log?: (event: string, data: Record<string, unknown>) => void;
}

export const ALLOWLIST = 'aiTestAccess';

const UNAVAILABLE = {
  pl: 'Ex-us jest teraz niedostępny. Spróbuj za chwilę.',
  en: 'Ex-us is unavailable right now. Please try again in a moment.',
} as const;

export function createTurnHandler(deps: TurnDeps) {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});

  return async function exusTurn(request: Pick<CallableRequest<unknown>, 'auth' | 'data'>): Promise<TurnResult> {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to use Ex-us.');

    const db = deps.db();
    const access = await db.doc(`${ALLOWLIST}/${uid}`).get();
    if (!access.exists) throw new HttpsError('permission-denied', 'Ex-us AI is not enabled for this account.');

    const input = parseTurnInput(request.data);
    const at = now();
    const day = dayKey(at);
    await checkBudget(db, uid, day, input.lang);

    let answer;
    try {
      answer = await deps.model().generate({
        system: buildSystemPrompt(input.lang, input.context),
        contents: buildContents(input.history, input.message),
        schema: buildResponseSchema(),
      });
    } catch (err) {
      // Status only: an SDK error message may quote the request.
      log('exusTurn.model_error', { promptVersion: PROMPT_VERSION, status: (err as { status?: unknown })?.status ?? null });
      throw new HttpsError('unavailable', UNAVAILABLE[input.lang]);
    }

    const output = validateOutput(answer, input.lang);
    const used = await recordUsage(db, uid, day, answer.usage.totalTokens, at);
    log('exusTurn', {
      promptVersion: PROMPT_VERSION,
      clientVersion: input.clientVersion,
      tokens: answer.usage.totalTokens,
      actions: output.actions.length,
      ...output.issues,
    });
    return { reply: output.reply, actions: output.actions, usage: usageOf(used) };
  };
}
