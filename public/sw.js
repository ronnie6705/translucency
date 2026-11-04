const CACHE = "rhythm-shell-v7-notifications";
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([
        "/",
        "/manifest.webmanifest",
        "/icon-192.png",
        "/icon-512.png",
        "/icon-maskable.png",
        "/rhythm/chronotype-axis.svg",
        "/rhythm/lion-axis.svg",
      ]);
      const html = await (await cache.match("/")).text();
      const assets = [
        ...new Set(
          [...html.matchAll(/(?:src|href)="([^" ]+)"/g)]
            .map((m) => m[1].replaceAll("&amp;", "&"))
            .filter((p) => p.startsWith("/_next/static/")),
        ),
      ];
      await cache.addAll(assets);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let message;
    try { message = event.data?.json(); } catch { return; }
    if (!message || typeof message.title !== 'string' || typeof message.tag !== 'string') return;
    if (typeof message.expiresAt !== 'number' || message.expiresAt <= Date.now()) return;
    await self.registration.showNotification(message.title, {
      body: message.body, icon: '/icon-192.png', badge: '/icon-192.png',
      tag: message.tag, renotify: false, data: { url: '/#rhythm-timeblocks' },
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/#rhythm-timeblocks', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await self.clients.openWindow(url);
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if ((name.startsWith("translucency-shell-") || name.startsWith("rhythm-shell-")) && name !== CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // Auth and API responses must never become offline app-shell cache entries.
  if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/')) return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put("/", response.clone());
          }
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname.startsWith("/rhythm/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then(async (response) => {
            if (response.ok) {
              const cache = await caches.open(CACHE);
              await cache.put(req, response.clone());
            }
            return response;
          }),
      ),
    );
  }
});
