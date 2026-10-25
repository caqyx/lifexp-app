// Sending the code. The real mailer is EmailJS REST with the private key (the
// secret EMAILJS_PRIVATE_KEY), as v1's weekly report did; the fake one exists
// ONLY in the Functions emulator (FUNCTIONS_EMULATOR=true, which Cloud Functions
// never sets) and keeps the last mail per account in an emulator-only document,
// so the end-to-end tests can read the code.
import type { Firestore } from 'firebase-admin/firestore';
import { EMAILJS } from './config';

export interface CodeMail {
  uid: string;
  to: string;
  userName: string;
  code: string;
}

export interface Mailer {
  sendCode(mail: CodeMail): Promise<void>;
}

/** Where the fake mailer puts mail (emulator only; no rule gives clients access). */
export const FAKE_MAILBOX = 'emulatorMail';

export function isFunctionsEmulator(env: NodeJS.ProcessEnv): boolean {
  return env.FUNCTIONS_EMULATOR === 'true';
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

export class EmailJsMailer implements Mailer {
  constructor(
    private readonly privateKey: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async sendCode({ to, userName, code }: CodeMail): Promise<void> {
    const res = await this.fetchImpl(EMAILJS.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS.serviceId,
        template_id: EMAILJS.templateId,
        user_id: EMAILJS.publicKey,
        accessToken: this.privateKey,
        template_params: { to_email: to, user_name: userName, code },
      }),
    });
    // The status only: EmailJS's body may quote the request.
    if (!res.ok) throw new Error(`EmailJS ${res.status}`);
  }
}

export function createFakeMailer(db: () => Firestore, env: NodeJS.ProcessEnv = process.env): Mailer {
  if (!isFunctionsEmulator(env)) throw new Error('The fake mailer exists only in the Functions emulator.');
  return {
    async sendCode({ uid, to, userName, code }) {
      // "fail@…" lets a test see a send that does not go through.
      if (to.startsWith('fail@')) throw new Error('fake mailer: refused');
      await db().doc(`${FAKE_MAILBOX}/${uid}`).set({ to, userName, code, at: Date.now() });
    },
  };
}

export function selectMailer(env: NodeJS.ProcessEnv, db: () => Firestore, privateKey: () => string): Mailer {
  if (isFunctionsEmulator(env)) return createFakeMailer(db, env);
  return new EmailJsMailer(privateKey());
}
