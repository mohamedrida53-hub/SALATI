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
import { track, trackScreen } from './analytics.js';
import { needsManualInstall, isIOSSafari } from './platform.js';
import { initTheme, getTheme, setTheme, THEMES } from './theme.js';
import { buscarCiudades, cancelarBusqueda, MIN_CARACTERES } from './city-search.js';
import { initLangPicker, render as renderLangPicker } from './langpicker.js';
import {
  notificationsSupported, notificationsEnabled, permissionDenied,
  enableNotifications, disableNotifications,
  adhanEnabled, enableAdhan, disableAdhan,
  scheduleAdhan, playAdhan, primeAudioOnFirstGesture, primeAudioNow, subscribePush,
  syncNativePermission,
} from './notifications.js';
import { $, $$, el, icon, apiDate, tomorrow, load, save, toast } from './utils.js';

const PANELS = ['prayer', 'qibla', 'mosques', 'calendar', 'quran', 'tasbih'];

/* Icono y etiqueta de cada modo de apariencia. Se declara aquí arriba y no
   junto a `buildThemePicker` a propósito: `wireSettings()` corre en el cuerpo
   del módulo y un `const` declarado más abajo aún estaría en zona muerta. */
const THEME_META = {
  auto:  { icon: 'icon-auto',       key: 'cfg.themeAuto' },
  light: { icon: 'icon-sun-theme',  key: 'cfg.themeLight' },
  dark:  { icon: 'icon-moon-theme', key: 'cfg.themeDark' },
};
let activeTab = 'prayer';
let installEvent = null;

/* ---------------- Arranque ---------------- */

// El idioma se resuelve antes que nada: el resto de módulos ya traduce al pintar.
initI18n();
applyStatic();
// El tema ya lo aplicó el script del <head>; esto sólo engancha el modo
// automático para que siga al sistema si el usuario lo cambia en caliente.
initTheme();

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
    buildThemePicker();
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
    /* Siempre por coordenadas. El buscador de ciudades ya las obtiene de
       Nominatim, así que no hace falta que Aladhan adivine nada a partir de
       texto: era justo lo que producía horarios equivocados. `place.query`
       sólo puede existir en datos guardados por versiones antiguas. */
    const tieneCoords = Number.isFinite(place.lat) && Number.isFinite(place.lon);
    const today = tieneCoords
      ? await getTimingsByCoords(place.lat, place.lon, state.method)
      : await getTimingsByAddress(place.query, state.method);

    /* Las nuestras mandan: sólo se aceptan las de la API cuando no teníamos.
       Antes se sobrescribían siempre, y eso tiraba a la basura las
       coordenadas exactas que acababa de elegir el usuario. */
    const resolved = {
      ...place,
      lat: tieneCoords ? place.lat : (Number.isFinite(today.meta.lat) ? today.meta.lat : place.lat),
      lon: tieneCoords ? place.lon : (Number.isFinite(today.meta.lon) ? today.meta.lon : place.lon),
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
  // Ahora todo lugar tiene coordenadas, así que la clave sale siempre de
  // ellas; el ramal por texto queda sólo para caché de versiones antiguas.
  if (Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
    return `g:${Number(place.lat).toFixed(2)},${Number(place.lon).toFixed(2)}`;
  }
  return `c:${place.query}`;
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

  wireExternalLink('#btn-donate', 'donate_click');
  wireExternalLink('#btn-gaza', 'gaza_click');

  buildThemePicker();

  const dlgIos = $('#dlg-ios');
  $('#btn-close-ios').addEventListener('click', () => dlgIos.close());
  dlgIos.addEventListener('click', (event) => {
    if (event.target === dlgIos) dlgIos.close();
  });

  /* En iOS nunca llega `beforeinstallprompt`, así que la fila de instalar
     no se mostraba jamás y el usuario ni sabía que podía instalarla. Aquí
     se muestra a mano cuando toca. */
  if (needsManualInstall()) $('#install-row').hidden = false;
  dlg.addEventListener('click', (event) => {
    if (event.target === dlg) dlg.close();   // clic en el fondo cierra
  });

  adhanToggle.checked = adhanEnabled();
  notifyToggle.checked = notificationsEnabled();

  // Las notificaciones dependen de un permiso; el sonido del adhan, no.
  if (!notificationsSupported() || permissionDenied()) notifyToggle.disabled = true;

  /* En el APK el estado del permiso llega de forma asíncrona desde el
     plugin, así que al arrancar el interruptor se pinta con datos aún sin
     confirmar. Esto lo corrige en cuanto Capacitor responde. */
  syncNativePermission().then(() => {
    notifyToggle.checked = notificationsEnabled();
    notifyToggle.disabled = !notificationsSupported() || permissionDenied();
  });

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
    // La métrica va primero y por separado: `track` nunca lanza, así que
    // pase lo que pase con la analítica la instalación sigue su curso.
    track('install_app');

    // iOS no implementa `beforeinstallprompt`: no hay diálogo nativo que
    // disparar, así que se explica el proceso manual paso a paso.
    if (needsManualInstall()) {
      track('install_ios_help');
      $('#ios-note').hidden = isIOSSafari();   // el aviso sólo si NO es Safari
      $('#dlg-ios').showModal();
      return;
    }

    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    installEvent = null;
    $('#install-row').hidden = true;

    // El clic sólo dice que le interesó; esto dice si llegó a instalarla.
    track('install_result', { outcome });   // 'accepted' o 'dismissed'

    if (outcome === 'accepted') toast(t('state.installed'));
  });

  // Al volver del segundo plano los temporizadores pueden haberse retrasado: se rearman.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) armAdhan();
  });
}

