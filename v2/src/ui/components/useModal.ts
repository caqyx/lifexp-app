// Shared behaviour of modal layers (Sheet, ConfirmDialog) on top of the native
// <dialog>: showModal() gives the focus trap, inert background, Escape and the
// top layer for free. On top of that:
// - opening adds a history entry, so the system Back closes the layer (PLAN.md 4.7);
// - closing ends the modal at once (the page is usable again: a message typed right
//   after a button of the layer is not lost) and plays the exit animation on the
//   closed dialog, which the CSS keeps in the top layer while it animates (taps
//   are held off the page until it is gone);
// - a dialog the browser closes by itself (Chrome on Android closes the top dialog
//   on Back through its close watcher, sometimes without a cancel event) reports
//   it to the parent, which would otherwise keep `open` true: the button that
//   opens it would then do nothing until the page was reloaded.
import { useEffect, useRef } from 'preact/hooks';

const HISTORY_KEY = 'lifexpModal';
let counter = 0;
/** Layers on their way out; while any is, a transparent guard takes the taps (ui/base.css). */
let leaving = 0;
let guard: HTMLElement | null = null;

/**
 * A real element, not `pointer-events: none` on the page: a tap on it is seen (and
 * a test or a script clicking the page waits until it is gone) instead of vanishing.
 */
function leave(delta: 1 | -1) {
  leaving += delta;
  if (leaving > 0 && !guard) {
    guard = document.createElement('div');
    guard.className = 'ui-modal-guard';
    document.body.append(guard);
  } else if (leaving <= 0 && guard) {
    guard.remove();
    guard = null;
  }
}

/**
 * `history.back()` is asynchronous: it lands after whatever the page does next. A layer
 * opened right after another closed would push its entry first, and the late Back would
 * then pop *that* entry and close the new layer at once. So our own Backs are tracked,
 * and a layer opened meanwhile pushes its entry only after the last one has landed.
 *
 * A Back can take well over a second on a loaded device (CI, 2026-10-25). The wait must
 * not end on a timer while the Back is still on its way, or the new entry is pushed and
 * the late Back takes it: so it ends only once the entry the Back takes off is no longer
 * on top (it landed, popstate or not), or after BACK_GIVE_UP_MS as a last resort.
 */
interface PendingBack {
  /** The modal entry that was on top when the Back was asked for. */
  from: string | null;
  since: number;
}
const pendingBacks: PendingBack[] = [];
const afterBacks = new Set<() => void>();
const BACK_CHECK_MS = 500;
const BACK_GIVE_UP_MS = 10_000;

function runAfterBacks() {
  if (pendingBacks.length > 0) return;
  const waiting = [...afterBacks];
  afterBacks.clear();
  for (const run of waiting) run();
}

function backLanded() {
  pendingBacks.shift();
  runAfterBacks();
}
addEventListener('popstate', backLanded);

function ourBack() {
  const back: PendingBack = { from: topEntryId(), since: Date.now() };
  pendingBacks.push(back);
  history.back();
  const check = () => {
    if (!pendingBacks.includes(back)) return;
    const onItsWay = topEntryId() === back.from && Date.now() - back.since < BACK_GIVE_UP_MS;
    if (onItsWay) {
      setTimeout(check, BACK_CHECK_MS);
      return;
    }
    pendingBacks.splice(pendingBacks.indexOf(back), 1);
    runAfterBacks();
  };
  setTimeout(check, BACK_CHECK_MS);
}

function whenBacksLanded(run: () => void) {
  if (pendingBacks.length === 0) run();
  else afterBacks.add(run);
}

function topEntryId(): string | null {
  const state: unknown = history.state;
  if (typeof state !== 'object' || state === null) return null;
  const id = (state as Record<string, unknown>)[HISTORY_KEY];
  return typeof id === 'string' ? id : null;
}

/** Longest exit animation of the dialog, in ms (0 with reduced motion). */
function exitDuration(dialog: HTMLElement): number {
  const style = getComputedStyle(dialog);
  const seconds = Math.max(...style.animationDuration.split(',').map((d) => parseFloat(d) || 0));
  return seconds * 1000;
}

