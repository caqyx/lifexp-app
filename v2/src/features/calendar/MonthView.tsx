// The month (#/calendar): whole weeks from Monday, each day with marks of its most
// important entries in their categories' colours (bigger for more important ones),
// today ringed, and the chosen day's agenda under the grid.
import { byDay, daySummary, inMonth, monthGrid, type Occurrence } from '@/domain/calendar/agenda';
import { locale, t } from '@/i18n';
import { addMonths, formatDayKey, formatDayMonth, formatMonthKey, formatWeekdayShort, monthKeyOfDay } from '@/lib/dates';
import { Button } from '@/ui/components/Button';
import { Card } from '@/ui/components/Layout';
import { DayAgendaList } from './DayAgendaList';
import { PeriodNav, paletteVar } from './parts';

interface MonthViewProps {
  focus: string;
  today: string;
  occurrences: readonly Occurrence[];
  onFocus: (day: string) => void;
  onToggle: (o: Occurrence) => void;
  onOpen: (o: Occurrence) => void;
  onAdd: (day: string) => void;
}

/** The same day of another month, or its last day when that month is shorter. */
function shiftMonth(day: string, months: number): string {
  const month = addMonths(monthKeyOfDay(day), months);
  const grid = monthGrid(month);
  const wanted = `${month}-${day.slice(8)}`;
  return wanted > grid.last ? grid.last : wanted;
}

export function MonthView({ focus, today, occurrences, onFocus, onToggle, onOpen, onAdd }: MonthViewProps) {
  const lang = locale();
  const monthKey = monthKeyOfDay(focus);
  const grid = monthGrid(monthKey);
  const days = byDay(occurrences);
  const chosen = days.get(focus) ?? [];

  return (
    <div class="stack cal-view">
      <Card padding="sm">
        <PeriodNav
          title={formatMonthKey(monthKey, lang)}
          prevLabel={t('calendar.prevMonth')}
          nextLabel={t('calendar.nextMonth')}
          onPrev={() => onFocus(shiftMonth(focus, -1))}
          onNext={() => onFocus(shiftMonth(focus, 1))}
        />
        <div class="cal-month" key={monthKey}>
          <div class="cal-month__weekdays" aria-hidden="true">
            {(grid.weeks[0] ?? []).map((day) => (
              <span key={day}>{formatWeekdayShort(day, lang)}</span>
            ))}
          </div>
          <ol class="cal-month__grid" aria-label={t('calendar.monthGrid', { month: formatMonthKey(monthKey, lang) })}>
            {grid.weeks.flat().map((day) => {
              const summary = daySummary(days.get(day) ?? []);
              const cls = [
                'cal-month__day',
                inMonth(day, monthKey) ? '' : 'cal-month__day--outside',
                day === today ? 'cal-month__day--today' : '',
                summary.top ? `cal-top--${summary.top}` : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <li key={day}>
                  <button
                    type="button"
                    class={cls}
                    aria-pressed={day === focus}
                    aria-label={t('calendar.dayCell', { date: formatDayMonth(day, lang), count: summary.total })}
                    onClick={() => onFocus(day)}
                  >
                    <span class="cal-month__num numeric" aria-hidden="true">
                      {Number(day.slice(8))}
                    </span>
                    <span class="cal-marks" aria-hidden="true">
                      {summary.marks.map((o) => (
                        <span
                          key={o.key}
                          class={`cal-mark cal-mark--${o.level}${o.mark === 'done' ? ' cal-mark--done' : ''}`}
                          style={{ '--cat-color': paletteVar(o.category?.color) }}
                        />
                      ))}
                    </span>
                    {summary.more > 0 && (
                      <span class="cal-month__more numeric" aria-hidden="true">
                        +{summary.more}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>

      <section class="cal-day-panel" aria-labelledby="cal-chosen-day" key={focus}>
        <div class="cal-day-panel__head">
          <h2 id="cal-chosen-day" class="cal-day-panel__title">
            {focus === today ? t('calendar.todayTitle', { date: formatDayKey(focus, lang) }) : formatDayKey(focus, lang)}
          </h2>
          <Button variant="quiet" onClick={() => onAdd(focus)}>
            {t('calendar.addHere')}
          </Button>
        </div>
        <DayAgendaList day={focus} occurrences={chosen} onToggle={onToggle} onOpen={onOpen} />
      </section>
    </div>
  );
}
