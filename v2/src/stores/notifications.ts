// The in-app reminders this device has shown and its recent list, live (docs/v2/
// PLAN.md 9.1, row c-3). Kept in localStorage per account (offline/notices); every
// change reads the stored log first, so two open tabs do not show the same reminder
// twice or lose each other's read marks.
import { signal } from '@preact/signals';
import { parseNoticeLog, type NoticeLog } from '@/domain/calendar/noticeLog';
import { loadNoticeLog, saveNoticeLog } from '@/offline/notices';

export const noticeLog = signal<NoticeLog>(parseNoticeLog(null));
let shownFor: string | null = null;

/** Show this account's log (after sign-in, or when another tab changed it). */
export function openNoticeLog(uid: string): void {
  shownFor = uid;
  noticeLog.value = loadNoticeLog(uid);
}

/** Apply a change to the stored log; `change` returns null for "nothing to change". */
export function updateNoticeLog(uid: string, change: (log: NoticeLog) => NoticeLog | null): void {
  const next = change(loadNoticeLog(uid));
  if (next === null) return;
  saveNoticeLog(uid, next);
  if (shownFor === uid) noticeLog.value = next;
}
