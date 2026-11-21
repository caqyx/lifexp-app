// How a reminder reads, in the active language, for the banner and the list.
import { levelRank } from '@/domain/calendar/importance';
import type { LoggedNotice } from '@/domain/calendar/noticeLog';
import type { Notice } from '@/domain/calendar/notices';
import { timeText } from '@/features/calendar/texts';
import { levelText } from '@/features/calendar/texts';
import { locale, t } from '@/i18n';
import { addDays, formatDayMonth, formatTimeOfDay, localDayKey } from '@/lib/dates';

type Shown = Notice | LoggedNotice;

/** "Kalendarz" or "Zadania": where it comes from. */
export function noticeSource(n: Shown): string {
  return t(n.target.type === 'event' ? 'nav.calendar' : 'nav.tasks');
}

/** "dziś", "jutro", "pojutrze", "wczoraj" or the date. */
function dayWord(day: string, today: string): string {
  if (day === today) return t('notifications.today');
  if (day === addDays(today, 1)) return t('notifications.tomorrow');
  if (day === addDays(today, 2)) return t('notifications.dayAfter');
  if (day === addDays(today, -1)) return t('notifications.yesterday');
  return formatDayMonth(day, locale());
}

const capital = (text: string) => text.charAt(0).toLocaleUpperCase(locale()) + text.slice(1);

/** The line under the title: when it is, and how important ("Jutro · 18:00–19:00 · Ważne"). */
export function noticeBody(n: Shown, today: string): string {
  const important = levelRank(n.level) >= levelRank('high') ? levelText(n.level) : null;
  if (n.target.type === 'task') {
    const when =
      n.kind === 'overdue'
        ? t('notifications.taskOverdue', { date: formatDayMonth(n.day, locale()) })
        : t('notifications.taskDue', { day: dayWord(n.day, today) });
    return [when, important].filter(Boolean).join(' · ');
  }
  return [capital(dayWord(n.day, today)), timeText(n), important].filter(Boolean).join(' · ');
}

/** When this device showed it: "dziś, 17:05", "wczoraj, 19:00" or "18 lis, 19:00". */
export function shownText(shownAt: number, now: number): string {
  const date = new Date(shownAt);
  const day = localDayKey(date);
  const today = localDayKey(new Date(now));
  return t('notifications.shownAt', { day: dayWord(day, today), time: formatTimeOfDay(date, locale()) });
}
