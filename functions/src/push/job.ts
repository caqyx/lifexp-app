// pushReminders (docs/v2/PLAN.md 9.1, row 6-7): every hour, the accounts that chose
// this Warsaw hour (v1 notifHours) get at most one reminder, decided by the v2
// domain's pickReminder, sent to their v1 tokens (users/{uid}/fcmTokens/{token},
// a subcollection: v1 settings.js writes { token, createdAt, ua }). Each send is
// claimed first in pushLog/{uid}_{Warsaw day}, so a retry of the hour sends nothing
// twice. Dead tokens are deleted, as v1's script did. Logs hold counts only.
import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';
import { addDays, utcDayKey, zonedIsoMinutes } from '../v2/lib/dates';
import type { DayLog } from '../v2/domain/activity';
import type { ChoreEntry } from '../v2/domain/chores';
import { REMINDERS_PER_DAY, pickReminder, type ReminderKind } from '../v2/domain/reminders';
import { CONCURRENCY, PUSH_LOG, TIME_ZONE } from './config';
import { reminderText, type Lang } from './messages';
import { DEAD_TOKEN_CODES, pushPayload, type Messenger, type PushPayload } from './messaging';

export interface PushDeps {
  db: () => Firestore;
  messenger: () => Messenger;
  now?: () => Date;
  log?: (event: string, data: Record<string, unknown>) => void;
}

export type Outcome = 'sent' | 'nothingDue' | 'noTokens' | 'alreadySent' | 'failed';

/** pushLog/{uid}_{day}. */
export interface PushLog {
  kinds?: ReminderKind[];
  hours?: number[];
  /** sendMyPushNow tests that day. */
  manual?: number;
}

export function warsawNow(at: Date): { day: string; hour: number } {
  const iso = zonedIsoMinutes(at, TIME_ZONE);
  return { day: iso.slice(0, 10), hour: Number(iso.slice(11, 13)) };
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null);
const langOf = (data: DocumentData): Lang => (data.lang === 'en' ? 'en' : 'pl');

/** The account's tokens, by document (v1 keys each by the token itself). */
export async function tokensOf(db: Firestore, uid: string): Promise<{ token: string; ref: DocumentReference }[]> {
  const snap = await db.collection(`users/${uid}/fcmTokens`).get();
  return snap.docs.flatMap((d) => {
    const token = (d.data() as { token?: unknown }).token;
    return typeof token === 'string' && token ? [{ token, ref: d.ref }] : [];
  });
}

/** Sends to every token; deletes the ones FCM says are dead. Returns how many went. */
export async function deliver(messenger: Messenger, uid: string, payload: PushPayload, tokens: Awaited<ReturnType<typeof tokensOf>>) {
  const results = await messenger.send(uid, payload, tokens.map((t) => t.token));
  const dead = tokens.filter((_t, i) => !results[i]?.ok && DEAD_TOKEN_CODES.includes(results[i]?.code ?? ''));
  await Promise.all(dead.map((t) => t.ref.delete().catch(() => {})));
  return { delivered: results.filter((r) => r.ok).length, dead: dead.length };
}

