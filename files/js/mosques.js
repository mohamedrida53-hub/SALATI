import {
  OSM_TILES, OSM_ATTRIBUTION, OVERPASS_ENDPOINTS,
  OVERPASS_SERVER_TIMEOUT, OVERPASS_CLIENT_TIMEOUT, MOSQUE_LIMIT,
  MOSQUE_RADII, DEFAULT_MOSQUE_RADIUS, STORAGE_KEYS,
} from './config.js';
import { KAABA } from './config.js';
import { $, el, showState, hideState, haversineKm, load, save, toast } from './utils.js';
import { t, getLocale } from './i18n.js';

/* Centro por defecto cuando aún no hay ubicación: la Kaaba. El mapa carga
   igual y el usuario ve algo con sentido en vez de una pantalla de error. */
const FALLBACK_PLACE = { lat: KAABA.lat, lon: KAABA.lon, label: 'Makkah' };

/* =========================================================
   Mezquitas cercanas.

   Mapa      : Leaflet 1.9.4 servido desde js/vendor (sin CDN, cachea el SW).
   Teselas   : OpenStreetMap, sin clave de API.
   Datos     : Overpass API — nodes/ways/relations con
               amenity=place_of_worship y religion=muslim.

   El mapa se crea la primera vez que se abre la pestaña, no al arrancar:
   Leaflet mide el contenedor y en un panel oculto mediría 0×0.
   ========================================================= */

const dom = {};

let map = null;
let markerLayer = null;
let meMarker = null;
let sizeObserver = null;
let activeController = null;   // petición en curso, para poder cancelarla
let retries = 0;               // fallos seguidos de LA MISMA consulta
let attemptKey = null;         // consulta a la que corresponde ese contador
const MAX_RETRIES = 2;
let radius = DEFAULT_MOSQUE_RADIUS;
let lastQueryKey = null;       // evita repetir la misma consulta al volver a la pestaña
let results = [];
let hooks = { onNeedLocation: null };

export function initMosques(callbacks = {}) {
  hooks = { ...hooks, ...callbacks };

  dom.state = $('#mosques-state');
  dom.wrap = $('#mosques-wrap');
  dom.map = $('#map');
  dom.list = $('#mosque-list');
  dom.notice = $('#mosque-notice');
  dom.summary = $('#mosque-summary');
  dom.radius = $('#radius-select');
  dom.recenter = $('#btn-recenter');

  const saved = Number(load(STORAGE_KEYS.radius, DEFAULT_MOSQUE_RADIUS));
  radius = MOSQUE_RADII.includes(saved) ? saved : DEFAULT_MOSQUE_RADIUS;

  dom.radius.replaceChildren(
    ...MOSQUE_RADII.map((km) => el('option', { value: km, text: `${km} km` })),
  );
  dom.radius.value = String(radius);
  dom.radius.addEventListener('change', () => {
    radius = Number(dom.radius.value);
    save(STORAGE_KEYS.radius, radius);
    lastQueryKey = null;
    refresh();
  });

  dom.recenter.addEventListener('click', () => {
    const place = currentPlace();
    if (place && map) map.setView([place.lat, place.lon], zoomForRadius(radius));
  });
}

let state = null;

/**
 * Punto de entrada desde app.js cuando se abre la pestaña o cambia el estado.
 *
 * Regla de oro tras el bucle de errores: **el mapa se pinta siempre**. Antes,
 * sin ubicación no se creaba el mapa y se tapaba todo con una tarjeta de error
 * que sólo ofrecía «Reintentar»; si además Overpass fallaba, el usuario nunca
 * llegaba a ver un mapa. Ahora la falta de ubicación y el fallo de la búsqueda
 * son avisos dentro de la vista, no pantallas que la sustituyen.
 */
