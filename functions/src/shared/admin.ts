// The one Admin SDK app of this codebase, created on first use (a cold start
// that never touches Firestore never pays for it). Checked by name: firebase-functions
// creates its own named app for Firestore trigger events, so "some app exists" does
// not mean the default one does (6-3b: the first trigger in this codebase).
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const DEFAULT_APP = '[DEFAULT]';

export function ensureDefaultApp(): void {
  if (!getApps().some((app) => app.name === DEFAULT_APP)) initializeApp();
}

export function db(): Firestore {
  ensureDefaultApp();
  return getFirestore();
}
