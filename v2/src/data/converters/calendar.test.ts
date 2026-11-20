import { describe, expect, test } from 'vitest';
import { categoryFromData, eventData, eventFromData, newCategoryData, newEventData } from './calendar';

describe('calendar converters', () => {
  test('an entry round-trips through its document', () => {
    const now = new Date('2026-11-20T10:00:00Z');
    const data = newEventData(
      {
        title: 'Spacer',
        categoryId: 'c1',
        extraImportance: 2,
        date: '2026-11-16',
        start: 18 * 60,
        end: 19 * 60,
        repeat: { kind: 'weekly', weekdays: [1, 3, 5], until: null },
      },
      now,
    );
    expect(data).toEqual({
      title: 'Spacer',
      categoryId: 'c1',
      extraImportance: 2,
      date: '2026-11-16',
      startTime: '18:00',
      endTime: '19:00',
      repeat: 'weekly',
      weekdays: [1, 3, 5],
      repeatUntil: '',
      marks: {},
      createdAt: '2026-11-20T10:00:00.000Z',
    });
    const event = eventFromData('e1', { ...data, marks: { '2026-11-16': 'done' } });
    expect(event).toEqual({
      id: 'e1',
      title: 'Spacer',
      categoryId: 'c1',
      extraImportance: 2,
      date: '2026-11-16',
      start: 1080,
      end: 1140,
      repeat: { kind: 'weekly', weekdays: [1, 3, 5], until: null },
      marks: { '2026-11-16': 'done' },
      createdAt: now,
    });
    expect(eventData(event)).toEqual({ ...data, marks: { '2026-11-16': 'done' } });
  });

  test('missing and odd fields get defaults, never an error', () => {
    expect(eventFromData('x', { createdAt: '2026-11-02T09:00:00Z' })).toEqual({
      id: 'x',
      title: '',
      categoryId: null,
      extraImportance: 0,
      date: '2026-11-02',
      start: null,
      end: null,
      repeat: { kind: 'none', weekdays: [], until: null },
      marks: {},
      createdAt: new Date('2026-11-02T09:00:00Z'),
    });
    const odd = eventFromData('y', {
      date: '2026-11-20',
      categoryId: '',
      extraImportance: 42,
      startTime: '25:00',
      endTime: '10:00',
      repeat: 'yearly',
      weekdays: [9, 1, 1],
      repeatUntil: '2026-12-01',
      marks: { '2026-11-20': 'done', nope: 'done', '2026-11-21': 'maybe' },
    });
    expect(odd).toMatchObject({
      categoryId: null,
      extraImportance: 5,
      start: null,
      end: null,
      repeat: { kind: 'none', weekdays: [], until: null },
      marks: { '2026-11-20': 'done' },
    });
    expect(eventFromData('z', { date: '2026-11-20', startTime: '18:00', endTime: '17:00' }).end).toBeNull();
    expect(eventFromData('w', { date: '2026-11-20', repeat: 'weekly', weekdays: [5, 1, 1, 9] }).repeat.weekdays).toEqual([1, 5]);
  });

  test('a category with defaults; an unknown colour is the first of the palette', () => {
    expect(newCategoryData({ name: 'Aktywność fizyczna', color: 'green', importance: 2 }, new Date('2026-11-20T10:00:00Z'))).toEqual({
      name: 'Aktywność fizyczna',
      color: 'green',
      importance: 2,
      createdAt: '2026-11-20T10:00:00.000Z',
    });
    expect(categoryFromData('c', { name: 'X', color: '#ff0000', importance: 'a lot' })).toEqual({
      id: 'c',
      name: 'X',
      color: 'violet',
      importance: 0,
      createdAt: null,
    });
  });
});
