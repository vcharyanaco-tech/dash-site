const SW_VERSION = '2026.08.16a';
const CACHE_NAME = 'ipd-dashboard-' + SW_VERSION;
const PRECACHE_URLS = [
  '/app.html',
  '/app.js',
  '/assets/styles.css',
  '/manifest.json',
  '/docs-pwa-icon.svg'
];

// The dashboard bundle (HTML/JS/CSS) changes on every deploy, so it must be
// network-first: always fetch the fresh copy when online (deploys propagate
// immediately) and fall back to the cached copy only when offline. The old
// cache-first strategy pinned the August-9 bundle forever — users kept seeing
// stale UI and old bugs long after fixes shipped. Other assets (icons,
// manifest) are static and stay cache-first.
const NETWORK_FIRST = ['/app.html', '/app.js', '/assets/styles.css'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.indexOf('/macros/') === 0) return;
  // API responses are dynamic (health, backup stats, data) — never cache
  // them, or the dashboard shows stale data while online.
  if (url.pathname.indexOf('/api') === 0) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isCore = NETWORK_FIRST.indexOf(url.pathname) !== -1;

  if (isCore) {
    event.respondWith(
      fetch(event.request).then(function (resp) {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return resp;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match('/app.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (resp) {
        if (resp && resp.status === 200 && url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return resp;
      }).catch(function () {
        return caches.match('/app.html');
      });
    })
  );
});

/* ── Push Notifications ──────────────────────────────────────────────────
 * Handles incoming push messages and displays native notifications.
 * Used for review deadline reminders and weekly report alerts.
 * ────────────────────────────────────────────────────────────────────────── */
self.addEventListener('push', function (event) {
  var data = { title: 'India Post Dashboard', body: '', tag: 'dashboard', url: '/app.html' };
  try {
    if (event.data) {
      var payload = event.data.json();
      data.title = payload.title || data.title;
      data.body = payload.body || data.body;
      data.tag = payload.tag || data.tag;
      data.url = payload.url || data.url;
      data.icon = payload.icon || data.icon;
      data.badge = payload.badge || data.badge;
      data.timestamp = payload.timestamp || Date.now();
    }
  } catch (e) {
    try { data.body = event.data.text(); } catch (e2) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/assets/icon-192.png',
      badge: data.badge || '/assets/icon-72.png',
      tag: data.tag,
      timestamp: data.timestamp,
      requireInteraction: data.tag && data.tag.indexOf('review') === 0,
      data: { url: data.url }
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/app.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      // Focus existing tab if already open
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.indexOf(self.location.origin) === 0 && 'focus' in clients[i]) {
          return clients[i].focus();
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow(url);
    })
  );
});