// Waiting for a store that has not delivered yet (docs/v2/PLAN.md 6.6): a command
// never answers from data that has not loaded. Rejects when the store failed, or
// when `timeoutMs` passes (for data a seeding write is about to create).
import { effect } from '@preact/signals';
import type { TodaySources } from '@/stores/today';
import { today as todaySources } from '@/stores/today';
import { stats as statsSources, type StatsSources } from '@/stores/stats';
import type { Note } from '@/domain/notes';
import type { Task } from '@/domain/tasks';
import { notes } from '@/stores/notes';
import { tasks } from '@/stores/tasks';

export function waitFor<T>(pick: () => T | undefined, failed: () => boolean, timeoutMs = 0): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (done: () => void) => {
      settled = true;
      clearTimeout(timer);
      queueMicrotask(() => stop());
      done();
    };
    const stop = effect(() => {
      const value = pick();
      const bad = failed();
      if (settled || (value === undefined && !bad)) return;
      if (value !== undefined) finish(() => resolve(value));
      else finish(() => reject(new Error('load')));
    });
    if (timeoutMs > 0 && !settled) timer = setTimeout(() => finish(() => reject(new Error('timeout'))), timeoutMs);
  });
}

/** The task list once the listener has it; rejects when it cannot be read. */
export const loadedTasks = (): Promise<readonly Task[]> =>
  waitFor(
    () => tasks.value.list,
    () => tasks.value.failed,
  );

/** The notes once the listener has them; rejects when they cannot be read. */
export const loadedNotes = (): Promise<readonly Note[]> =>
  waitFor(
    () => notes.value.list,
    () => notes.value.failed,
  );

/** One part of Today's data (days, activity types, chores …) once the listener has it. */
export function loadedToday<K extends 'days' | 'activityDefs' | 'choreDefs' | 'choreEntries'>(key: K): Promise<NonNullable<TodaySources[K]>> {
  return waitFor(
    () => todaySources.value[key] as NonNullable<TodaySources[K]> | undefined,
    () => todaySources.value.failed,
  );
}

/** One part of the Stats data (days, the newest activities, their type names). */
export function loadedStats<K extends 'days' | 'latest' | 'activityNames'>(key: K): Promise<NonNullable<StatsSources[K]>> {
  return waitFor(
    () => statsSources.value[key] as NonNullable<StatsSources[K]> | undefined,
    () => statsSources.value.failed,
  );
}

/** How long a seeding write (v1's default types and chores) gets to show up in the listener. */
const SEED_WAIT_MS = 3000;

/**
 * The list once it has something in it. An empty list from the server may be an account
 * that was never seeded: `seed` writes v1's defaults, and the list is awaited again.
 */
export async function seeded<T>(list: Promise<readonly T[]>, again: () => readonly T[] | undefined, seed: () => Promise<void>): Promise<readonly T[]> {
  const first = await list;
  if (first.length > 0) return first;
  await seed();
  return waitFor(
    () => {
      const next = again();
      return next && next.length > 0 ? next : undefined;
    },
    () => todaySources.value.failed,
    SEED_WAIT_MS,
  ).catch(() => []);
}
