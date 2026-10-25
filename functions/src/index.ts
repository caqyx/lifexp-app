// LifeXP v2 Cloud Functions — codebase "lifexp-v2" (firebase.json).
//
// Exports (docs/v2/PLAN.md 6.9, 6.12):
//   exusTurn                                   — stage 5b: one Gemini call per message
//   sendParentEmailCode, verifyParentEmailCode — stage 6 (not yet)
//
// The five v1 callables (aiClassifyIntent, aiAssistantChat, aiAssistantPing,
// aiConfirmTask, aiConfirmGoal) are deployed from source that no longer
// exists. They belong to a different codebase, so deploying this one never
// touches them. Deploy only with `npm run deploy` in this folder, which
// targets functions:lifexp-v2 — never a bare `firebase deploy --only functions`.
import * as logger from 'firebase-functions/logger';
import { onCall } from 'firebase-functions/https';
import { defineSecret } from 'firebase-functions/params';
import { MAX_INSTANCES, MEMORY, REGION, TIMEOUT_SECONDS } from './exus/config';
import { selectModelClient } from './exus/select';
import { createTurnHandler } from './exus/turn';
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
