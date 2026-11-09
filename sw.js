/* TestRecall service worker — caches the app shell and the pdf.js CDN files
   so the app works offline after the first visit. No build step. */
const CACHE_NAME = 'testrecall-v9';

const APP_SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/pdf-parser.js',
  'data/naming-classification-bacteria.json',
  'data/systematic-classification-bacteria.json',
  'manifest.json',
  'icons/icon.svg',
];

const PDFJS_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache each URL on its own so one failure (e.g. no network for the
      // CDN on first install) does not fail the whole install.
      const results = await Promise.allSettled(
        [...APP_SHELL, ...PDFJS_CDN].map(async (url) => {
          const res = await fetch(url);
          if (res.ok || res.type === 'opaque') await cache.put(url, res);
        })
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed) console.warn('[sw] failed to cache ' + failed + ' URL(s) on install');
    })
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
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        // Cache successful same-origin and pdf.js CDN responses for later.
        const url = new URL(event.request.url);
        const cacheable =
          (url.origin === self.location.origin || url.hostname === 'cdnjs.cloudflare.com') &&
          (res.ok || res.type === 'opaque');
        if (cacheable) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      });
    })
  );
});
