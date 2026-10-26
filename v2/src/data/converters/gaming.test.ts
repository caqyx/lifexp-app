import { describe, expect, test } from 'vitest';
import { gamingSessionFromData, newGamingSessionData } from './gaming';

describe('gamingSessions converter', () => {
  test('writes v1\'s fields and types', () => {
    const at = new Date('2026-10-26T15:00:00Z');
    const data = newGamingSessionData({ game: 'Wartime', duration: 12, date: '2026-10-26' }, at);
    expect(data).toEqual({ game: 'Wartime', duration: 12, date: '2026-10-26', timestamp: at });
    expect(Object.keys(data).sort()).toEqual(['date', 'duration', 'game', 'timestamp']);
  });

  test('reads what v1 writes, with defaults for loose data', () => {
    expect(gamingSessionFromData({ game: 'Minecraft', duration: 90, date: '2026-10-26' })).toEqual({
      game: 'Minecraft',
      duration: 90,
      date: '2026-10-26',
    });
    expect(gamingSessionFromData({ date: '2026-10-26' })).toEqual({ game: '', duration: 0, date: '2026-10-26' });
    expect(gamingSessionFromData({ game: 'x', duration: 5 })).toBeNull();
  });
});
