// One day's entries as a list, the most important first (domain compareOccurrences).
import { compareOccurrences, type Occurrence } from '@/domain/calendar/agenda';
import { locale, t } from '@/i18n';
import { formatDayMonth } from '@/lib/dates';
import { Card } from '@/ui/components/Layout';
import { OccurrenceList, OccurrenceRow } from './parts';

interface DayAgendaListProps {
  day: string;
  occurrences: readonly Occurrence[];
  onToggle: (o: Occurrence) => void;
  onOpen: (o: Occurrence) => void;
  /** Shown instead of the list for a day without entries. */
  empty?: string;
}

export function DayAgendaList({ day, occurrences, onToggle, onOpen, empty }: DayAgendaListProps) {
  if (occurrences.length === 0) {
    return <p class="cal-empty">{empty ?? t('calendar.dayEmpty')}</p>;
  }
  return (
    <Card padding="none">
      <OccurrenceList label={t('calendar.dayList', { date: formatDayMonth(day, locale()) })}>
        {[...occurrences].sort(compareOccurrences).map((o) => (
          <OccurrenceRow key={o.key} occurrence={o} onToggle={onToggle} onOpen={onOpen} />
        ))}
      </OccurrenceList>
    </Card>
  );
}
