const CACHE_NAME = 'haltero-ai-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Para librerías externas pesadas (MediaPipe, FontAwesome, Tailwind)
  // Estrategia CACHE FIRST: Si está en caché, no gasta internet. Perfecto para modelos IA.
  if (url.origin.includes('cdn.jsdelivr.net') || url.origin.includes('cdnjs.cloudflare.com') || url.origin.includes('cdn.tailwindcss.com')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch((err) => {
          console.warn('Offline and CDN not cached:', err);
        });
      })
    );
    return;
  }

  // Para archivos locales (index.html, SVG)
  // Estrategia STALE-WHILE-REVALIDATE: Carga instantáneo desde caché, pero actualiza en fondo.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch((e) => {
          console.warn('Fetch failed, likely offline', e);
      });
      
      return cachedResponse || fetchPromise;
    })
  );
});
