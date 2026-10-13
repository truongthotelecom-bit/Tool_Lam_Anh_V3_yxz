// Service Worker cho Tool Bảng Số VIP (PWA Standalone)
const CACHE_NAME = 'bang-so-vip-v2';
const STATIC_ASSETS = [
  './index.html',
  'index.html',
  './css/style.css',
  './js/main.js',
  './js/configs.js',
  './js/template-manager.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('Lỗi nạp cache asset:', asset, err);
        }
      }
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

  // Không cache các API Google Apps Script hoặc external API request
  if (url.origin !== location.origin || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Cập nhật ngầm trong nền nếu có mạng
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).catch(async () => {
        // Fallback offline cho trang web khi mở từ màn hình chính
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('./index.html') || await caches.match('index.html');
          if (fallback) return fallback;
        }
      });
    })
  );
});
