// A new or changed calendar entry in a sheet (docs/v2/PLAN.md 9.1, row c-1): name,
// category (or a new one typed right here — never a sheet from a sheet), extra
// importance points with what they add up to and which reminders that brings, the
// day, all day or from–to, and the repetition. Opened from an occurrence it also
// ticks or skips that one day. Checked by domain/calendar.
import { Check, Trash2 } from 'lucide-preact';
import { useState } from 'preact/hooks';
import {
  CATEGORY_IMPORTANCE_MAX,
  CATEGORY_NAME_MAX,
  EVENT_TITLE_MAX,
  EXTRA_IMPORTANCE_MAX,
  WEEKDAYS,
  emptyCategoryDraft,
  emptyEventDraft,
  eventDraft,
  sortedCategories,
  type CalendarCategory,
  type CalendarEvent,
  type CategoryDraft,
  type EventDraft,
  type RepeatKind,
  type Weekday,
} from '@/domain/calendar/events';
import { importanceLevel, IMPORTANCE_MAX } from '@/domain/calendar/importance';
import { remindersFor } from '@/domain/calendar/reminders';
import { locale, t } from '@/i18n';
import { formatDayMonth, isoWeekday, parseClock } from '@/lib/dates';
import type { EventRejection } from '@/services/calendar';
import { Button } from '@/ui/components/Button';
import { DateField, FilterChip, Select, Stepper, Switch, TextField, TimeField } from '@/ui/components/Fields';
import { Sheet } from '@/ui/components/Sheet';
import { CategoryDot, ColorPicker, categoryLabel } from './parts';
import { levelText, reminderText } from './texts';

const FORM_ID = 'calendar-event-form';
/** The category choice that opens the inline "new category" fields. */
const NEW = '__new__';

const EVENT_PROBLEM_KEY = {
  titleRequired: 'calendar.needTitle',
  dateRequired: 'calendar.needDate',
  startRequired: 'calendar.needStart',
  endBeforeStart: 'calendar.endBeforeStart',
  weekdaysRequired: 'calendar.needWeekdays',
  untilBeforeDate: 'calendar.untilBeforeDate',
} as const;

const CATEGORY_PROBLEM_KEY = {
  nameRequired: 'calendar.needCategoryName',
  nameTaken: 'calendar.categoryTaken',
  limit: 'calendar.categoryLimit',
} as const;

interface EventSheetProps {
  open: boolean;
  /** The entry being changed; null for a new one. */
  event: CalendarEvent | null;
  /** The occurrence it was opened from, or the day a new entry starts on. */
  day: string;
  /** A new entry's start time, "HH:mm" (from the timeline); "" = all day. */
  startTime?: string;
  categories: readonly CalendarCategory[];
  onClose: () => void;
  /** Returns a problem to show, or null when saved. */
  onSave: (draft: EventDraft, newCategory: CategoryDraft | null) => EventRejection | null;
  onDelete: (event: CalendarEvent) => void;
  onMark: (event: CalendarEvent, day: string, mark: 'done' | 'skipped' | null) => void;
}

function initialDraft(event: CalendarEvent | null, day: string, startTime: string): EventDraft {
  if (event) return eventDraft(event);
  const draft = emptyEventDraft(day);
  return startTime ? { ...draft, allDay: false, start: startTime } : draft;
}

