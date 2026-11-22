// The account's tasks, live (stage 3a). Shared by the screens that show them (Tasks,
// the calendar, Today's "Ważne dzisiaj"): the listener runs while at least one of
// them watches, one per account. The PC build comes with the profile (session).
import { signal } from '@preact/signals';
import type { Task } from '@/domain/tasks';
import { SCREEN_GRACE_MS, sharedWatch } from './shared';

export interface TasksState {
  /** undefined = still loading. */
  list: readonly Task[] | undefined;
  failed: boolean;
}

const EMPTY: TasksState = { list: undefined, failed: false };

export const tasks = signal<TasksState>(EMPTY);

function start(uid: string): () => void {
  tasks.value = EMPTY;
  let stopped = false;
  let stop: (() => void) | null = null;
  const fail = () => {
    if (!stopped) tasks.value = { ...tasks.value, failed: true };
  };
  void import('@/data/repos/tasks')
    .then((repo) => {
      if (stopped) return;
      stop = repo.watchTasks(
        uid,
        (list) => {
          if (!stopped) tasks.value = { list, failed: false };
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

/** Start watching (or join the watch already running); call the result to leave. */
export const watchTasks = sharedWatch(start, SCREEN_GRACE_MS, () => tasks.peek().failed);
