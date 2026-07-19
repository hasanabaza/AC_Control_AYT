// Night Cool - minimal app-shell service worker.
// Caches the static shell so the page still opens (showing cached UI) if the
// phone briefly has no signal. It does NOT cache Firebase data - live control
// always needs a live connection.

const CACHE_NAME = 'night-cool-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache Firebase / Google API traffic - always go to network.
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    return;
  }

  // App shell files: use network-first for index.html/root so clients pick up
  // new deploys quickly (avoids stale cached HTML in some browsers).
  if (SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '')))) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Update cache with fresh response — only for http/https requests
          const clone = res.clone();
          try {
            const reqUrl = new URL(event.request.url);
            if (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:') {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
          } catch (e) {
            // URL parsing failed; skip caching
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (CDN scripts, fonts): network-first, cache fallback.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        try {
          const reqUrl = new URL(event.request.url);
          if (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
        } catch (e) {
          // skip caching if URL has unsupported scheme (e.g., chrome-extension://)
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
