// The parent's e-mail and the weekly report (v1 settings.js; stage 4g). Two ways to
// verify the address:
// - on the server (stage 6-4): sendParentEmailCode / verifyParentEmailCode keep only a
//   hash of the code where no client reaches it (B12, R17);
// - in the client, as v1 (stage 4g-1): the code sits in users/{uid}. Kept as the
//   fallback until the functions are deployed with the EMAILJS_PRIVATE_KEY secret.
// The code is sent first and saved after: v1 saves it first, so a failed send left
// "code sent" on screen with nothing in the inbox.
import { sendParentCodeEmail } from '@/data/emailjs';
import { emulator } from '@/data/firebase';
import {
  cancelParentEmailVerification,
  confirmParentEmail,
  readParentCode,
  setAutoReport,
  startParentEmailVerification,
} from '@/data/repos/profile';
import { newParentCode, parentCodeProblem, parentEmailProblem, PARENT_CODE_TTL_MS, type CodeProblem } from '@/domain/parent-email';

/**
 * Production: the server flow once the owner has deployed the functions (and set the
 * secret) — flip to true then (PLAN.md 9.1, 6-4). Until then a production build
 * keeps v1's client flow, which works without the functions.
 */
export const PARENT_CODE_SERVER = false;

/** Emulator tests only: "1" in sessionStorage keeps the client flow (the 4g-1 tests). */
export const PARENT_CODE_CLIENT_KEY = 'lifexp-parent-code-client';

/** On the emulators (where the functions run) the server flow, unless a test asks for the client one. */
export function parentCodeOnServer(): boolean {
  if (!emulator) return PARENT_CODE_SERVER;
  try {
    return sessionStorage.getItem(PARENT_CODE_CLIENT_KEY) !== '1';
  } catch {
    return true;
  }
}

export type SendProblem = 'invalid' | 'sendFailed' | 'rateLimited';
export type VerifyProblem = CodeProblem | 'locked';

/** v1 sendParentEmailVerification(). Resolves once the code is on its way and saved. */
export async function sendParentCode(
  uid: string,
  userName: string,
  email: string,
  lang = 'pl',
  now = Date.now(),
): Promise<SendProblem | null> {
  if (parentEmailProblem(email)) return 'invalid';
  const address = email.trim();
  if (parentCodeOnServer()) {
    const { callSendParentEmailCode } = await import('@/data/functions');
    const reason = await callSendParentEmailCode(address, lang);
    if (reason === null || reason === 'invalid' || reason === 'rateLimited') return reason;
    return 'sendFailed';
  }
  const code = newParentCode();
  try {
    await sendParentCodeEmail(address, userName, code);
  } catch {
    return 'sendFailed';
  }
  await startParentEmailVerification(uid, address, code, now + PARENT_CODE_TTL_MS);
  return null;
}

/** v1 verifyParentEmailCode(): checked against the server's copy, then the address counts. */
export async function verifyParentCode(uid: string, input: string, lang = 'pl', now = new Date()): Promise<VerifyProblem | null> {
  if (parentCodeOnServer()) {
    const { callVerifyParentEmailCode } = await import('@/data/functions');
    const reason = await callVerifyParentEmailCode(input.trim(), lang);
    switch (reason) {
      case null:
      case 'noPending':
      case 'expired':
      case 'locked':
        return reason;
      case 'wrongCode':
      case 'invalid':
        return 'invalid';
      default:
        throw new Error('verifyParentEmailCode failed');
    }
  }
  const stored = await readParentCode(uid);
  const problem = parentCodeProblem(input, stored, now.getTime());
  if (problem) return problem;
  await confirmParentEmail(uid, stored.pendingParentEmail!, now);
  return null;
}

export function cancelParentCode(uid: string): Promise<void> {
  return cancelParentEmailVerification(uid);
}

export function saveAutoReport(uid: string, on: boolean): Promise<void> {
  return setAutoReport(uid, on);
}
