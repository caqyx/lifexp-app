// sendMyPushNow: a test notification to the signed-in account's own devices (its v1
// fcmTokens), for the owner's first check on a real phone (docs/v2/PLAN.md 9.1, 6-7).
// `dryRun` returns the payload and how many devices it would go to. At most
// MANUAL_DAILY_LIMIT real tests per Warsaw day, counted in pushLog; they do not use
// up the day's reminders.
import { HttpsError, type CallableRequest } from 'firebase-functions/https';
import { z } from 'zod';
import { MANUAL_DAILY_LIMIT, PUSH_LOG } from './config';
import { deliver, tokensOf, warsawNow, type PushDeps, type PushLog } from './job';
import { testText } from './messages';
import { pushPayload, type PushPayload } from './messaging';

const inputSchema = z.object({ dryRun: z.boolean().default(false) }).default({ dryRun: false });

export type ManualPushResult =
  | { dryRun: true; payload: PushPayload; devices: number }
  | { dryRun: false; devices: number; delivered: number; removedTokens: number };

export function createSendMyPushHandler(deps: PushDeps) {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});

  return async function sendMyPushNow(request: Pick<CallableRequest<unknown>, 'auth' | 'data'>): Promise<ManualPushResult> {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const parsed = inputSchema.safeParse(request.data ?? undefined);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Expected { dryRun?: boolean }.', { reason: 'invalid' });
    const db = deps.db();
    const user = await db.doc(`users/${uid}`).get();
    if (!user.exists) throw new HttpsError('not-found', 'No such account.', { reason: 'noAccount' });
    const tokens = await tokensOf(db, uid);
    if (tokens.length === 0) {
      throw new HttpsError('failed-precondition', 'Turn notifications on in the app (v1 settings) first.', { reason: 'noTokens' });
    }
    const payload = pushPayload(testText(user.data()?.lang === 'en' ? 'en' : 'pl'));
    if (parsed.data.dryRun) return { dryRun: true, payload, devices: tokens.length };

    const at = now();
    const logRef = db.doc(`${PUSH_LOG}/${uid}_${warsawNow(at).day}`);
    const allowed = await db.runTransaction(async (tx) => {
      const fresh = ((await tx.get(logRef)).data() ?? {}) as PushLog;
      const used = fresh.manual ?? 0;
      if (used >= MANUAL_DAILY_LIMIT) return false;
      tx.set(logRef, { manual: used + 1 }, { merge: true });
      return true;
    });
    if (!allowed) throw new HttpsError('resource-exhausted', `At most ${MANUAL_DAILY_LIMIT} tests a day.`, { reason: 'rateLimited' });
    const { delivered, dead } = await deliver(deps.messenger(), uid, payload, tokens);
    log('sendMyPushNow', { devices: tokens.length, delivered, removedTokens: dead });
    return { dryRun: false, devices: tokens.length, delivered, removedTokens: dead };
  };
}
