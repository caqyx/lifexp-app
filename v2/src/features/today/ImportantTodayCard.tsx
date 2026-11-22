// Today's tasks on Today (docs/v2/PLAN.md 7.6; QUALITY.md D1): the tasks due today
// and overdue ones still open, the most important first (domain/calendar/items
// importantToday). With the calendar on it is the calendar's "Ważne dzisiaj" (row c-2):
// the day's entries among the tasks. Ticking an entry marks the day (no points, with
// "Cofnij"); ticking a task goes through the tasks service (v1 rules). A row opens it
// where it lives: the entry in the calendar's day, the task in Tasks.
import { useEffect, useRef, useState } from 'preact/hooks';
import { importantToday, type CalendarItem } from '@/domain/calendar/items';
import { ItemList, ItemRow } from '@/features/calendar/parts';
import { t } from '@/i18n';
import type { Navigate } from '@/lib/route-match';
import { markOccurrence } from '@/services/calendar';
import { completeTask } from '@/services/tasks';
import { calendar as calendarState, calendarFocus, watchCalendar } from '@/stores/calendar';
import { tasks as tasksState, watchTasks } from '@/stores/tasks';
import { dismissToast, showToast, type ToastInput } from '@/ui/toast';
import { Skeleton } from '@/ui/components/Display';
import { Card, Section } from '@/ui/components/Layout';

interface ImportantTodayCardProps {
  uid: string;
  today: string;
  navigate: Navigate;
  /** The calendar module is on: its entries join the tasks ("Ważne dzisiaj"). */
  withCalendar: boolean;
}

const NO_EVENTS: readonly never[] = [];

export function ImportantTodayCard({ uid, today, navigate, withCalendar }: ImportantTodayCardProps) {
  useEffect(() => (withCalendar ? watchCalendar(uid) : undefined), [uid, withCalendar]);
  useEffect(() => watchTasks(uid), [uid]);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const lastToast = useRef<number | null>(null);

  const { events, categories } = withCalendar ? calendarState.value : { events: NO_EVENTS, categories: NO_EVENTS };
  const taskList = tasksState.value.list;
  const notify = (input: ToastInput) => {
    if (lastToast.current !== null) dismissToast(lastToast.current);
    lastToast.current = showToast(input);
  };

  const title = t(withCalendar ? 'calendar.importantToday' : 'today.tasksToday');
  const link = withCalendar ? (
    <a
      href="#/calendar/day"
      onClick={() => {
        calendarFocus.value = null;
      }}
    >
      {t('calendar.openCalendar')}
    </a>
  ) : (
    <a href="#/tasks">{t('today.tasksOpen')}</a>
  );

  if (!events || !categories || !taskList) {
    return (
      <Section title={title} action={link}>
        <Card>
          <Skeleton lines={3} />
        </Card>
      </Section>
    );
  }

  const { items, more, settled } = importantToday(events, categories, taskList, today);

  const toggle = (item: CalendarItem) => {
    if (item.kind === 'event') {
      const event = item.occurrence.event;
      const { saved, undo } = markOccurrence(uid, event, item.day, 'done');
      const failed = () => notify({ message: t('calendar.saveFailed'), tone: 'negative' });
      saved.catch(failed);
      notify({
        message: t('calendar.markedDone', { title: event.title }),
        tone: 'positive',
        action: { label: t('ui.undo'), onAction: () => void undo().catch(failed) },
      });
      return;
    }
    setBusy((keys) => new Set(keys).add(item.key));
    completeTask(uid, item.task.id)
      .then((pieces) =>
        notify(
          pieces > 0
            ? { message: t('tasks.piecesEarned', { count: pieces }), tone: 'positive' }
            : { message: t('tasks.lateNoPieces') },
        ),
      )
      .catch(() => notify({ message: t('tasks.completeFailed'), tone: 'negative' }))
      .finally(() =>
        setBusy((keys) => {
          const next = new Set(keys);
          next.delete(item.key);
          return next;
        }),
      );
  };

  const open = (item: CalendarItem) => {
    if (item.kind === 'task') {
      navigate('/tasks');
      return;
    }
    calendarFocus.value = null;
    navigate('/calendar/day');
  };

  return (
    <Section title={title} action={link}>
      <Card padding={items.length === 0 ? 'md' : 'none'}>
        {items.length === 0 ? (
          <p class="today-important__empty">
            {t(settled > 0 ? 'calendar.importantAllDone' : withCalendar ? 'calendar.importantNone' : 'today.tasksNone')}
          </p>
        ) : (
          <ItemList label={title}>
            {items.map((item) => (
              <ItemRow key={item.key} item={item} onToggle={toggle} onOpen={open} busy={busy.has(item.key)} />
            ))}
          </ItemList>
        )}
        {(more > 0 || (settled > 0 && items.length > 0)) && (
          <p class="today-important__foot">
            {[more > 0 ? t('calendar.importantMore', { count: more }) : null, settled > 0 ? t('calendar.importantSettled', { count: settled }) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </Card>
    </Section>
  );
}
