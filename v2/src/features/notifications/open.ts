// Opening what a reminder is about: the entry's day in the calendar, or Tasks.
import type { NoticeTarget } from '@/domain/calendar/notices';
import { localDayKey } from '@/lib/dates';
import type { Navigate } from '@/lib/route-match';
import { calendarFocus } from '@/stores/calendar';

export function openNoticeTarget(target: NoticeTarget, navigate: Navigate): void {
  if (target.type === 'task') {
    navigate('/tasks');
    return;
  }
  calendarFocus.value = target.day === localDayKey(new Date()) ? null : target.day;
  navigate('/calendar/day');
}
