// users/{uid}/calendarEvents and users/{uid}/calendarCategories (docs/v2/PLAN.md 9.1,
// row c-1). New in v2, additive: v1 never reads them. Every write is a single write
// or a batch, so offline Firestore queues it and the listener shows it at once;
// the promises settle when the server has it.
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { CalendarCategory, CalendarEvent, CategoryDraft, EventValues, OccurrenceMark } from '@/domain/calendar/events';
import {
  categoryData,
  categoryFromData,
  categoryValuesData,
  eventData,
  eventFromData,
  eventValuesData,
  newCategoryData,
  newEventData,
} from '../converters/calendar';
import { db } from '../firebase';

type OnError = (error: unknown) => void;

const eventsOf = (uid: string) => collection(db, 'users', uid, 'calendarEvents');
const categoriesOf = (uid: string) => collection(db, 'users', uid, 'calendarCategories');

/** A category created together with an entry (the sheet's "Nowa kategoria"). */
export interface NewCategory {
  id: string;
  draft: CategoryDraft;
}

export function watchEvents(uid: string, onChange: (events: CalendarEvent[]) => void, onError: OnError) {
  return onSnapshot(eventsOf(uid), (snap) => onChange(snap.docs.map((d) => eventFromData(d.id, d.data()))), onError);
}

export function watchCategories(uid: string, onChange: (categories: CalendarCategory[]) => void, onError: OnError) {
  return onSnapshot(
    categoriesOf(uid),
    (snap) => onChange(snap.docs.map((d) => categoryFromData(d.id, d.data()))),
    onError,
  );
}

export const newEventId = (uid: string) => doc(eventsOf(uid)).id;
export const newCategoryId = (uid: string) => doc(categoriesOf(uid)).id;

/** The entry, and its new category in the same batch: one never exists without the other. */
export function addEvent(uid: string, id: string, values: EventValues, now: Date, category: NewCategory | null): Promise<void> {
  const batch = writeBatch(db);
  if (category) batch.set(doc(categoriesOf(uid), category.id), newCategoryData(category.draft, now));
  batch.set(doc(eventsOf(uid), id), newEventData(values, now));
  return batch.commit();
}

export function editEvent(uid: string, id: string, values: EventValues, now: Date, category: NewCategory | null): Promise<void> {
  const batch = writeBatch(db);
  if (category) batch.set(doc(categoriesOf(uid), category.id), newCategoryData(category.draft, now));
  batch.update(doc(eventsOf(uid), id), eventValuesData(values));
  return batch.commit();
}

export function removeEvent(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(eventsOf(uid), id));
}

/** Undo of a delete: the same document under the same id. */
export function restoreEvent(uid: string, event: CalendarEvent): Promise<void> {
  return setDoc(doc(eventsOf(uid), event.id), eventData(event));
}

/** One occurrence ticked, skipped, or back to open (null). Only that day's mark changes. */
export function setMark(uid: string, id: string, day: string, mark: OccurrenceMark | null): Promise<void> {
  return updateDoc(doc(eventsOf(uid), id), { [`marks.${day}`]: mark ?? deleteField() });
}

export function addCategory(uid: string, id: string, draft: CategoryDraft, now: Date): Promise<void> {
  return setDoc(doc(categoriesOf(uid), id), newCategoryData(draft, now));
}

export function editCategory(uid: string, id: string, draft: CategoryDraft): Promise<void> {
  return updateDoc(doc(categoriesOf(uid), id), categoryValuesData(draft));
}

/** The category goes; its entries stay and show without one. */
export function removeCategory(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(categoriesOf(uid), id));
}

export function restoreCategory(uid: string, category: CalendarCategory): Promise<void> {
  return setDoc(doc(categoriesOf(uid), category.id), categoryData(category));
}