/**
 * Wires a <dialog> to `open`. `onClose` is called for every way out the user
 * takes (Escape, Back, the component's own buttons call it themselves); the
 * parent then sets `open` to false.
 */
export function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const entryId = useRef<string | null>(null);
  /** The next `close` event is ours (end of the exit animation), not the browser's. */
  const closingOurselves = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /** Our history entry goes with the layer (Back already took it when Back closed it). */
  const dropEntry = () => {
    if (entryId.current && topEntryId() === entryId.current) ourBack();
    entryId.current = null;
  };
  /** Bumped by every open and close, so a push that waited for a Back knows whether it is still wanted. */
  const turn = useRef(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (dialog.open && dialog.dataset.state === 'open') return;
      // Opening, or opened again while the exit animation still runs (the
      // previous run's cleanup has stopped its close).
      dialog.dataset.state = 'open';
      if (!dialog.open) dialog.showModal();
      const mine = ++turn.current;
      whenBacksLanded(() => {
        if (turn.current !== mine) return;
        entryId.current = `m${++counter}`;
        history.pushState({ [HISTORY_KEY]: entryId.current }, '', location.href);
      });
      return;
    }
    if (dialog.open && dialog.dataset.state === 'open') {
      turn.current += 1;
      dropEntry();
      dialog.dataset.state = 'closing';
      const duration = exitDuration(dialog);
      // close() lifts the inert page and gives the focus back at once. The layer
      // stays on screen for its exit: `transition: overlay, display … allow-discrete`
      // in its CSS holds it (and its backdrop) in the top layer until the animation
      // is over, where that is supported; elsewhere it just goes. Taps are held off
      // the page meanwhile by a guard (ui/base.css), so one lands nowhere, not on what slides past.
      closingOurselves.current = true;
      dialog.close();
      leave(1);
      let ended = false;
      // Opened again while leaving: the cleanup runs at once and ends the hold.
      const timer = setTimeout(() => {
        if (dialog.dataset.state === 'closing') delete dialog.dataset.state;
        leave(-1);
        ended = true;
      }, duration);
      return () => {
        clearTimeout(timer);
        if (!ended) leave(-1);
      };
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    const onCancel = (e: Event) => {
      e.preventDefault(); // Escape: close through the parent, with the animation
      onCloseRef.current();
    };
    const onNativeClose = () => {
      if (closingOurselves.current) {
        closingOurselves.current = false;
        return;
      }
      // Closed by the browser, not by us: tidy up and tell the parent.
      if (dialog) delete dialog.dataset.state;
      dropEntry();
      onCloseRef.current();
    };
    const onPopState = () => {
      if (entryId.current && topEntryId() !== entryId.current) {
        entryId.current = null;
        onCloseRef.current();
      }
    };
    dialog?.addEventListener('cancel', onCancel);
    dialog?.addEventListener('close', onNativeClose);
    addEventListener('popstate', onPopState);
    return () => {
      dialog?.removeEventListener('cancel', onCancel);
      dialog?.removeEventListener('close', onNativeClose);
      removeEventListener('popstate', onPopState);
      // Unmounted while open (e.g. navigation): leave no dead history entry.
      turn.current += 1;
      if (entryId.current && topEntryId() === entryId.current) history.back();
    };
  }, []);

  return ref;
}

/**
 * Runs `fn` once no modal history entry is on top: at once, or after the Back
 * that a closing modal has just started. For a navigation that follows a
 * confirmation (e.g. leave a deleted note), so it replaces the screen's entry
 * and not the dialog's. Returns a cancel function.
 */
export function afterModalHistory(fn: () => void): () => void {
  if (topEntryId() === null) {
    fn();
    return () => {};
  }
  const onPopState = () => fn();
  addEventListener('popstate', onPopState, { once: true });
  return () => removeEventListener('popstate', onPopState);
}
