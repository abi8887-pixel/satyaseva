/* Service Worker for Satyaseva Sisters PWA
   ═══════════════════════════════════════════
   - Cache-first for static assets with background revalidation
   - Network-first for API calls
   - Update notification when new version is available
   - media.html added to pre-cache list
*/
const CACHE_NAME = 'satyaseva-v4';
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
  '/media.html',
  '/vocations.html',
  '/privacy.html',
  '/impressum.html',
  '/404.html',
  '/css/style.css',
  '/css/communities.css',
  '/css/community.css',
  '/css/foundress.css',
  '/css/memorial.css',
  '/js/main.js',
  '/js/gallery.js',
  '/js/communities-grid.js',
  '/js/community-detail.js',
  '/favicon.svg',
  '/manifest.json'
  // NOTE: admin.html and admin.js deliberately excluded from cache
];

/* ── Install: Pre-cache core assets ───────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Pre-cache warning (some assets may not exist yet):', err);
      });
    })
  );
  // Don't skip waiting automatically — let the update notification flow handle it
});

/* ── Activate: Clean old caches & notify clients ──────────── */
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
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

/* ── Fetch: Strategy-based caching ────────────────────────── */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Never cache API requests, admin pages, or auth endpoints
  if (url.pathname.startsWith('/api/') || url.pathname.includes('admin')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Background revalidation
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => null);

      // Return cache immediately, fall back to network
      if (cachedResponse) {
        return cachedResponse;
      }

      // No cache — wait for network
      return fetchPromise.then((networkResponse) => {
        if (networkResponse) return networkResponse;
        // Last resort: show offline fallback for HTML pages
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/404.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

/* ── Message handler: Skip waiting on command ─────────────── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
