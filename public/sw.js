/* public/sw.js */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// (optionnel) mise en cache ultra simple de la shell
const CACHE = 'dc-v5-shell';
const ASSETS = [
  '/',            // si start_url = "/"
  '/index.html',  // Pages renvoie index.html de toute façon
  '/app-192.png', // adapte si tu as des icônes en /public
  '/app-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((res) =>
      res ||
      fetch(req).then((net) => {
        // cache-first pour les assets statiques
        const url = new URL(req.url);
        if (/\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
          const clone = net.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return net;
      }).catch(() => res)
    )
  );
});
