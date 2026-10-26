// Today's gaming sessions, live, for the games list (stage g-1). The games screen
// starts the listener when it mounts and stops it when it leaves.
import { signal } from '@preact/signals';
import type { GamingSession } from '@/domain/gaming';

export interface GamingDayState {
  /** The UTC day being watched. */
  day: string | null;
  /** undefined = still loading. */
  sessions: readonly GamingSession[] | undefined;
  failed: boolean;
}

const EMPTY: GamingDayState = { day: null, sessions: undefined, failed: false };

export const gamingDay = signal<GamingDayState>(EMPTY);

export function watchGamingDay(uid: string, day: string): () => void {
  gamingDay.value = { ...EMPTY, day };
  let stopped = false;
  let stop: (() => void) | null = null;
  const fail = () => {
    if (!stopped) gamingDay.value = { ...gamingDay.value, failed: true };
  };
  void import('@/data/repos/gaming')
    .then((repo) => {
      if (stopped) return;
      stop = repo.watchGamingDay(
        uid,
        day,
        (sessions) => {
          if (!stopped) gamingDay.value = { day, sessions, failed: false };
        },
        fail,
      );
    })
    .catch(fail);
  return () => {
    stopped = true;
    stop?.();
  };
}
