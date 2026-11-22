// The week (#/calendar/week): the strip of seven days, then each day's entries, the
// most important first. A tap on a day in the strip makes it the chosen day.
import type { CalendarItem } from '@/domain/calendar/items';
import { locale, t } from '@/i18n';
import { addDays, formatDayMonth, formatWeekdayLong, weekOf } from '@/lib/dates';
import { DayAgendaList, type ItemHandlers } from './DayAgendaList';
import { PeriodNav, WeekStrip } from './parts';

interface WeekViewProps extends ItemHandlers {
  focus: string;
  today: string;
  items: ReadonlyMap<string, readonly CalendarItem[]>;
  onFocus: (day: string) => void;
}

/** "16–22 listopada" or "30 listopada – 6 grudnia". */
export function weekTitle(days: readonly string[]): string {
  const lang = locale();
  const first = days[0] ?? '';
  const last = days[days.length - 1] ?? '';
  if (first.slice(0, 7) === last.slice(0, 7)) {
    return t('calendar.weekRangeSameMonth', { from: Number(first.slice(8)), to: formatDayMonth(last, lang) });
  }
  return t('calendar.weekRange', { from: formatDayMonth(first, lang), to: formatDayMonth(last, lang) });
}

export function WeekView({ focus, today, items, onFocus, ...handlers }: WeekViewProps) {
  const lang = locale();
  const days = weekOf(focus);

  return (
    <div class="stack cal-view">
      <PeriodNav
        title={weekTitle(days)}
        prevLabel={t('calendar.prevWeek')}
        nextLabel={t('calendar.nextWeek')}
        onPrev={() => onFocus(addDays(focus, -7))}
        onNext={() => onFocus(addDays(focus, 7))}
      />
      <WeekStrip days={days} focus={focus} today={today} items={items} onSelect={onFocus} />
      <div class="stack cal-week" key={days[0]}>
        {days.map((day) => (
          <section
            key={day}
            // A free day is one line ("Poniedziałek 16 listopada · Wolne."), not a heading and a row.
            class={`cal-week__day${day === focus ? ' cal-week__day--focus' : ''}${(items.get(day) ?? []).length === 0 ? ' cal-week__day--free' : ''}`}
            aria-labelledby={`cal-week-${day}`}
          >
            <h3 id={`cal-week-${day}`} class="cal-week__title">
              <span class="cal-week__weekday">{formatWeekdayLong(day, lang)}</span>{' '}
              <span class="cal-week__date">{formatDayMonth(day, lang)}</span>
              {day === today && <span class="cal-tag cal-tag--today">{t('calendar.today')}</span>}
            </h3>
            <DayAgendaList
              day={day}
              items={items.get(day) ?? []}
              {...handlers}
              empty={t('calendar.weekDayEmpty')}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
