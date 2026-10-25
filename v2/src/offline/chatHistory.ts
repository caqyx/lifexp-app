// The Ex-us conversation on this device (docs/v2/PLAN.md 6.10): one IndexedDB record per
// account, cleared on sign-out. Storage can be missing or blocked (private mode): then
// there is simply no history, and nothing here throws.
import { parseHistory, type StoredMessage } from '@/domain/exus/history';

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
    return parseHistory(await withStore('readonly', (s) => s.get(uid)));
  } catch {
    return [];
  }
}

export async function saveChatHistory(uid: string, messages: readonly StoredMessage[]): Promise<void> {
  try {
    await withStore('readwrite', (s) => (messages.length > 0 ? s.put(messages, uid) : s.delete(uid)));
  } catch {
    // Storage blocked or full: the conversation just is not kept.
  }
}

/** Every account's conversation: what signing out leaves on the device is nothing. */
export async function clearChatHistory(): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.clear());
  } catch {
    // Nothing stored, or storage blocked.
  }
}
