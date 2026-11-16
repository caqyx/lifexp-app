// The reader's books on this device (docs/v2/PLAN.md 9.1 row "r"): IndexedDB only —
// nothing goes to Firestore or Storage. Meta (title, position) and content (the
// text) are separate stores, so the library reads only the small part; the reader's
// settings sit next to them. Where IndexedDB is missing or blocked (some private
// modes) the books live in memory until the page closes, and `persistent` says so.
import type { BookContent, BookMeta } from '@/domain/reader/book';

const DB_NAME = 'lifexp-v2-reader';
const META = 'meta';
const CONTENT = 'content';
const SETTINGS = 'settings';
const SETTINGS_KEY = 'reader';
/** Pictures of the books' elements (r-5): key "<book id>:<n>" → Blob. */
const ASSETS = 'assets';
/** The original file of a book, kept for the PDF "Oryginał" view (r-6): key = book id → Blob. */
const FILES = 'files';

interface Backend {
  persistent: boolean;
  db: IDBDatabase | null;
}

const mem = {
  meta: new Map<string, BookMeta>(),
  content: new Map<string, BookContent>(),
  settings: undefined as unknown,
  assets: new Map<string, Blob>(),
  files: new Map<string, Blob>(),
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      // 1: books and settings; 2: pictures of elements and original files.
      if (e.oldVersion < 1) {
        db.createObjectStore(META, { keyPath: 'id' });
        db.createObjectStore(CONTENT, { keyPath: 'id' });
        db.createObjectStore(SETTINGS);
      }
      if (e.oldVersion < 2) {
        db.createObjectStore(ASSETS);
        db.createObjectStore(FILES);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}

let backend: Promise<Backend> | null = null;

/** Opens the store once; never rejects (falls back to memory). */
function ready(): Promise<Backend> {
  backend ??= openDb()
    .then((db): Backend => {
      // Another tab upgrading later must not wait on this connection.
      db.onversionchange = () => db.close();
      return { persistent: true, db };
    })
    .catch((): Backend => ({ persistent: false, db: null }));
  return backend;
}

export async function openReaderLibrary(): Promise<{ persistent: boolean }> {
  return { persistent: (await ready()).persistent };
}

async function run<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const { db } = await ready();
  if (!db) throw new Error('no IndexedDB');
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = op(tx.objectStore(store));
    tx.oncomplete = () => resolve((request ? request.result : undefined) as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function persistent(): Promise<boolean> {
  return (await openReaderLibrary()).persistent;
}

export async function listBookMeta(): Promise<BookMeta[]> {
  if (!(await persistent())) return [...mem.meta.values()];
  return run<BookMeta[]>(META, 'readonly', (s) => s.getAll());
}

export async function getBook(id: string): Promise<{ meta: BookMeta; content: BookContent } | null> {
  if (!(await persistent())) {
    const meta = mem.meta.get(id);
    const content = mem.content.get(id);
    return meta && content ? { meta, content } : null;
  }
  const [meta, content] = await Promise.all([
    run<BookMeta | undefined>(META, 'readonly', (s) => s.get(id)),
    run<BookContent | undefined>(CONTENT, 'readonly', (s) => s.get(id)),
  ]);
  return meta && content ? { meta, content } : null;
}

export async function putBookMeta(meta: BookMeta): Promise<void> {
  if (!(await persistent())) return void mem.meta.set(meta.id, meta);
  await run(META, 'readwrite', (s) => s.put(meta));
}

/** Content first, then meta: a book is listed only once its text is stored. */
export async function putBook(meta: BookMeta, content: BookContent): Promise<void> {
  if (!(await persistent())) {
    mem.meta.set(meta.id, meta);
    mem.content.set(meta.id, content);
    return;
  }
  await run(CONTENT, 'readwrite', (s) => s.put(content));
  await run(META, 'readwrite', (s) => s.put(meta));
}

export async function removeBook(id: string): Promise<void> {
  if (!(await persistent())) {
    mem.meta.delete(id);
    mem.content.delete(id);
    await removeBookFiles(id);
    return;
  }
  await run(META, 'readwrite', (s) => s.delete(id));
  await run(CONTENT, 'readwrite', (s) => s.delete(id));
  await removeBookFiles(id);
}

/** The stored settings as they were saved (domain/reader/settings normalizes them). */
export async function readReaderSettings(): Promise<unknown> {
  if (!(await persistent())) return mem.settings;
  return run<unknown>(SETTINGS, 'readonly', (s) => s.get(SETTINGS_KEY));
}

export async function writeReaderSettings(settings: object): Promise<void> {
  if (!(await persistent())) {
    mem.settings = { ...settings };
    return;
  }
  await run(SETTINGS, 'readwrite', (s) => s.put({ ...settings }, SETTINGS_KEY));
}

/** Every key of a book's pictures starts with its id and a colon. */
const assetRange = (bookId: string) => IDBKeyRange.bound(`${bookId}:`, `${bookId}:\uffff`);

export async function putAssets(assets: readonly { key: string; blob: Blob }[]): Promise<void> {
  if (!(await persistent())) {
    for (const a of assets) mem.assets.set(a.key, a.blob);
    return;
  }
  // One transaction per picture keeps each write small (a big PDF has many).
  for (const a of assets) await run(ASSETS, 'readwrite', (s) => s.put(a.blob, a.key));
}

export async function getAsset(key: string): Promise<Blob | undefined> {
  if (!(await persistent())) return mem.assets.get(key);
  return run<Blob | undefined>(ASSETS, 'readonly', (s) => s.get(key));
}

export async function putOriginal(bookId: string, blob: Blob): Promise<void> {
  if (!(await persistent())) return void mem.files.set(bookId, blob);
  await run(FILES, 'readwrite', (s) => s.put(blob, bookId));
}

export async function getOriginal(bookId: string): Promise<Blob | undefined> {
  if (!(await persistent())) return mem.files.get(bookId);
  return run<Blob | undefined>(FILES, 'readonly', (s) => s.get(bookId));
}

/** A book's pictures (before it is read again). */
export async function removeBookAssets(bookId: string): Promise<void> {
  if (!(await persistent())) {
    for (const k of [...mem.assets.keys()]) if (k.startsWith(`${bookId}:`)) mem.assets.delete(k);
    return;
  }
  await run(ASSETS, 'readwrite', (s) => s.delete(assetRange(bookId)));
}

/** A book's pictures and original file go with it. */
async function removeBookFiles(bookId: string): Promise<void> {
  if (!(await persistent())) {
    for (const k of [...mem.assets.keys()]) if (k.startsWith(`${bookId}:`)) mem.assets.delete(k);
    mem.files.delete(bookId);
    return;
  }
  await run(ASSETS, 'readwrite', (s) => s.delete(assetRange(bookId)));
  await run(FILES, 'readwrite', (s) => s.delete(bookId));
}
