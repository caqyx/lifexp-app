// One live watch per account, shared by every screen (and Ex-us) that shows the same
// data. The listeners run while at least one of them watches and a moment longer:
// going back to a screen soon after leaving it finds its data still live, instead of
// a skeleton while Firestore registers the queries again and re-reads every document
// of them from its cache (docs/v2/PERF.md: ~300 ms of a phone's CPU for 150
// transactions). PLAN.md 4.5 still holds: nothing listens for a screen long after it.
import { session } from './session';

/**
 * How long listeners outlive their last watcher: long enough to look at another tab of
 * the tab bar and come back (before: 2 s, only for screens sharing a store).
 */
export const SCREEN_GRACE_MS = 30_000;

function signedInUid(): string | null {
  const current = session.peek();
  return current.status === 'signedIn' ? current.user.uid : null;
}

/**
 * Wraps `start` (starts the listeners for `uid`, returns their stop) into a shared
 * watch: call the result to start watching or join the watch already running, and
 * call what it returns to leave. `failed` tells whether the running watch has failed:
 * a screen that comes back then starts it afresh instead of showing the old error.
 */
export function sharedWatch(
  start: (uid: string) => () => void,
  graceMs: number,
  failed: () => boolean = () => false,
): (uid: string) => () => void {
  let active: { uid: string; watchers: number; stop: () => void } | null = null;
  const stopActive = () => {
    active?.stop();
    active = null;
  };
  return (uid) => {
    if (active && (active.uid !== uid || (active.watchers === 0 && failed()))) stopActive();
    if (!active) active = { uid, watchers: 0, stop: start(uid) };
    const mine = active;
    mine.watchers += 1;
    let left = false;
    return () => {
      if (left) return;
      left = true;
      mine.watchers -= 1;
      if (mine.watchers > 0 || active !== mine) return;
      // Signed out (or another account): nothing to come back to.
      if (signedInUid() !== mine.uid) return stopActive();
      setTimeout(() => {
        if (mine.watchers === 0 && active === mine) stopActive();
      }, graceMs);
    };
  };
}
