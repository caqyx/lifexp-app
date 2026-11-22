// The reader's books on this device (docs/v2/PLAN.md 9.1 row "r"): IndexedDB only —
// nothing goes to Firestore or Storage. Meta (title, position) and content (the
// text) are separate stores, so the library reads only the small part; the reader's
// settings sit next to them. Where IndexedDB is missing or blocked (some private
// modes) the books live in memory until the page closes, and `persistent` says so.
//
// Per account (owner's decision 2026-11-22): every signed-in account has its own
// database, `lifexp-v2-reader:{uid}`, with its books, reading positions, pictures,
// original files and reader settings (theme, text size, pace: a person's choice,
// not the device's). Signed out, there is no library. When the account changes the
// open connection is closed and the in-memory copy is dropped, so nothing of one
// account reaches the next.
//
// Before that, one database `lifexp-v2-reader` held the device's library for whoever
// was signed in. The first account to open the Reader after the update takes it
// over: the old database is marked as claimed by that account, copied into its own,
// then deleted, so no other account ever sees it. A copy cut off half-way is finished
// by the same account next time; an account that finds it claimed by another leaves it.
import { effect } from '@preact/signals';
import type { BookContent, BookMeta } from '@/domain/reader/book';
import { session } from '@/stores/session';

/** The library before it was per account (one per device). */
export const LEGACY_DB_NAME = 'lifexp-v2-reader';
/** The library of one account. */
export const readerDbName = (uid: string) => `${LEGACY_DB_NAME}:${uid}`;
const DB_VERSION = 2;

const META = 'meta';
const CONTENT = 'content';
const SETTINGS = 'settings';
const SETTINGS_KEY = 'reader';
/** Pictures of the books' elements (r-5): key "<book id>:<n>" → Blob. */
const ASSETS = 'assets';
/** The original file of a book, kept for the PDF "Oryginał" view (r-6): key = book id → Blob. */
const FILES = 'files';
const STORES = [META, CONTENT, SETTINGS, ASSETS, FILES] as const;
/** In the legacy database's settings store: the account that took it over. */
const CLAIM_KEY = 'claimedBy';

interface Backend {
  persistent: boolean;
  db: IDBDatabase | null;
}

interface Memory {
  meta: Map<string, BookMeta>;
  content: Map<string, BookContent>;
  settings: unknown;
  assets: Map<string, Blob>;
  files: Map<string, Blob>;
}

const emptyMemory = (): Memory => ({ meta: new Map(), content: new Map(), settings: undefined, assets: new Map(), files: new Map() });

/** The library of the signed-in account; null when nobody is signed in. */
let current: { uid: string; backend: Promise<Backend> | null; mem: Memory } | null = null;

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('aborted'));
  });
}

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);
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
    request.onsuccess = () => {
      // Another tab upgrading or deleting it later must not wait on this connection.
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}

/** The legacy database if it exists (opened without creating it), else null. */
function openLegacyIfAny(): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    let missing = false;
    const request = indexedDB.open(LEGACY_DB_NAME);
    request.onupgradeneeded = () => {
      // Version 0: it did not exist. Aborting the upgrade leaves nothing behind.
      missing = true;
      request.transaction?.abort();
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => (missing ? resolve(null) : reject(request.error));
    request.onblocked = () => reject(new Error('blocked'));
  });
}

/**
 * Hands the device's old shared library to `uid` if nobody took it yet: claim, copy,
 * delete. Resolves to whether this account has it now (false: none, or another's).
 */
async function adoptLegacyLibrary(uid: string, target: IDBDatabase): Promise<boolean> {
  const legacy = await openLegacyIfAny();
  if (!legacy) return false;
  try {
    if (!STORES.every((s) => legacy.objectStoreNames.contains(s))) return false;
    // The claim first, in its own transaction: whoever writes it first owns the old library.
    const claimTx = legacy.transaction(SETTINGS, 'readwrite');
    const claims = claimTx.objectStore(SETTINGS);
    const owner = await req(claims.get(CLAIM_KEY));
    if (owner !== undefined && owner !== uid) {
      claimTx.abort();
      return false;
    }
    if (owner === undefined) claims.put(uid, CLAIM_KEY);
    await done(claimTx);

    // Everything copied in one transaction on the account's side; the copies keep their keys.
    const read = legacy.transaction([...STORES], 'readonly');
    const [metas, contents, settings, assetKeys, assets, fileKeys, files] = await Promise.all([
      req(read.objectStore(META).getAll()),
      req(read.objectStore(CONTENT).getAll()),
      req(read.objectStore(SETTINGS).get(SETTINGS_KEY)),
      req(read.objectStore(ASSETS).getAllKeys()),
      req(read.objectStore(ASSETS).getAll()),
      req(read.objectStore(FILES).getAllKeys()),
      req(read.objectStore(FILES).getAll()),
    ]);
    const write = target.transaction([...STORES], 'readwrite');
    for (const m of metas) write.objectStore(META).put(m);
    for (const c of contents) write.objectStore(CONTENT).put(c);
    if (settings !== undefined) write.objectStore(SETTINGS).put(settings, SETTINGS_KEY);
    assetKeys.forEach((key, i) => write.objectStore(ASSETS).put(assets[i], key));
    fileKeys.forEach((key, i) => write.objectStore(FILES).put(files[i], key));
    await done(write);
  } finally {
    legacy.close();
  }
  // Only once its copy is stored, and not waited for: a tab still holding the old database
  // (an older build) delays it until that tab lets go. A deletion cut short leaves the
  // claim, so this account finishes it next time and nobody else takes it.
  const deletion = indexedDB.deleteDatabase(LEGACY_DB_NAME);
  deletion.onerror = () => undefined;
  return true;
}

