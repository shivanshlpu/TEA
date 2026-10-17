// ── Cafe Management (Owner Dashboard) PWA Service Worker ──
// Cache Versioning & Update Control
const CACHE_NAME = 'cafe-management-owner-v1.0.0';

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
        console.warn('[Owner SW] Pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Invalidate old caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[Owner SW] Purging old cache:', name);
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

  // A. EXCLUDE NON-GET REQUESTS
  if (request.method !== 'GET') {
    return;
  }

  // B. CRITICAL: NEVER CACHE OWNER API CALLS, WEBSOCKETS, OR UPLOADS
  // Keeps kitchen order statuses, payments, and dashboards 100% real-time.
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/socket.io') ||
    url.pathname.startsWith('/uploads') ||
    request.headers.get('accept')?.includes('application/json')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // C. HTML Navigation: Network-First with Cache Fallback
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

  // D. Static Assets: Stale-While-Revalidate
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

// 4. Message Event: Support instant update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 5. Push Event: Handle incoming Web Push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'Tea Bhatti Alert ☕',
    body: 'New update in Cafe Management',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/favicon.png',
    data: { url: '/orders' }
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const isUtr = (data.data && data.data.type === 'utr_submitted') || (data.title && data.title.includes('UTR'));
  const isVerify = (data.data && data.data.type === 'payment_verified');

  const options = {
    body: data.body || 'New order or payment received!',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/favicon.png',
    vibrate: [300, 100, 300, 100, 500],
    tag: data.tag || (isUtr ? 'utr-submitted' : 'tea-bhatti-alert'),
    renotify: true,
    requireInteraction: true, // Keep notification visible on screen until interacted with
    silent: false,
    data: data.data || { url: '/orders' },
    actions: [
      { action: 'open_orders', title: isUtr ? '💰 Verify Payment' : '👀 View Order' },
      { action: 'dismiss', title: '✕ Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Tea Bhatti Alert ☕', options)
  );
});

// 6. Notification Click Event: Focus or open window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
