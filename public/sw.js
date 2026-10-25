// Kiosk-only service worker: lets the booth app reopen while offline.
// Pages: network first (always fresh when online). Static files: cache first.
// Never touches /api/*, so no lead data is ever cached.
const CACHE = 'aspen-calc-v2';
const ASSET_PATTERN = /\/(?:_next\/static|icons|brand)\/[^"'\s)\\]+/g;

/** Caches the page and every script, style, font and image it references. */
async function cachePageWithAssets(cache, response) {
  const html = await response.clone().text();
  const assets = [...new Set(html.match(ASSET_PATTERN) ?? [])];
  await cache.put('/', response);
  await Promise.all(
    assets.map(async (path) => {
      // Next files are content-hashed; for icons/brand, bump CACHE to refresh.
      if (await cache.match(path)) return;
      try {
        const res = await fetch(path);
        if (res.ok) await cache.put(path, res);
      } catch {
        // Missing one asset only matters offline; the next online load retries.
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const response = await fetch('/', { cache: 'no-store' });
      if (response.ok) await cachePageWithAssets(cache, response);
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    if (url.pathname !== '/') return; // Staff pages always need the network.
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Refresh the offline copy (and its new asset files) only from a good response.
          if (response.ok) caches.open(CACHE).then((cache) => cachePageWithAssets(cache, response.clone()));
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (!url.pathname.match(/^\/(?:_next\/static|icons|brand)\//)) return;
  event.respondWith(
    caches.match(url.pathname).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        }),
    ),
  );
});