export function renderMosques(next) {
  state = next;

  hideState(dom.state);
  dom.wrap.hidden = false;

  const place = currentPlace();
  const centro = place ?? FALLBACK_PLACE;

  if (!ensureMap(centro)) return;   // Leaflet no cargó: ensureMap ya avisó

  if (!place) {
    // Sin ubicación se enseña el mapa sobre La Meca y se invita a elegirla,
    // en vez de dejar la pestaña en blanco.
    showNotice(t('mosques.noLocMsg'), t('qibla.noLocAction'), () => hooks.onNeedLocation?.());
    map.setView([centro.lat, centro.lon], 6);
    placeMe(centro);
    return;
  }

  clearNotice();
  refresh();
}

function currentPlace() {
  const place = state?.place;
  return place && Number.isFinite(place.lat) ? place : null;
}

/** Aviso dentro de la vista, encima de la lista. Nunca sustituye al mapa. */
function showNotice(mensaje, etiqueta, accion) {
  dom.notice.hidden = false;
  dom.notice.replaceChildren(
    el('p', { class: 'mosques__notice-txt', text: mensaje }),
    etiqueta ? el('button', { class: 'btn btn--ghost', type: 'button', text: etiqueta, onclick: accion }) : null,
  );
}

function clearNotice() {
  dom.notice.hidden = true;
  dom.notice.replaceChildren();
}

/** Repinta textos tras un cambio de idioma sin volver a llamar a Overpass. */
export function refreshMosquesText() {
  if (!dom.list) return;
  renderList();
}

/* ---------------- Mapa ---------------- */

const log = (...args) => console.log('[SALATI/mapa]', ...args);
const logError = (...args) => console.error('[SALATI/mapa]', ...args);

/**
 * Crea el mapa una sola vez y lo mantiene con el tamaño correcto.
 *
 * El fallo clásico de Leaflet: si se instancia mientras su contenedor está
 * oculto, mide 0×0 y queda gris para siempre. Aquí puede pasar porque el
 * panel vive con `hidden` hasta que se abre la pestaña. Se cubre por partida
 * doble: se remide en el siguiente frame y, además, un ResizeObserver avisa
 * de cualquier cambio de tamaño posterior (rotar el móvil, teclado, etc.).
 */
function ensureMap(place) {
  if (map) {
    scheduleInvalidate();
    return true;
  }

  if (typeof L === 'undefined') {
    logError('Leaflet no se ha cargado. Revisa js/vendor/leaflet.js en el HTML.');
    showState(dom.state, { kind: 'error', title: t('mosques.errorTitle'), message: t('mosques.errorMsg') });
    return false;
  }

  try {
    map = L.map(dom.map, {
      center: [place.lat, place.lon],
      zoom: zoomForRadius(radius),
      zoomControl: true,
      attributionControl: true,
      // El zoom por rueda en un panel con scroll secuestra la página.
      scrollWheelZoom: false,
    });

    const tiles = L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION });
    let tileErrors = 0;
    tiles.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors === 5) logError('Varias teselas no cargan. ¿Sin conexión o OSM bloqueado?');
    });
    tiles.addTo(map);

    // Agrupación de marcadores. Si la librería no está, se cae a una capa
    // normal en vez de romper el mapa entero.
    markerLayer = typeof L.markerClusterGroup === 'function'
      ? L.markerClusterGroup({
        maxClusterRadius: 45,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 17,
        iconCreateFunction: (cluster) => L.divIcon({
          html: `<span class="cluster">${cluster.getChildCount()}</span>`,
          className: 'pin-wrap',
          iconSize: [36, 36],
        }),
      })
      : L.layerGroup();

    if (typeof L.markerClusterGroup !== 'function') {
      log('Leaflet.markercluster no disponible: se pintan los marcadores sueltos.');
    }
    markerLayer.addTo(map);

    observeSize();
    scheduleInvalidate();
    log('Mapa creado en', place.lat, place.lon);
    return true;
  } catch (err) {
    logError('No se ha podido crear el mapa:', err);
    map = null;
    showState(dom.state, { kind: 'error', title: t('mosques.errorTitle'), message: t('mosques.errorMsg') });
    return false;
  }
}

