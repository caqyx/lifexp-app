// The day (#/calendar/day): the week strip to move between days, the all-day row,
// and a timeline of the hours with each timed entry as a block (overlapping ones
// side by side, domain layoutTimeline). Today shows a line at the current time.
import { useEffect, useRef, useState } from 'preact/hooks';
import { byDay, dayAgenda, layoutTimeline, type Occurrence } from '@/domain/calendar/agenda';
import { locale, t } from '@/i18n';
import { addDays, formatClock, formatDayKey, weekOf } from '@/lib/dates';
import { DayAgendaList } from './DayAgendaList';
import { ImportanceTag, PeriodNav, WeekStrip, paletteVar } from './parts';
import { timeText } from './texts';

interface DayViewProps {
  focus: string;
  today: string;
  /** The occurrences of the focus day's week. */
  occurrences: readonly Occurrence[];
  onFocus: (day: string) => void;
  onToggle: (o: Occurrence) => void;
  onOpen: (o: Occurrence) => void;
}

/** Blocks shorter than this (minutes) put the title and the time on one line. */
const SHORT_BLOCK = 55;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
/** Where the timeline opens when the day has nothing timed: the morning. */
const DEFAULT_SCROLL_HOUR = 7;

function minutesNow(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function Timeline({ day, today, timed, onOpen }: { day: string; today: string; timed: readonly Occurrence[]; onOpen: (o: Occurrence) => void }) {
  const lang = locale();
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(minutesNow);
  const blocks = layoutTimeline(timed);
  const first = blocks[0]?.top;

  useEffect(() => {
    if (day !== today) return;
    const timer = setInterval(() => setNow(minutesNow()), 60_000);
    return () => clearInterval(timer);
  }, [day, today]);

  // Open at the first entry (or the morning), not at midnight; this is where the view starts, not a move.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const hourPx = el.scrollHeight / 24;
    const target = first !== undefined ? first / 60 - 0.5 : day === today ? now / 60 - 1 : DEFAULT_SCROLL_HOUR;
    el.scrollTop = Math.max(0, target * hourPx);
  }, [day]);

  return (
    <div class="cal-timeline" ref={scroller} role="region" aria-label={t('calendar.timeline')} tabIndex={0}>
      <div class="cal-timeline__hours">
        {HOURS.map((h) => (
          <div key={h} class="cal-timeline__hour">
            <span class="cal-timeline__label numeric">{h === 0 ? '' : formatClock(h * 60, lang)}</span>
          </div>
        ))}
        {day === today && (
          <div class="cal-timeline__now" style={{ '--now': String(now) }} aria-hidden="true" />
        )}
        <ol class="cal-timeline__blocks" aria-label={t('calendar.timedList')}>
          {blocks.map((b) => {
            const o = b.occurrence;
            return (
              <li
                key={o.key}
                class={`cal-block cal-imp--${o.level}${o.mark ? ` cal-block--${o.mark}` : ''}${b.length < SHORT_BLOCK ? ' cal-block--short' : ''}`}
                style={{
                  '--top': String(b.top),
                  '--length': String(b.length),
                  '--col': String(b.column),
                  '--cols': String(b.columns),
                  '--cat-color': paletteVar(o.category?.color),
                }}
              >
                <button type="button" class="cal-block__button" onClick={() => onOpen(o)}>
                  <span class="cal-block__title user-text clamp-2">{o.event.title}</span>
                  <span class="cal-block__meta numeric">
                    {timeText(o)}
                    {o.mark === 'done' ? ` · ${t('calendar.done')}` : o.mark === 'skipped' ? ` · ${t('calendar.skipped')}` : ''}
                  </span>
                  <ImportanceTag level={o.level} />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export function DayView({ focus, today, occurrences, onFocus, onToggle, onOpen }: DayViewProps) {
  const lang = locale();
  const grouped = byDay(occurrences);
  const { allDay, timed } = dayAgenda(grouped.get(focus) ?? []);

  return (
    <div class="stack cal-view">
      <PeriodNav
        title={focus === today ? t('calendar.todayTitle', { date: formatDayKey(focus, lang) }) : formatDayKey(focus, lang)}
        prevLabel={t('calendar.prevDay')}
        nextLabel={t('calendar.nextDay')}
        onPrev={() => onFocus(addDays(focus, -1))}
        onNext={() => onFocus(addDays(focus, 1))}
      />
      <WeekStrip days={weekOf(focus)} focus={focus} today={today} occurrences={grouped} onSelect={onFocus} />
      <div class="stack cal-day" key={focus}>
        <section aria-labelledby="cal-all-day">
          <h3 id="cal-all-day" class="cal-week__title">
            {t('calendar.allDayRow')}
          </h3>
          <DayAgendaList day={focus} occurrences={allDay} onToggle={onToggle} onOpen={onOpen} empty={t('calendar.allDayEmpty')} />
        </section>
        <section aria-labelledby="cal-hours">
          <h3 id="cal-hours" class="cal-week__title">
            {t('calendar.hours')}
          </h3>
          {timed.length === 0 && <p class="cal-empty">{t('calendar.timedEmpty')}</p>}
          <Timeline day={focus} today={today} timed={timed} onOpen={onOpen} />
        </section>
      </div>
    </div>
  );
}
