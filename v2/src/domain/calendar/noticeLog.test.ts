import { describe, expect, test } from 'vitest';
import { logDelivered, markRead, NOTICE_LIST_MAX, parseNoticeLog, unreadCount } from './noticeLog';
import { DELIVERED_KEEP_MS, type Notice } from './notices';

const notice = (id: string, at = 1000): Notice => ({
  id,
  at,
  expiresAt: at + 1000,
  kind: 'hourBefore',
  title: id.toUpperCase(),
  level: 'medium',
  target: { type: 'event', eventId: id, day: '2026-11-20' },
  day: '2026-11-20',
  start: 600,
  end: null,
});

describe('the notice log', () => {
  test('fresh ones go on top, unread; fresh and stale are remembered', () => {
    let log = parseNoticeLog(null);
    log = logDelivered(log, [notice('a')], [notice('old', 500)], 2000);
    log = logDelivered(log, [notice('b', 1500)], [], 3000);
    expect(log.list.map((n) => [n.id, n.read, n.shownAt])).toEqual([
      ['b', false, 3000],
      ['a', false, 2000],
    ]);
    expect(log.delivered).toEqual({ a: 1000, old: 500, b: 1500 });
    expect(unreadCount(log)).toBe(2);
    expect(unreadCount(markRead(log, 'a'))).toBe(1);
    expect(unreadCount(markRead(log, null))).toBe(0);
  });

  test(`at most ${NOTICE_LIST_MAX}; a week later forgotten`, () => {
    const many = Array.from({ length: NOTICE_LIST_MAX + 5 }, (_, i) => notice(`n${i}`));
    const log = logDelivered(parseNoticeLog(null), many, [], 2000);
    expect(log.list).toHaveLength(NOTICE_LIST_MAX);
    expect(logDelivered(log, [], [], 1000 + DELIVERED_KEEP_MS + 1).delivered).toEqual({});
  });

  test('storage gives back anything: broken parts are dropped, never thrown', () => {
    expect(parseNoticeLog('nope')).toEqual({ delivered: {}, list: [] });
    const round = JSON.parse(JSON.stringify(logDelivered(parseNoticeLog(null), [notice('a')], [], 2000)));
    expect(parseNoticeLog(round).list[0]).toMatchObject({ id: 'a', target: { type: 'event', eventId: 'a', day: '2026-11-20' } });
    expect(
      parseNoticeLog({ delivered: { a: 1, b: 'x' }, list: [{ id: 'x' }, { ...round.list[0], level: 'huge', kind: 'weird', start: 5000 }] }),
    ).toMatchObject({ delivered: { a: 1 }, list: [{ id: 'a', level: 'low', kind: 'morning', start: null }] });
  });
});
