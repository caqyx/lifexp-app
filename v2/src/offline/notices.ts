// The in-app reminders this device has shown, and its list of recent ones (docs/v2/
// PLAN.md 9.1, row c-3): localStorage, one key per account. Per device on purpose —
// a reminder seen on the phone still shows on the laptop. Storage can be missing,
// full or blocked (private mode): then nothing is remembered and nothing here throws.
import { parseNoticeLog, type NoticeLog } from '@/domain/calendar/noticeLog';

/** The storage key of an account's log (other tabs' changes arrive as storage events on it). */
export const noticeLogKey = (uid: string) => `lifexp-v2-notices:${uid}`;
const keyOf = noticeLogKey;

export function loadNoticeLog(uid: string): NoticeLog {
  try {
    const raw = localStorage.getItem(keyOf(uid));
    return parseNoticeLog(raw === null ? null : JSON.parse(raw));
  } catch {
    return parseNoticeLog(null);
  }
}

export function saveNoticeLog(uid: string, log: NoticeLog): void {
  try {
    localStorage.setItem(keyOf(uid), JSON.stringify(log));
  } catch {
    // Not remembered: at worst a reminder shows again on this device.
  }
}
