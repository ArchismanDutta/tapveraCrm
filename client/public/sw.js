/* eslint-env serviceworker */
/* global clients */
//
// public/sw.js — Web Push service worker.
//
// Scope is deliberately narrow: this handles push delivery and notification
// clicks, and NOTHING else. In particular it does not cache the app shell.
// An offline-caching service worker is a much larger commitment — it can serve
// a stale build after a deploy, and debugging that is miserable. Caching can be
// added later as its own change; conflating the two is how service workers get
// a bad reputation.
//
// Lives in /public so Vite copies it to the site root verbatim. It MUST be
// served from the root for its scope to cover the whole app.

// Take over immediately rather than waiting for every old tab to close —
// otherwise a user who just granted permission gets no pushes until they
// close every tab they have open.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * A push arrived.
 *
 * `event.waitUntil` is required: without it the browser may kill the worker
 * before showNotification() resolves, and the notification silently never
 * appears. This is the single most common web-push bug.
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'New message', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Tapvera CRM';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon.png',
    badge: '/icon.png',
    // Same tag => the OS REPLACES the previous banner instead of stacking, so a
    // burst in one thread reads as one conversation needing attention.
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/', ...(payload.data || {}) },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Notification clicked — focus an existing tab if the app is already open,
 * rather than opening a duplicate. Opening a second tab of a SPA the user
 * already has running is a small thing that feels broken.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of windows) {
        // Same origin — reuse it.
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(target);
            } catch {
              // Cross-origin or a navigation the browser refused; focusing the
              // existing tab is still better than spawning a new one.
            }
          }
          return;
        }
      }

      if (clients.openWindow) await clients.openWindow(target);
    })()
  );
});

/**
 * The push service rotated this subscription's endpoint.
 *
 * Without this handler the device silently stops receiving pushes, and neither
 * the user nor the server has any way to notice. Re-subscribing here needs the
 * VAPID public key, which the page stashed for exactly this purpose.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open('push-config');
        const res = await cache.match('vapid');
        const key = res ? await res.text() : null;
        if (!key) return;

        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ subscription: sub }),
        });
      } catch {
        // Nothing useful to do here — the next page load re-subscribes.
      }
    })()
  );
});
