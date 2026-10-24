// "/statystyki", the pure part (docs/v2/PLAN.md 6.5): the same numbers as the Stats
// screen (G14), for 7 or 30 UTC days ending today.
import { addDays, utcDayKey } from '@/lib/dates';
import type { Activity, DayLog } from '../activity';
import { TOP_SAMPLE, topActivities, type TopActivity } from '../stats';
import { oneOf } from './recognizers';

export type StatsPeriod = 7 | 30;

export const STATS_PERIOD = oneOf<StatsPeriod>({
  '7d': 7,
  '7': 7,
  tydzien: 7,
  week: 7,
  '30d': 30,
  '30': 30,
  miesiac: 30,
  month: 30,
});

export interface PeriodStats {
  /** Points of the days in the period (dailyLog, as the Stats screen's chart sums them). */
  points: number;
  gamingMinutes: number;
  /** Minutes of the logged activities of the period found among the newest TOP_SAMPLE. */
  activityMinutes: number;
  /** The newest TOP_SAMPLE entries all fall in the period, so older ones may be missing from `activityMinutes` and `top`. */
  partial: boolean;
  top: TopActivity | null;
}

/**
 * `days` are the day logs, `latest` the newest TOP_SAMPLE activities (what the screen's
 * "most frequent" reads). The period is `period` UTC days ending on `today` (G13).
 */
export function periodStats(days: ReadonlyMap<string, DayLog>, latest: readonly Activity[], today: string, period: StatsPeriod): PeriodStats {
  const from = addDays(today, 1 - period);
  let points = 0;
  let gamingMinutes = 0;
  for (let ago = 0; ago < period; ago++) {
    const log = days.get(addDays(today, -ago));
    points += log?.pointsEarned ?? 0;
    gamingMinutes += log?.gamingMinutes ?? 0;
  }
  const within = latest.filter((a) => utcDayKey(a.at) >= from && utcDayKey(a.at) <= today);
  const oldest = latest.reduce<string | null>((min, a) => (min === null || utcDayKey(a.at) < min ? utcDayKey(a.at) : min), null);
  return {
    points,
    gamingMinutes,
    activityMinutes: within.reduce((sum, a) => sum + a.duration, 0),
    partial: latest.length >= TOP_SAMPLE && oldest !== null && oldest >= from,
    top: topActivities(within)[0] ?? null,
  };
}
