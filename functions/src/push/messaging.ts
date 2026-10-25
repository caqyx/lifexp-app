// Sending to FCM. The real messenger is the Admin SDK (default credentials, no
// secret); the fake exists ONLY in the Functions emulator (FUNCTIONS_EMULATOR=true,
// never set in Cloud Functions) and keeps what it was given in an emulator-only
// collection, answering "not registered" for tokens that start with "dead".
import type { Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { isFunctionsEmulator } from '../parent/mailer';
import { ensureDefaultApp } from '../shared/admin';
import { APP_URL } from './config';
import type { PushText } from './messages';

/**
 * The shape v1's sw.js shows (onBackgroundMessage reads payload.notification.title
 * and .body) and the link FCM opens on a tap, as the old send-notifications.js sent it.
 */
export interface PushPayload {
  notification: { title: string; body: string };
  webpush: { fcmOptions: { link: string } };
}

export function pushPayload(text: PushText): PushPayload {
  return { notification: { title: text.title, body: text.body }, webpush: { fcmOptions: { link: APP_URL } } };
}

export interface SendResult {
  ok: boolean;
  /** FCM's error code when not ok, e.g. messaging/registration-token-not-registered. */
  code?: string;
}

export interface Messenger {
  /** One result per token, in order. */
  send(uid: string, payload: PushPayload, tokens: readonly string[]): Promise<SendResult[]>;
}

/** Tokens FCM will never deliver to again: removed, as v1's script did. */
export const DEAD_TOKEN_CODES = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

export const FAKE_PUSHBOX = 'emulatorPush';

export class FcmMessenger implements Messenger {
  async send(_uid: string, payload: PushPayload, tokens: readonly string[]): Promise<SendResult[]> {
    ensureDefaultApp();
    const res = await getMessaging().sendEachForMulticast({ ...payload, tokens: [...tokens] });
    return res.responses.map((r) => (r.success ? { ok: true } : { ok: false, code: r.error?.code }));
  }
}

export function createFakeMessenger(db: () => Firestore, env: NodeJS.ProcessEnv = process.env): Messenger {
  if (!isFunctionsEmulator(env)) throw new Error('The fake messenger exists only in the Functions emulator.');
  return {
    async send(uid, payload, tokens) {
      await db().doc(`${FAKE_PUSHBOX}/${uid}`).set({ payload, tokens: [...tokens], at: Date.now() });
      return tokens.map((t) => (t.startsWith('dead') ? { ok: false, code: DEAD_TOKEN_CODES[0] } : { ok: true }));
    },
  };
}

export function selectMessenger(env: NodeJS.ProcessEnv, db: () => Firestore): Messenger {
  return isFunctionsEmulator(env) ? createFakeMessenger(db, env) : new FcmMessenger();
}
