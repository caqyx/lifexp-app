// The account's tasks, live (stage 3a). Shared by the screens that show them (Tasks,
// the calendar, Today's "Ważne dzisiaj"): the listener runs while at least one of
// them watches, one per account. The PC build comes with the profile (session).
import { signal } from '@preact/signals';
import type { Task } from '@/domain/tasks';

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

/** How long the listeners outlive their last watcher. */
const LEAVE_GRACE_MS = 2000;

let active: { uid: string; watchers: number; stop: () => void } | null = null;

/** Start watching (or join the watch already running); call the result to leave. */
export function watchTasks(uid: string): () => void {
  if (active && active.uid !== uid) {
    active.stop();
    active = null;
  }
  if (!active) active = { uid, watchers: 0, stop: start(uid) };
  const mine = active;
  mine.watchers += 1;
  let left = false;
  return () => {
    if (left) return;
    left = true;
    mine.watchers -= 1;
    // A moment's grace: moving between two screens that both watch keeps the data.
    setTimeout(() => {
      if (mine.watchers === 0 && active === mine) {
        mine.stop();
        active = null;
      }
    }, LEAVE_GRACE_MS);
  };
}
