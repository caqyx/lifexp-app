// sendMyReportNow: the signed-in account's weekly report, now, to its own verified
// parent address (the owner's first real check, docs/v2/PLAN.md 9.1, 6-5). With
// `dryRun` it only returns the template params. At most MANUAL_DAILY_LIMIT real
// sends per 24 h; it never touches lastReportSent, so Sunday's report still goes.
import { HttpsError, type CallableRequest } from 'firebase-functions/https';
import type { DocumentData } from 'firebase-admin/firestore';
import { z } from 'zod';
import { maskEmail } from '../parent/code';
import { reportWeekStart } from '../v2/domain/parent';
import { MANUAL_DAILY_LIMIT, MANUAL_RUNS } from './config';
import { buildReportParams, type ReportDeps } from './job';
import type { ReportParams } from './params';

const DAY_MS = 24 * 60 * 60 * 1000;
const inputSchema = z.object({ dryRun: z.boolean().default(false) }).default({ dryRun: false });

export type ManualResult = { dryRun: true; params: ReportParams } | { dryRun: false; sentTo: string };

export function createSendMyReportHandler(deps: ReportDeps) {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});

  return async function sendMyReportNow(request: Pick<CallableRequest<unknown>, 'auth' | 'data'>): Promise<ManualResult> {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    const parsed = inputSchema.safeParse(request.data ?? undefined);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Expected { dryRun?: boolean }.', { reason: 'invalid' });
    const db = deps.db();
    const at = now();
    const user = await db.doc(`users/${uid}`).get();
    if (!user.exists) throw new HttpsError('not-found', 'No such account.', { reason: 'noAccount' });
    const params = await buildReportParams(db, uid, user.data() as DocumentData, reportWeekStart(at));
    if (!params) {
      throw new HttpsError('failed-precondition', 'Turn the weekly report on and verify the parent e-mail first.', { reason: 'noRecipient' });
    }
    if (parsed.data.dryRun) return { dryRun: true, params };

    const runs = db.doc(`${MANUAL_RUNS}/${uid}`);
    const allowed = await db.runTransaction(async (tx) => {
      const sends = (((await tx.get(runs)).data() as { sends?: number[] } | undefined)?.sends ?? []).filter((t) => at.getTime() - t < DAY_MS);
      if (sends.length >= MANUAL_DAILY_LIMIT) return false;
      tx.set(runs, { sends: [...sends, at.getTime()] });
      return true;
    });
    if (!allowed) throw new HttpsError('resource-exhausted', `At most ${MANUAL_DAILY_LIMIT} reports a day.`, { reason: 'rateLimited' });
    try {
      await deps.mailer().sendReport({ uid, params });
    } catch {
      log('sendMyReportNow', { sent: 0, failed: 1 });
      throw new HttpsError('unavailable', 'The e-mail could not be sent.', { reason: 'sendFailed' });
    }
    log('sendMyReportNow', { sent: 1, failed: 0 });
    return { dryRun: false, sentTo: maskEmail(params.to_email) };
  };
}
