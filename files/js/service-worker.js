/* =========================================================
   Service worker de SALATI
   · SHELL : la app entera, precargada en la instalación (cache-first)
   · DATA  : respuestas de las APIs (network-first con reserva)
   · FONTS : Google Fonts (stale-while-revalidate)
   Sube la versión para forzar la actualización en los dispositivos.
   ========================================================= */

const VERSION = 'v1.6.0';
const SHELL = `SALATI-shell-${VERSION}`;
const DATA = `SALATI-data-${VERSION}`;
const FONTS = `SALATI-fonts-${VERSION}`;
const TILES = `SALATI-tiles-${VERSION}`;
const CACHES = [SHELL, DATA, FONTS, TILES];

/* Las teselas del mapa son muchas y pequeñas: se limita el cajón
   para no llenar la cuota del navegador con zonas que ya no se miran. */
const TILE_LIMIT = 300;

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './favicon.svg',
  './js/app.js',
  './js/api.js',
  './js/config.js',
  './js/calendar.js',
  './js/i18n.js',
  './js/langpicker.js',
  './js/location.js',
  './js/mosques.js',
  './js/notifications.js',
  './js/prayer.js',
  './js/qibla.js',
  './js/quran.js',
  './js/store.js',
  './js/tasbih.js',
  './js/utils.js',
  './js/vendor/leaflet.js',
  './js/vendor/leaflet.css',
  './js/vendor/leaflet.markercluster.js',
  './js/vendor/MarkerCluster.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/logo-salati.png',
  './icons/logo-mark.png',
  // 2,7 MB: alarga la instalación, pero el adhan tiene que sonar sin conexión.
  './audio/adhan.mp3',
];

const API_HOSTS = [
  'api.aladhan.com', 'api.quran.com', 'api.bigdatacloud.net',
  'overpass-api.de', 'overpass.kumi.systems',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const TILE_HOSTS = ['tile.openstreetmap.org', 'a.tile.openstreetmap.org', 'b.tile.openstreetmap.org', 'c.tile.openstreetmap.org'];

/* ---------------- Ciclo de vida ---------------- */

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // Uno a uno: si un archivo opcional falla, no tumba la instalación entera.
    await Promise.all(SHELL_FILES.map((file) => cache.add(new Request(file, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('SALATI-') && !CACHES.includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------------- Estrategias ---------------- */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navegación: red primero para ver cambios, index.html cacheado si no hay conexión.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, './index.html'));
    return;
  }

  if (API_HOSTS.includes(url.hostname)) {
    event.respondWith(networkFirst(request, DATA));
    return;
  }

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, FONTS));
    return;
  }

  // Teselas del mapa: cache-first, que no cambian casi nunca.
  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirstCapped(request, TILES, TILE_LIMIT));
    return;
  }

  // El propio origen (HTML, CSS, JS, iconos, audio del adhan).
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
  }
});

async function put(cacheName, request, response) {
  // Las respuestas opacas (status 0) no se pueden guardar: se ignoran sin ruido.
  if (!response || !response.ok) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch { /* cuota llena o respuesta no cacheable */ }
}

async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const response = await fetch(request);
    await put(cacheName, request, response);
    return response;
  } catch (err) {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    if (fallbackUrl) {
      const shell = await caches.match(fallbackUrl);
      if (shell) return shell;
    }
    return new Response(
      JSON.stringify({ offline: true, message: 'Sin conexión y sin copia guardada.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

/** Cache-first con poda FIFO: al pasarse del tope se tiran las más antiguas. */
async function cacheFirstCapped(request, cacheName, limit) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    await put(cacheName, request, response);
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > limit) {
      await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
    }
    return response;
  } catch {
    return new Response('', { status: 504 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request, { ignoreVary: true });
  const network = fetch(request)
    .then((response) => { put(cacheName, request, response); return response; })
    .catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}

/* ---------------- Notificaciones ---------------- */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || './';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        client.postMessage({ type: 'NOTIFICATION_CLICK', url: target });
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
