import { STORAGE_KEYS } from './config.js';
import { getTimingsByAddress, getTimingsByCoords, reverseGeocode } from './api.js';
import { requestPosition, geolocationAvailable } from './location.js';
import { state, setState, subscribe } from './store.js';
import { initPrayer, renderPrayer } from './prayer.js';
import { initQibla, renderQibla, enableCompass, stopCompass } from './qibla.js';
import { initQuran, ensureQuranLoaded, refreshQuranTranslation } from './quran.js';
import { initTasbih, setTasbihActive, refreshTasbih } from './tasbih.js';
import { initMosques, renderMosques, refreshMosquesText } from './mosques.js';
import { initCalendar, renderCalendar } from './calendar.js';
import { initI18n, onLangChange, applyStatic, t } from './i18n.js';
import { initLangPicker, render as renderLangPicker } from './langpicker.js';
import {
  notificationsSupported, notificationsEnabled, permissionDenied,
  enableNotifications, disableNotifications,
  adhanEnabled, enableAdhan, disableAdhan,
  scheduleAdhan, playAdhan, primeAudioOnFirstGesture, primeAudioNow,
} from './notifications.js';
import { $, $$, apiDate, tomorrow, load, save, toast } from './utils.js';

const PANELS = ['prayer', 'qibla', 'mosques', 'calendar', 'quran', 'tasbih'];
let activeTab = 'prayer';
let installEvent = null;

/* ---------------- Arranque ---------------- */

// El idioma se resuelve antes que nada: el resto de módulos ya traduce al pintar.
initI18n();
applyStatic();

initPrayer({
  onRetry: openLocationDialog,
  onDayChange: () => {
    if (state.place) loadTimes(state.place);
  },
});

initQibla({ onNeedLocation: openLocationDialog });
initMosques({ onNeedLocation: openLocationDialog });
initCalendar();
initQuran();
initTasbih();
initLangPicker();
wireTabs();
wireLocationUi();
wireSettings();
wireLanguage();
primeAudioOnFirstGesture();
registerServiceWorker();

subscribe(render);
render(state);
boot();

/** Al cambiar de idioma se repinta todo lo que ya estaba en pantalla. */
function wireLanguage() {
  onLangChange(() => {
    renderLangPicker();
    render(state);
    refreshTasbih();
    refreshMosquesText();
    refreshQuranTranslation();
    if (activeTab === 'calendar') renderCalendar();
  });
}

async function boot() {
  if (state.place) {
    loadTimes(state.place);
    return;
  }
  if (!geolocationAvailable()) {
    setState({ error: t('loc.noSecure'), errorKey: 'loc.noSecure' });
    return;
  }
  await useGeolocation({ silent: true });
}

/* ---------------- Datos ---------------- */

async function loadTimes(place) {
  setState({ loading: true, error: null, errorKey: null, tomorrowFajr: null });
  try {
    const byCity = place.source === 'city';
    const today = byCity
      ? await getTimingsByAddress(place.query, state.method)
      : await getTimingsByCoords(place.lat, place.lon, state.method);

    // Coordenadas y zona horaria confirmadas por la API (imprescindible al buscar por ciudad).
    const resolved = {
      ...place,
      lat: Number.isFinite(today.meta.lat) ? today.meta.lat : place.lat,
      lon: Number.isFinite(today.meta.lon) ? today.meta.lon : place.lon,
      timezone: today.meta.timezone,
    };

    setState({ place: resolved, today, loading: false, error: null, errorKey: null });
    cacheDay(resolved, today, null);
    armAdhan();

    // El Fajr de mañana sólo hace falta para la cuenta atrás nocturna: no bloquea la vista.
    const request = byCity
      ? getTimingsByAddress(place.query, state.method, tomorrow())
      : getTimingsByCoords(resolved.lat, resolved.lon, state.method, tomorrow());

    request
      .then((data) => {
        setState({ tomorrowFajr: data.timings?.Fajr ?? null });
        cacheDay(resolved, today, state.tomorrowFajr);
      })
      .catch(() => {});
  } catch (err) {
    const cached = readCachedDay(place);
    if (cached) {
      setState({ today: cached.today, tomorrowFajr: cached.tomorrowFajr ?? null, loading: false, error: null, errorKey: null });
      armAdhan();
      toast(t('state.offlineCached'));
    } else {
      setState({ loading: false, error: err.message || t('state.timesFailed'), errorKey: err.key ?? null });
    }
  }
}

