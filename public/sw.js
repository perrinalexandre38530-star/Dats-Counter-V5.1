// /public/sw.js — PWA stable + auto-update + purge des vieux caches
const VERSION = 'v2025-11-02-01';            // 🔁 INCRÉMENTE à chaque déploiement
const CACHE_STATIC = `dc-v5-static-${VERSION}`;

// 🔹 Shell/Assets à pré-cacher (icônes, etc.)
const ASSETS = [
  '/app-192.png',
  '/app-512.png',
];

// Installe instantanément + pré-cache des assets statiques
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then((c) => c.addAll(ASSETS).catch(() => {}))
  );
});

// Prend le contrôle + purge TOUTES les anciennes versions
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_STATIC).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Permet de forcer l’activation dès qu’une nouvelle build est dispo
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Stratégies de réponse
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ne gère que GET
  if (req.method !== 'GET') return;

  // 🔸 Navigation / HTML : NETWORK-FIRST pour toujours récupérer la dernière build
  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  if (isDoc) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 🔸 Assets statiques (js/css/img/fonts) : CACHE-FIRST + mise en cache runtime
  const url = new URL(req.url);
  const isStatic = /\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(url.pathname);
  if (isStatic) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // défaut : réseau direct (pas de cache)
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    // On ne met PAS index.html en cache longue durée pour éviter le stale
    return fresh;
  } catch (err) {
    // Si hors-ligne, tente un fallback éventuel
    return caches.match('/index.html') || new Response('', { status: 503 });
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const net = await fetch(req);
  const clone = net.clone();
  (await caches.open(CACHE_STATIC)).put(req, clone);
  return net;
}
