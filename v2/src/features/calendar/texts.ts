// How calendar values read (times, repetition, importance), in the active language.
import type { Occurrence } from '@/domain/calendar/agenda';
import { WEEKDAYS, type CalendarEvent, type Weekday } from '@/domain/calendar/events';
import type { ImportanceLevel } from '@/domain/calendar/importance';
import type { ReminderKind } from '@/domain/calendar/reminders';
import { locale, t } from '@/i18n';
import { addDays, formatClock, formatDayMonth, formatWeekdayShort } from '@/lib/dates';

/** "Cały dzień", "18:00–19:00" or "18:00". */
export function timeText(o: Pick<Occurrence, 'start' | 'end'>): string {
  const lang = locale();
  if (o.start === null) return t('calendar.allDay');
  if (o.end === null) return formatClock(o.start, lang);
  return t('calendar.timeRange', { from: formatClock(o.start, lang), to: formatClock(o.end, lang) });
}

/** A Monday; any one will do to name the weekdays. */
const A_MONDAY = '2026-11-16';

/** A weekday's short name ("pon."). */
export function weekdayShort(day: Weekday): string {
  return formatWeekdayShort(addDays(A_MONDAY, day - 1), locale());
}

/** "Co tydzień: pon., śr., pt.", "Codziennie", "Co miesiąc, dnia 20", "" for once. */
export function repeatText(event: CalendarEvent): string {
  const { kind, weekdays, until } = event.repeat;
  let text = '';
  if (kind === 'daily') text = t('calendar.repeatDaily');
  if (kind === 'weekly') {
    const days = weekdays.length === WEEKDAYS.length ? t('calendar.everyDay') : weekdays.map(weekdayShort).join(', ');
    text = t('calendar.repeatWeeklyOn', { days });
  }
  if (kind === 'monthly') text = t('calendar.repeatMonthlyOn', { day: Number(event.date.slice(8)) });
  if (text && until) text += ` ${t('calendar.repeatUntilShort', { date: formatDayMonth(until, locale()) })}`;
  return text;
}

export function levelText(level: ImportanceLevel): string {
  return t(`calendar.level.${level}`);
}

export function reminderText(kind: ReminderKind): string {
  return t(`calendar.reminderKind.${kind}`);
}
