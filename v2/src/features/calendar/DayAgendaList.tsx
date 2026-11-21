// One day's entries and tasks as a list, the most important first (domain compareItems).
import { compareItems, type CalendarItem } from '@/domain/calendar/items';
import { locale, t } from '@/i18n';
import { formatDayMonth } from '@/lib/dates';
import { Card } from '@/ui/components/Layout';
import { ItemList, ItemRow } from './parts';

export interface ItemHandlers {
  onToggle: (item: CalendarItem) => void;
  onOpen: (item: CalendarItem) => void;
  /** Tasks whose tick is being saved. */
  busy: ReadonlySet<string>;
}

interface DayAgendaListProps extends ItemHandlers {
  day: string;
  items: readonly CalendarItem[];
  /** Shown instead of the list for a day without items. */
  empty?: string;
}

export function DayAgendaList({ day, items, onToggle, onOpen, busy, empty }: DayAgendaListProps) {
  if (items.length === 0) {
    return <p class="cal-empty">{empty ?? t('calendar.dayEmpty')}</p>;
  }
  return (
    <Card padding="none">
      <ItemList label={t('calendar.dayList', { date: formatDayMonth(day, locale()) })}>
        {[...items].sort(compareItems).map((item) => (
          <ItemRow key={item.key} item={item} onToggle={onToggle} onOpen={onOpen} busy={busy.has(item.key)} />
        ))}
      </ItemList>
    </Card>
  );
}
