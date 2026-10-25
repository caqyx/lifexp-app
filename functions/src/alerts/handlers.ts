// Alerts to the parent (docs/v2/PLAN.md 9.1, row 6-3b). Two Firestore triggers call
// these: a dailyLog write whose gamingMinutes reach GAMING_ALERT_MINUTES (from below
// it), and a new purchase. The recipient is the v2 domain's alertRecipient (a
// verified parent address, not solo, parentAlerts not off). One e-mail per kind per
// day, claimed in parentAlertLog/{uid}_{day} in a transaction and released if the
// mail fails. Logs hold the kind and the outcome only.
import type { Firestore } from 'firebase-admin/firestore';
import { formatDayKey, zonedDayKey } from '../v2/lib/dates';
import { GAMING_ALERT_MINUTES, alertRecipient, gamingCrossed, type ParentAlertKind } from '../v2/domain/parent';
import { groszeFromZloty } from '../v2/lib/money';
import type { AlertMailer } from '../parent/mailer';
import { ALERT_LOG, TIME_ZONE } from './config';

export interface AlertDeps {
  db: () => Firestore;
  mailer: () => AlertMailer;
  /** null = the EmailJS template is not set up yet: nothing is sent. */
  templateId: () => string | null;
  now?: () => Date;
  log?: (event: string, data: Record<string, unknown>) => void;
}

export type AlertOutcome = 'sent' | 'notCrossed' | 'noRecipient' | 'alreadySent' | 'templateMissing' | 'failed';

/** The user fields alertRecipient reads (as the v2 profile converter reads them). */
function recipientOf(data: Record<string, unknown> | undefined): { to: string; name: string } | null {
  if (!data) return null;
  const to = alertRecipient({
    accountMode: data.accountMode === 'solo' ? 'solo' : data.accountMode === 'supervised' ? 'supervised' : null,
    parentEmail: typeof data.parentEmail === 'string' ? data.parentEmail : '',
    parentEmailVerifiedAt: typeof data.parentEmailVerifiedAt === 'string' && data.parentEmailVerifiedAt ? data.parentEmailVerifiedAt : null,
    parentAlerts: data.parentAlerts !== false,
  });
  const name = typeof data.name === 'string' && data.name.trim() ? data.name : 'Użytkownik';
  return to ? { to, name } : null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const pln = (grosze: number) => `${(grosze / 100).toFixed(2).replace('.', ',')} zł`;

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function createAlertHandlers(deps: AlertDeps) {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});

  async function alert(uid: string, kind: ParentAlertKind, day: string, text: (name: string) => { subject: string; body: string }): Promise<AlertOutcome> {
    const db = deps.db();
    const user = await db.doc(`users/${uid}`).get();
    const recipient = recipientOf(user.data());
    if (!recipient) return 'noRecipient';
    const templateId = deps.templateId();
    if (!templateId) return 'templateMissing';

    const logRef = db.doc(`${ALERT_LOG}/${uid}_${day}`);
    const claimed = await db.runTransaction(async (tx) => {
      const kinds = (((await tx.get(logRef)).data() as { kinds?: string[] } | undefined)?.kinds ?? []);
      if (kinds.includes(kind)) return false;
      tx.set(logRef, { kinds: [...kinds, kind] }, { merge: true });
      return true;
    });
    if (!claimed) return 'alreadySent';

    const { subject, body } = text(recipient.name);
    try {
      await deps.mailer().sendAlert({
        uid,
        kind,
        templateId,
        params: { to_email: recipient.to, user_name: recipient.name, alert_subject: subject, alert_body: body, alert_day: formatDayKey(day, 'pl-PL') },
      });
      return 'sent';
    } catch {
      await db
        .runTransaction(async (tx) => {
          const kinds = (((await tx.get(logRef)).data() as { kinds?: string[] } | undefined)?.kinds ?? []);
          tx.set(logRef, { kinds: kinds.filter((k) => k !== kind) }, { merge: true });
        })
        .catch(() => {});
      return 'failed';
    }
  }

  const done = (kind: ParentAlertKind) => (outcome: AlertOutcome) => {
    log('parentAlert', { kind, outcome });
    return outcome;
  };

  return {
    /** users/{uid}/dailyLog/{day} written: `before`/`after` are its gamingMinutes. The day is the log's own. */
    async gaming(uid: string, day: string, before: unknown, after: unknown): Promise<AlertOutcome> {
      const minutes = num(after);
      // Most writes are points, not gaming: not logged, or every activity would leave a line.
      if (!gamingCrossed(num(before), minutes)) return 'notCrossed';
      return alert(uid, 'gaming', day, (name) => ({
        subject: `${name}: dziś już ${duration(minutes)} grania`,
        body: `Czas grania tego dnia przekroczył ${GAMING_ALERT_MINUTES} min i wynosi teraz ${duration(minutes)}.`,
      })).then(done('gaming'), () => done('gaming')('failed'));
    },

    /** users/{uid}/purchases/{id} created (v1's shop: description, amount in złoty, pointsCost). */
    async purchase(uid: string, data: Record<string, unknown> | undefined): Promise<AlertOutcome> {
      const day = zonedDayKey(now(), TIME_ZONE);
      const what = typeof data?.description === 'string' && data.description.trim() ? data.description.trim().slice(0, 100) : 'zakup';
      const grosze = groszeFromZloty(num(data?.amount));
      const points = num(data?.pointsCost);
      return alert(uid, 'purchase', day, (name) => ({
        subject: `${name} coś kupił(a)`,
        body: `Zakup: ${what}, ${pln(grosze)} (${points} pkt).`,
      })).then(done('purchase'), () => done('purchase')('failed'));
    },
  };
}
