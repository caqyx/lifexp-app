// Every knob of the parent's e-mail codes (docs/v2/PLAN.md 9.1, row 6-4; B12, R17).

/** v1: a code is good for 10 minutes. */
export const CODE_TTL_MS = 10 * 60 * 1000;
/** Wrong codes allowed; the fifth wrong one ends the code. */
export const MAX_ATTEMPTS = 5;
/** Sends per account: at most SHORT_LIMIT in SHORT_WINDOW_MS and DAY_LIMIT in 24 h. */
export const SHORT_LIMIT = 3;
export const SHORT_WINDOW_MS = 15 * 60 * 1000;
export const DAY_LIMIT = 10;
export const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Server-only: the rules give clients no access (firestore.rules). */
export const CODES = 'parentEmailCodes';

/** v1's longest address field (maxlength="254"). */
export const MAX_EMAIL_CHARS = 254;

export const REGION = 'europe-west1';
export const MAX_INSTANCES = 2;
export const MEMORY = '256MiB' as const;
export const TIMEOUT_SECONDS = 30;

/**
 * The template v1 and 4g-1 send the code with (settings.js, v2 data/emailjs.ts).
 * Public ids, already in the repo; the private key is the secret EMAILJS_PRIVATE_KEY.
 */
export const EMAILJS = {
  url: 'https://api.emailjs.com/api/v1.0/email/send',
  serviceId: 'service_417sg11',
  templateId: 'template_f2b4jeo',
  publicKey: '1vFk29QDNKopU0RnJ',
} as const;
