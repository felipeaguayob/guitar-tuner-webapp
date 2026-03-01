const CACHE_NAME = 'tuner-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'app.js',
  'manifest.json'
];

// Instalar y guardar archivos en caché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Servir archivos desde la caché si no hay internet
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});