// Climate Control - minimal app-shell service worker.
// Caches the static shell so the page still opens (showing cached UI) if the
// phone briefly has no signal. It does NOT cache Firebase data - live control
// always needs a live connection.

// Bump CACHE_NAME whenever SHELL_FILES changes so old caches are evicted.
const CACHE_NAME = 'climate-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/components.css',
  './css/layout.css',
  './js/main.js',
  './js/config.js',
  './js/i18n/I18n.js',
  './js/i18n/translations.js',
  './js/logging/Logger.js',
  './js/logging/log.js',
  './js/data/AcRepository.js',
  './js/state/AppState.js',
  './js/utils/time.js',
  './js/views/AuthView.js',
  './js/views/DevicePickerView.js',
  './js/views/HeroView.js',
  './js/views/ConnectionView.js',
  './js/views/SafetyBannerView.js',
  './js/views/NightArcView.js',
  './js/views/ModeSwitchView.js',
  './js/views/ScheduleView.js',
  './js/views/ManualControlView.js',
  './js/views/HistoryChartView.js',
  './js/views/SettingsView.js'
];

// Path suffixes used to recognise shell requests. './' is excluded because
// stripping it leaves an empty string, which endsWith() matches against every
// URL — that made the "everything else" branch below unreachable.
const SHELL_SUFFIXES = SHELL_FILES
  .map((file) => file.replace('./', ''))
  .filter(Boolean);

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
  const isShellRequest =
    url.pathname.endsWith('/') || SHELL_SUFFIXES.some((suffix) => url.pathname.endsWith(suffix));

  if (isShellRequest) {
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
