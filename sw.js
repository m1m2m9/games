const CACHE_NAME = 'block-blast-v2';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/game.js',
    './manifest.json'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache opened');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Активация и очистка старого кэша
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

// Перехват запросов
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Возвращаем кэш или делаем сетевой запрос
                if (response) {
                    return response;
                }
                return fetch(event.request).then((response) => {
                    // Проверяем валидность ответа
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    // Кэшируем новые ресурсы
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    return response;
                });
            })
            .catch(() => {
                // Оффлайн fallback
                return caches.match('/index.html');
            })
    );
});
