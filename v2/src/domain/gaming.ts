// Play time in the games module (docs/v2/PLAN.md 9.1, stage g-1; owner's decision
// 2026-10-26): counted on its own and written the way v1 logs gaming (activities.js
// persistGamingSession: a gamingSessions doc {game, duration, date, timestamp} and
// dailyLog/{UTC day}.gamingMinutes), with no points, so the parent view, the weekly
// report and the 60-minute parent alert (6-3b) see it. Pure: the caller passes the
// time, the screen owns the events.
import { utcDayKey } from '@/lib/dates';

/** Shorter sessions are not written (opened by mistake, closed at once). */
export const MIN_SESSION_MS = 30_000;
/** v1 rejects a session over 1440 minutes (logGaming.sessionTooLong); a longer one is cut to it. */
export const MAX_SESSION_MINUTES = 1440;

/**
 * Time played so far: `activeMs` banked, plus the run since `since` while the game
 * is on screen (null = paused: the tab or the game is hidden).
 */
export interface PlayClock {
  activeMs: number;
  since: number | null;
}

export function startClock(now: number, visible: boolean): PlayClock {
  return { activeMs: 0, since: visible ? now : null };
}

/** A clock that went backwards (the device's time changed) adds nothing instead of taking time away. */
function run(clock: PlayClock, now: number): number {
  return clock.since === null ? 0 : Math.max(0, now - clock.since);
}

export function pauseClock(clock: PlayClock, now: number): PlayClock {
  if (clock.since === null) return clock;
  return { activeMs: clock.activeMs + run(clock, now), since: null };
}

export function resumeClock(clock: PlayClock, now: number): PlayClock {
  return clock.since === null ? { ...clock, since: now } : clock;
}

export function playedMs(clock: PlayClock, now: number): number {
  return clock.activeMs + run(clock, now);
}

/**
 * Whole minutes as v1 stores them (an integer `duration`): rounded to the nearest
 * minute, so 30 s is the first minute; under MIN_SESSION_MS nothing.
 */
export function sessionMinutes(ms: number): number {
  if (!Number.isFinite(ms) || ms < MIN_SESSION_MS) return 0;
  return Math.min(MAX_SESSION_MINUTES, Math.max(1, Math.round(ms / 60_000)));
}

/** v1's gamingSessions document, without the `timestamp` the repository adds. */
export interface GamingSession {
  /** The game's name as v1's history shows it. */
  game: string;
  /** Minutes. */
  duration: number;
  /** The UTC day ("YYYY-MM-DD") whose dailyLog gets the minutes. */
  date: string;
}

/**
 * The session to write when play ends at `end`, or null when it is too short.
 *
 * Midnight (UTC): the whole session goes to the UTC day it ENDS on, not split. v1
 * writes one document with one `date` and puts all its minutes on that day's
 * dailyLog, and its form defaults that date to todayStr() when the session is saved,
 * i.e. after playing; ending is when v2 saves.
 */
export function gamingSession(game: string, ms: number, end: Date): GamingSession | null {
  const duration = sessionMinutes(ms);
  return duration > 0 ? { game, duration, date: utcDayKey(end) } : null;
}

/** Minutes per game on `day` (v1's and v2's sessions alike, matched by name). */
export function minutesByGame(sessions: readonly GamingSession[], day: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sessions) {
    if (s.date !== day) continue;
    out.set(s.game, (out.get(s.game) ?? 0) + s.duration);
  }
  return out;
}

/**
 * A session that may not have reached Firestore: play paused in a hidden tab (a phone
 * can kill it without pagehide), or one written at pagehide, which the page may not
 * live to hand over. Kept on the device and written on the next visit under the same
 * document id, after checking the server does not have it: never twice.
 */
export interface PendingPlay {
  /** The gamingSessions document id the session is written under. */
  id: string;
  uid: string;
  game: string;
  ms: number;
  /** When play stopped (ms since epoch): the session ends then. */
  endedAt: number;
  /** The page load that owns it; a page never recovers its own. */
  pageId: string;
}

function isPendingPlay(v: unknown): v is PendingPlay {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    p.id !== '' &&
    typeof p.uid === 'string' &&
    typeof p.game === 'string' &&
    typeof p.ms === 'number' &&
    Number.isFinite(p.ms) &&
    typeof p.endedAt === 'number' &&
    Number.isFinite(p.endedAt) &&
    typeof p.pageId === 'string'
  );
}

/** The stored list; anything broken or foreign in it is dropped. */
export function parsePendingPlays(raw: string | null): PendingPlay[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter(isPendingPlay).map(({ id, uid, game, ms, endedAt, pageId }) => ({ id, uid, game, ms, endedAt, pageId }))
      : [];
  } catch {
    return [];
  }
}

/** The list with `play` in it (replacing the one with its id). */
export function withPendingPlay(list: readonly PendingPlay[], play: PendingPlay): PendingPlay[] {
  return [...list.filter((p) => p.id !== play.id), play];
}

export function withoutPendingPlay(list: readonly PendingPlay[], id: string): PendingPlay[] {
  return list.filter((p) => p.id !== id);
}

/** What the next visit of `uid` writes: the account's records from other page loads. */
export function playsToRecover(list: readonly PendingPlay[], uid: string, pageId: string): PendingPlay[] {
  return list.filter((p) => p.uid === uid && p.pageId !== pageId);
}
