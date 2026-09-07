const CACHE = "translucency-shell-v2-instances";
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
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("translucency-shell-") && name !== CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
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
