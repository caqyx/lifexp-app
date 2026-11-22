// Sign-in use cases. Results instead of exceptions, so screens only translate a key.
import { sendPasswordReset, signInWithEmail, signInWithGoogle, signOutUser } from '@/data/auth';
import { authErrorKey, type AuthErrorKey } from './auth-errors';

export type AuthResult = { ok: true } | { ok: false; error: AuthErrorKey };

export async function login(email: string, password: string): Promise<AuthResult> {
  if (!email.trim() || !password) return { ok: false, error: 'auth.errors.fillAll' };
  try {
    await signInWithEmail(email.trim(), password);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: authErrorKey(e) };
  }
}

export async function loginWithGoogle(): Promise<AuthResult> {
  try {
    await signInWithGoogle();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: authErrorKey(e) };
  }
}

/**
 * "Nie pamiętam hasła": Firebase e-mails a link to set a new password. An address
 * without an account answers like one with it, so the screen never tells who has one.
 */
export async function requestPasswordReset(email: string, languageCode: string): Promise<AuthResult> {
  const address = email.trim();
  if (!address) return { ok: false, error: 'auth.errors.emailFirst' };
  try {
    await sendPasswordReset(address, languageCode);
    return { ok: true };
  } catch (e) {
    const error = authErrorKey(e);
    return error === 'auth.errors.userNotFound' ? { ok: true } : { ok: false, error };
  }
}

export function logout(): Promise<void> {
  return signOutUser();
}
