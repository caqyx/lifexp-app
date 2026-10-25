// The parent's e-mail verified on the server (docs/v2/PLAN.md 9.1, row 6-4; B12, R17).
// v1 keeps the code in users/{uid}.parentEmailCode, where the account itself can
// read it; here only a salted hash is kept, in parentEmailCodes/{uid}, which no
// client can read or write. On success the same fields as v1 are written to
// users/{uid}, so v1, the parent's view and the report see the same address.
//
// Errors are HttpsErrors with `details.reason` (the client's message key) and a
// message in the account's language. Logs never hold the address or the code.
import { HttpsError, type CallableRequest } from 'firebase-functions/https';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { codeMatches, hashCode, maskEmail, newCode, newSalt } from './code';
import {
  CODES,
  CODE_TTL_MS,
  DAY_LIMIT,
  DAY_WINDOW_MS,
  MAX_ATTEMPTS,
  MAX_EMAIL_CHARS,
  SHORT_LIMIT,
  SHORT_WINDOW_MS,
} from './config';
import type { Mailer } from './mailer';

export type Lang = 'pl' | 'en';

export type Reason = 'invalid' | 'rateLimited' | 'sendFailed' | 'noPending' | 'expired' | 'wrongCode' | 'locked' | 'noAccount';

const MESSAGES: Record<Reason, Record<Lang, string>> = {
  invalid: { pl: 'Wpisz poprawny adres e-mail.', en: 'Enter a valid e-mail address.' },
  rateLimited: { pl: 'Za dużo kodów naraz. Spróbuj później.', en: 'Too many codes at once. Try again later.' },
  sendFailed: { pl: 'Nie udało się wysłać e-maila.', en: 'The e-mail could not be sent.' },
  noPending: { pl: 'Nie ma kodu do potwierdzenia. Wyślij nowy.', en: 'There is no code to confirm. Send a new one.' },
  expired: { pl: 'Kod wygasł. Wyślij nowy.', en: 'The code has expired. Send a new one.' },
  wrongCode: { pl: 'Nieprawidłowy kod.', en: 'Wrong code.' },
  locked: { pl: 'Za dużo błędnych prób. Wyślij nowy kod.', en: 'Too many wrong tries. Send a new code.' },
  noAccount: { pl: 'Nie ma takiego konta.', en: 'There is no such account.' },
};

const CODES_FOR: Record<Reason, ConstructorParameters<typeof HttpsError>[0]> = {
  invalid: 'invalid-argument',
  rateLimited: 'resource-exhausted',
  sendFailed: 'unavailable',
  noPending: 'failed-precondition',
  expired: 'deadline-exceeded',
  wrongCode: 'invalid-argument',
  locked: 'resource-exhausted',
  noAccount: 'not-found',
};

export function failure(reason: Reason, lang: Lang, extra: Record<string, unknown> = {}): HttpsError {
  return new HttpsError(CODES_FOR[reason], MESSAGES[reason][lang], { reason, ...extra });
}

/** v1 /\S+@\S+\.\S+/ on the trimmed address. */
const sendSchema = z.object({
  email: z.string().trim().min(1).max(MAX_EMAIL_CHARS).regex(/\S+@\S+\.\S+/),
  lang: z.enum(['pl', 'en']).default('pl'),
});

const verifySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  lang: z.enum(['pl', 'en']).default('pl'),
});

const langOf = (data: unknown): Lang => ((data as { lang?: unknown } | null)?.lang === 'en' ? 'en' : 'pl');

/** parentEmailCodes/{uid}. */
interface CodeDoc {
  email?: string;
  hash?: string;
  salt?: string;
  expiresAt?: number;
  attempts?: number;
  /** ms of every send in the last 24 h (the rate limits). */
  sends?: number[];
}

export interface ParentEmailDeps {
  db: () => Firestore;
  mailer: () => Mailer;
  now?: () => number;
  code?: () => string;
  log?: (event: string, data: Record<string, unknown>) => void;
}

type Request = Pick<CallableRequest<unknown>, 'auth' | 'data'>;

function requireUid(request: Request, lang: Lang): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', lang === 'en' ? 'Sign in first.' : 'Najpierw się zaloguj.');
  return uid;
}

export interface SendResult {
  sentTo: string;
  expiresAt: number;
}

