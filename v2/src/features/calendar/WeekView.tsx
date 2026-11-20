// The week (#/calendar/week): the strip of seven days, then each day's entries, the
// most important first. A tap on a day in the strip makes it the chosen day.
import { byDay, type Occurrence } from '@/domain/calendar/agenda';
import { locale, t } from '@/i18n';
import { addDays, formatDayMonth, formatWeekdayLong, weekOf } from '@/lib/dates';
import { DayAgendaList } from './DayAgendaList';
import { PeriodNav, WeekStrip } from './parts';

interface WeekViewProps {
  focus: string;
  today: string;
  occurrences: readonly Occurrence[];
  onFocus: (day: string) => void;
  onToggle: (o: Occurrence) => void;
  onOpen: (o: Occurrence) => void;
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

export function WeekView({ focus, today, occurrences, onFocus, onToggle, onOpen }: WeekViewProps) {
  const lang = locale();
  const days = weekOf(focus);
  const grouped = byDay(occurrences);

  return (
    <div class="stack cal-view">
      <PeriodNav
        title={weekTitle(days)}
        prevLabel={t('calendar.prevWeek')}
        nextLabel={t('calendar.nextWeek')}
        onPrev={() => onFocus(addDays(focus, -7))}
        onNext={() => onFocus(addDays(focus, 7))}
      />
      <WeekStrip days={days} focus={focus} today={today} occurrences={grouped} onSelect={onFocus} />
      <div class="stack cal-week" key={days[0]}>
        {days.map((day) => (
          <section
            key={day}
            class={`cal-week__day${day === focus ? ' cal-week__day--focus' : ''}`}
            aria-labelledby={`cal-week-${day}`}
          >
            <h3 id={`cal-week-${day}`} class="cal-week__title">
              <span class="cal-week__weekday">{formatWeekdayLong(day, lang)}</span>{' '}
              <span class="cal-week__date">{formatDayMonth(day, lang)}</span>
              {day === today && <span class="cal-tag cal-tag--today">{t('calendar.today')}</span>}
            </h3>
            <DayAgendaList
              day={day}
              occurrences={grouped.get(day) ?? []}
              onToggle={onToggle}
              onOpen={onOpen}
              empty={t('calendar.weekDayEmpty')}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
