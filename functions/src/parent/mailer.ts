// Sending the code (6-4) and the weekly report (6-5). The real mailer is EmailJS REST with the private key (the
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

/** The weekly report: v1's template params (email-templates/weekly-report.html, plus to_email). */
export interface ReportMail {
  uid: string;
  params: Record<string, string> & { to_email: string };
}

export interface ReportMailer {
  sendReport(mail: ReportMail): Promise<void>;
}

/** An alert to the parent (6-3b): its own template (email-templates/parent-alert.html). */
export interface AlertMail {
  uid: string;
  kind: string;
  templateId: string;
  params: Record<string, string> & { to_email: string };
}

export interface AlertMailer {
  sendAlert(mail: AlertMail): Promise<void>;
}

/** Where the fake mailer puts mail (emulator only; no rule gives clients access). */
export const FAKE_MAILBOX = 'emulatorMail';

export function isFunctionsEmulator(env: NodeJS.ProcessEnv): boolean {
  return env.FUNCTIONS_EMULATOR === 'true';
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

export class EmailJsMailer implements Mailer, ReportMailer, AlertMailer {
  constructor(
    private readonly privateKey: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  sendCode({ to, userName, code }: CodeMail): Promise<void> {
    return this.send(EMAILJS.templateId, { to_email: to, user_name: userName, code });
  }

  sendReport({ params }: ReportMail): Promise<void> {
    return this.send(EMAILJS.reportTemplateId, params);
  }

  sendAlert({ templateId, params }: AlertMail): Promise<void> {
    return this.send(templateId, params);
  }

  private async send(templateId: string, params: Record<string, string>): Promise<void> {
    const res = await this.fetchImpl(EMAILJS.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS.serviceId,
        template_id: templateId,
        user_id: EMAILJS.publicKey,
        accessToken: this.privateKey,
        template_params: params,
      }),
    });
    // The status only: EmailJS's body may quote the request.
    if (!res.ok) throw new Error(`EmailJS ${res.status}`);
  }
}

export function createFakeMailer(db: () => Firestore, env: NodeJS.ProcessEnv = process.env): Mailer & ReportMailer & AlertMailer {
  if (!isFunctionsEmulator(env)) throw new Error('The fake mailer exists only in the Functions emulator.');
  return {
    async sendCode({ uid, to, userName, code }) {
      // "fail@…" lets a test see a send that does not go through.
      if (to.startsWith('fail@')) throw new Error('fake mailer: refused');
      await db().doc(`${FAKE_MAILBOX}/${uid}`).set({ to, userName, code, at: Date.now() });
    },
    async sendReport({ uid, params }) {
      if (params.to_email.startsWith('fail@')) throw new Error('fake mailer: refused');
      await db().doc(`${FAKE_MAILBOX}/${uid}_report`).set({ params, at: Date.now() });
    },
    async sendAlert({ uid, kind, templateId, params }) {
      if (params.to_email.startsWith('fail@')) throw new Error('fake mailer: refused');
      await db().doc(`${FAKE_MAILBOX}/${uid}_alert_${kind}`).set({ templateId, params, at: Date.now() });
    },
  };
}

export function selectMailer(env: NodeJS.ProcessEnv, db: () => Firestore, privateKey: () => string): Mailer & ReportMailer & AlertMailer {
  if (isFunctionsEmulator(env)) return createFakeMailer(db, env);
  return new EmailJsMailer(privateKey());
}
