import {
  OSM_TILES, OSM_ATTRIBUTION, OVERPASS_ENDPOINTS,
  MOSQUE_RADII, DEFAULT_MOSQUE_RADIUS, STORAGE_KEYS,
} from './config.js';
import { $, el, showState, hideState, haversineKm, load, save, toast } from './utils.js';
import { t, getLocale } from './i18n.js';

/* =========================================================
   Mezquitas cercanas.

   Mapa      : Leaflet 1.9.4 servido desde js/vendor (sin CDN, cachea el SW).
   Teselas   : OpenStreetMap, sin clave de API.
   Datos     : Overpass API — nodes/ways/relations con
               amenity=place_of_worship y religion=muslim.

   El mapa se crea la primera vez que se abre la pestaña, no al arrancar:
   Leaflet mide el contenedor y en un panel oculto mediría 0×0.
   ========================================================= */

const OVERPASS_TIMEOUT = 25;   // segundos que le damos a Overpass
const dom = {};

let map = null;
let markerLayer = null;
let meMarker = null;
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

/** Punto de entrada desde app.js cuando se abre la pestaña o cambia el estado. */
export function renderMosques(next) {
  state = next;
  const place = currentPlace();

  if (!place) {
    dom.wrap.hidden = true;
    showState(dom.state, {
      title: t('mosques.noLocTitle'),
      message: t('mosques.noLocMsg'),
      actionLabel: t('qibla.noLocAction'),
      onAction: () => hooks.onNeedLocation?.(),
    });
    return;
  }

  hideState(dom.state);
  dom.wrap.hidden = false;
  ensureMap(place);
  refresh();
}

function currentPlace() {
  const place = state?.place;
  return place && Number.isFinite(place.lat) ? place : null;
}

/** Repinta textos tras un cambio de idioma sin volver a llamar a Overpass. */
export function refreshMosquesText() {
  if (!dom.list) return;
  renderList();
}

/* ---------------- Mapa ---------------- */

function ensureMap(place) {
  if (map) {
    map.invalidateSize();   // el panel estaba oculto: Leaflet debe remedir
    return;
  }
  if (typeof L === 'undefined') {
    showState(dom.state, { kind: 'error', title: t('mosques.errorTitle'), message: t('mosques.errorMsg') });
    return;
  }

  map = L.map(dom.map, {
    center: [place.lat, place.lon],
    zoom: zoomForRadius(radius),
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer(OSM_TILES, {
    maxZoom: 19,
    attribution: OSM_ATTRIBUTION,
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
}

/** Un radio de 2 km cabe en zoom 14; cada duplicación baja un nivel. */
function zoomForRadius(km) {
  if (km <= 2) return 14;
  if (km <= 5) return 13;
  if (km <= 10) return 12;
  return 10;
}

function placeMe(place) {
  if (!map) return;
  const html = '<span class="pin pin--me"></span>';
  const icon = L.divIcon({ html, className: 'pin-wrap', iconSize: [18, 18], iconAnchor: [9, 9] });

  if (meMarker) meMarker.setLatLng([place.lat, place.lon]).setIcon(icon);
  else meMarker = L.marker([place.lat, place.lon], { icon, zIndexOffset: 1000 }).addTo(map);

  meMarker.bindPopup(`<strong>${escapeHtml(t('mosques.you'))}</strong>`);
}

/* ---------------- Consulta ---------------- */

async function refresh() {
  const place = currentPlace();
  if (!place || !map) return;

  map.setView([place.lat, place.lon], zoomForRadius(radius));
  placeMe(place);

  const key = `${place.lat.toFixed(3)}|${place.lon.toFixed(3)}|${radius}`;
  if (key === lastQueryKey) {
    renderList();
    return;
  }

  dom.summary.textContent = t('mosques.searching');
  dom.list.replaceChildren();

  try {
    const found = await queryOverpass(place, radius);
    lastQueryKey = key;
    results = found
      .map((m) => ({ ...m, km: haversineKm(place, { lat: m.lat, lon: m.lon }) }))
      .sort((a, b) => a.km - b.km);
    drawMarkers();
    renderList();
  } catch {
    results = [];
    markerLayer?.clearLayers();
    dom.summary.textContent = '';
    dom.list.replaceChildren(el('li', { class: 'mosque mosque--error' }, [
      el('div', {}, [
        el('div', { class: 'mosque__name', text: t('mosques.errorTitle') }),
        el('div', { class: 'mosque__meta', text: t('mosques.errorMsg') }),
      ]),
      el('button', { class: 'btn btn--ghost', type: 'button', text: t('mosques.retry'), onclick: () => { lastQueryKey = null; refresh(); } }),
    ]));
  }
}

/**
 * Overpass QL: mezquitas en un radio dado.
 * `nwr` cubre nodos, vías y relaciones a la vez; `out center` devuelve
 * un punto único para las que son polígonos (la mayoría de edificios).
 */
async function queryOverpass(place, km) {
  const query = `[out:json][timeout:${OVERPASS_TIMEOUT}];
nwr["amenity"="place_of_worship"]["religion"="muslim"](around:${km * 1000},${place.lat},${place.lon});
out center tags;`;

  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const data = await response.json();
      return (data.elements || []).map(toMosque).filter(Boolean);
    } catch (err) {
      lastError = err;   // espejo saturado o caído: probamos el siguiente
    }
  }
  throw lastError ?? new Error('Overpass no disponible');
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
    const icon = L.divIcon({
      html: '<span class="pin pin--mosque"></span>',
      className: 'pin-wrap',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const marker = L.marker([mosque.lat, mosque.lon], { icon }).addTo(markerLayer);
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
