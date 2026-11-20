// Calendar use cases (docs/v2/PLAN.md 9.1, row c-1): the rules of domain/calendar,
// then one write (or one batch). Results come back at once with `saved`, which
// settles when the server has the write; offline it stays pending while the list
// already shows the change. Nothing here gives points or touches the balance,
// statistics or tasks: ticking an entry done only marks that day.
import {
  addCategory,
  addEvent,
  editCategory,
  editEvent,
  newCategoryId,
  newEventId,
  removeCategory,
  removeEvent,
  restoreCategory,
  restoreEvent,
  setMark,
  type NewCategory,
} from '@/data/repos/calendar';
import {
  canAddEvent,
  categoryProblem,
  categoryValues,
  eventProblem,
  eventValues,
  type CalendarCategory,
  type CalendarEvent,
  type CategoryDraft,
  type CategoryProblem,
  type EventDraft,
  type EventProblem,
  type OccurrenceMark,
} from '@/domain/calendar/events';

export type EventRejection =
  | { kind: 'event'; problem: EventProblem }
  | { kind: 'category'; problem: CategoryProblem }
  | { kind: 'limit' };

export type CalendarSaveResult = { ok: true; id: string; saved: Promise<void> } | { ok: false; problem: EventRejection };

export interface Undoable {
  saved: Promise<void>;
  undo: () => Promise<void>;
}

/** The draft's new category checked; with an id once it passes, and the entry pointing at it. */
function withNewCategory(
  uid: string,
  draft: EventDraft,
  category: CategoryDraft | null,
  categories: readonly CalendarCategory[],
): { ok: true; draft: EventDraft; category: NewCategory | null } | { ok: false; problem: EventRejection } {
  if (!category) return { ok: true, draft, category: null };
  const problem = categoryProblem(category, categories);
  if (problem) return { ok: false, problem: { kind: 'category', problem } };
  const id = newCategoryId(uid);
  return { ok: true, draft: { ...draft, categoryId: id }, category: { id, draft: categoryValues(category) } };
}

/** A new entry; `category` = a new category typed in the sheet, saved with it. */
export function createEvent(
  uid: string,
  draft: EventDraft,
  events: readonly CalendarEvent[],
  category: CategoryDraft | null,
  categories: readonly CalendarCategory[],
  now = new Date(),
): CalendarSaveResult {
  if (!canAddEvent(events)) return { ok: false, problem: { kind: 'limit' } };
  const problem = eventProblem(draft);
  if (problem) return { ok: false, problem: { kind: 'event', problem } };
  const checked = withNewCategory(uid, draft, category, categories);
  if (!checked.ok) return checked;
  const id = newEventId(uid);
  return { ok: true, id, saved: addEvent(uid, id, eventValues(checked.draft), now, checked.category) };
}

/** Changes the whole entry (every occurrence of a repeating one); marks stay. */
export function updateEvent(
  uid: string,
  id: string,
  draft: EventDraft,
  category: CategoryDraft | null,
  categories: readonly CalendarCategory[],
  now = new Date(),
): CalendarSaveResult {
  const problem = eventProblem(draft);
  if (problem) return { ok: false, problem: { kind: 'event', problem } };
  const checked = withNewCategory(uid, draft, category, categories);
  if (!checked.ok) return checked;
  return { ok: true, id, saved: editEvent(uid, id, eventValues(checked.draft), now, checked.category) };
}

/** The entry with all its occurrences; `undo` puts the same document back. */
export function deleteEvent(uid: string, event: CalendarEvent): Undoable {
  return { saved: removeEvent(uid, event.id), undo: () => restoreEvent(uid, event) };
}

/** One occurrence done, skipped or open again (null); `undo` restores the mark it had. */
export function markOccurrence(uid: string, event: CalendarEvent, day: string, mark: OccurrenceMark | null): Undoable {
  const before = event.marks[day] ?? null;
  return { saved: setMark(uid, event.id, day, mark), undo: () => setMark(uid, event.id, day, before) };
}

export function createCategory(
  uid: string,
  draft: CategoryDraft,
  categories: readonly CalendarCategory[],
  now = new Date(),
): { ok: true; id: string; saved: Promise<void> } | { ok: false; problem: CategoryProblem } {
  const problem = categoryProblem(draft, categories);
  if (problem) return { ok: false, problem };
  const id = newCategoryId(uid);
  return { ok: true, id, saved: addCategory(uid, id, categoryValues(draft), now) };
}

export function updateCategory(
  uid: string,
  id: string,
  draft: CategoryDraft,
  categories: readonly CalendarCategory[],
): { ok: true; id: string; saved: Promise<void> } | { ok: false; problem: CategoryProblem } {
  const problem = categoryProblem(draft, categories, id);
  if (problem) return { ok: false, problem };
  return { ok: true, id, saved: editCategory(uid, id, categoryValues(draft)) };
}

/** The category goes; its entries stay, without a category (and its weight), until it is back. */
export function deleteCategory(uid: string, category: CalendarCategory): Undoable {
  return { saved: removeCategory(uid, category.id), undo: () => restoreCategory(uid, category) };
}
