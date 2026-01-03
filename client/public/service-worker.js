const CACHE_NAME = 'rover-os-v2.5';
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  if (url.protocol === 'chrome-extension:' ||
      url.pathname.startsWith('/ws') ||
      url.pathname.includes('hot-update') ||
      url.pathname.includes('__vite') ||
      url.hostname !== self.location.hostname) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const clonedResponse = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clonedResponse).catch(() => {});
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(response => response || new Response('Offline - content not available', { status: 503 }));
      })
  );
});