/**
 * Enlace externo que funciona igual en la web y en el APK.
 *
 * En el navegador basta con `target="_blank"`. Dentro de Capacitor eso
 * abriría la página en el propio WebView de la app, dejando al usuario
 * atrapado sin barra de direcciones ni botón de atrás fiable. Con
 * `@capacitor/browser` se abre una Custom Tab de Android: es el navegador
 * de verdad del sistema, con sus cookies y sesiones, y al cerrarla se
 * vuelve a SALATI donde estaba.
 *
 * La métrica va antes y por separado: `track` nunca lanza.
 */
function wireExternalLink(selector, evento) {
  const enlace = $(selector);
  if (!enlace) return;

  enlace.addEventListener('click', async (event) => {
    track(evento);

    const Browser = globalThis.Capacitor?.isNativePlatform?.()
      ? globalThis.Capacitor?.Plugins?.Browser
      : null;
    if (!Browser?.open) return;   // en web, que el ancla haga su trabajo

    event.preventDefault();
    try {
      await Browser.open({ url: enlace.href, presentationStyle: 'popover' });
    } catch (err) {
      console.error('[SALATI] No se ha podido abrir el enlace:', err);
      window.open(enlace.href, '_blank', 'noopener');   // reserva
    }
  });
}

/* ---------------- Apariencia ---------------- */

/** Control segmentado de tres opciones. Se repinta al cambiar de idioma. */
function buildThemePicker() {
  const box = $('#theme-picker');
  if (!box) return;

  const actual = getTheme();
  box.replaceChildren(...THEMES.map((valor) => {
    const meta = THEME_META[valor];
    return el('button', {
      class: 'segmented__opt',
      type: 'button',
      role: 'radio',
      'aria-checked': String(valor === actual),
      dataset: { theme: valor },
      onclick: () => {
        setTheme(valor);
        buildThemePicker();
        track('theme_change', { theme: valor });
      },
    }, [icon(meta.icon), el('span', { text: t(meta.key) })]);
  }));
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
  /* En la app nativa no hay service worker: los archivos ya van dentro del
     APK y build-www.mjs lo deja fuera a propósito. Registrarlo sólo
     provocaría un 404 sobre capacitor:// sin ganar nada. */
  if (globalThis.Capacitor?.isNativePlatform?.()) return;
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
  // También salta si instalan desde el menú del navegador, sin usar el botón.
  track('app_installed');
});

