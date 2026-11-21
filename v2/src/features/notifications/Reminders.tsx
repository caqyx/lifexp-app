// The reminder scheduler (docs/v2/PLAN.md 9.1, row c-3), mounted by the app shell while
// the calendar is on. It watches the entries and tasks and checks what is due
// (domain/calendar/notices) when they change, every 30 s, and when the app comes back
// to the foreground. What is due shows as one banner — the most important, with how
// many more are waiting — and goes into the bell's list; this device remembers what it
// showed, so nothing shows twice. Renders nothing.
import { useEffect } from 'preact/hooks';
import { logDelivered, markRead } from '@/domain/calendar/noticeLog';
import { dueNotices, scheduleNotices, type Notice } from '@/domain/calendar/notices';
import { t } from '@/i18n';
import { localDayKey } from '@/lib/dates';
import type { Navigate } from '@/lib/route-match';
import { calendar as calendarState, watchCalendar } from '@/stores/calendar';
import { noticeLogKey } from '@/offline/notices';
import { openNoticeLog, updateNoticeLog } from '@/stores/notifications';
import { tasks as tasksState, watchTasks } from '@/stores/tasks';
import { showBanner } from '@/ui/banner';
import { openNoticeTarget } from './open';
import { noticeBody, noticeSource } from './texts';

/** How often the scheduler looks while the app is open. */
export const CHECK_EVERY_MS = 30_000;

export function Reminders({ uid, navigate }: { uid: string; navigate: Navigate }) {
  useEffect(() => watchCalendar(uid), [uid]);
  useEffect(() => watchTasks(uid), [uid]);
  useEffect(() => openNoticeLog(uid), [uid]);

  const { events, categories } = calendarState.value;
  const taskList = tasksState.value.list;

  useEffect(() => {
    if (!events || !categories || !taskList) return;
    const check = () => {
      const now = Date.now();
      const schedule = scheduleNotices({ events, categories, tasks: taskList, now });
      let shown: Notice[] = [];
      updateNoticeLog(uid, (log) => {
        const { fresh, stale } = dueNotices(schedule, now, new Set(Object.keys(log.delivered)));
        if (fresh.length === 0 && stale.length === 0) return null;
        shown = fresh;
        return logDelivered(log, fresh, stale, now);
      });
      const [first] = shown;
      if (!first) return;
      const today = localDayKey(new Date(now));
      const more = shown.length - 1;
      showBanner({
        source: noticeSource(first),
        title: first.title,
        body: more > 0 ? `${noticeBody(first, today)} · ${t('notifications.more', { count: more })}` : noticeBody(first, today),
        onOpen: () => {
          updateNoticeLog(uid, (log) => markRead(log, first.id));
          openNoticeTarget(first.target, navigate);
        },
      });
    };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    // Back from the background (another app, a locked phone): look at once.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    // Another tab showed or read something: show its list here too.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === noticeLogKey(uid)) openNoticeLog(uid);
    };
    document.addEventListener('visibilitychange', onVisible);
    addEventListener('focus', onVisible);
    addEventListener('storage', onStorage);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      removeEventListener('focus', onVisible);
      removeEventListener('storage', onStorage);
    };
  }, [uid, events, categories, taskList]);

  return null;
}