/** Remide en el siguiente frame, cuando el navegador ya ha hecho el layout. */
function scheduleInvalidate() {
  requestAnimationFrame(() => {
    if (!map) return;
    map.invalidateSize({ animate: false });
    const { x, y } = map.getSize();
    if (x === 0 || y === 0) logError('El contenedor del mapa mide 0×0. ¿Está oculto un ancestro?');
  });
}

function observeSize() {
  if (sizeObserver || typeof ResizeObserver === 'undefined') return;
  sizeObserver = new ResizeObserver(() => {
    if (map) map.invalidateSize({ animate: false });
  });
  sizeObserver.observe(dom.map);
}

/** Un radio de 2 km cabe en zoom 14; cada duplicación baja un nivel. */
function zoomForRadius(km) {
  if (km <= 2) return 14;
  if (km <= 5) return 13;
  if (km <= 10) return 12;
  return 10;
}

/* ---------------- Iconos ---------------- */

/* Los dos marcadores se dibujan con SVG en línea dentro de un L.divIcon:
   así no hace falta ningún PNG y el color se controla desde aquí.
   Las teselas de OpenStreetMap son claras, de modo que ambos llevan
   contorno oscuro o blanco para que no se pierdan sobre el mapa. */

/** Mezquita: gota verde con la silueta de una cúpula y dos alminares. */
const MOSQUE_SVG = `
<svg viewBox="0 0 30 38" width="30" height="38" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 36.5S27.5 22 27.5 14A12.5 12.5 0 1 0 2.5 14C2.5 22 15 36.5 15 36.5z"
        fill="#12a150" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
  <g fill="#ffffff">
    <path d="M15 7.4c.95 1.05 1.5 1.85 1.5 2.6 0 .5-.28.93-.72 1.24 2.03.92 3.42 2.72 3.42 4.86v3.2h-8.4v-3.2c0-2.14 1.39-3.94 3.42-4.86-.44-.31-.72-.74-.72-1.24 0-.75.55-1.55 1.5-2.6z"/>
    <rect x="8" y="12.2" width="1.9" height="7.1" rx=".95"/>
    <rect x="20.1" y="12.2" width="1.9" height="7.1" rx=".95"/>
    <rect x="7.3" y="19.3" width="15.4" height="1.7" rx=".85"/>
  </g>
</svg>`;

