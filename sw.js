// HK Wood Doors ERP — Service Worker
// Purpose: after the very first successful online visit, cache the app shell
// and the external libraries (Google Fonts, html2canvas, jsPDF, Firebase SDK)
// so the app — including PDF/invoice generation — keeps working with zero
// internet connection. Core business data always lives in localStorage and
// never depends on this file.

const CACHE_NAME = 'hk-wood-doors-erp-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Some environments (e.g. file:// preview) may not support caching
        // the shell; that's fine, runtime caching below still helps.
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isCdn = /fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|gstatic\.com\/firebasejs|api\.qrserver\.com/.test(url.hostname + url.pathname);
  const isNavigation = req.mode === 'navigate';

  if (isCdn) {
    // Cache-first for external libraries/fonts: once downloaded, always
    // available offline. Falls back to network only if not yet cached.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  if (isNavigation) {
    // Network-first for the app page itself, so updates are picked up when
    // online, but it still loads from cache when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Everything else: try cache, then network.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
