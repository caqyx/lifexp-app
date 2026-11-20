// Entries for the calendar's unit tests (not used by the app).
import type { CalendarEvent, Repeat } from './events';

export const repeat = (patch: Partial<Repeat> = {}): Repeat => ({ kind: 'none', weekdays: [], until: null, ...patch });

export function event(patch: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Spacer',
    categoryId: null,
    extraImportance: 0,
    date: '2026-11-20',
    start: null,
    end: null,
    repeat: repeat(),
    marks: {},
    createdAt: null,
    ...patch,
  };
}
