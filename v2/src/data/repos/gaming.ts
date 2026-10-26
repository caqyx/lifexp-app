// users/{uid}/gamingSessions and dailyLog.gamingMinutes (docs/v2/PLAN.md 9.1, stage g-1).
// A session and its day's minutes are one atomic batch, not a transaction: nothing has
// to be read first (the minutes are an increment), and a batch, unlike a transaction,
// is queued by Firestore offline and sent when the network is back. No points move.
// Each session has its id from the start, so a copy kept on the device for a page that
// may have died (services/gaming) is written later under the same id, at most once.
import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  waitForPendingWrites,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { GamingSession } from '@/domain/gaming';
import { gamingSessionFromData, newGamingSessionData } from '../converters/gaming';
import { db } from '../firebase';

type OnError = (error: unknown) => void;

const sessionsOf = (uid: string) => collection(db, 'users', uid, 'gamingSessions');
const dayOf = (uid: string, key: string) => doc(db, 'users', uid, 'dailyLog', key);

/** v1 creates a missing day as {pointsEarned: 0, gamingMinutes}; increment(0) on a merge gives the same without touching a day's points. */
const dayIncrement = (minutes: number): DocumentData => ({ pointsEarned: increment(0), gamingMinutes: increment(minutes) });

/** A new session document id (no write). */
export function newGamingSessionId(uid: string): string {
  return doc(sessionsOf(uid)).id;
}

/** v1 persistGamingSession(): the session document and the day's minutes, together. */
export function logGamingSession(uid: string, id: string, session: GamingSession, at: Date): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(sessionsOf(uid), id), newGamingSessionData(session, at));
  batch.set(dayOf(uid, session.date), dayIncrement(session.duration), { merge: true });
  return batch.commit();
}

/**
 * The same write for a session that may already be there: this device's queued writes
 * go out first, then one transaction writes it only if the server does not have it.
 * Needs the server; offline it rejects and the caller keeps the session for later.
 * Resolves to whether it wrote.
 */
export async function logGamingSessionOnce(uid: string, id: string, session: GamingSession, at: Date): Promise<boolean> {
  await waitForPendingWrites(db);
  return runTransaction(db, async (tx) => {
    const ref = doc(sessionsOf(uid), id);
    if ((await tx.get(ref)).exists()) return false;
    tx.set(ref, newGamingSessionData(session, at));
    tx.set(dayOf(uid, session.date), dayIncrement(session.duration), { merge: true });
    return true;
  });
}

/** Every session logged on the UTC `day` (by v1 or v2): one equality filter, no index needed. */
export function watchGamingDay(uid: string, day: string, onChange: (sessions: GamingSession[]) => void, onError: OnError) {
  return onSnapshot(
    query(sessionsOf(uid), where('date', '==', day)),
    (snap) => onChange(snap.docs.flatMap((d) => gamingSessionFromData(d.data()) ?? [])),
    onError,
  );
}
