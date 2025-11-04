// ============================================
// /public/sw.js — PWA stable + auto-update + safe dev mode
// ============================================

const VERSION = 'v2025-11-04-01'; // 🔁 INCRÉMENTE à chaque déploiement
const CACHE_STATIC = `dc-v5-static-${VERSION}`;
const ORIGIN = self.location.origin;

// 🔹 Shell/Assets à pré-cacher (icônes, etc.)
const ASSETS = [
  '/app-192.png',
  '/app-512.png',
];

/* --------------------------------------------
   INSTALL — Pré-cache des assets essentiels
-------------------------------------------- */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then((c) => c.addAll(ASSETS).catch(() => {}))
  );
});

/* --------------------------------------------
   ACTIVATE — Purge des vieux caches + prise de contrôle immédiate
-------------------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_STATIC).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/* --------------------------------------------
   MESSAGE — Forcer SKIP_WAITING sur update
-------------------------------------------- */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* --------------------------------------------
   FETCH — Stratégies de réponse
-------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ne gère que GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ⚠️ Ignore les requêtes externes et StackBlitz/HMR (sinon crash en dev)
  if (
    url.origin !== ORIGIN ||
    /^\/@vite\//.test(url.pathname) ||
    /\.map$/i.test(url.pathname)
  )
    return;

  // 🔸 HTML / navigation : NETWORK-FIRST
  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  if (isDoc) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 🔸 Assets statiques (js/css/img/fonts) : CACHE-FIRST + runtime cache
  const isStatic = /\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(
    url.pathname
  );
  if (isStatic) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 🔸 Fallback : réseau direct
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

/* --------------------------------------------
   STRATÉGIES
-------------------------------------------- */
async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    return fresh; // on ne met pas index.html en cache longue durée
  } catch (err) {
    // Hors-ligne → fallback éventuel
    return (await caches.match('/index.html')) || new Response('', { status: 503 });
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
