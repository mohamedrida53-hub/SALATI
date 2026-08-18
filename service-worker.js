/* =========================================================
   Service worker de SALATI
   · SHELL : la app entera, precargada en la instalación (cache-first)
             incluye las tipografías, que ahora son locales
   · DATA  : respuestas de las APIs (network-first con reserva)
   · TILES : teselas del mapa (cache-first con tope)
   Sube la versión para forzar la actualización en los dispositivos.
   ========================================================= */

/* IMPORTANTE: este archivo tiene que vivir en la RAÍZ del proyecto.
   Un service worker sólo puede controlar su propia carpeta y las de debajo,
   así que desde `js/` era imposible que gobernara `/` y el registro fallaba
   con SecurityError: la app nunca llegaba a funcionar sin conexión.
   Las rutas relativas de SHELL_FILES se resuelven contra ESTA ubicación. */
/* v3.6.0 sube de versión sobre todo por el adhan: el archivo de audio cambió
   de grabación y las instalaciones existentes lo tienen guardado en la caché
   SHELL. Sin cambiar la versión seguirían sonando con el archivo anterior,
   que es justo el que había que dejar de distribuir. */
const VERSION = 'v3.7.0';
const SHELL = `SALATI-shell-${VERSION}`;
const DATA = `SALATI-data-${VERSION}`;
const TILES = `SALATI-tiles-${VERSION}`;
const CACHES = [SHELL, DATA, TILES];

/* Las teselas del mapa son muchas y pequeñas: se limita el cajón
   para no llenar la cuota del navegador con zonas que ya no se miran. */
const TILE_LIMIT = 300;

const SHELL_FILES = [
  './',
  './index.html',
  './privacidad.html',
  './privacy.html',
  './fonts.css',
  './styles.css',
  './manifest.json',
  './favicon.svg',
  './js/app.js',
  './js/api.js',
  './js/config.js',
  './js/analytics.js',
  './js/platform.js',
  './js/prefs-db.js',
  './js/native-notifications.js',
  './js/theme.js',
  './js/calendar.js',
  './js/city-search.js',
  './js/i18n.js',
  './js/langpicker.js',
  './js/location.js',
  './js/mosques.js',
  './js/notifications.js',
  './js/prayer.js',
  './js/prayer-alerts.js',
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
];

/* El adhan (2,7 MB) NO va en el precache: era el 76 % del peso de instalación
   y bloqueaba que la app quedara lista sin conexión. Se guarda bajo demanda
   cuando el usuario enciende el interruptor del adhan, que es el único
   momento en que va a necesitarlo. Ver `CACHE_ADHAN` más abajo. */
const ADHAN_URL = './audio/adhan.mp3';

const API_HOSTS = [
  'api.aladhan.com', 'api.quran.com', 'api.bigdatacloud.net',
  'overpass-api.de', 'overpass.kumi.systems',
  'nominatim.openstreetmap.org',
];
/* Ya no hay FONT_HOSTS: las tipografías se sirven desde el propio origen y
   las cubre la regla del final, junto al resto de archivos de la app. */
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
  if (event.data === 'SKIP_WAITING') { self.skipWaiting(); return; }

  /* La app pide guardar el adhan al encender su interruptor. Se hace aquí y
     no en la instalación para que la app quede lista sin conexión en
     segundos en vez de esperar a 2,7 MB de audio que quizá no se usen. */
  if (event.data === 'CACHE_ADHAN') {
    event.waitUntil((async () => {
      const cache = await caches.open(SHELL);
      if (await cache.match(ADHAN_URL)) return;   // ya estaba
      try {
        await cache.add(new Request(ADHAN_URL, { cache: 'reload' }));
      } catch { /* sin conexión: se reintentará la próxima vez */ }
    })());
  }
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

/* ---------------- Web Push ---------------- */

/* Lectura de los flags del usuario desde IndexedDB.
   El worker NO puede leer localStorage: es síncrono y sólo existe en el hilo
   de la ventana. Por eso la app copia los dos interruptores a IndexedDB
   (ver js/prefs-db.js) y aquí se consultan antes de mostrar nada. */
function leerFlag(clave, porDefecto = false) {
  return new Promise((resolve) => {
    let db;
    const req = indexedDB.open('salati-prefs', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('flags')) req.result.createObjectStore('flags');
    };
    req.onerror = () => resolve(porDefecto);
    req.onsuccess = () => {
      db = req.result;
      try {
        const tx = db.transaction('flags', 'readonly');
        const get = tx.objectStore('flags').get(clave);
        get.onsuccess = () => { resolve(get.result === undefined ? porDefecto : get.result); db.close(); };
        get.onerror = () => { resolve(porDefecto); db.close(); };
      } catch {
        resolve(porDefecto);
        db?.close();
      }
    };
  });
}

/**
 * Llega un mensaje del servidor de push.
 *
 * `userVisibleOnly: true` obliga a mostrar SIEMPRE una notificación: si no
 * se muestra, Chrome acaba revocando el permiso. Por eso, cuando el usuario
 * tiene los avisos apagados, lo correcto no es callar sino no estar
 * suscrito — la app se desuscribe al apagar el interruptor.
 */
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let datos = {};
    try { datos = event.data ? event.data.json() : {}; } catch { datos = {}; }

    // Tarea 3: se valida el estado del usuario ANTES de avisar de nada.
    const avisosOn = await leerFlag('notify', false);
    const adhanOn = await leerFlag('adhan', false);
    if (!avisosOn) return;   // el usuario los tiene apagados: no se muestra

    /* Campana individual del rezo. El servidor de push aún no existe (falta la
       clave VAPID), pero si algún día envía `prayer`, un rezo silenciado no
       debe colarse por esta vía saltándose la preferencia del usuario.
       Sin `prayer` en el mensaje no se filtra nada: sólo se descarta lo que
       consta explícitamente como silenciado. */
    if (datos.prayer) {
      const campanas = await leerFlag('prayerAlerts', null);
      if (campanas && campanas[datos.prayer] === false) return;
    }

    const titulo = datos.title || 'SALATI';
    await self.registration.showNotification(titulo, {
      body: datos.body || '',
      tag: datos.tag || 'adhan',
      renotify: true,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      // Silencioso sólo si el adhan va a sonar por su cuenta al abrir la app.
      silent: adhanOn,
      requireInteraction: !adhanOn,
      vibrate: [220, 120, 220],
      data: { url: datos.url || './#prayer' },
    });
  })());
});

/* El servicio de push puede rotar la suscripción por su cuenta. Sin esto,
   el usuario dejaría de recibir avisos sin enterarse. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const clientes = await self.clients.matchAll({ includeUncontrolled: true });
    for (const c of clientes) c.postMessage({ type: 'PUSH_RESUBSCRIBE' });
  })());
});

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
