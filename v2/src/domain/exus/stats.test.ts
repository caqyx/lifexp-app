import { describe, expect, it } from 'vitest';
import type { Activity, DayLog } from '../activity';
import { statsWeeks, sumGaming, sumPoints, TOP_SAMPLE } from '../stats';
import { periodStats, STATS_PERIOD } from './stats';

const TODAY = '2026-10-09';

const logs = (entries: Record<string, [number, number]>): Map<string, DayLog> =>
  new Map(Object.entries(entries).map(([key, [pointsEarned, gamingMinutes]]) => [key, { pointsEarned, gamingMinutes }]));

let n = 0;
const activity = (type: string, day: string, duration: number, points = 10): Activity => ({
  id: `a${(n += 1)}`,
  type,
  typeName: null,
  desc: '',
  duration,
  points,
  at: new Date(`${day}T10:00:00Z`),
});

describe('the period token', () => {
  it.each([
    ['7d', 7],
    ['7D', 7],
    ['7', 7],
    ['tydzień', 7],
    ['30d', 30],
    ['30', 30],
    ['miesiąc', 30],
    ['14d', undefined],
    ['nauka', undefined],
  ])('%s → %s', (token, expected) => expect(STATS_PERIOD(token)).toBe(expected));
});

describe('periodStats', () => {
  const days = logs({
    '2026-10-09': [40, 30],
    '2026-10-03': [25, 0],
    '2026-10-02': [100, 60],
    '2026-09-20': [70, 0],
    '2026-09-09': [999, 0],
  });

  it('sums the 7 days exactly as the Stats screen chart does', () => {
    const weeks = statsWeeks(days, TODAY);
    const week = periodStats(days, [], TODAY, 7);
    expect(week.points).toBe(sumPoints(weeks.thisWeek));
    expect(week.gamingMinutes).toBe(sumGaming(weeks.thisWeek));
    expect(week.points).toBe(65);
    expect(week.gamingMinutes).toBe(30);
  });

  it('counts 30 days ending today, including the 30th, not the 31st', () => {
    expect(periodStats(days, [], TODAY, 30).points).toBe(235);
    // 2026-09-10 is the 30th day back; 2026-09-09 is outside.
    expect(periodStats(logs({ '2026-09-10': [5, 0], '2026-09-09': [7, 0] }), [], TODAY, 30).points).toBe(5);
  });

  it('adds the activity time and the top activity of the period only', () => {
    const latest = [
      activity('learning', '2026-10-09', 60),
      activity('reading', '2026-10-05', 30),
      activity('reading', '2026-10-04', 20),
      activity('exercise', '2026-09-20', 90),
    ];
    const week = periodStats(days, latest, TODAY, 7);
    expect(week.activityMinutes).toBe(110);
    expect(week.top).toEqual({ type: 'reading', count: 2, points: 20 });
    expect(week.partial).toBe(false);
    const month = periodStats(days, latest, TODAY, 30);
    expect(month.activityMinutes).toBe(200);
  });

  it('has no top and no time without activities', () => {
    expect(periodStats(new Map(), [], TODAY, 7)).toEqual({ points: 0, gamingMinutes: 0, activityMinutes: 0, partial: false, top: null });
  });

  it('says so when the newest 50 entries may not reach back the whole period', () => {
    const full = Array.from({ length: TOP_SAMPLE }, () => activity('learning', '2026-10-08', 10));
    expect(periodStats(new Map(), full, TODAY, 7).partial).toBe(true);
    const reachesBack = [...full.slice(1), activity('learning', '2026-09-01', 10)];
    expect(periodStats(new Map(), reachesBack, TODAY, 7).partial).toBe(false);
    expect(periodStats(new Map(), full.slice(1), TODAY, 7).partial).toBe(false);
  });
});
