/* Service Worker for Satyaseva Sisters PWA */
const CACHE_NAME = 'satyaseva-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/communities.html',
  '/community.html',
  '/foundress.html',
  '/memorial.html',
  '/events.html',
  '/news.html',
  '/contact.html',
  '/prayers.html',
  '/donate.html',
  '/map.html',
  '/vocations.html',
  '/privacy.html',
  '/impressum.html',
  '/404.html',
  '/css/style.css',
  '/js/main.js',
  '/favicon.svg',
  '/manifest.json'
  // NOTE: admin.html and admin.js deliberately excluded from cache
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API requests, admin pages, or auth endpoints
  if (url.pathname.startsWith('/api/') || url.pathname.includes('admin')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/404.html');
        }
      });
    })
  );
});