export async function remindOne(deps: PushDeps, uid: string, data: DocumentData, at: Date): Promise<{ outcome: Outcome; dead: number }> {
  const db = deps.db();
  const { day, hour } = warsawNow(at);
  const logRef = db.doc(`${PUSH_LOG}/${uid}_${day}`);
  const [tokens, logSnap, yesterday, dayLogs, defs, entries] = await Promise.all([
    tokensOf(db, uid),
    logRef.get(),
    db.doc(`${PUSH_LOG}/${uid}_${addDays(day, -1)}`).get(),
    db.collection(`users/${uid}/dailyLog`).get(),
    db.collection(`users/${uid}/choreDefs`).get(),
    db.collection(`users/${uid}/chores`).get(),
  ]);
  if (tokens.length === 0) return { outcome: 'noTokens', dead: 0 };
  const sent = (logSnap.data() ?? {}) as PushLog;
  const yesterdayKinds = ((yesterday.data() ?? {}) as PushLog).kinds ?? [];

  const reminder = pickReminder({
    modules: { enabledModules: strings(data.enabledModules), disabledModules: strings(data.disabledModules) },
    notifHours: Array.isArray(data.notifHours) ? data.notifHours.filter((h: unknown): h is number => typeof h === 'number') : [],
    hour,
    todayUtc: utcDayKey(at),
    todayLocal: day,
    now: at,
    streakFreezeLastUsed: typeof data.streakFreezeLastUsed === 'string' ? data.streakFreezeLastUsed : null,
    days: new Map<string, DayLog>(
      dayLogs.docs.map((d) => [d.id, { pointsEarned: Number(d.data().pointsEarned) || 0, gamingMinutes: Number(d.data().gamingMinutes) || 0 }]),
    ),
    choreDefs: defs.size,
    choreEntries: entries.docs.map((d): ChoreEntry => ({
      id: d.id,
      choreId: String(d.data().choreId ?? ''),
      name: '',
      emoji: '',
      points: Number(d.data().points) || 0,
      dateISO: typeof d.data().dateISO === 'string' ? d.data().dateISO : '',
      monthKey: typeof d.data().monthKey === 'string' ? d.data().monthKey : '',
      createdAt: null,
    })),
    sentToday: { kinds: sent.kinds ?? [], hours: sent.hours ?? [] },
    lastChoresReminder: sent.kinds?.includes('chores') ? day : yesterdayKinds.includes('chores') ? addDays(day, -1) : null,
  });
  if (!reminder) return { outcome: 'nothingDue', dead: 0 };

  // Claim the hour and the kind before sending; a second run of the hour finds them taken.
  const claimed = await db.runTransaction(async (tx) => {
    const fresh = ((await tx.get(logRef)).data() ?? {}) as PushLog;
    const kinds = fresh.kinds ?? [];
    const hours = fresh.hours ?? [];
    if (hours.includes(hour) || kinds.includes(reminder.kind) || kinds.length >= REMINDERS_PER_DAY) return false;
    tx.set(logRef, { kinds: [...kinds, reminder.kind], hours: [...hours, hour] }, { merge: true });
    return true;
  });
  if (!claimed) return { outcome: 'alreadySent', dead: 0 };

  try {
    const { delivered, dead } = await deliver(deps.messenger(), uid, pushPayload(reminderText(reminder, langOf(data))), tokens);
    return { outcome: delivered > 0 ? 'sent' : 'failed', dead };
  } catch {
    // Not sent: the hour and the kind are free again.
    await db
      .runTransaction(async (tx) => {
        const fresh = ((await tx.get(logRef)).data() ?? {}) as PushLog;
        tx.set(
          logRef,
          { kinds: (fresh.kinds ?? []).filter((k) => k !== reminder.kind), hours: (fresh.hours ?? []).filter((h) => h !== hour) },
          { merge: true },
        );
      })
      .catch(() => {});
    return { outcome: 'failed', dead: 0 };
  }
}

/** The hourly run: the accounts whose notifHours hold this Warsaw hour, CONCURRENCY at a time. */
export async function runPushReminders(deps: PushDeps): Promise<Record<Outcome, number> & { deadTokens: number }> {
  const at = (deps.now ?? (() => new Date()))();
  const log = deps.log ?? (() => {});
  const { hour } = warsawNow(at);
  const users = await deps.db().collection('users').where('notifHours', 'array-contains', hour).get();
  const counts = { sent: 0, nothingDue: 0, noTokens: 0, alreadySent: 0, failed: 0, deadTokens: 0 };
  const docs = users.docs;
  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    const results = await Promise.all(
      docs.slice(i, i + CONCURRENCY).map((d) =>
        remindOne(deps, d.id, d.data(), at).catch(() => ({ outcome: 'failed' as const, dead: 0 })),
      ),
    );
    for (const r of results) {
      counts[r.outcome] += 1;
      counts.deadTokens += r.dead;
    }
  }
  log('pushReminders', { hour, accounts: docs.length, ...counts });
  return counts;
}
