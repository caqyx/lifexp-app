// The one Admin SDK app of this codebase, created on first use (a cold start
// that never touches Firestore never pays for it).
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export function db(): Firestore {
  if (getApps().length === 0) initializeApp();
  return getFirestore();
}