export function createSendHandler(deps: ParentEmailDeps) {
  const now = deps.now ?? Date.now;
  const makeCode = deps.code ?? newCode;
  const log = deps.log ?? (() => {});

  return async function sendParentEmailCode(request: Request): Promise<SendResult> {
    const lang = langOf(request.data);
    const uid = requireUid(request, lang);
    const parsed = sendSchema.safeParse(request.data);
    if (!parsed.success) throw failure('invalid', lang);
    const { email } = parsed.data;
    // v1 does not refuse the account's own address, so neither does this.

    const db = deps.db();
    const codeRef = db.doc(`${CODES}/${uid}`);
    const userRef = db.doc(`users/${uid}`);
    const at = now();
    const code = makeCode();
    const salt = newSalt();
    const expiresAt = at + CODE_TTL_MS;

    // Reserve the send (limits) and keep the hash, in one transaction.
    const reserved = await db.runTransaction(async (tx) => {
      const [codeSnap, userSnap] = await Promise.all([tx.get(codeRef), tx.get(userRef)]);
      if (!userSnap.exists) return { ok: false as const, reason: 'noAccount' as const };
      const sends = ((codeSnap.data() as CodeDoc | undefined)?.sends ?? []).filter((t) => at - t < DAY_WINDOW_MS);
      const recent = sends.filter((t) => at - t < SHORT_WINDOW_MS).length;
      if (recent >= SHORT_LIMIT || sends.length >= DAY_LIMIT) return { ok: false as const, reason: 'rateLimited' as const };
      const doc: CodeDoc = { email, hash: hashCode(code, salt), salt, expiresAt, attempts: 0, sends: [...sends, at] };
      tx.set(codeRef, doc);
      const name = (userSnap.data() as { name?: unknown } | undefined)?.name;
      return { ok: true as const, userName: typeof name === 'string' && name.trim() ? name : 'Użytkownik' };
    });
    if (!reserved.ok) {
      log('sendParentEmailCode.refused', { reason: reserved.reason });
      throw failure(reserved.reason, lang);
    }

    try {
      await deps.mailer().sendCode({ uid, to: email, userName: reserved.userName, code });
    } catch (err) {
      // The send still counts; the code that never arrived is dropped.
      await codeRef.update({ hash: FieldValue.delete(), salt: FieldValue.delete(), email: FieldValue.delete() });
      log('sendParentEmailCode.mail_error', { status: String((err as Error)?.message ?? '').slice(0, 40).replace(/[^\w ]/g, '') });
      throw failure('sendFailed', lang);
    }

    // What v1 and the screens read: the address waits for its code. A code v1 left
    // in the profile is removed, so only the server's code counts from now on.
    await userRef.update({
      pendingParentEmail: email,
      parentEmailCode: FieldValue.delete(),
      parentEmailCodeExpiry: FieldValue.delete(),
    });
    log('sendParentEmailCode', { sent: 1 });
    return { sentTo: maskEmail(email), expiresAt };
  };
}

export interface VerifyResult {
  verified: true;
}

type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: 'noPending' | 'expired' | 'locked' | 'noAccount' }
  | { ok: false; reason: 'wrongCode'; attemptsLeft: number };

export function createVerifyHandler(deps: ParentEmailDeps) {
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => {});

  return async function verifyParentEmailCode(request: Request): Promise<VerifyResult> {
    const lang = langOf(request.data);
    const uid = requireUid(request, lang);
    const parsed = verifySchema.safeParse(request.data);
    const db = deps.db();
    const codeRef = db.doc(`${CODES}/${uid}`);
    const userRef = db.doc(`users/${uid}`);
    const at = now();

    // Every outcome is decided and written in one transaction; the error is thrown
    // after it, so a wrong try is counted (a throw inside would roll it back).
    const outcome = await db.runTransaction(async (tx): Promise<VerifyOutcome> => {
      const [codeSnap, userSnap] = await Promise.all([tx.get(codeRef), tx.get(userRef)]);
      if (!userSnap.exists) return { ok: false, reason: 'noAccount' };
      const stored = codeSnap.data() as CodeDoc | undefined;
      const pending = (userSnap.data() as { pendingParentEmail?: unknown } | undefined)?.pendingParentEmail;
      // Cancelled in the app (pending cleared) or a newer address asked for: this code no longer counts.
      if (!stored?.hash || !stored.salt || !stored.email || pending !== stored.email) return { ok: false, reason: 'noPending' };
      const endCode = { hash: FieldValue.delete(), salt: FieldValue.delete(), email: FieldValue.delete(), attempts: FieldValue.delete() };
      if (stored.expiresAt === undefined || at > stored.expiresAt) {
        tx.update(codeRef, endCode);
        return { ok: false, reason: 'expired' };
      }
      const attempts = stored.attempts ?? 0;
      if (attempts >= MAX_ATTEMPTS) {
        tx.update(codeRef, endCode);
        tx.update(userRef, { pendingParentEmail: FieldValue.delete() });
        return { ok: false, reason: 'locked' };
      }
      if (!parsed.success || !codeMatches(parsed.data.code, stored.salt, stored.hash)) {
        const used = attempts + 1;
        if (used >= MAX_ATTEMPTS) {
          // The fifth wrong code ends it: the address goes back to "send a code".
          tx.update(codeRef, endCode);
          tx.update(userRef, { pendingParentEmail: FieldValue.delete() });
          return { ok: false, reason: 'locked' };
        }
        tx.update(codeRef, { attempts: used });
        return { ok: false, reason: 'wrongCode', attemptsLeft: MAX_ATTEMPTS - used };
      }
      // v1 verifyParentEmailCode(), field for field.
      tx.update(userRef, {
        parentEmail: stored.email,
        parentEmailVerifiedAt: new Date(at).toISOString(),
        pendingParentEmail: FieldValue.delete(),
        parentEmailCode: FieldValue.delete(),
        parentEmailCodeExpiry: FieldValue.delete(),
      });
      tx.delete(codeRef);
      return { ok: true };
    });

    if (!outcome.ok) {
      log('verifyParentEmailCode.refused', { reason: outcome.reason });
      throw outcome.reason === 'wrongCode'
        ? failure('wrongCode', lang, { attemptsLeft: outcome.attemptsLeft })
        : failure(outcome.reason, lang);
    }
    log('verifyParentEmailCode', { verified: 1 });
    return { verified: true };
  };
}
