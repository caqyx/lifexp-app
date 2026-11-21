// What a device remembers of its in-app reminders (docs/v2/PLAN.md 9.1, row c-3): which
// ones it has shown (so none shows twice) and the recent ones for the bell's list, with
// their read state. Pure: parsing what storage gives back, and the changes.
import { pruneDelivered, type Notice, type NoticeKind, type NoticeTarget } from './notices';
import type { ImportanceLevel } from './importance';
import { IMPORTANCE_LEVELS } from './importance';

/** How many recent notifications the list keeps. */
export const NOTICE_LIST_MAX = 30;

/** One notification in the list: what it was about, enough to show and open it. */
export interface LoggedNotice {
  id: string;
  /** When it was due (ms). */
  at: number;
  /** When this device showed it (ms). */
  shownAt: number;
  kind: NoticeKind;
  title: string;
  level: ImportanceLevel;
  target: NoticeTarget;
  day: string;
  start: number | null;
  end: number | null;
  read: boolean;
}

export interface NoticeLog {
  /** Shown (or found too late), by id → when it was due. */
  delivered: Record<string, number>;
  /** Newest first. */
  list: LoggedNotice[];
}

const KINDS: readonly NoticeKind[] = ['twoDaysBefore', 'dayBefore', 'morning', 'hourBefore', 'quarterBefore', 'overdue'];
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const minutesOrNull = (v: unknown) => (isNum(v) && v >= 0 && v < 24 * 60 ? v : null);

function targetOf(value: unknown): NoticeTarget | null {
  if (!value || typeof value !== 'object') return null;
  const t = value as Record<string, unknown>;
  if (t.type === 'event' && typeof t.eventId === 'string' && isDay(t.day)) return { type: 'event', eventId: t.eventId, day: t.day };
  if (t.type === 'task' && typeof t.taskId === 'string') return { type: 'task', taskId: t.taskId };
  return null;
}

function loggedOf(value: unknown): LoggedNotice | null {
  if (!value || typeof value !== 'object') return null;
  const n = value as Record<string, unknown>;
  const target = targetOf(n.target);
  if (typeof n.id !== 'string' || !isNum(n.at) || !isNum(n.shownAt) || !target || !isDay(n.day)) return null;
  return {
    id: n.id,
    at: n.at,
    shownAt: n.shownAt,
    kind: KINDS.includes(n.kind as NoticeKind) ? (n.kind as NoticeKind) : 'morning',
    title: typeof n.title === 'string' ? n.title : '',
    level: IMPORTANCE_LEVELS.includes(n.level as ImportanceLevel) ? (n.level as ImportanceLevel) : 'low',
    target,
    day: n.day,
    start: minutesOrNull(n.start),
    end: minutesOrNull(n.end),
    read: n.read === true,
  };
}

/** What storage gave back (anything, or null), as a log; broken parts are dropped. */
export function parseNoticeLog(value: unknown): NoticeLog {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const delivered: Record<string, number> = {};
  if (v.delivered && typeof v.delivered === 'object') {
    for (const [id, at] of Object.entries(v.delivered as Record<string, unknown>)) if (isNum(at)) delivered[id] = at;
  }
  const list = Array.isArray(v.list) ? v.list.map(loggedOf).filter((n): n is LoggedNotice => n !== null) : [];
  return { delivered, list: list.slice(0, NOTICE_LIST_MAX) };
}

/**
 * After a check at `now`: the fresh notices go to the top of the list (unread), and
 * they and the stale ones are remembered as shown; what is older than a week is forgotten.
 */
export function logDelivered(log: NoticeLog, fresh: readonly Notice[], stale: readonly Notice[], now: number): NoticeLog {
  const delivered = { ...log.delivered };
  for (const n of [...fresh, ...stale]) delivered[n.id] = n.at;
  const added: LoggedNotice[] = fresh.map((n) => ({
    id: n.id,
    at: n.at,
    shownAt: now,
    kind: n.kind,
    title: n.title,
    level: n.level,
    target: n.target,
    day: n.day,
    start: n.start,
    end: n.end,
    read: false,
  }));
  const ids = new Set(added.map((n) => n.id));
  return {
    delivered: pruneDelivered(delivered, now),
    list: [...added, ...log.list.filter((n) => !ids.has(n.id))].slice(0, NOTICE_LIST_MAX),
  };
}

export function markRead(log: NoticeLog, id: string | null): NoticeLog {
  return { ...log, list: log.list.map((n) => (id === null || n.id === id ? { ...n, read: true } : n)) };
}

export function unreadCount(log: NoticeLog): number {
  return log.list.filter((n) => !n.read).length;
}
