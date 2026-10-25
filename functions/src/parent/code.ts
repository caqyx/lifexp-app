// The six digits and how they are kept: only a salted scrypt hash is stored,
// compared in constant time; the code itself lives only in the e-mail.
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

/** v1's range: 100000 … 999999, from the CSPRNG. */
export function newCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

export function newSalt(): string {
  return randomBytes(16).toString('base64');
}

export function hashCode(code: string, salt: string): string {
  return scryptSync(code, salt, 32).toString('base64');
}

export function codeMatches(code: string, salt: string, hash: string): boolean {
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(code, salt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** "m***@poczta.pl": enough to recognise the address, not to read it out. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}