/** Usuario: flecha dorada. El mapa está orientado al norte, así que apunta al norte. */
const ME_SVG = `
<svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
  <circle cx="15" cy="15" r="13.5" fill="rgba(10,8,2,.30)"/>
  <path d="M15 4.5 23 24 15 19.6 7 24z"
        fill="#f0cf7a" stroke="#3a2c07" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

const mosqueIcon = () => L.divIcon({
  html: MOSQUE_SVG,
  className: 'pin-wrap',
  iconSize: [30, 38],
  iconAnchor: [15, 36],    // la punta de la gota es lo que marca el sitio
  popupAnchor: [0, -32],
});

const meIcon = () => L.divIcon({
  html: ME_SVG,
  className: 'pin-wrap',
  iconSize: [30, 30],
  iconAnchor: [15, 15],    // la flecha se centra en la posición exacta
  popupAnchor: [0, -14],
});

function placeMe(place) {
  if (!map) return;
  const icon = meIcon();

  if (meMarker) meMarker.setLatLng([place.lat, place.lon]).setIcon(icon);
  else meMarker = L.marker([place.lat, place.lon], { icon, zIndexOffset: 1000 }).addTo(map);

  meMarker.bindPopup(`<strong>${escapeHtml(t('mosques.you'))}</strong>`);
}

/* ---------------- Consulta ---------------- */

async function refresh() {
  const place = currentPlace();
  if (!place || !map) return;

  // Última petición gana. Antes se descartaba la nueva y el resumen se pintaba
  // con el radio actual, así que salía «11 mezquitas en 25 km» con los datos
  // de 5 km. Ahora se cancela la anterior y sólo cuenta la última.
  activeController?.abort();

  map.setView([place.lat, place.lon], zoomForRadius(radius));
  placeMe(place);

  const key = `${place.lat.toFixed(3)}|${place.lon.toFixed(3)}|${radius}`;
  if (key === lastQueryKey) {
    renderList();   // mismos parámetros: se reutiliza lo ya descargado
    return;
  }

  // El tope de reintentos es por consulta. Cambiar de radio o de ciudad es
  // una consulta nueva y merece sus propios intentos: sin esto, dos fallos
  // de búsquedas distintas dejaban al usuario sin botón de reintentar.
  if (key !== attemptKey) { attemptKey = key; retries = 0; }

  const controller = new AbortController();
  activeController = controller;

  clearNotice();
  dom.map.classList.add('map--busy');
  dom.summary.textContent = t('mosques.searching');
  dom.list.replaceChildren();

  const t0 = performance.now();
  try {
    const found = await queryOverpass(place, radius, controller.signal);
    if (controller.signal.aborted) return;   // la pisó una búsqueda posterior

    lastQueryKey = key;
    retries = 0;
    results = found
      .map((m) => ({ ...m, km: haversineKm(place, { lat: m.lat, lon: m.lon }) }))
      .sort((a, b) => a.km - b.km);

    log(`${results.length} mezquitas en ${radius} km · ${Math.round(performance.now() - t0)} ms`);
    drawMarkers();
    renderList();
  } catch (err) {
    if (controller.signal.aborted) return;
    const lento = err?.name === 'AbortError';
    logError(lento
      ? `Overpass no respondió en ${OVERPASS_CLIENT_TIMEOUT} ms (radio ${radius} km).`
      : `Overpass falló tras ${Math.round(performance.now() - t0)} ms:`, err);
    showError(lento);
  } finally {
    if (activeController === controller) {
      activeController = null;
      dom.map.classList.remove('map--busy');
    }
  }
}

/**
 * El error ya no tapa el mapa: es un aviso encima de la lista y el mapa sigue
 * siendo usable (se puede mover, hacer zoom y ver dónde está uno).
 *
 * Los reintentos están limitados. Antes el botón «Reintentar» volvía a lanzar
 * la misma consulta contra el mismo espejo caído una y otra vez, y daba la
 * sensación de bucle infinito. Tras dos intentos seguidos se deja de ofrecer
 * y se sugiere lo único que suele funcionar: bajar el radio.
 */
function showError(abortado) {
  results = [];
  markerLayer?.clearLayers();
  dom.summary.textContent = '';
  dom.list.replaceChildren();

  // Sólo cuentan los reintentos que pulsa el usuario. Un mismo gesto puede
  // disparar dos búsquedas internas (el cambio de radio y el repintado del
  // estado), y antes eso agotaba los intentos antes de enseñar el botón.
  const puedeReintentar = retries < MAX_RETRIES;

  showNotice(
    abortado ? t('mosques.errorSlow') : t('mosques.errorMsg'),
    puedeReintentar ? t('mosques.retry') : null,
    () => { retries += 1; lastQueryKey = null; refresh(); },
  );

  if (!puedeReintentar) {
    logError(`Agotados los ${MAX_RETRIES} reintentos. Prueba con un radio menor o revisa la conexión.`);
  }
}

/**
 * Overpass QL: mezquitas en un radio dado.
 * `nwr` cubre nodos, vías y relaciones a la vez; `out center` devuelve
 * un punto único para las que son polígonos (la mayoría de edificios).
 * El número final limita cuántos elementos devuelve el servidor.
 *
 * Antes se probaba un espejo y, si tardaba, se pasaba al siguiente: con el
 * timeout de servidor en 25 s eso daba esperas de casi un minuto. Ahora se
 * lanzan los dos a la vez y gana el primero que conteste.
 */
async function queryOverpass(place, km, externalSignal) {
  const query = `[out:json][timeout:${OVERPASS_SERVER_TIMEOUT}];`
    + `nwr["amenity"="place_of_worship"]["religion"="muslim"]`
    + `(around:${km * 1000},${place.lat},${place.lon});`
    + `out center tags ${MOSQUE_LIMIT};`;

  const controller = new AbortController();
  // Red de seguridad propia: si ningún espejo contesta, no esperamos indefinidamente.
  const cut = setTimeout(() => controller.abort(), OVERPASS_CLIENT_TIMEOUT);
  // Y si el usuario cambia el radio, la señal de fuera corta esta consulta.
  externalSignal?.addEventListener('abort', () => controller.abort(), { once: true });

  const attempts = OVERPASS_ENDPOINTS.map(async (endpoint) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}`);
    const data = await response.json();
    return (data.elements || []).map(toMosque).filter(Boolean);
  });

  try {
    // `any` resuelve con la primera que va bien e ignora las que fallan.
    const found = await Promise.any(attempts);
    controller.abort();   // el otro espejo ya no hace falta
    return found;
  } catch (err) {
    // AggregateError: han fallado todas.
    throw err instanceof AggregateError ? (err.errors[0] ?? err) : err;
  } finally {
    clearTimeout(cut);
  }
}

