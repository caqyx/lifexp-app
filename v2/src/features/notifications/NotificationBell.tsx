// The bell in the top bar (docs/v2/PLAN.md 9.1, row c-3): "Powiadomienia" with the
// number not read yet, and a sheet with the recent reminders, newest first. A row
// opens what it is about; closing the sheet marks them read (they were seen).
import { Bell } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { markRead, unreadCount, type LoggedNotice } from '@/domain/calendar/noticeLog';
import { t } from '@/i18n';
import { localDayKey } from '@/lib/dates';
import type { Navigate } from '@/lib/route-match';
import { noticeLog, updateNoticeLog } from '@/stores/notifications';
import { Button } from '@/ui/components/Button';
import { EmptyState, MotionList } from '@/ui/components/Display';
import { Sheet } from '@/ui/components/Sheet';
import { openNoticeTarget } from './open';
import { noticeBody, noticeSource, shownText } from './texts';
import './notifications.css';

function NoticeRow({ notice, now, onOpen }: { notice: LoggedNotice; now: number; onOpen: (n: LoggedNotice) => void }) {
  const today = localDayKey(new Date(now));
  return (
    <li class={`notice-row${notice.read ? '' : ' notice-row--unread'}`}>
      <button type="button" class="notice-row__button" onClick={() => onOpen(notice)}>
        <span class="notice-row__source">
          {!notice.read && <span class="notice-row__dot" aria-hidden="true" />}
          {noticeSource(notice)}
          <span class="notice-row__when">{shownText(notice.shownAt, now)}</span>
        </span>
        <span class="notice-row__title user-text">{notice.title}</span>
        <span class="notice-row__body">{noticeBody(notice, today)}</span>
        {!notice.read && <span class="visually-hidden">{t('notifications.unread')}</span>}
      </button>
    </li>
  );
}

export function NotificationBell({ uid, navigate }: { uid: string; navigate: Navigate }) {
  const [sheet, setSheet] = useState({ open: false, key: 0 });
  const log = noticeLog.value;
  const unread = unreadCount(log);
  const now = Date.now();

  const close = () => {
    setSheet((s) => ({ ...s, open: false }));
    updateNoticeLog(uid, (l) => (unreadCount(l) > 0 ? markRead(l, null) : null));
  };
  const open = (notice: LoggedNotice) => {
    setSheet((s) => ({ ...s, open: false }));
    updateNoticeLog(uid, (l) => markRead(l, notice.id));
    openNoticeTarget(notice.target, navigate);
  };

  return (
    <>
      <button
        type="button"
        class={`notice-bell${unread > 0 ? ' notice-bell--unread' : ''}`}
        aria-label={unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.title')}
        onClick={() => setSheet((s) => ({ open: true, key: s.key + 1 }))}
      >
        <Bell aria-hidden="true" />
        <span class="notice-bell__label">{t('notifications.title')}</span>
        {unread > 0 && (
          <span class="notice-bell__count numeric" key={unread} aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {sheet.key > 0 && (
        <Sheet
          key={sheet.key}
          open={sheet.open}
          onClose={close}
          title={t('notifications.title')}
          footer={
            unread > 0 ? (
              <Button variant="secondary" size="lg" block onClick={() => updateNoticeLog(uid, (l) => markRead(l, null))}>
                {t('notifications.markAllRead')}
              </Button>
            ) : undefined
          }
        >
          {log.list.length === 0 ? (
            <EmptyState title={t('notifications.empty')} body={t('notifications.emptyBody')} />
          ) : (
            <MotionList class="notice-list" label={t('notifications.title')}>
              {log.list.map((n) => (
                <NoticeRow key={n.id} notice={n} now={now} onOpen={open} />
              ))}
            </MotionList>
          )}
        </Sheet>
      )}
    </>
  );
}
