// GENERATED from v2/src/lib/intl.ts by `npm run gen:shared-domain --prefix v2`. Do not edit here:
// change v2/src/lib/intl.ts and regenerate (a v2 test fails while this copy is stale).
// Shared Intl formatters (docs/v2/PERF.md). Creating one costs ~60 µs on a desktop and
// several times that on a phone, and a list of 150 transactions or notes formats
// hundreds of dates and amounts per render, so each locale + options pair is built once.

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** A cached Intl.NumberFormat for `locale` and `options`. */
export function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, format);
  }
  return format;
}

/**
 * The device's time zone, cheaply: its UTC offsets in winter and in summer. Asking Intl
 * for the zone's name costs as much as a new formatter. A zone change while the app is
 * open (travel, a test switching TZ) changes them, and the formatters are rebuilt.
 */
function deviceZone(): string {
  return `${new Date(2000, 0, 1).getTimezoneOffset()}/${new Date(2000, 6, 1).getTimezoneOffset()}`;
}

/** A cached Intl.DateTimeFormat for `locale` and `options` (in the device's zone unless `options.timeZone`). */
export function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${options.timeZone ?? deviceZone()}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, format);
  }
  return format;
}
