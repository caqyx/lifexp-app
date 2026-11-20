// A new or changed calendar category: name, colour from the theme's palette and its
// own weight, which every entry of the category starts from (domain/calendar).
import { Trash2 } from 'lucide-preact';
import { useState } from 'preact/hooks';
import {
  CATEGORY_IMPORTANCE_MAX,
  CATEGORY_NAME_MAX,
  emptyCategoryDraft,
  type CalendarCategory,
  type CategoryDraft,
  type CategoryProblem,
} from '@/domain/calendar/events';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { Stepper, TextField } from '@/ui/components/Fields';
import { Sheet } from '@/ui/components/Sheet';
import { ColorPicker } from './parts';

const FORM_ID = 'calendar-category-form';

const PROBLEM_KEY = {
  nameRequired: 'calendar.needCategoryName',
  nameTaken: 'calendar.categoryTaken',
  limit: 'calendar.categoryLimit',
} as const;

interface CategorySheetProps {
  open: boolean;
  category: CalendarCategory | null;
  categories: readonly CalendarCategory[];
  onClose: () => void;
  onSave: (draft: CategoryDraft) => CategoryProblem | null;
  onDelete: (category: CalendarCategory) => void;
}

export function CategorySheet({ open, category, categories, onClose, onSave, onDelete }: CategorySheetProps) {
  const [draft, setDraft] = useState<CategoryDraft>(() =>
    category ? { name: category.name, color: category.color, importance: category.importance } : emptyCategoryDraft(categories),
  );
  const [problem, setProblem] = useState<CategoryProblem | null>(null);
  const set = (patch: Partial<CategoryDraft>) => {
    setDraft({ ...draft, ...patch });
    setProblem(null);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t(category ? 'calendar.editCategory' : 'calendar.newCategory')}
      footer={
        <Button type="submit" form={FORM_ID} variant="primary" size="lg" block>
          {t(category ? 'calendar.saveCategory' : 'calendar.addCategory')}
        </Button>
      }
    >
      <form
        id={FORM_ID}
        class="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setProblem(onSave(draft));
        }}
      >
        <TextField
          label={t('calendar.categoryName')}
          value={draft.name}
          onInput={(name) => set({ name })}
          placeholder={t('calendar.categoryNamePh')}
          maxLength={CATEGORY_NAME_MAX}
          error={problem ? t(PROBLEM_KEY[problem]) : null}
        />
        <ColorPicker name="calendar-category-color" value={draft.color} onChange={(color) => set({ color })} />
        <Stepper
          label={t('calendar.categoryImportance')}
          value={draft.importance}
          min={0}
          max={CATEGORY_IMPORTANCE_MAX}
          valueText={t('calendar.pointsValue', { count: draft.importance })}
          onChange={(importance) => set({ importance })}
          hint={t('calendar.categoryImportanceHint')}
        />
      </form>
      {category && (
        <div class="cal-sheet__delete">
          <Button variant="danger" onClick={() => onDelete(category)}>
            <Trash2 aria-hidden="true" />
            {t('calendar.deleteCategory')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
