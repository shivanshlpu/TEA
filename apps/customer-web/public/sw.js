// ── Tea Bhatti Cafe PWA Service Worker ──
// Cache Versioning & Update Control
const CACHE_NAME = 'teabhatti-customer-v1.0.0';

// Core Application Shell assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/teabhatti-logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.png'
];

// 1. Install Event: Cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-cache warning (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Invalidate old caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Strict Caching Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A. EXCLUDE NON-GET REQUESTS (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') {
    return;
  }

  // B. CRITICAL: NEVER CACHE API CALLS, WEBSOCKETS, OR UPLOADS
  // This guarantees live fresh menus, real-time prices, socket updates, and active order statuses.
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/socket.io') ||
    url.pathname.startsWith('/uploads') ||
    request.headers.get('accept')?.includes('application/json')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // C. HTML Navigation Requests: Network-First with Cache Fallback
  // Ensures customer always receives latest deployment, but still loads if connection drops.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // D. Static Assets (JS, CSS, Images, Fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Message Event: Support immediate update skip
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
