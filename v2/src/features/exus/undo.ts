// The Ex-us undo stack (docs/v2/PLAN.md 6.6): the last writes of this Ex-us
// session that know how to take themselves back, newest on top. /cofnij pops
// the top one; the toast "Cofnij" takes its own entry out by id, so the same
// write is never undone twice.

/** How a command takes itself back. */
export interface Undo {
  /** What /cofnij says it took back, e.g. the task „Kupić mleko”. */
  what: string;
  run: () => Promise<void>;
}

export const UNDO_MAX = 10;

export interface UndoEntry extends Undo {
  id: number;
}

export interface UndoStack {
  push: (undo: Undo) => UndoEntry;
  /** The newest entry, taken off the stack; null when empty. */
  pop: () => UndoEntry | null;
  /** This entry, taken off the stack; null once it is gone (undone or pushed out). */
  take: (id: number) => UndoEntry | null;
  /** Forgets every entry (a new conversation). */
  clear: () => void;
  readonly size: number;
}

export function createUndoStack(max = UNDO_MAX): UndoStack {
  let entries: UndoEntry[] = [];
  let nextId = 1;
  return {
    push(undo) {
      const entry = { ...undo, id: nextId++ };
      entries = [...entries, entry].slice(-max);
      return entry;
    },
    pop() {
      const entry = entries.at(-1) ?? null;
      entries = entries.slice(0, -1);
      return entry;
    },
    take(id) {
      const entry = entries.find((e) => e.id === id) ?? null;
      entries = entries.filter((e) => e.id !== id);
      return entry;
    },
    clear() {
      entries = [];
    },
    get size() {
      return entries.length;
    },
  };
}
