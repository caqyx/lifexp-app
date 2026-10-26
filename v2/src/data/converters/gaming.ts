// users/{uid}/gamingSessions as v1 writes them (activities.js persistGamingSession:
// {game, duration, date, timestamp}; docs/v2/PLAN.md 5.1). The same shape both ways:
// what v2 writes, v1's history (loadGamingHistory) shows, and the other way round.
import type { DocumentData } from 'firebase/firestore';
import type { GamingSession } from '@/domain/gaming';
import { dayKeyOrNull, numberOr, stringOr } from './fields';

/** A session v2 can count, or null (no day: v1's history shows it, but no day can hold it). */
export function gamingSessionFromData(data: DocumentData): GamingSession | null {
  const date = dayKeyOrNull(data.date);
  if (!date) return null;
  return { game: stringOr(data.game).trim(), duration: Math.max(0, numberOr(data.duration)), date };
}

/** v1's document: an integer `duration` in minutes, the UTC `date` and the client's time as `timestamp`. */
export function newGamingSessionData(session: GamingSession, at: Date): DocumentData {
  return { game: session.game, duration: session.duration, date: session.date, timestamp: at };
}
