// Firebase Auth for v2: the same accounts and the same signed-in session as v1.
import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import type { SessionUser } from '@/domain/profile';
import { auth } from './firebase';

function toSessionUser(user: User): SessionUser {
  return { uid: user.uid, email: user.email ?? '', displayName: user.displayName, emailVerified: user.emailVerified };
}

export function watchAuth(onChange: (user: SessionUser | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => onChange(user ? toSessionUser(user) : null));
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

/** Popup, as in v1. The profile document is created by v1 if it does not exist yet. */
export async function signInWithGoogle(): Promise<void> {
  // The popup helper is loaded here, not at start (see firebase.ts).
  await signInWithPopup(auth, new GoogleAuthProvider(), browserPopupRedirectResolver);
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}

/**
 * Firebase's own verification link to the signed-in address (6-8: the rules trust a
 * parent's e-mail only when Firebase Auth has it verified; v1's 6-digit code sets only
 * the profile flag). Rejects when nobody is signed in.
 */
export async function sendAuthVerificationLink(): Promise<void> {
  if (!auth.currentUser) throw new Error('signed out');
  await sendEmailVerification(auth.currentUser);
}

/** After the link was opened: the fresh state, with a new token so the rules see it. */
export async function reloadAuthUser(): Promise<SessionUser | null> {
  const user = auth.currentUser;
  if (!user) return null;
  await user.reload();
  await user.getIdToken(true);
  return toSessionUser(user);
}
