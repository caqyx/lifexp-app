// The part of the Admin Firestore that the handlers use (doc().get/set/update,
// runTransaction with get, set, update and delete; FieldValue.delete() in updates),
// in memory. Transactions run one at a time, and a callback that throws leaves
// nothing written, as in Firestore. update() on a missing document throws, as in Firestore.
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

type Data = Record<string, unknown>;

interface FakeRef {
  path: string;
  get(): Promise<FakeSnap>;
  set(data: Data, opts?: { merge?: boolean }): Promise<void>;
  update(data: Data): Promise<void>;
}

const isDelete = (v: unknown) => v instanceof FieldValue && v.isEqual(FieldValue.delete());

/** A patch applied to a document: FieldValue.delete() removes the field. */
function patched(base: Data, patch: Data): Data {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (isDelete(v)) delete out[k];
    else out[k] = v;
  }
  return out;
}

interface FakeSnap {
  exists: boolean;
  data(): Data | undefined;
}

export interface FakeDb {
  db: Firestore;
  docs: Map<string, Data>;
  transactions: number;
}

export function fakeFirestore(initial: Record<string, Data> = {}): FakeDb {
  const docs = new Map<string, Data>(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const snap = (path: string): FakeSnap => {
    const d = docs.get(path);
    return { exists: d !== undefined, data: () => (d ? structuredClone(d) : undefined) };
  };
  const write = (path: string, data: Data | null, mode: 'set' | 'merge' | 'update') => {
    if (data === null) return void docs.delete(path);
    const current = docs.get(path);
    if (mode === 'update' && !current) throw new Error(`NOT_FOUND: ${path}`);
    docs.set(path, mode === 'set' ? patched({}, data) : patched(current ?? {}, data));
  };
  const doc = (path: string): FakeRef => ({
    path,
    get: async () => snap(path),
    set: async (data, opts) => write(path, data, opts?.merge ? 'merge' : 'set'),
    update: async (data) => write(path, data, 'update'),
  });
  let queue: Promise<unknown> = Promise.resolve();
  const state: FakeDb = { db: undefined as unknown as Firestore, docs, transactions: 0 };

  const runTransaction = <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    const run = async () => {
      state.transactions++;
      const writes: [string, Data | null, 'set' | 'merge' | 'update'][] = [];
      const tx = {
        get: async (ref: FakeRef) => snap(ref.path),
        set: (ref: FakeRef, data: Data, opts?: { merge?: boolean }) => {
          writes.push([ref.path, data, opts?.merge ? 'merge' : 'set']);
          return tx;
        },
        update: (ref: FakeRef, data: Data) => {
          writes.push([ref.path, data, 'update']);
          return tx;
        },
        delete: (ref: FakeRef) => {
          writes.push([ref.path, null, 'set']);
          return tx;
        },
      };
      const result = await fn(tx);
      // As Firestore: an update of a missing document fails the whole commit.
      for (const [path, , mode] of writes) if (mode === 'update' && !docs.has(path)) throw new Error(`NOT_FOUND: ${path}`);
      for (const [path, data, mode] of writes) write(path, data, mode);
      return result;
    };
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  };

  state.db = { doc, runTransaction } as unknown as Firestore;
  return state;
}
