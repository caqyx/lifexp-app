// Calendar (docs/v2/PLAN.md 9.1, row c-1): an opt-in module, off until turned on in
// Settings. Four views of one screen, each with its own address — the month
// (#/calendar), the week, the day and the categories — over the same chosen day.
// Entries are weighed by importance (their category plus extra points): the more
// important stand higher and show stronger. Ticking one done gives no points.
import { Plus } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { occurrencesBetween, monthGrid, type Occurrence } from '@/domain/calendar/agenda';
import {
  canAddEvent,
  EVENTS_MAX,
  type CalendarCategory,
  type CalendarEvent,
  type CategoryDraft,
  type EventDraft,
  type OccurrenceMark,
} from '@/domain/calendar/events';
import { t } from '@/i18n';
import { localDayKey, monthKeyOfDay, weekOf } from '@/lib/dates';
import type { RouteProps } from '@/lib/route-match';
import {
  createCategory,
  createEvent,
  deleteCategory,
  deleteEvent,
  markOccurrence,
  updateCategory,
  updateEvent,
  type EventRejection,
} from '@/services/calendar';
import { calendar as calendarState, calendarFocus, watchCalendar } from '@/stores/calendar';
import { account } from '@/stores/session';
import { dismissToast, showToast, type ToastInput } from '@/ui/toast';
import { Button } from '@/ui/components/Button';
import { Skeleton } from '@/ui/components/Display';
import { Card, Page, Stack } from '@/ui/components/Layout';
import { ViewPanel, ViewSwitch } from '@/ui/components/ViewSwitch';
import { CategoriesView } from './CategoriesView';
import { CategorySheet } from './CategorySheet';
import { DayView } from './DayView';
import { EventSheet } from './EventSheet';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import './calendar.css';

type View = 'month' | 'week' | 'day' | 'categories';

const VIEW_PATHS: Readonly<Record<View, string>> = {
  month: '/calendar',
  week: '/calendar/week',
  day: '/calendar/day',
  categories: '/calendar/categories',
};
const VIEWS: readonly View[] = ['month', 'week', 'day', 'categories'];

function viewOf(path: string): View {
  return VIEWS.find((v) => VIEW_PATHS[v] === path) ?? 'month';
}

/** The sheet stays mounted while it closes (exit animation); `key` gives each opening a fresh form. */
interface EventSheetState {
  open: boolean;
  key: number;
  event: CalendarEvent | null;
  day: string;
}

interface CategorySheetState {
  open: boolean;
  key: number;
  category: CalendarCategory | null;
}

