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
/** Layers on their way out; while any is, taps are held off the page (ui/base.css). */
let leaving = 0;

function leave(delta: 1 | -1) {
  leaving += delta;
  document.documentElement.toggleAttribute('data-modal-closing', leaving > 0);
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
    if (entryId.current && topEntryId() === entryId.current) history.back();
    entryId.current = null;
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (dialog.open && dialog.dataset.state === 'open') return;
      // Opening, or opened again while the exit animation still runs (the
      // previous run's cleanup has stopped its close).
      dialog.dataset.state = 'open';
      if (!dialog.open) dialog.showModal();
      entryId.current = `m${++counter}`;
      history.pushState({ [HISTORY_KEY]: entryId.current }, '', location.href);
      return;
    }
    if (dialog.open && dialog.dataset.state === 'open') {
      dropEntry();
      dialog.dataset.state = 'closing';
      const duration = exitDuration(dialog);
      // close() lifts the inert page and gives the focus back at once. The layer
      // stays on screen for its exit: `transition: overlay, display … allow-discrete`
      // in its CSS holds it (and its backdrop) in the top layer until the animation
      // is over, where that is supported; elsewhere it just goes. Taps are held off
      // the page meanwhile (ui/base.css), so one lands nowhere, not on what slides past.
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
