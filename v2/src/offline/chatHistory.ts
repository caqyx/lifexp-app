// The Ex-us conversation on this device (docs/v2/PLAN.md 6.10): one IndexedDB record per
// account, cleared on sign-out. Storage can be missing or blocked (private mode): then
// there is simply no history, and nothing here throws.
import { parseHistory, type StoredMessage } from '@/domain/exus/history';
import { createSerial } from '@/lib/serial';

const DB_NAME = 'lifexp-v2-exus';
const STORE = 'history';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Every read and write goes through one queue. Each runs on its own connection and
 * transaction, so two started close together could commit in either order: an older save
 * finishing late would bring back a conversation that /nowy or signing out just cleared.
 * Queued, they land in the order they were made, and a clear waits for the saves before it.
 */
const inOrder = createSerial();

/** Runs one request on the store; resolves to its result and always closes the connection. */
async function withStore(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
  const db = await open();
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadChatHistory(uid: string): Promise<StoredMessage[]> {
  try {
    return parseHistory(await inOrder(() => withStore('readonly', (s) => s.get(uid))));
  } catch {
    return [];
  }
}

/** Saves not yet started, per account: a newer save replaces the list of one still waiting in the queue. */
const waiting = new Map<string, { messages: readonly StoredMessage[]; done: Promise<void> }>();

export function saveChatHistory(uid: string, messages: readonly StoredMessage[]): Promise<void> {
  // Copied now: the caller's list moves on.
  const kept = [...messages];
  const queued = waiting.get(uid);
  if (queued) {
    // A burst of messages is one write of the newest list, not one per message.
    queued.messages = kept;
    return queued.done;
  }
  const entry = { messages: kept, done: Promise.resolve() };
  waiting.set(uid, entry);
  entry.done = inOrder(async () => {
    if (waiting.get(uid) === entry) waiting.delete(uid);
    await withStore('readwrite', (s) => (entry.messages.length > 0 ? s.put([...entry.messages], uid) : s.delete(uid)));
  }).catch(() => {
    // Storage blocked or full: the conversation just is not kept.
  });
  return entry.done;
}

/** Every account's conversation: what signing out leaves on the device is nothing. */
export async function clearChatHistory(): Promise<void> {
  // A save made after this must not merge into one queued before it, or the clear would wipe it.
  waiting.clear();
  try {
    await inOrder(() => withStore('readwrite', (s) => s.clear()));
  } catch {
    // Nothing stored, or storage blocked.
  }
}
