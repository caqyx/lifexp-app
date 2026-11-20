// Pieces the calendar's views share: a category's colour mark, a row of an agenda,
// the previous/next bar, the week strip and the colour picker of the sheets.
import { Check, ChevronLeft, ChevronRight } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { daySummary, type Occurrence } from '@/domain/calendar/agenda';
import { CATEGORY_COLORS, type CalendarCategory, type CategoryColor } from '@/domain/calendar/events';
import { levelRank, type ImportanceLevel } from '@/domain/calendar/importance';
import { locale, t } from '@/i18n';
import { formatDayMonth, formatWeekdayShort } from '@/lib/dates';
import { levelText, repeatText, timeText } from './texts';

/** The palette colour of a category as a CSS variable value (tokens.css --palette-*). */
export const paletteVar = (color: CategoryColor | null | undefined) =>
  color ? `var(--palette-${color})` : 'var(--color-text-tertiary)';

/** A small round mark in the category's colour; decorative, the name says it. */
export function CategoryDot({ color, size = 'md' }: { color: CategoryColor | null | undefined; size?: 'sm' | 'md' }) {
  return <span class={`cal-dot cal-dot--${size}`} style={{ '--cat-color': paletteVar(color) }} aria-hidden="true" />;
}

/** "Ważne" / "Bardzo ważne" as a tag; nothing for the lower levels. */
export function ImportanceTag({ level }: { level: ImportanceLevel }) {
  if (levelRank(level) < levelRank('high')) return null;
  return <span class={`cal-tag cal-tag--${level}`}>{levelText(level)}</span>;
}

interface OccurrenceRowProps {
  occurrence: Occurrence;
  onToggle: (o: Occurrence) => void;
  onOpen: (o: Occurrence) => void;
}

/**
 * One occurrence in a list: tick (done, no points), the title with its time,
 * category and repetition, and how important it is. More important rows are
 * drawn stronger (cal-imp--*).
 */
export function OccurrenceRow({ occurrence: o, onToggle, onOpen }: OccurrenceRowProps) {
  const title = o.event.title;
  const meta = [timeText(o), o.category?.name, repeatText(o.event)].filter(Boolean).join(' · ');
  const done = o.mark === 'done';
  const skipped = o.mark === 'skipped';
  return (
    <li
      class={`cal-row cal-imp--${o.level}${done ? ' cal-row--done' : ''}${skipped ? ' cal-row--skipped' : ''}`}
      style={{ '--cat-color': paletteVar(o.category?.color) }}
    >
      <button
        type="button"
        class={`cal-check${done ? ' cal-check--done' : ''}`}
        aria-pressed={done}
        aria-label={t(done ? 'calendar.markOpen' : 'calendar.markDone', { title })}
        onClick={() => onToggle(o)}
      >
        <Check aria-hidden="true" />
      </button>
      <button type="button" class="cal-row__body" onClick={() => onOpen(o)}>
        <span class="cal-row__title user-text clamp-2">{title}</span>
        <span class="cal-row__meta user-text clamp-1">
          {skipped ? `${t('calendar.skipped')} · ${meta}` : meta}
        </span>
      </button>
      <ImportanceTag level={o.level} />
    </li>
  );
}

export function OccurrenceList({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <ul class="cal-list" aria-label={label}>
      {children}
    </ul>
  );
}

interface PeriodNavProps {
  title: string;
  /** What "Wstecz"/"Dalej" lead to, for screen readers ("Poprzedni miesiąc"). */
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
}

/** ‹ Wstecz · the period · Dalej › */
export function PeriodNav({ title, prevLabel, nextLabel, onPrev, onNext }: PeriodNavProps) {
  return (
    <div class="cal-period">
      <button type="button" class="cal-period__step" aria-label={prevLabel} onClick={onPrev}>
        <ChevronLeft aria-hidden="true" />
        <span>{t('calendar.back')}</span>
      </button>
      <h2 class="cal-period__title" aria-live="polite">
        {title}
      </h2>
      <button type="button" class="cal-period__step cal-period__step--next" aria-label={nextLabel} onClick={onNext}>
        <span>{t('calendar.forward')}</span>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

interface WeekStripProps {
  days: readonly string[];
  focus: string;
  today: string;
  occurrences: ReadonlyMap<string, readonly Occurrence[]>;
  onSelect: (day: string) => void;
}

/** Seven days, Monday first: weekday, number and up to three marks; the chosen one filled. */
export function WeekStrip({ days, focus, today, occurrences, onSelect }: WeekStripProps) {
  const lang = locale();
  return (
    <ol class="cal-strip" aria-label={t('calendar.weekDays')}>
      {days.map((day) => {
        const summary = daySummary(occurrences.get(day) ?? []);
        const label = t('calendar.dayCell', { date: formatDayMonth(day, lang), count: summary.total });
        return (
          <li key={day}>
            <button
              type="button"
              class={`cal-strip__day${day === today ? ' cal-strip__day--today' : ''}${summary.top ? ` cal-top--${summary.top}` : ''}`}
              aria-pressed={day === focus}
              aria-label={label}
              onClick={() => onSelect(day)}
            >
              <span class="cal-strip__weekday" aria-hidden="true">
                {formatWeekdayShort(day, lang)}
              </span>
              <span class="cal-strip__num numeric" aria-hidden="true">
                {Number(day.slice(8))}
              </span>
              <span class="cal-marks" aria-hidden="true">
                {summary.marks.map((o) => (
                  <span key={o.key} class={`cal-mark cal-mark--${o.level}`} style={{ '--cat-color': paletteVar(o.category?.color) }} />
                ))}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

interface ColorPickerProps {
  value: CategoryColor;
  onChange: (color: CategoryColor) => void;
  name: string;
}

/** The palette as radios; the chosen colour named in the legend. */
export function ColorPicker({ value, onChange, name }: ColorPickerProps) {
  return (
    <fieldset class="cal-colors">
      <legend class="ui-field__label">
        {t('calendar.color')}: <span class="cal-colors__current">{t(`calendar.colors.${value}`)}</span>
      </legend>
      <div class="cal-colors__options">
        {CATEGORY_COLORS.map((color) => (
          <label key={color} class="cal-colors__option">
            <input
              class="cal-colors__input"
              type="radio"
              name={name}
              value={color}
              checked={color === value}
              onChange={() => onChange(color)}
            />
            <span class="cal-colors__swatch" style={{ '--cat-color': paletteVar(color) }} aria-hidden="true" />
            <span class="visually-hidden">{t(`calendar.colors.${color}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A category for a picker: its name and weight. */
export function categoryLabel(category: CalendarCategory): string {
  return category.importance > 0 ? `${category.name} (+${category.importance})` : category.name;
}