/* Caché propia (además de la del service worker): permite pintar los horarios
   de hoy al instante y sin red, incluso antes de que responda ningún fetch. */

function placeKey(place) {
  return place.source === 'city'
    ? `c:${place.query}`
    : `g:${Number(place.lat).toFixed(2)},${Number(place.lon).toFixed(2)}`;
}

function cacheDay(place, today, tomorrowFajr) {
  save(STORAGE_KEYS.today, { stamp: apiDate(), key: placeKey(place), today, tomorrowFajr });
}

function readCachedDay(place) {
  const cached = load(STORAGE_KEYS.today, null);
  if (!cached || cached.stamp !== apiDate() || cached.key !== placeKey(place)) return null;
  return cached;
}

async function useGeolocation({ silent = false } = {}) {
  try {
    const { lat, lon } = await requestPosition();
    const place = { lat, lon, label: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, source: 'gps' };
    setState({ place });
    await loadTimes(place);

    const name = await reverseGeocode(lat, lon);
    if (name) setState({ place: { ...state.place, label: name } });
    return true;
  } catch (err) {
    // `errorKey` permite volver a traducir el mensaje si cambia el idioma.
    if (silent) setState({ error: err.message, errorKey: err.key ?? null });
    else showDialogError(err.message);
    return false;
  }
}

/* ---------------- Aviso del adhan ---------------- */

function armAdhan() {
  if (!state.today) return 0;
  return scheduleAdhan({
    timings: state.today.timings,
    timezone: state.today.meta.timezone,
    label: state.place?.label,
  });
}

function wireSettings() {
  const adhanToggle = $('#adhan-toggle');
  const notifyToggle = $('#notify-toggle');
  const dlg = $('#dlg-settings');

  // Abrir el panel es ya una interacción del usuario: es el momento perfecto
  // para desbloquear el audio, que es lo que el navegador exige para poder
  // reproducir el adhan solo más tarde.
  $('#btn-settings').addEventListener('click', () => {
    primeAudioNow();
    dlg.showModal();
  });

  $('#btn-close-cfg').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (event) => {
    if (event.target === dlg) dlg.close();   // clic en el fondo cierra
  });

  adhanToggle.checked = adhanEnabled();
  notifyToggle.checked = notificationsEnabled();

  // Las notificaciones dependen de un permiso; el sonido del adhan, no.
  if (!notificationsSupported() || permissionDenied()) notifyToggle.disabled = true;

  adhanToggle.addEventListener('change', () => {
    // El gesto del usuario es lo que desbloquea el audio: hay que aprovecharlo aquí.
    if (adhanToggle.checked) enableAdhan();
    else disableAdhan();
    announceAlerts();
  });

  notifyToggle.addEventListener('change', async () => {
    if (notifyToggle.checked) {
      const granted = await enableNotifications();
      notifyToggle.checked = granted;
      if (!granted && permissionDenied()) notifyToggle.disabled = true;
    } else {
      disableNotifications();
    }
    announceAlerts();
  });

  // Es un gesto del usuario, así que aquí el navegador siempre deja sonar el audio.
  $('#btn-test-adhan').addEventListener('click', () => playAdhan());

  $('#btn-install').addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    installEvent = null;
    $('#install-row').hidden = true;
    if (outcome === 'accepted') toast(t('state.installed'));
  });

  // Al volver del segundo plano los temporizadores pueden haberse retrasado: se rearman.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) armAdhan();
  });
}

