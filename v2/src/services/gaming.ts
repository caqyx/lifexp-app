// Play time of the games module (docs/v2/PLAN.md 9.1, stage g-1): the rules of
// domain/gaming, then the repository's batch. Saving does not wait for the server
// (CLAUDE.md): the session is worked out at once and `saved` settles later; offline
// Firestore queues the write. No points: gaming is only recorded, as v1 records it.
import { logGamingSession, logGamingSessionOnce, newGamingSessionId } from '@/data/repos/gaming';
import {
  gamingSession,
  parsePendingPlays,
  playsToRecover,
  withoutPendingPlay,
  withPendingPlay,
  type GamingSession,
  type PendingPlay,
} from '@/domain/gaming';

export interface GamingRecord {
  /** null = shorter than the minimum: nothing written. */
  session: GamingSession | null;
  saved: Promise<void>;
}

/** The id a session starts with and is written under (also when recovered). */
export function newPlayId(uid: string): string {
  return newGamingSessionId(uid);
}

/** Ends session `id` of `game` after `ms` of play at `end`. */
export function recordPlay(uid: string, id: string, game: string, ms: number, end = new Date()): GamingRecord {
  const session = gamingSession(game, ms, end);
  return { session, saved: session ? logGamingSession(uid, id, session, end) : Promise.resolve() };
}

// ── Sessions kept on the device until they surely reached Firestore (domain PendingPlay) ──

/** On this device only; v2's own key, nothing v1 reads. */
export const PENDING_PLAY_KEY = 'lifexp-v2-gaming-pending';

/** This page load; the records it keeps are its own until it is gone. */
const PAGE_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

function readPending(): PendingPlay[] {
  try {
    return parsePendingPlays(localStorage.getItem(PENDING_PLAY_KEY));
  } catch {
    return [];
  }
}

function writePending(list: readonly PendingPlay[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(PENDING_PLAY_KEY);
    else localStorage.setItem(PENDING_PLAY_KEY, JSON.stringify(list));
  } catch {
    // No storage (private mode): a session of a page that dies is lost.
  }
}

/** Keeps session `id` (`ms` played, stopped at `endedAt`) on the device. Synchronous: safe in pagehide. */
export function holdPlay(uid: string, id: string, game: string, ms: number, endedAt: number): void {
  writePending(withPendingPlay(readPending(), { id, uid, game, ms, endedAt, pageId: PAGE_ID }));
}

/** The page is alive and carries on (or wrote the session itself): forget the copy. */
export function releasePlay(id: string): void {
  writePending(withoutPendingPlay(readPending(), id));
}

let recovering = false;

/**
 * Writes the sessions other page loads of this account left on the device (a tab killed
 * while hidden, or closed while its pagehide write was on its way), each under its own
 * id and only if Firestore does not have it yet. A record goes once it is written or
 * found; offline it stays for the next visit. Resolves to how many were written.
 */
export async function recoverPlays(uid: string): Promise<number> {
  if (recovering) return 0;
  recovering = true;
  let written = 0;
  try {
    for (const play of playsToRecover(readPending(), uid, PAGE_ID)) {
      const session = gamingSession(play.game, play.ms, new Date(play.endedAt));
      if (session && (await logGamingSessionOnce(uid, play.id, session, new Date(play.endedAt)))) written += 1;
      releasePlay(play.id);
    }
  } finally {
    recovering = false;
  }
  return written;
}
