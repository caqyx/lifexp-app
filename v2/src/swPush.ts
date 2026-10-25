// What v2's Service Worker does with a push (docs/v2/PLAN.md 9.1, row 6-8): pure, so
// it is unit-tested; src/sw.ts only wires it to the `push` and `notificationclick`
// events. v2 does not subscribe before the cutover (R7: no getToken, no tokens), so
// until then these handlers stay idle; at the cutover the reminders (functions/src/push)
// reach v2 with the payload they send today:
//   { notification: { title, body }, fcmOptions | webpush.fcmOptions: { link } }
// and a data-only message ({ data: { title, body, link } }) is read too.

export interface PushNotice {
  title: string;
  body: string;
  /** As sent; resolved against the scope when clicked (clickUrl). */
  link: string | null;
}

export const DEFAULT_TITLE = 'LifeXP';

const record = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (...values: unknown[]): string | null => {
  for (const v of values) if (typeof v === 'string' && v.trim() !== '') return v;
  return null;
};

/** The push message's JSON (event.data.json()), or anything else, as a notification. */
export function readPush(raw: unknown): PushNotice {
  const msg = record(raw);
  const notification = record(msg.notification);
  const data = record(msg.data);
  const fcmOptions = record(msg.fcmOptions);
  const webpushFcm = record(record(msg.webpush).fcmOptions);
  return {
    title: text(notification.title, data.title) ?? DEFAULT_TITLE,
    body: text(notification.body, data.body) ?? '',
    link: text(fcmOptions.link, webpushFcm.link, data.link, notification.click_action),
  };
}

/** The push's data as JSON; a text payload becomes its body; nothing at all is an empty object. */
export function parsePushData(json: () => unknown, plain: () => string): unknown {
  try {
    return json();
  } catch {
    const body = plain();
    return body ? { notification: { body } } : {};
  }
}

/**
 * Where a tap leads: the link if it is on our own origin (relative links resolve
 * against the worker's scope), otherwise the scope itself — v2's start. A foreign
 * origin is never opened.
 */
export function clickUrl(link: string | null, scope: string): string {
  const start = new URL(scope).href;
  if (!link) return start;
  let url: URL;
  try {
    url = new URL(link, start);
  } catch {
    return start;
  }
  if (url.origin !== new URL(start).origin || (url.protocol !== 'https:' && url.protocol !== 'http:')) return start;
  return url.href;
}
