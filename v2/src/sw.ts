// Service Worker of v2 (docs/v2/PLAN.md 4.8, stage 1f). Scope /lifexp-app/v2/: the
// longer scope wins over v1's sw.js, so each version controls its own pages.
//
// - Precache: every hashed asset plus index.html, installed as one set. An offline
//   start always gets one consistent build (v1's bug B1 cannot happen).
// - Navigations: network first (3 s), so an online start always gets the newest
//   build; offline, or on a slow network, the precached index.html.
// - Updates install in the background and take over at once, without reloading
//   anyone: an open page keeps running, and app/pwa.ts reloads it only if it asks
//   for a chunk the deploy removed.
// - Games (public/games/<id>/, stage g-1) are not precached (Wartime alone is ~4.5 MB):
//   each file is cached the first time it is played. Their code (pages, scripts, styles,
//   data) is network first (3 s, revalidated past the HTTP cache), the cache only
//   offline: the Rush games share their engine (games/_engine/), so a stale engine file
//   next to a newer game would mix two deploys — Flip Rush's portals ran on Ship Rush's
//   cached engine and said "wave" (hotfix after f-1). Media (images, sound, fonts) stay
//   stale-while-revalidate. The game's own page is a frame navigation, so the app shell's
//   navigation route leaves it alone.
// - Only same-origin GETs are touched; Firebase traffic goes straight to the network.
// - Push (stage 6-8): shows the reminders and opens their link on a tap (swPush.ts).
//   v2 does not subscribe before the cutover (R7), so until then nothing arrives here.
/// <reference lib="webworker" />
import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { addRoute, cleanupOutdatedCaches, matchPrecache, precache, type PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { clickUrl, parsePushData, readPush } from './swPush';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] };

/** v1's sw.js deletes every cache that is not its own `lifexp-shell-*`; ours start with this. */
setCacheNameDetails({ prefix: 'lifexp-v2' });

const NETWORK_TIMEOUT_MS = 3000;

async function networkFirstShell(request: Request): Promise<Response> {
  const shell = () => matchPrecache('index.html');
  try {
    const response = await Promise.race([
      fetch(request, { cache: 'no-store' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (response.ok) return response;
    return (await shell()) ?? response;
  } catch {
    return (await shell()) ?? Response.error();
  }
}

/** Everything under games/ next to the worker (its scope), the frame's page included. */
const GAMES_PREFIX = () => new URL('games/', self.registration.scope).href;

/** A game's code: its pages and what they run, never served older than the rest of the deploy online. */
const GAME_CODE = /\.(html?|m?js|css|json|wasm)$/i;
const isGameCode = (url: URL, request: Request) => request.mode === 'navigate' || url.pathname.endsWith('/') || GAME_CODE.test(url.pathname);

// First, so a game's page (a navigation inside the frame) is never answered with the app shell.
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.href.startsWith(GAMES_PREFIX()) && isGameCode(url, request),
  new NetworkFirst({ cacheName: 'lifexp-v2-games', networkTimeoutSeconds: NETWORK_TIMEOUT_MS / 1000, fetchOptions: { cache: 'no-cache' } }),
);
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.href.startsWith(GAMES_PREFIX()),
  new StaleWhileRevalidate({ cacheName: 'lifexp-v2-games' }),
);

// Registered before the precache route, so navigations (including ./ and
// ./index.html) are network first instead of being answered from the precache.
registerRoute(new NavigationRoute(({ request }) => networkFirstShell(request)));

precache(self.__WB_MANIFEST);
addRoute();
cleanupOutdatedCaches();

self.addEventListener('install', () => {
  void self.skipWaiting();
});
clientsClaim();

// ── Push (docs/v2/PLAN.md 9.1, row 6-8) ──

/** The manifest's icon (vite.config.ts), next to the worker's scope. */
const ICON = () => new URL('icon-192.png', self.registration.scope).href;

self.addEventListener('push', (event) => {
  const raw = event.data ? parsePushData(() => event.data!.json(), () => event.data!.text()) : {};
  const notice = readPush(raw);
  event.waitUntil(
    self.registration
      .showNotification(notice.title, {
        body: notice.body,
        icon: ICON(),
        badge: ICON(),
        data: { url: clickUrl(notice.link, self.registration.scope) },
      })
      // No permission (or a browser that cannot show one): nothing to show, and the worker carries on.
      .catch(() => undefined),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | null;
  // Re-checked here: only our origin, else v2's start.
  const url = clickUrl(typeof data?.url === 'string' ? data.url : null, self.registration.scope);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // A v2 window is reused only for a v2 address; a link outside the scope (v1 until the cutover) opens its own.
      const inScope = url.startsWith(self.registration.scope);
      const open = inScope ? windows.find((w) => w.url.startsWith(self.registration.scope)) : undefined;
      if (open) {
        await open.focus();
        if (open.url !== url && 'navigate' in open) await open.navigate(url).catch(() => null);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