export default function CalendarModule({ path, navigate }: RouteProps) {
  const current = account.value;
  const uid = current?.user.uid;
  useEffect(() => (uid ? watchCalendar(uid) : undefined), [uid]);

  const [eventSheet, setEventSheet] = useState<EventSheetState>({ open: false, key: 0, event: null, day: '' });
  const [categorySheet, setCategorySheet] = useState<CategorySheetState>({ open: false, key: 0, category: null });
  const sheetKey = useRef(0);
  const lastToast = useRef<number | null>(null);

  const { events, categories, failed } = calendarState.value;
  const today = localDayKey(new Date());
  const focus = calendarFocus.value ?? today;
  const view = viewOf(path);

  const notify = (input: ToastInput) => {
    if (lastToast.current !== null) dismissToast(lastToast.current);
    lastToast.current = showToast(input);
  };
  const saveFailed = () => notify({ message: t('calendar.saveFailed'), tone: 'negative' });

  const openEvent = (event: CalendarEvent | null, day: string) => {
    sheetKey.current += 1;
    setEventSheet({ open: true, key: sheetKey.current, event, day });
  };
  const closeEvent = () => setEventSheet((s) => ({ ...s, open: false }));
  const startNew = (day: string) => {
    if (events && !canAddEvent(events)) notify({ message: t('calendar.eventLimit', { max: EVENTS_MAX }), tone: 'negative' });
    else openEvent(null, day);
  };

  // #/calendar/new (the "+" sheet): the month, with the form open on the chosen day.
  useEffect(() => {
    if (path !== '/calendar/new' || !events) return;
    navigate('/calendar', { replace: true });
    startNew(focus);
  }, [path, events === undefined]);

  if (!current || !uid) return null;

  const setFocus = (day: string) => {
    calendarFocus.value = day === today ? null : day;
  };

  // The range the view shows: the month grid (whole weeks), or the chosen day's week.
  const range = (() => {
    if (view === 'month') {
      const weeks = monthGrid(monthKeyOfDay(focus)).weeks;
      return { from: weeks[0]?.[0] ?? focus, to: weeks[weeks.length - 1]?.[6] ?? focus };
    }
    const week = weekOf(focus);
    return { from: week[0] ?? focus, to: week[6] ?? focus };
  })();
  const occurrences: Occurrence[] = events && categories ? occurrencesBetween(events, categories, range.from, range.to) : [];

  const mark = (event: CalendarEvent, day: string, next: OccurrenceMark | null) => {
    const { saved, undo } = markOccurrence(uid, event, day, next);
    saved.catch(saveFailed);
    const message = next === 'done' ? 'calendar.markedDone' : next === 'skipped' ? 'calendar.markedSkipped' : 'calendar.markedOpen';
    notify({
      message: t(message, { title: event.title }),
      tone: next === 'done' ? 'positive' : undefined,
      action: { label: t('ui.undo'), onAction: () => void undo().catch(saveFailed) },
    });
  };
  const toggle = (o: Occurrence) => mark(o.event, o.day, o.mark === null ? 'done' : null);
  const markFromSheet = (event: CalendarEvent, day: string, next: OccurrenceMark | null) => {
    closeEvent();
    mark(event, day, next);
  };

  const rejection = (problem: EventRejection): EventRejection | null => {
    if (problem.kind !== 'limit') return problem;
    notify({ message: t('calendar.eventLimit', { max: EVENTS_MAX }), tone: 'negative' });
    return null;
  };

  const saveEvent = (draft: EventDraft, newCategory: CategoryDraft | null): EventRejection | null => {
    if (!events || !categories) return null;
    const result = eventSheet.event
      ? updateEvent(uid, eventSheet.event.id, draft, newCategory, categories)
      : createEvent(uid, draft, events, newCategory, categories);
    if (!result.ok) return rejection(result.problem);
    result.saved.catch(saveFailed);
    notify({ message: t('calendar.eventSaved'), tone: 'positive' });
    if (!eventSheet.event && draft.date) setFocus(draft.date);
    closeEvent();
    return null;
  };

  const removeEvent = (event: CalendarEvent) => {
    closeEvent();
    const { saved, undo } = deleteEvent(uid, event);
    saved.catch(saveFailed);
    notify({
      message: t('calendar.eventDeleted'),
      action: { label: t('ui.undo'), onAction: () => void undo().catch(saveFailed) },
    });
  };

  const openCategory = (category: CalendarCategory | null) => {
    sheetKey.current += 1;
    setCategorySheet({ open: true, key: sheetKey.current, category });
  };
  const closeCategory = () => setCategorySheet((s) => ({ ...s, open: false }));

  const saveCategory = (draft: CategoryDraft) => {
    if (!categories) return null;
    const result = categorySheet.category
      ? updateCategory(uid, categorySheet.category.id, draft, categories)
      : createCategory(uid, draft, categories);
    if (!result.ok) return result.problem;
    result.saved.catch(saveFailed);
    notify({ message: t('calendar.categorySaved'), tone: 'positive' });
    closeCategory();
    return null;
  };

  const removeCategory = (category: CalendarCategory) => {
    closeCategory();
    const { saved, undo } = deleteCategory(uid, category);
    saved.catch(saveFailed);
    notify({
      message: t('calendar.categoryDeleted', { name: category.name }),
      action: { label: t('ui.undo'), onAction: () => void undo().catch(saveFailed) },
    });
  };

  const openOccurrence = (o: Occurrence) => openEvent(o.event, o.day);
  const loaded = events !== undefined && categories !== undefined;

  return (
    <Page>
      <Stack>
        <ViewSwitch
          label={t('calendar.views')}
          links={VIEWS.map((v) => ({ href: `#${VIEW_PATHS[v]}`, label: t(`calendar.view.${v}`), current: v === view }))}
        />
        {failed && (
          <p class="cal-error" role="alert">
            {t('calendar.loadFailed')}
          </p>
        )}
        {view !== 'categories' && (
          <div class="cal-head">
            <Button variant="secondary" onClick={() => setFocus(today)} disabled={focus === today}>
              {t('calendar.today')}
            </Button>
            <Button variant="primary" onClick={() => startNew(focus)} disabled={!loaded}>
              <Plus aria-hidden="true" />
              {t('calendar.newEvent')}
            </Button>
          </div>
        )}
        <ViewPanel index={VIEWS.indexOf(view)}>
          {!loaded ? (
            <Card>
              <Skeleton lines={5} />
            </Card>
          ) : view === 'month' ? (
            <MonthView
              focus={focus}
              today={today}
              occurrences={occurrences}
              onFocus={setFocus}
              onToggle={toggle}
              onOpen={openOccurrence}
              onAdd={startNew}
            />
          ) : view === 'week' ? (
            <WeekView focus={focus} today={today} occurrences={occurrences} onFocus={setFocus} onToggle={toggle} onOpen={openOccurrence} />
          ) : view === 'day' ? (
            <DayView focus={focus} today={today} occurrences={occurrences} onFocus={setFocus} onToggle={toggle} onOpen={openOccurrence} />
          ) : (
            <CategoriesView categories={categories} events={events} onOpen={openCategory} onNew={() => openCategory(null)} />
          )}
        </ViewPanel>
      </Stack>

      {eventSheet.key > 0 && categories && (
        <EventSheet
          key={eventSheet.key}
          open={eventSheet.open}
          event={eventSheet.event}
          day={eventSheet.day}
          categories={categories}
          onClose={closeEvent}
          onSave={saveEvent}
          onDelete={removeEvent}
          onMark={markFromSheet}
        />
      )}
      {categorySheet.key > 0 && categories && (
        <CategorySheet
          key={categorySheet.key}
          open={categorySheet.open}
          category={categorySheet.category}
          categories={categories}
          onClose={closeCategory}
          onSave={saveCategory}
          onDelete={removeCategory}
        />
      )}
    </Page>
  );
}
