// The weekly report to the parent (docs/v2/PLAN.md 9.1, rows 6-5/6-6).

/**
 * v1's workflow ran on Sundays at 08:00 UTC (9:00 in Polish winter, 10:00 in summer);
 * the function keeps Sunday 9:00 on the Warsaw clock all year.
 */
export const SCHEDULE = '0 9 * * 0';
export const TIME_ZONE = 'Europe/Warsaw';
export const REGION = 'europe-west1';
export const MEMORY = '256MiB' as const;
export const TIMEOUT_SECONDS = 540;
/** Accounts handled at once. */
export const CONCURRENCY = 5;

/** sendMyReportNow: reports per account per 24 h (the owner's first check). */
export const MANUAL_DAILY_LIMIT = 3;
/** Server-only: the rules give clients no access (firestore.rules). */
export const MANUAL_RUNS = 'weeklyReportRuns';
