// GENERATED from v2/src/domain/streak.ts by `npm run gen:shared-domain --prefix v2`. Do not edit here:
// change v2/src/domain/streak.ts and regenerate (a v2 test fails while this copy is stale).
// Streak of active days and the streak freeze (docs/v2/GOLDEN.md G3). A day is
// active when its dailyLog has pointsEarned > 0; keys are UTC days (G13).
//
// v1 saves "freeze used" while rendering the dashboard (B15), and on the next
// render the freeze is spent, so the same gap breaks the streak after all. v2
// (stage 3e) records the freeze through a service, once, and keeps bridging the
// gap it covered: that day is found again from the date the freeze was used.
import { addDays } from '../lib/dates';
import { activeDays, type DayLog } from './activity';

/** The freeze comes back 7 days after it was last used. */
export const FREEZE_COOLDOWN_DAYS = 7;

/** v1 isStreakFreezeAvailable(): never used, or last used more than 7 days before `now`. */
export function isFreezeAvailable(lastUsed: string | null, now: Date): boolean {
  if (!lastUsed) return true;
  const cooldownStart = new Date(now);
  cooldownStart.setDate(cooldownStart.getDate() - FREEZE_COOLDOWN_DAYS);
  return new Date(lastUsed) < cooldownStart;
}

export interface Streak {
  days: number;
  /** A gap is bridged by the freeze: one used before, or the one available now. */
  freezeUsed: boolean;
  /** The bridge uses the freeze available now: the service records it (v1 saves it while rendering). */
  newFreeze: boolean;
  /** The gap the freeze available now bridges (UTC day); null when newFreeze is false. */
  bridged: string | null;
}

/**
 * The gap a freeze used on `lastUsed` (UTC day) bridged, as v1 found it that day:
 * walking back from that day (or the day before, if it had no points then) to the
 * first day without points. null when there was no streak to bridge.
 */
export function frozenDay(activeDays: ReadonlySet<string>, lastUsed: string | null): string | null {
  if (!lastUsed) return null;
  let cursor = activeDays.has(lastUsed) ? lastUsed : addDays(lastUsed, -1);
  if (!activeDays.has(cursor)) return null;
  while (activeDays.has(cursor)) cursor = addDays(cursor, -1);
  return cursor;
}

/**
 * v1 calculateStreakDays(): count active days back from today — or from
 * yesterday while today is still empty, so a streak does not break in the
 * morning. One gap may be skipped with the freeze, once the streak has started;
 * the skipped day does not count.
 *
 * Unlike v1 (GOLDEN G3.8), a gap is bridged only when the day before it was active:
 * a bridge to nothing would leave the streak as it is and spend the freeze for a week.
 */
export function calculateStreak(
  activeDays: ReadonlySet<string>,
  today: string,
  freezeAvailable: boolean,
  /** The gap a freeze used before bridged (frozenDay); it stays bridged. */
  frozen: string | null = null,
): Streak {
  let days = 0;
  let freezeUsed = false;
  let bridged: string | null = null;
  let cursor = activeDays.has(today) ? today : addDays(today, -1);
  for (;;) {
    const leadsOn = days > 0 && activeDays.has(addDays(cursor, -1));
    if (activeDays.has(cursor)) {
      days += 1;
    } else if (leadsOn && cursor === frozen) {
      freezeUsed = true;
    } else if (leadsOn && bridged === null && freezeAvailable) {
      freezeUsed = true;
      bridged = cursor;
    } else {
      break;
    }
    cursor = addDays(cursor, -1);
  }
  return { days, freezeUsed, newFreeze: bridged !== null, bridged };
}

/**
 * The check the service makes on the server's day logs before it records a freeze:
 * the gap it bridges is still a day without points and the day before it still has
 * some (the screen may have counted from a cache that was behind).
 */
export function freezeStillBridges(gap: DayLog | null, dayBefore: DayLog | null): boolean {
  return (gap?.pointsEarned ?? 0) <= 0 && (dayBefore?.pointsEarned ?? 0) > 0;
}

/**
 * G3 on the day logs the screens hold: the streak, with a freeze used before still
 * bridging its gap. Today's streak card and Ex-us's /seria both read it from here.
 */
export function streakOf(
  freezeLastUsed: string | null,
  days: ReadonlyMap<string, DayLog>,
  todayKey: string,
  now: Date = new Date(),
) {
  const active = activeDays(days);
  const freezeAvailable = isFreezeAvailable(freezeLastUsed, now);
  const streak = calculateStreak(active, todayKey, freezeAvailable, frozenDay(active, freezeLastUsed));
  return { active, freezeAvailable, streak };
}