function openFor(uid: string): Promise<Backend> {
  return openDb(readerDbName(uid))
    .then(async (db): Promise<Backend> => {
      try {
        await adoptLegacyLibrary(uid, db);
      } catch {
        // The old library stays where it is; this account's own library works without it.
      }
      return { persistent: true, db };
    })
    .catch((): Backend => ({ persistent: false, db: null }));
}

/**
 * Whose library this is. Called whenever the session changes (see below); a change
 * closes the previous account's connection and forgets its in-memory books.
 */
export function setReaderAccount(uid: string | null): void {
  if ((current?.uid ?? null) === uid) return;
  void current?.backend?.then((b) => b.db?.close());
  current = uid === null ? null : { uid, backend: null, mem: emptyMemory() };
}

// Follows the signed-in account: signing out or switching never shows one account's books to another.
effect(() => {
  const s = session.value;
  setReaderAccount(s.status === 'signedIn' ? s.user.uid : null);
});

function account(): NonNullable<typeof current> {
  if (!current) throw new Error('signed out');
  return current;
}

/** Opens this account's store once; never rejects while signed in (falls back to memory). */
function ready(): Promise<Backend> {
  const lib = account();
  lib.backend ??= openFor(lib.uid);
  return lib.backend;
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

/** The in-memory library when IndexedDB is not there; null when it is. */
async function memory(): Promise<Memory | null> {
  const lib = account();
  return (await ready()).persistent ? null : lib.mem;
}

export async function listBookMeta(): Promise<BookMeta[]> {
  const mem = await memory();
  if (mem) return [...mem.meta.values()];
  return run<BookMeta[]>(META, 'readonly', (s) => s.getAll());
}

export async function getBook(id: string): Promise<{ meta: BookMeta; content: BookContent } | null> {
  const mem = await memory();
  if (mem) {
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
  const mem = await memory();
  if (mem) return void mem.meta.set(meta.id, meta);
  await run(META, 'readwrite', (s) => s.put(meta));
}

/** Content first, then meta: a book is listed only once its text is stored. */
export async function putBook(meta: BookMeta, content: BookContent): Promise<void> {
  const mem = await memory();
  if (mem) {
    mem.meta.set(meta.id, meta);
    mem.content.set(meta.id, content);
    return;
  }
  await run(CONTENT, 'readwrite', (s) => s.put(content));
  await run(META, 'readwrite', (s) => s.put(meta));
}

export async function removeBook(id: string): Promise<void> {
  const mem = await memory();
  if (mem) {
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
  const mem = await memory();
  if (mem) return mem.settings;
  return run<unknown>(SETTINGS, 'readonly', (s) => s.get(SETTINGS_KEY));
}

export async function writeReaderSettings(settings: object): Promise<void> {
  const mem = await memory();
  if (mem) {
    mem.settings = { ...settings };
    return;
  }
  await run(SETTINGS, 'readwrite', (s) => s.put({ ...settings }, SETTINGS_KEY));
}

/** Every key of a book's pictures starts with its id and a colon. */
const assetRange = (bookId: string) => IDBKeyRange.bound(`${bookId}:`, `${bookId}:￿`);

export async function putAssets(assets: readonly { key: string; blob: Blob }[]): Promise<void> {
  const mem = await memory();
  if (mem) {
    for (const a of assets) mem.assets.set(a.key, a.blob);
    return;
  }
  // One transaction per picture keeps each write small (a big PDF has many).
  for (const a of assets) await run(ASSETS, 'readwrite', (s) => s.put(a.blob, a.key));
}

export async function getAsset(key: string): Promise<Blob | undefined> {
  const mem = await memory();
  if (mem) return mem.assets.get(key);
  return run<Blob | undefined>(ASSETS, 'readonly', (s) => s.get(key));
}

export async function putOriginal(bookId: string, blob: Blob): Promise<void> {
  const mem = await memory();
  if (mem) return void mem.files.set(bookId, blob);
  await run(FILES, 'readwrite', (s) => s.put(blob, bookId));
}

export async function getOriginal(bookId: string): Promise<Blob | undefined> {
  const mem = await memory();
  if (mem) return mem.files.get(bookId);
  return run<Blob | undefined>(FILES, 'readonly', (s) => s.get(bookId));
}

/** A book's pictures (before it is read again). */
export async function removeBookAssets(bookId: string): Promise<void> {
  const mem = await memory();
  if (mem) {
    for (const k of [...mem.assets.keys()]) if (k.startsWith(`${bookId}:`)) mem.assets.delete(k);
    return;
  }
  await run(ASSETS, 'readwrite', (s) => s.delete(assetRange(bookId)));
}

/** A book's pictures and original file go with it. */
async function removeBookFiles(bookId: string): Promise<void> {
  const mem = await memory();
  if (mem) {
    for (const k of [...mem.assets.keys()]) if (k.startsWith(`${bookId}:`)) mem.assets.delete(k);
    mem.files.delete(bookId);
    return;
  }
  await run(ASSETS, 'readwrite', (s) => s.delete(assetRange(bookId)));
  await run(FILES, 'readwrite', (s) => s.delete(bookId));
}
