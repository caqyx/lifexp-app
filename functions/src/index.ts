// LifeXP v2 Cloud Functions — codebase "lifexp-v2" (firebase.json).
//
// Exports (docs/v2/PLAN.md 6.9, 6.12):
//   exusTurn                                   — stage 5b: one Gemini call per message
//   sendParentEmailCode, verifyParentEmailCode — stage 6-4: the parent's e-mail code on the server
//   weeklyParentReport, sendMyReportNow        — stage 6-5/6-6: the weekly report to the parent
//
// The five v1 callables (aiClassifyIntent, aiAssistantChat, aiAssistantPing,
// aiConfirmTask, aiConfirmGoal) are deployed from source that no longer
// exists. They belong to a different codebase, so deploying this one never
// touches them. Deploy only with `npm run deploy` in this folder, which
// targets functions:lifexp-v2 — never a bare `firebase deploy --only functions`.
import * as logger from 'firebase-functions/logger';
import { onCall } from 'firebase-functions/https';
import { onSchedule } from 'firebase-functions/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { MAX_INSTANCES, MEMORY, REGION, TIMEOUT_SECONDS } from './exus/config';
import { selectModelClient } from './exus/select';
import { createTurnHandler } from './exus/turn';
import * as parent from './parent/config';
import { createSendHandler, createVerifyHandler } from './parent/handlers';
import { selectMailer } from './parent/mailer';
import * as report from './report/config';
import { runWeeklyReports } from './report/job';
import { createSendMyReportHandler } from './report/manual';
import { db } from './shared/admin';

// The secret already exists in Secret Manager (the v1 functions use it); this only references it by name.
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

export const exusTurn = onCall(
  { region: REGION, memory: MEMORY, maxInstances: MAX_INSTANCES, timeoutSeconds: TIMEOUT_SECONDS, secrets: [GEMINI_API_KEY] },
  createTurnHandler({
    db,
    model: () => selectModelClient(process.env, () => GEMINI_API_KEY.value()),
    log: (event, data) => logger.info(event, data),
  }),
);

// Was a GitHub Actions secret for v1's weekly report; for functions the owner puts it
// into Secret Manager under this name (docs/v2/PLAN.md 9.1, row 6-4). Read only by the real mailer.
const EMAILJS_PRIVATE_KEY = defineSecret('EMAILJS_PRIVATE_KEY');

const parentOptions = {
  region: parent.REGION,
  memory: parent.MEMORY,
  maxInstances: parent.MAX_INSTANCES,
  timeoutSeconds: parent.TIMEOUT_SECONDS,
};
const parentDeps = {
  db,
  mailer: () => selectMailer(process.env, db, () => EMAILJS_PRIVATE_KEY.value()),
  log: (event: string, data: Record<string, unknown>) => logger.info(event, data),
};

export const sendParentEmailCode = onCall({ ...parentOptions, secrets: [EMAILJS_PRIVATE_KEY] }, createSendHandler(parentDeps));
export const verifyParentEmailCode = onCall(parentOptions, createVerifyHandler(parentDeps));

const reportDeps = {
  db,
  mailer: () => selectMailer(process.env, db, () => EMAILJS_PRIVATE_KEY.value()),
  log: (event: string, data: Record<string, unknown>) => logger.info(event, data),
};

// Sunday 9:00 Warsaw (v1's workflow: 08:00 UTC). Replaces .github/workflows/weekly-report.yml (gone since 19.08).
export const weeklyParentReport = onSchedule(
  {
    schedule: report.SCHEDULE,
    timeZone: report.TIME_ZONE,
    region: report.REGION,
    memory: report.MEMORY,
    timeoutSeconds: report.TIMEOUT_SECONDS,
    maxInstances: 1,
    secrets: [EMAILJS_PRIVATE_KEY],
  },
  async () => {
    await runWeeklyReports(reportDeps);
  },
);

export const sendMyReportNow = onCall(
  { region: report.REGION, memory: report.MEMORY, maxInstances: 1, timeoutSeconds: 60, secrets: [EMAILJS_PRIVATE_KEY] },
  createSendMyReportHandler(reportDeps),
);