/** Reprograma los avisos y confirma en un toast, ya que las filas no llevan texto. */
function announceAlerts() {
  const armed = armAdhan();
  const on = [
    adhanEnabled() ? t('prayer.adhanToggle') : null,
    notificationsEnabled() ? t('prayer.notifyToggle') : null,
  ].filter(Boolean);

  if (!on.length) {
    toast(t('state.alertsOff'));
    return;
  }
  // Se repite aquí lo de «con la app abierta» a propósito: es el momento en
  // que el usuario decide confiar en el aviso, y conviene que no se confunda.
  const etiquetas = on.join(' · ');
  toast(armed
    ? t('state.alertsOn', { on: etiquetas, n: armed })
    : t('state.alertsOnNext', { on: etiquetas }));
}

/* ---------------- PWA ---------------- */

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          toast(t('state.newVersion'));
        }
      });
    });
  } catch {
    // Sin service worker la app sigue funcionando, sólo pierde el modo sin conexión.
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installEvent = event;
  $('#install-row').hidden = false;
});

window.addEventListener('appinstalled', () => {
  installEvent = null;
  $('#install-row').hidden = true;
});

navigator.serviceWorker?.addEventListener('message', (event) => {
  if (event.data?.type === 'NOTIFICATION_CLICK') switchTab('prayer');
});

/* ---------------- Ubicación (interfaz) ---------------- */

function wireLocationUi() {
  const dialog = $('#dlg-location');
  const form = $('#form-location');
  const input = $('#city-input');

  $('#btn-location').addEventListener('click', openLocationDialog);
  $('#btn-close-dlg').addEventListener('click', () => dialog.close());

  $('#btn-geo').addEventListener('click', async () => {
    showDialogError('');
    const ok = await useGeolocation();
    if (ok) dialog.close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    showDialogError('Buscando…');
    const place = { query, label: query, source: 'city', lat: NaN, lon: NaN };
    setState({ place });
    await loadTimes(place);

    if (state.error) {
      showDialogError(state.error);
    } else {
      showDialogError('');
      dialog.close();
    }
  });
}

function openLocationDialog() {
  showDialogError('');
  if (state.place?.query) $('#city-input').value = state.place.query;
  $('#dlg-location').showModal();
}

function showDialogError(message) {
  const node = $('#dlg-error');
  node.textContent = message;
  node.hidden = !message;
}

/* ---------------- Pestañas ---------------- */

function wireTabs() {
  $$('.tabbar__btn').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.panel));
    tab.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const index = (PANELS.indexOf(tab.dataset.panel) + step + PANELS.length) % PANELS.length;
      switchTab(PANELS[index]);
      $(`#tab-${PANELS[index]}`).focus();
    });
  });

  const fromHash = location.hash.replace('#', '');
  switchTab(PANELS.includes(fromHash) ? fromHash : 'prayer');

  window.addEventListener('hashchange', () => {
    const name = location.hash.replace('#', '');
    if (PANELS.includes(name) && name !== activeTab) switchTab(name);
  });
}

function switchTab(name) {
  activeTab = name;
  history.replaceState(null, '', `#${name}`);

  for (const panel of PANELS) {
    $(`#panel-${panel}`).hidden = panel !== name;
    const tab = $(`#tab-${panel}`);
    tab.setAttribute('aria-selected', String(panel === name));
    tab.tabIndex = panel === name ? 0 : -1;
  }

  setTasbihActive(name === 'tasbih');

  if (name === 'quran') ensureQuranLoaded();
  if (name === 'mosques') renderMosques(state);
  if (name === 'calendar') renderCalendar();

  if (name === 'qibla') {
    renderQibla(state);
    // En Android se puede escuchar directamente; iOS necesita el botón de permiso.
    if (typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      enableCompass();
    }
  } else {
    stopCompass();
  }
}

/* ---------------- Render ---------------- */

function render(next) {
  $('#location-label').textContent = next.place?.label
    || (next.loading ? t('app.locSearching') : t('app.locChoose'));

  renderPrayer(next);
  if (activeTab === 'qibla') renderQibla(next);
  if (activeTab === 'mosques') renderMosques(next);
}

/* ---------------- Red ---------------- */

window.addEventListener('offline', () => toast(t('state.offlineGeneric')));
window.addEventListener('online', () => {
  if (state.place && !state.today) loadTimes(state.place);
});