navigator.serviceWorker?.addEventListener('message', (event) => {
  // El servicio de push ha rotado la suscripción: hay que rehacerla.
  if (event.data?.type === 'PUSH_RESUBSCRIBE') subscribePush();
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

  wireCitySearch(dialog, input, form);
}

/* ---------------- Buscador de ciudades ---------------- */

let ciudadElegida = null;   // el único sitio del que salen las coordenadas

/**
 * Autocompletado contra Nominatim.
 *
 * La regla que arregla el bug: el botón de confirmar sólo se habilita cuando
 * `ciudadElegida` tiene valor, y eso sólo pasa al pulsar una sugerencia real.
 * Escribir «asdfgh» y darle a intro ya no genera horarios inventados.
 */
function wireCitySearch(dialog, input, form) {
  const lista = $('#city-results');
  const pista = $('#city-hint');
  const confirmar = $('#btn-city-ok');
  let resultados = [];
  let resaltado = -1;

  const marcarSinElegir = () => {
    ciudadElegida = null;
    confirmar.disabled = true;
  };

  const cerrarLista = () => {
    lista.hidden = true;
    lista.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    resaltado = -1;
  };

  const pintar = () => {
    if (!resultados.length) { cerrarLista(); return; }
    lista.replaceChildren(...resultados.map((sitio, i) => el('li', {
      class: `ac__item${i === resaltado ? ' ac__item--on' : ''}`,
      role: 'option',
      'aria-selected': String(i === resaltado),
      onclick: () => elegir(sitio),
    }, [
      el('span', { class: 'ac__name', text: sitio.label }),
      sitio.tipo ? el('span', { class: 'ac__type', text: sitio.tipo }) : null,
    ].filter(Boolean))));
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const elegir = (sitio) => {
    ciudadElegida = sitio;
    input.value = sitio.label;
    confirmar.disabled = false;
    pista.textContent = '';
    cerrarLista();
    input.focus();
  };

  input.addEventListener('input', async () => {
    marcarSinElegir();
    const texto = input.value.trim();

    if (texto.length < MIN_CARACTERES) {
      resultados = [];
      cerrarLista();
      pista.textContent = texto ? t('loc.typeMore') : '';
      return;
    }

    pista.textContent = t('loc.searching');
    const encontrados = await buscarCiudades(texto);

    // Si el usuario ha seguido escribiendo, esta respuesta ya no vale.
    if (input.value.trim() !== texto) return;

    resultados = encontrados;
    resaltado = -1;
    pintar();
    pista.textContent = encontrados.length ? t('loc.pickOne') : t('loc.noMatches');
  });

  // Flechas y Enter sobre la lista, sin obligar a soltar el teclado.
  input.addEventListener('keydown', (event) => {
    if (lista.hidden || !resultados.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const paso = event.key === 'ArrowDown' ? 1 : -1;
      resaltado = (resaltado + paso + resultados.length) % resultados.length;
      pintar();
    } else if (event.key === 'Enter' && resaltado >= 0) {
      event.preventDefault();
      elegir(resultados[resaltado]);
    } else if (event.key === 'Escape') {
      cerrarLista();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!ciudadElegida) { pista.textContent = t('loc.pickOne'); return; }

    showDialogError(t('loc.searching'));

    /* Se guardan las COORDENADAS, no el texto. Antes se mandaba la cadena a
       Aladhan y ésta resolvía lo que buenamente podía; ahora los horarios
       salen del punto exacto que el usuario ha señalado en la lista. */
    const place = {
      lat: ciudadElegida.lat,
      lon: ciudadElegida.lon,
      label: ciudadElegida.label,
      source: 'city',
    };
    setState({ place });
    await loadTimes(place);

    if (state.error) {
      showDialogError(state.errorKey ? t(state.errorKey) : state.error);
    } else {
      showDialogError('');
      dialog.close();
    }
  });

  dialog.addEventListener('close', () => {
    cancelarBusqueda();
    cerrarLista();
    pista.textContent = '';
  });
}

function openLocationDialog() {
  showDialogError('');
  ciudadElegida = null;
  const input = $('#city-input');
  $('#btn-city-ok').disabled = true;
  $('#city-hint').textContent = '';
  input.value = state.place?.label ?? '';
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

  // GA4 vería una sola página en toda la app: esto distingue las secciones.
  trackScreen(name);

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
