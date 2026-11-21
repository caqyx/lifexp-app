// GENERATED from v2/src/lib/dates.ts by `npm run gen:shared-domain --prefix v2`. Do not edit here:
// change v2/src/lib/dates.ts and regenerate (a v2 test fails while this copy is stale).
// Calendar days as "YYYY-MM-DD" keys (docs/v2/GOLDEN.md G13). v1 uses two
// calendars and v2 keeps both until migration M4: the UTC day (dailyLog, streak,
// daily limit — v1's todayStr) and the local day (chores, tasks — dateISOLocal).
// Keys never go through Date parsing in local time, so they cannot shift.

/** v1's `todayStr()`: the UTC calendar date. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** v1's `dateISOLocal()`: the calendar date on this device. */
export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Date and time to the minute in `timeZone`, "YYYY-MM-DDTHH:mm" (the Ex-us
 * context's `now`). With the device's own zone its day is localDayKey's.
 */
export function zonedIsoMinutes(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** The calendar day of `date` in `timeZone`, "YYYY-MM-DD" (the weekly report's Europe/Warsaw days). */
export function zonedDayKey(date: Date, timeZone: string): string {
  return zonedIsoMinutes(date, timeZone).slice(0, 10);
}

function keyToUtcDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** The key `days` calendar days after (or before, if negative) `key`. */
export function addDays(key: string, days: number): string {
  const date = keyToUtcDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDayKey(date);
}

/** Monday … Sunday of the week that contains `key`. */
export function weekOf(key: string): string[] {
  const mondayOffset = (keyToUtcDate(key).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => addDays(key, i - mondayOffset));
}

/** "pon." / "Mon" for a day key, independent of the device's time zone. */
export function formatWeekdayShort(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(keyToUtcDate(key));
}

/** "wtorek" / "Tuesday" for a day key, independent of the device's time zone. */
export function formatWeekdayLong(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(keyToUtcDate(key));
}

/** "wtorek, 29 września" for a day key, independent of the device's time zone. */
export function formatDayKey(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    keyToUtcDate(key),
  );
}

/** "29 września" for a day key, independent of the device's time zone. */
export function formatDayMonth(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(keyToUtcDate(key));
}

/** "wrzesień 2026" for a month key "2026-09". */
export function formatMonthKey(monthKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    keyToUtcDate(`${monthKey}-01`),
  );
}

/** "wtorek, 29 września" for the device's current day. */
export function formatLongDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

/** "12 wrz" — the day of a moment, as a person on this device sees it. */
export function formatShortDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
}

/** ISO weekday of a day key: 1 = Monday … 7 = Sunday, independent of the device's time zone. */
export function isoWeekday(key: string): number {
  return ((keyToUtcDate(key).getUTCDay() + 6) % 7) + 1;
}

/** "2026-11" for a day key "2026-11-20". */
export function monthKeyOfDay(key: string): string {
  return key.slice(0, 7);
}

/** The month key `months` months after (or before, if negative) `monthKey`. */
export function addMonths(monthKey: string, months: number): string {
  const [y, m] = monthKey.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + months;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** 28–31: the days of the month `monthKey` ("2026-02"). */
export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Minutes after midnight for a wall-clock time "HH:mm" (00:00–23:59), or null. */
export function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** "HH:mm" for minutes after midnight (what a time input holds). */
export function clockValue(minutes: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "18:00" / "6:00 PM": minutes after midnight in the language's clock. */
export function formatClock(minutes: number, locale: string): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, 0, 1, 0, m)),
  );
}

/**
 * The moment a wall-clock time happens on a local day on this device (tasks and
 * calendar entries are local days, G13). A time skipped by a DST change moves on
 * to the next valid one, as the platform does it.
 */
export function localInstant(key: string, minutes: number): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 0, minutes);
}

/** "lis" / "Nov": the short month name for a month key. */
export function formatMonthShort(monthKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(keyToUtcDate(`${monthKey}-01`));
}

/** "20 lis" / "20 Nov" for a day key, independent of the device's time zone. */
export function formatDayShort(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(keyToUtcDate(key));
}

/** "17:05" / "5:05 pm": the time of a moment on this device, in the language's clock. */
export function formatTimeOfDay(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
}
