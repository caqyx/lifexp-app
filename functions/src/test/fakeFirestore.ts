// The part of the Admin Firestore that exusTurn uses (doc().get(), runTransaction
// with get and merged set), in memory. Transactions run one at a time, and a
// callback that throws leaves nothing written, as in Firestore.
import type { Firestore } from 'firebase-admin/firestore';

type Data = Record<string, unknown>;

interface FakeRef {
  path: string;
  get(): Promise<FakeSnap>;
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
  const doc = (path: string): FakeRef => ({ path, get: async () => snap(path) });
  let queue: Promise<unknown> = Promise.resolve();
  const state: FakeDb = { db: undefined as unknown as Firestore, docs, transactions: 0 };

  const runTransaction = <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    const run = async () => {
      state.transactions++;
      const writes: [string, Data][] = [];
      const tx = {
        get: async (ref: FakeRef) => snap(ref.path),
        set: (ref: FakeRef, data: Data, opts?: { merge?: boolean }) => {
          writes.push([ref.path, opts?.merge ? { ...(docs.get(ref.path) ?? {}), ...data } : data]);
          return tx;
        },
      };
      const result = await fn(tx);
      for (const [path, data] of writes) docs.set(path, data);
      return result;
    };
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  };

  state.db = { doc, runTransaction } as unknown as Firestore;
  return state;
}
