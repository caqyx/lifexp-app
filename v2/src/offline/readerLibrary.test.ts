import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import type { BookContent, BookMeta } from '@/domain/reader/book';
import { session } from '@/stores/session';
import {
  LEGACY_DB_NAME,
  getAsset,
  getBook,
  getOriginal,
  listBookMeta,
  putBook,
  readReaderSettings,
  readerDbName,
  setReaderAccount,
  writeReaderSettings,
} from './readerLibrary';

const meta = (id: string, title: string) => ({ id, title, format: 'TXT', pos: 3, total: 10 }) as unknown as BookMeta;
const content = (id: string) => ({ id, sections: [] }) as unknown as BookContent;

const titles = async () => (await listBookMeta()).map((m) => m.title).sort();

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** The old per-device library, as the reader wrote it before it was per account. */
async function seedLegacy(claimedBy?: string) {
  const open = indexedDB.open(LEGACY_DB_NAME, 2);
  open.onupgradeneeded = () => {
    const db = open.result;
    db.createObjectStore('meta', { keyPath: 'id' });
    db.createObjectStore('content', { keyPath: 'id' });
    db.createObjectStore('settings');
    db.createObjectStore('assets');
    db.createObjectStore('files');
  };
  const db = await request(open);
  const tx = db.transaction(['meta', 'content', 'settings', 'assets', 'files'], 'readwrite');
  tx.objectStore('meta').put(meta('old', 'Stara książka'));
  tx.objectStore('content').put(content('old'));
  tx.objectStore('settings').put({ theme: 'night' }, 'reader');
  tx.objectStore('assets').put('picture', 'old:1');
  tx.objectStore('files').put('original', 'old');
  if (claimedBy) tx.objectStore('settings').put(claimedBy, 'claimedBy');
  await new Promise((resolve) => (tx.oncomplete = resolve));
  db.close();
}

/** Whether a database of that name exists (opened without creating it). */
function exists(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const open = indexedDB.open(name);
    let created = false;
    open.onupgradeneeded = () => {
      created = true;
      open.transaction?.abort();
    };
    open.onsuccess = () => {
      open.result.close();
      resolve(true);
    };
    open.onerror = () => resolve(!created);
  });
}

beforeEach(() => {
  setReaderAccount(null);
  globalThis.indexedDB = new IDBFactory();
});

describe('the reader library is per account', () => {
  test("one account's books are not another's, and come back when it signs in again", async () => {
    setReaderAccount('a');
    await putBook(meta('b1', 'Książka A'), content('b1'));
    await writeReaderSettings({ theme: 'night' });
    expect(await titles()).toEqual(['Książka A']);

    setReaderAccount('b');
    expect(await titles()).toEqual([]);
    expect(await getBook('b1')).toBeNull();
    expect(await readReaderSettings()).toBeUndefined();

    setReaderAccount('a');
    expect(await titles()).toEqual(['Książka A']);
    expect(await readReaderSettings()).toEqual({ theme: 'night' });
    expect(await exists(readerDbName('a'))).toBe(true);
  });

  test('signed out there is no library at all', async () => {
    setReaderAccount(null);
    await expect(listBookMeta()).rejects.toThrow();
  });

  test('follows the session: signing out and in as someone else switches the library', async () => {
    const signedIn = (uid: string) => ({
      status: 'signedIn' as const,
      user: { uid, email: '', displayName: null, emailVerified: true },
      profile: 'loading' as const,
    });
    session.value = signedIn('a');
    await putBook(meta('b1', 'Książka A'), content('b1'));
    session.value = { status: 'signedOut' };
    await expect(listBookMeta()).rejects.toThrow();
    session.value = signedIn('b');
    expect(await titles()).toEqual([]);
    session.value = signedIn('a');
    expect(await titles()).toEqual(['Książka A']);
    session.value = { status: 'loading' };
  });
});

describe('the shared library from before goes to the first account that opens the reader', () => {
  test('books, positions, pictures, files and settings move over; the old database goes', async () => {
    await seedLegacy();
    setReaderAccount('first');
    expect(await listBookMeta()).toEqual([meta('old', 'Stara książka')]);
    expect(await getBook('old')).toEqual({ meta: meta('old', 'Stara książka'), content: content('old') });
    expect(await getAsset('old:1')).toBe('picture');
    expect(await getOriginal('old')).toBe('original');
    expect(await readReaderSettings()).toEqual({ theme: 'night' });
    await expect.poll(() => exists(LEGACY_DB_NAME)).toBe(false);

    // Nobody else ever sees them.
    setReaderAccount('second');
    expect(await titles()).toEqual([]);
    setReaderAccount('first');
    expect(await titles()).toEqual(['Stara książka']);
  });

  test('a library another account already claimed (its copy cut short) is left to it', async () => {
    await seedLegacy('first');
    setReaderAccount('second');
    expect(await titles()).toEqual([]);
    expect(await exists(LEGACY_DB_NAME)).toBe(true);

    // The account that claimed it finishes the copy.
    setReaderAccount('first');
    expect(await titles()).toEqual(['Stara książka']);
    await expect.poll(() => exists(LEGACY_DB_NAME)).toBe(false);
  });

  test('without an old library nothing is created under its name', async () => {
    setReaderAccount('a');
    expect(await titles()).toEqual([]);
    expect(await exists(LEGACY_DB_NAME)).toBe(false);
  });
});
