// The categories (#/calendar/categories): each with its colour, its own weight and
// how many entries use it; a tap opens it in the sheet, "Nowa kategoria" adds one.
import { Plus } from 'lucide-preact';
import { sortedCategories, type CalendarCategory, type CalendarEvent, CATEGORIES_MAX } from '@/domain/calendar/events';
import { locale, t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { EmptyState, List, ListRow } from '@/ui/components/Display';
import { Card } from '@/ui/components/Layout';
import { CategoryDot } from './parts';

interface CategoriesViewProps {
  categories: readonly CalendarCategory[];
  events: readonly CalendarEvent[];
  onOpen: (category: CalendarCategory) => void;
  onNew: () => void;
}

export function CategoriesView({ categories, events, onOpen, onNew }: CategoriesViewProps) {
  const uses = new Map<string, number>();
  for (const e of events) if (e.categoryId) uses.set(e.categoryId, (uses.get(e.categoryId) ?? 0) + 1);
  const list = sortedCategories(categories, locale());

  return (
    <div class="stack cal-view">
      <p class="cal-intro">{t('calendar.categoriesIntro')}</p>
      <div class="cal-head">
        <p class="cal-head__count numeric">{t('calendar.categoryCount', { count: list.length, max: CATEGORIES_MAX })}</p>
        <Button variant="primary" onClick={onNew} disabled={list.length >= CATEGORIES_MAX}>
          <Plus aria-hidden="true" />
          {t('calendar.newCategory')}
        </Button>
      </div>
      <Card padding={list.length === 0 ? 'md' : 'none'}>
        {list.length === 0 ? (
          <EmptyState title={t('calendar.categoriesEmpty')} />
        ) : (
          <List label={t('calendar.categoriesList')}>
            {list.map((c) => (
              <ListRow
                key={c.id}
                leading={<CategoryDot color={c.color} />}
                title={c.name}
                meta={t('calendar.categoryMeta', { importance: c.importance, count: uses.get(c.id) ?? 0 })}
                onClick={() => onOpen(c)}
              />
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}
