const CACHE_NAME = 'radio-chipeo-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/admin.css',
  '/intro-chipeo.css',
  '/intro-chipeo.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable.png',
  '/assets/apple-touch-icon.png',
  '/assets/img/radio-deh-4250bt.jpg',
  '/assets/img/logo-dricky.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Precache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first for JavaScript, HTML and API, cache-first for media
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for code (HTML, JS, CSS, JSON, API) to ensure fresh updates
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json') ||
    url.pathname === '/'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for images, fonts and media
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
