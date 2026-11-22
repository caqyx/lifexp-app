// Pieces the calendar's views share: a category's colour mark, a row of an agenda,
// the previous/next bar, the week strip and the colour picker of the sheets.
import { Check, ChevronLeft, ChevronRight } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { CATEGORY_COLORS, type CalendarCategory, type CategoryColor } from '@/domain/calendar/events';
import { levelRank, type ImportanceLevel } from '@/domain/calendar/importance';
import { itemSummary, type CalendarItem } from '@/domain/calendar/items';
import { locale, t } from '@/i18n';
import { MotionList } from '@/ui/components/Display';
import { formatDayMonth, formatWeekdayShort } from '@/lib/dates';
import { levelText, repeatText, timeText } from './texts';
import './calendar.css';

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

/** The colour of an item: its category's, or the accent for a task. */
export function itemColor(item: CalendarItem): string {
  return item.kind === 'task' ? 'var(--color-accent-text)' : paletteVar(item.occurrence.category?.color);
}

/** The line under an item's title. */
export function itemMeta(item: CalendarItem): string {
  if (item.kind === 'task') {
    const due = item.overdue ? t('calendar.taskOverdue', { date: formatDayMonth(item.task.dueDate ?? item.day, locale()) }) : null;
    return [t('calendar.task'), item.task.size, due, item.state === 'done' ? t('calendar.done') : null].filter(Boolean).join(' · ');
  }
  const o = item.occurrence;
  const meta = [timeText(o), o.category?.name, repeatText(o.event)].filter(Boolean).join(' · ');
  return item.state === 'skipped' ? `${t('calendar.skipped')} · ${meta}` : meta;
}

interface ItemRowProps {
  item: CalendarItem;
  onToggle: (item: CalendarItem) => void;
  onOpen: (item: CalendarItem) => void;
  /** The tick is busy (a task being completed). */
  busy?: boolean;
}

/**
 * One item in a list: the tick, the title with its time, category and repetition
 * (or "Zadanie", size and due date), and how important it is. More important rows
 * are drawn stronger (cal-imp--*). An entry's tick gives no points and can be
 * undone; a task's goes through the tasks service and is final, as in v1.
 */
export function ItemRow({ item, onToggle, onOpen, busy = false }: ItemRowProps) {
  const done = item.state === 'done';
  const skipped = item.state === 'skipped';
  const task = item.kind === 'task';
  return (
    <li
      class={`cal-row cal-imp--${item.level}${task ? ' cal-row--task' : ''}${done ? ' cal-row--done' : ''}${skipped ? ' cal-row--skipped' : ''}`}
      style={{ '--cat-color': itemColor(item) }}
    >
      {task && done ? (
        <span class="cal-check cal-check--done cal-check--static" aria-hidden="true">
          <Check />
        </span>
      ) : (
        <button
          type="button"
          class={`cal-check${done ? ' cal-check--done' : ''}${task ? ' cal-check--task' : ''}`}
          aria-pressed={task ? undefined : done}
          aria-busy={busy || undefined}
          disabled={busy}
          aria-label={t(task ? 'calendar.taskDone' : done ? 'calendar.markOpen' : 'calendar.markDone', { title: item.title })}
          onClick={() => onToggle(item)}
        >
          <Check aria-hidden="true" />
        </button>
      )}
      <button type="button" class="cal-row__body" onClick={() => onOpen(item)}>
        <span class="cal-row__title user-text clamp-2">{item.title}</span>
        <span class="cal-row__meta user-text clamp-1">{itemMeta(item)}</span>
      </button>
      <ImportanceTag level={item.level} />
    </li>
  );
}

/**
 * A list of items whose rows move (ui MotionList): they rise in one after another,
 * a ticked row that leaves fades out while the rest close the gap, a reordered one
 * glides to its new place.
 */
export function ItemList({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <MotionList class="cal-list" label={label}>
      {children}
    </MotionList>
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
      {/* The name starts with the visible word (WCAG 2.5.3), then says which period. */}
      <button type="button" class="cal-period__step" aria-label={t('calendar.stepLabel', { step: t('calendar.back'), period: prevLabel })} onClick={onPrev}>
        <ChevronLeft aria-hidden="true" />
        <span>{t('calendar.back')}</span>
      </button>
      <h2 class="cal-period__title" aria-live="polite">
        {title}
      </h2>
      <button
        type="button"
        class="cal-period__step cal-period__step--next"
        aria-label={t('calendar.stepLabel', { step: t('calendar.forward'), period: nextLabel })}
        onClick={onNext}
      >
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
  items: ReadonlyMap<string, readonly CalendarItem[]>;
  onSelect: (day: string) => void;
}

/** Seven days, Monday first: weekday, number and up to three marks; the chosen one filled. */
export function WeekStrip({ days, focus, today, items, onSelect }: WeekStripProps) {
  const lang = locale();
  return (
    <ol class="cal-strip" aria-label={t('calendar.weekDays')}>
      {days.map((day) => {
        const summary = itemSummary(items.get(day) ?? []);
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
                {summary.marks.map((item) => (
                  <ItemMark key={item.key} item={item} />
                ))}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** A day cell's mark of one item: round for an entry, square for a task, bigger when more important. */
export function ItemMark({ item }: { item: CalendarItem }) {
  return (
    <span
      class={`cal-mark cal-mark--${item.level}${item.kind === 'task' ? ' cal-mark--task' : ''}${item.state === 'done' ? ' cal-mark--done' : ''}`}
      style={{ '--cat-color': itemColor(item) }}
    />
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