export function EventSheet({ open, event, day, startTime = '', categories, onClose, onSave, onDelete, onMark }: EventSheetProps) {
  const lang = locale();
  const [draft, setDraft] = useState<EventDraft>(() => initialDraft(event, day, startTime));
  const [choice, setChoice] = useState<string>(event?.categoryId && categories.some((c) => c.id === event.categoryId) ? event.categoryId : '');
  const [newCategory, setNewCategory] = useState<CategoryDraft>(() => emptyCategoryDraft(categories));
  const [problem, setProblem] = useState<EventRejection | null>(null);
  // Until the person picks weekdays, a weekly entry repeats on the weekday of its first day.
  const [weekdaysTouched, setWeekdaysTouched] = useState(event?.repeat.kind === 'weekly');

  const set = (patch: Partial<EventDraft>) => {
    setDraft({ ...draft, ...patch });
    setProblem(null);
  };
  const eventError = (...kinds: (keyof typeof EVENT_PROBLEM_KEY)[]) =>
    problem?.kind === 'event' && kinds.includes(problem.problem) ? t(EVENT_PROBLEM_KEY[problem.problem]) : null;
  const categoryError = problem?.kind === 'category' ? t(CATEGORY_PROBLEM_KEY[problem.problem]) : null;

  const chosen = categories.find((c) => c.id === choice) ?? null;
  const base = choice === NEW ? newCategory.importance : (chosen?.importance ?? 0);
  const total = Math.min(IMPORTANCE_MAX, base + draft.extraImportance);
  const level = importanceLevel(total);
  const start = draft.allDay ? null : parseClock(draft.start);
  const reminders = draft.date ? remindersFor({ day: draft.date, start, level }) : [];
  const repeating = event !== null && event.repeat.kind !== 'none';
  const mark = event?.marks[day] ?? null;

  const submit = () => {
    const categoryId = choice === NEW || choice === '' ? null : choice;
    setProblem(onSave({ ...draft, categoryId }, choice === NEW ? newCategory : null));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t(event ? 'calendar.editEvent' : 'calendar.newEvent')}
      footer={
        <Button type="submit" form={FORM_ID} variant="primary" size="lg" block>
          {t(event ? 'calendar.saveEvent' : 'calendar.addEvent')}
        </Button>
      }
    >
      {event && (
        <section class="cal-sheet__occurrence" aria-labelledby="cal-occurrence-title">
          <h3 id="cal-occurrence-title" class="cal-sheet__subtitle">
            {t('calendar.thisDay', { date: formatDayMonth(day, lang) })}
            {mark && <span class="cal-sheet__mark"> · {t(mark === 'done' ? 'calendar.done' : 'calendar.skipped')}</span>}
          </h3>
          <div class="cal-sheet__actions">
            {mark ? (
              <Button variant="secondary" onClick={() => onMark(event, day, null)}>
                {t('calendar.reopen')}
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => onMark(event, day, 'done')}>
                  <Check aria-hidden="true" />
                  {t('calendar.markDoneShort')}
                </Button>
                {repeating && (
                  <Button variant="quiet" onClick={() => onMark(event, day, 'skipped')}>
                    {t('calendar.skipDay')}
                  </Button>
                )}
              </>
            )}
          </div>
          <p class="cal-sheet__hint">{t('calendar.noPoints')}</p>
        </section>
      )}

      <form
        id={FORM_ID}
        class="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField
          label={t('calendar.title')}
          value={draft.title}
          onInput={(title) => set({ title })}
          placeholder={t('calendar.titlePh')}
          maxLength={EVENT_TITLE_MAX}
          error={eventError('titleRequired')}
        />

        <fieldset class="cal-pick">
          <legend class="ui-field__label">{t('calendar.category')}</legend>
          <div class="cal-pick__options">
            {[
              { id: '', name: t('calendar.noCategory'), color: null },
              ...sortedCategories(categories, lang).map((c) => ({ id: c.id, name: categoryLabel(c), color: c.color })),
              { id: NEW, name: t('calendar.newCategoryChoice'), color: null },
            ].map((option) => (
              <label key={option.id || 'none'} class="cal-pick__option">
                <input
                  class="cal-pick__input"
                  type="radio"
                  name="calendar-category"
                  value={option.id}
                  checked={choice === option.id}
                  onChange={() => {
                    setChoice(option.id);
                    setProblem(null);
                  }}
                />
                <span class="cal-pick__chip">
                  {option.color && <CategoryDot color={option.color} size="sm" />}
                  {option.id === NEW && <span aria-hidden="true">+ </span>}
                  <span class="user-text">{option.name}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {choice === NEW && (
          <div class="stack cal-new-category">
            <TextField
              label={t('calendar.categoryName')}
              value={newCategory.name}
              onInput={(name) => {
                setNewCategory({ ...newCategory, name });
                setProblem(null);
              }}
              placeholder={t('calendar.categoryNamePh')}
              maxLength={CATEGORY_NAME_MAX}
              error={categoryError}
            />
            <ColorPicker
              name="calendar-new-category-color"
              value={newCategory.color}
              onChange={(color) => setNewCategory({ ...newCategory, color })}
            />
            <Stepper
              label={t('calendar.categoryImportance')}
              value={newCategory.importance}
              min={0}
              max={CATEGORY_IMPORTANCE_MAX}
              valueText={t('calendar.pointsValue', { count: newCategory.importance })}
              onChange={(importance) => setNewCategory({ ...newCategory, importance })}
            />
          </div>
        )}

        <Stepper
          label={t('calendar.extraImportance')}
          value={draft.extraImportance}
          min={0}
          max={EXTRA_IMPORTANCE_MAX}
          valueText={t('calendar.pointsValue', { count: draft.extraImportance })}
          onChange={(extraImportance) => set({ extraImportance })}
          hint={
            <>
              <span class="cal-sheet__total" data-testid="calendar-importance">
                {t('calendar.importanceSum', { base, extra: draft.extraImportance, total, level: levelText(level) })}
              </span>{' '}
              {reminders.length > 0 && t('calendar.remindersPreview', { list: reminders.map((r) => reminderText(r.kind)).join(', ') })}
            </>
          }
        />

        <DateField
          label={t(draft.repeat === 'none' ? 'calendar.date' : 'calendar.firstDate')}
          value={draft.date}
          onChange={(date) => set(weekdaysTouched || !date ? { date } : { date, weekdays: [isoWeekday(date) as Weekday] })}
          error={eventError('dateRequired')}
        />

        <Switch label={t('calendar.allDay')} checked={draft.allDay} onChange={(allDay) => set({ allDay })} />
        {!draft.allDay && (
          <div class="cal-sheet__times">
            <TimeField
              label={t('calendar.from')}
              value={draft.start}
              onChange={(value) => set({ start: value })}
              error={eventError('startRequired')}
            />
            <TimeField
              label={t('calendar.toOptional')}
              value={draft.end}
              onChange={(value) => set({ end: value })}
              error={eventError('endBeforeStart')}
            />
          </div>
        )}

        <Select<RepeatKind>
          label={t('calendar.repeat')}
          value={draft.repeat}
          options={[
            { value: 'none', label: t('calendar.repeatNone') },
            { value: 'daily', label: t('calendar.repeatDaily') },
            { value: 'weekly', label: t('calendar.repeatWeekly') },
            { value: 'monthly', label: t('calendar.repeatMonthly') },
          ]}
          onChange={(repeat) => set({ repeat })}
          hint={draft.repeat === 'monthly' && Number(draft.date.slice(8)) > 28 ? t('calendar.monthEndHint') : undefined}
        />
        {draft.repeat === 'weekly' && (
          <fieldset class="cal-weekdays">
            <legend class="ui-field__label">{t('calendar.weekdays')}</legend>
            <div class="cal-weekdays__options">
              {WEEKDAYS.map((d) => (
                <FilterChip
                  key={d}
                  label={t(`calendar.weekdayShort.${d}`)}
                  selected={draft.weekdays.includes(d)}
                  onToggle={() => {
                    setWeekdaysTouched(true);
                    set({ weekdays: draft.weekdays.includes(d) ? draft.weekdays.filter((w) => w !== d) : [...draft.weekdays, d] });
                  }}
                />
              ))}
            </div>
            {eventError('weekdaysRequired') && (
              <p class="ui-field__error" role="alert">
                {eventError('weekdaysRequired')}
              </p>
            )}
          </fieldset>
        )}
        {draft.repeat !== 'none' && (
          <DateField
            label={t('calendar.until')}
            value={draft.until}
            min={draft.date}
            onChange={(until) => set({ until })}
            error={eventError('untilBeforeDate')}
          />
        )}
      </form>

      {event && (
        <div class="cal-sheet__delete">
          <Button variant="danger" onClick={() => onDelete(event)}>
            <Trash2 aria-hidden="true" />
            {t(repeating ? 'calendar.deleteSeries' : 'calendar.deleteEvent')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
