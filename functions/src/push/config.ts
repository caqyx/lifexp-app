// Push reminders (docs/v2/PLAN.md 9.1, row 6-7). The rules themselves are the v2
// domain's (functions/src/v2/domain/reminders.ts, a generated copy).

/** Every hour on the hour, Warsaw clock: v1's notifHours are Warsaw hours. */
export const SCHEDULE = '0 * * * *';
export const TIME_ZONE = 'Europe/Warsaw';
export const REGION = 'europe-west1';
export const MEMORY = '256MiB' as const;
export const TIMEOUT_SECONDS = 300;
export const CONCURRENCY = 5;

/**
 * Where a tap on the notification leads: v1's app (it holds the push subscription
 * until the cutover, R7). The address of the old send-notifications.js, which is
 * still right; at the cutover (stage 7) it becomes v2's.
 */
export const APP_URL = 'https://szymonrogalski098-collab.github.io/lifexp-app/app.html';

/** pushLog/{uid}_{Warsaw day}: what went out that day (server-only, firestore.rules). */
export const PUSH_LOG = 'pushLog';
/** sendMyPushNow: test pushes per account per Warsaw day. */
export const MANUAL_DAILY_LIMIT = 3;
