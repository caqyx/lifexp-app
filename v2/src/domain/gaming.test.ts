import { describe, expect, test } from 'vitest';
import {
  gamingSession,
  MAX_SESSION_MINUTES,
  minutesByGame,
  parsePendingPlays,
  playsToRecover,
  pauseClock,
  playedMs,
  resumeClock,
  sessionMinutes,
  startClock,
  withoutPendingPlay,
  withPendingPlay,
  type PendingPlay,
} from './gaming';

const S = 1000;
const M = 60 * S;

describe('play clock', () => {
  test('counts only while the game is on screen', () => {
    let c = startClock(0, true);
    expect(playedMs(c, 90 * S)).toBe(90 * S);
    c = pauseClock(c, 2 * M); // hidden after 2 min
    expect(playedMs(c, 10 * M)).toBe(2 * M); // the hidden gap adds nothing
    c = resumeClock(c, 10 * M);
    expect(playedMs(c, 13 * M)).toBe(5 * M);
  });

  test('a page opened hidden starts paused', () => {
    let c = startClock(0, false);
    expect(playedMs(c, 5 * M)).toBe(0);
    c = resumeClock(c, 5 * M);
    expect(playedMs(c, 6 * M)).toBe(M);
  });

  test('repeated pause and resume events change nothing', () => {
    let c = startClock(0, true);
    c = pauseClock(c, M);
    c = pauseClock(c, 3 * M);
    expect(playedMs(c, 4 * M)).toBe(M);
    c = resumeClock(c, 4 * M);
    c = resumeClock(c, 5 * M); // a second "visible" does not restart the run
    expect(playedMs(c, 6 * M)).toBe(3 * M);
  });

  test('a clock set backwards adds nothing instead of taking time away', () => {
    const c = startClock(10 * M, true);
    expect(playedMs(c, 5 * M)).toBe(0);
    expect(pauseClock(c, 5 * M).activeMs).toBe(0);
  });
});

describe('sessionMinutes: minimum and rounding', () => {
  test.each([
    [0, 0],
    [29 * S, 0],
    [29_999, 0],
    [30 * S, 1], // the minimum is also the first minute
    [89 * S, 1],
    [90 * S, 2],
    [10 * M + 29 * S, 10],
    [10 * M + 30 * S, 11],
    [NaN, 0],
    [-M, 0],
  ])('%d ms → %d min', (ms, min) => {
    expect(sessionMinutes(ms)).toBe(min);
  });

  test('capped at v1\'s 1440 minutes per session', () => {
    expect(sessionMinutes(30 * 60 * M)).toBe(MAX_SESSION_MINUTES);
  });
});

describe('gamingSession', () => {
  test('v1\'s shape: name, whole minutes, the UTC day', () => {
    expect(gamingSession('Wartime', 12 * M, new Date('2026-10-26T15:00:00Z'))).toEqual({
      game: 'Wartime',
      duration: 12,
      date: '2026-10-26',
    });
  });

  test('too short: nothing to write', () => {
    expect(gamingSession('Wartime', 20 * S, new Date('2026-10-26T15:00:00Z'))).toBeNull();
  });

  test('over UTC midnight: the whole session goes to the day it ends on, as v1 saves it', () => {
    // Started 23:50 UTC on the 26th, ended 00:20 UTC on the 27th.
    expect(gamingSession('Gridlock', 30 * M, new Date('2026-10-27T00:20:00Z'))).toEqual({
      game: 'Gridlock',
      duration: 30,
      date: '2026-10-27',
    });
  });

  test('the day is UTC, not the device\'s: 00:30 in Warsaw is still yesterday in UTC', () => {
    expect(gamingSession('Gridlock', 5 * M, new Date('2026-10-26T23:30:00Z'))?.date).toBe('2026-10-26');
  });
});

test('minutesByGame sums one day per game', () => {
  const sessions = [
    { game: 'Wartime', duration: 10, date: '2026-10-26' },
    { game: 'Wartime', duration: 5, date: '2026-10-26' },
    { game: 'Gridlock', duration: 7, date: '2026-10-26' },
    { game: 'Wartime', duration: 99, date: '2026-10-25' },
  ];
  expect(Object.fromEntries(minutesByGame(sessions, '2026-10-26'))).toEqual({ Wartime: 15, Gridlock: 7 });
});

describe('pending plays', () => {
  const play = (patch: Partial<PendingPlay> = {}): PendingPlay => ({
    id: 's1',
    uid: 'u',
    game: 'Wartime',
    ms: 60_000,
    endedAt: 5,
    pageId: 'p',
    ...patch,
  });

  test('reads the stored list and drops what is broken', () => {
    expect(parsePendingPlays(JSON.stringify([play(), { ...play({ id: 's2' }), ms: 'x' }, null, play({ id: '' })]))).toEqual([
      play(),
    ]);
  });

  test.each([null, '', 'not json', '{}', 'null', JSON.stringify(play())])('nothing to recover in %s', (raw) => {
    expect(parsePendingPlays(raw)).toEqual([]);
  });

  test('one record per session id', () => {
    let list = withPendingPlay([], play());
    list = withPendingPlay(list, play({ ms: 90_000 }));
    list = withPendingPlay(list, play({ id: 's2' }));
    expect(list.map((p) => [p.id, p.ms])).toEqual([
      ['s1', 90_000],
      ['s2', 60_000],
    ]);
    expect(withoutPendingPlay(list, 's1').map((p) => p.id)).toEqual(['s2']);
  });

  test('a page recovers only the account\'s records of other page loads', () => {
    const list = [play({ id: 'mine-now', pageId: 'this' }), play({ id: 'old' }), play({ id: 'other-user', uid: 'v' })];
    expect(playsToRecover(list, 'u', 'this').map((p) => p.id)).toEqual(['old']);
  });
});