function toMosque(element) {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const tags = element.tags || {};
  return {
    id: `${element.type}/${element.id}`,
    lat,
    lon,
    name: tags['name:ar'] || tags.name || '',
    address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
    city: tags['addr:city'] || '',
  };
}

/* ---------------- Pintado ---------------- */

function drawMarkers() {
  if (!markerLayer) return;
  markerLayer.clearLayers();

  for (const mosque of results) {
    const marker = L.marker([mosque.lat, mosque.lon], { icon: mosqueIcon() }).addTo(markerLayer);
    marker.bindPopup(popupHtml(mosque));
    mosque.marker = marker;
  }
}

function popupHtml(mosque) {
  const name = escapeHtml(mosque.name || t('mosques.unnamed'));
  const where = escapeHtml([mosque.address, mosque.city].filter(Boolean).join(', '));
  const km = formatKm(mosque.km);
  const link = `https://www.openstreetmap.org/directions?to=${mosque.lat}%2C${mosque.lon}`;
  return `<strong>${name}</strong><br>${where ? `${where}<br>` : ''}${km}<br>`
    + `<a href="${link}" target="_blank" rel="noopener">${escapeHtml(t('mosques.directions'))}</a>`;
}

function renderList() {
  if (!results.length) {
    dom.summary.textContent = t('mosques.none', { km: radius });
    dom.list.replaceChildren();
    return;
  }

  dom.summary.textContent = t('mosques.found', { n: results.length, km: radius });

  dom.list.replaceChildren(...results.map((mosque) => el('li', {
    class: 'mosque',
    tabindex: '0',
    role: 'button',
    onclick: () => focus(mosque),
    onkeydown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focus(mosque); }
    },
  }, [
    el('div', { class: 'mosque__body' }, [
      el('div', { class: 'mosque__name', text: mosque.name || t('mosques.unnamed') }),
      el('div', { class: 'mosque__meta', text: [mosque.address, mosque.city].filter(Boolean).join(', ') }),
    ]),
    el('div', { class: 'mosque__km', text: formatKm(mosque.km) }),
  ])));
}

function focus(mosque) {
  if (!map) return;
  map.setView([mosque.lat, mosque.lon], Math.max(map.getZoom(), 16));
  mosque.marker?.openPopup();
  dom.map.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------------- Auxiliares ---------------- */

function formatKm(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString(getLocale(), { maximumFractionDigits: 1 })} km`;
}

/** Los nombres vienen de OpenStreetMap, que es editable por cualquiera:
    nunca se inyectan en el popup sin escapar. */
function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}
