// Alerts to the parent (docs/v2/PLAN.md 9.1, row 6-3b; owner's decision 2026-10-25):
// an e-mail when a day's gaming reaches 60 minutes and when something is bought,
// at most one of each kind per day.

/**
 * TODO właściciel: the EmailJS template made from email-templates/parent-alert.html
 * (instructions in that file). Until it is set, nothing is sent ("templateMissing").
 */
export const PARENT_ALERT_TEMPLATE_ID: string | null = null;
/** The Functions emulator's fake mailer needs no real template. */
export const EMULATOR_TEMPLATE_ID = 'template_emulator';

/** parentAlertLog/{uid}_{day}: which kinds went that day (server-only, firestore.rules). */
export const ALERT_LOG = 'parentAlertLog';

/** Same as the database's eur3 (firebase-tools maps eur3 → europe-west1 for Firestore triggers). */
export const REGION = 'europe-west1';
export const MEMORY = '256MiB' as const;
export const MAX_INSTANCES = 5;
export const TIME_ZONE = 'Europe/Warsaw';
