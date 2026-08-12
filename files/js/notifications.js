import { PRAYERS, STORAGE_KEYS, ADHAN_URL } from './config.js';
import { cleanTime, timeToSeconds, secondsOfDayInZone, load, save, toast } from './utils.js';
import { t, prayerName, getLang } from './i18n.js';
import { writeFlag } from './prefs-db.js';
import { isIOS, isStandalone } from './platform.js';

/* ▼▼▼ PEGA AQUÍ TU CLAVE PÚBLICA VAPID CUANDO TENGAS SERVIDOR DE PUSH ▼▼▼
   Mientras esté vacía, la app no intenta suscribirse y todo lo demás
   funciona igual. Se genera con `npx web-push generate-vapid-keys`. */
const VAPID_PUBLIC_KEY = '';

/* =========================================================
   Avisos a la hora del rezo.

   Son dos ajustes independientes y cada uno tiene su interruptor:

     · adhan  → suena el audio del adhan. No necesita ningún permiso,
                sólo que el navegador haya desbloqueado el audio con un
                gesto del usuario (lo hacemos al encender el interruptor).
     · notify → aparece una notificación silenciosa. Necesita permiso.

   Se pueden usar por separado: sólo sonido, sólo aviso visual, los dos
   o ninguno. Los temporizadores viven en la página: mientras la app esté
   abierta (aunque sea en segundo plano) el aviso salta. Para que suene
   con la app cerrada haría falta Web Push con servidor o un envoltorio
   nativo; se explica en el README.
   ========================================================= */

let soundOn = load(STORAGE_KEYS.adhan, false);
let notifyOn = load(STORAGE_KEYS.notify, false);
let element = null;
let ctx = null;
let unlocked = false;   // ¿ya se desbloqueó la reproducción automática?
let lastFired = null;   // evita duplicados si se reprograma en el mismo minuto

export function notificationsSupported() {
  return 'Notification' in window;
}

/* ---------------- Web Push ---------------- */

/**
 * Suscribe el navegador al servicio de push.
 *
 * Ojo con cómo funciona Web Push, porque condiciona todo lo demás: el
 * navegador se suscribe a un servicio (FCM en Chrome, APNs en Safari) y
 * devuelve un endpoint. **Los mensajes los envía un servidor tuyo a ese
 * endpoint.** No existe forma de programar un push desde el propio cliente.
 *
 * Por eso esto no hace nada mientras `VAPID_PUBLIC_KEY` esté vacía: deja la
 * app lista para el día que haya servidor, sin romper nada mientras tanto.
 */
export async function subscribePush() {
  if (!VAPID_PUBLIC_KEY) return null;          // aún no hay servidor
  if (!('PushManager' in window)) return null; // iOS sin PWA instalada, p. ej.

  try {
    const reg = await navigator.serviceWorker.ready;
    const yaSuscrito = await reg.pushManager.getSubscription();
    if (yaSuscrito) return yaSuscrito;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,   // obligatorio en Chrome: todo push debe verse
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Aquí iría el envío del `sub` a tu servidor para que pueda avisarte.
    // await fetch('/api/subscribe', { method:'POST', body: JSON.stringify(sub) });
    return sub;
  } catch (err) {
    console.error('[SALATI/push] No se ha podido suscribir:', err);
    return null;
  }
}

/** La clave VAPID viaja en base64url y `subscribe` la exige como bytes. */
function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const limpio = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(limpio);
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}

export function permissionDenied() {
  return notificationsSupported() && Notification.permission === 'denied';
}

/* ---------------- Interruptor del adhan (sonido) ---------------- */

export function adhanEnabled() {
  return soundOn;
}

/** Debe llamarse desde un gesto del usuario: el audio sólo se desbloquea así. */
export function enableAdhan() {
  soundOn = true;
  save(STORAGE_KEYS.adhan, true);
  writeFlag('adhan', true);   // copia que sí puede leer el service worker
  unlockAudio();
  // Ahora sí interesa tener el audio guardado para cuando no haya conexión.
  navigator.serviceWorker?.ready
    .then((reg) => reg.active?.postMessage('CACHE_ADHAN'))
    .catch(() => {});
  return true;
}

export function disableAdhan() {
  soundOn = false;
  save(STORAGE_KEYS.adhan, false);
  writeFlag('adhan', false);
  stopAdhan();
}

/* ---------------- Interruptor de notificaciones ---------------- */

export function notificationsEnabled() {
  return notifyOn && notificationsSupported() && Notification.permission === 'granted';
}

export async function enableNotifications() {
  /* iOS 16.4+ sólo expone la API de notificaciones si la PWA está instalada
     en la pantalla de inicio. Desde una pestaña de Safari `Notification` ni
     existe, así que hay que decirlo en vez de dejar que falle en silencio. */
  if (isIOS() && !isStandalone()) {
    toast(t('notify.iosNeedsInstall'));
    return false;
  }

  if (!notificationsSupported()) {
    toast('Este navegador no admite notificaciones.');
    return false;
  }
  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = 'denied';
    }
  }
  if (permission !== 'granted') {
    toast('Permiso de notificaciones denegado. Puedes cambiarlo en los ajustes del navegador.');
    return false;
  }

  notifyOn = true;
  save(STORAGE_KEYS.notify, true);
  writeFlag('notify', true);   // copia que sí puede leer el service worker
  await subscribePush();       // no hace nada si no hay clave VAPID configurada
  return true;
}

export function disableNotifications() {
  notifyOn = false;
  save(STORAGE_KEYS.notify, false);
  writeFlag('notify', false);
}

/* ---------------- Programación ---------------- */

/* Antes había un setTimeout por rezo, de hasta varias horas. Los navegadores
   estrangulan los temporizadores de las pestañas en segundo plano y los
   agrupan, así que un timer tan largo puede dispararse tarde o no llegar a
   dispararse. Ahora se guarda la lista de horas y un único intervalo corto
   comprueba si alguna ha llegado: aunque el navegador lo frene a una vez por
   minuto, el aviso sigue saltando con un margen de segundos. */
const CHECK_MS = 15000;
const GRACE_SEC = 300;   // si la pestaña estuvo congelada, no avisamos de un rezo de hace horas

let pending = [];
let ticker = null;
let zone = null;
let placeLabel = null;

function clearTimers() {
  clearInterval(ticker);
  ticker = null;
  pending = [];
}

/**
 * Programa los avisos que quedan del día.
 * Se vuelve a llamar cada vez que cambian los horarios, el lugar o el día.
 */
export function scheduleAdhan({ timings, timezone, label } = {}) {
  clearTimers();
  // Basta con que uno de los dos avisos esté encendido.
  if (!timings || (!soundOn && !notificationsEnabled())) return 0;

  zone = timezone;
  placeLabel = label;
  const nowSec = secondsOfDayInZone(zone);

  for (const prayer of PRAYERS) {
    if (prayer.info) continue;
    const sec = timeToSeconds(timings[prayer.key]);
    if (!Number.isFinite(sec) || sec <= nowSec) continue;
    pending.push({ prayer, sec, clock: cleanTime(timings[prayer.key]) });
  }

  if (pending.length) ticker = setInterval(check, CHECK_MS);
  return pending.length;
}

function check() {
  if (!pending.length) { clearTimers(); return; }

  const nowSec = secondsOfDayInZone(zone);
  const due = pending.filter((p) => nowSec >= p.sec);
  if (!due.length) return;

  pending = pending.filter((p) => nowSec < p.sec);

  // Si se acumula más de uno (pestaña dormida), sólo interesa el último.
  const last = due[due.length - 1];
  if (nowSec - last.sec <= GRACE_SEC) fire(last.prayer, last.clock, placeLabel);

  if (!pending.length) clearTimers();
}

async function fire(prayer, clock, label) {
  const stamp = `${new Date().toDateString()}|${prayer.key}`;
  if (lastFired === stamp) return;
  lastFired = stamp;

  const name = prayerName(prayer.key);
  const body = [t('notify.body', { name, time: clock }), label].filter(Boolean).join(' · ');

  if (notificationsEnabled()) {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      const options = {
        body,
        tag: `adhan-${prayer.key}`,
        renotify: true,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        lang: getLang(),
        /* `silent` SÓLO cuando el adhan va a sonar por su cuenta: así no se
           pisan dos sonidos. Antes era incondicional, y eso hacía que en
           Android la notificación llegara muda y sin banner emergente —
           el usuario sólo la veía si bajaba la persiana. Con el adhan
           apagado ahora suena el tono del sistema, que es lo que el usuario
           espera de un aviso. */
        silent: soundOn,
        vibrate: [220, 120, 220],
        requireInteraction: !soundOn,   // sin sonido, que al menos no se esfume
        data: { url: './#prayer', prayer: prayer.key },
      };
      // En Android `new Notification()` lanza excepción: hay que pasar por el service worker.
      if (registration?.showNotification) await registration.showNotification(`${name} · ${prayer.ar}`, options);
      else new Notification(`${name} · ${prayer.ar}`, options);
    } catch {
      toast(t('notify.body', { name, time: clock }));
    }
  } else if (soundOn) {
    // Sin aviso visual, al menos que quede constancia en pantalla.
    toast(t('notify.body', { name, time: clock }));
  }

  if (soundOn) playAdhan();
}

/* ---------------- Sonido ---------------- */

function audioContext() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/* iOS suspende el AudioContext en cuanto la app pasa a segundo plano y NO lo
   reanuda solo al volver. Sin esto, tras minimizar la app la campanilla de
   reserva se quedaba muda para el resto de la sesión. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ctx?.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
});

/**
 * Al recargar la página el navegador vuelve a bloquear la reproducción
 * automática, aunque el interruptor del adhan siguiera encendido. Sin esto,
 * a la hora del rezo `play()` era rechazado y sonaba la campanilla de reserva
 * en vez del adhan. Aprovechamos el primer toque del usuario, sea cual sea.
 */
/** Desbloqueo inmediato, para llamar desde un gesto explícito del usuario. */
export function primeAudioNow() {
  unlockAudio();
}

export function primeAudioOnFirstGesture() {
  const once = () => {
    document.removeEventListener('pointerdown', once, true);
    document.removeEventListener('keydown', once, true);
    if (soundOn) unlockAudio();
  };
  document.addEventListener('pointerdown', once, true);
  document.addEventListener('keydown', once, true);
}

/**
 * Prepara el audio durante un gesto del usuario para que luego pueda sonar solo.
 *
 * iOS es el caso exigente: Safari sólo levanta el bloqueo de reproducción
 * automática si el elemento se reproduce DENTRO del gesto, no después. Por eso
 * aquí se llama a `play()` de inmediato y se pausa en cuanto arranca, en vez
 * de esperar a que cargue. El `load()` previo fuerza a WebKit a empezar a
 * traerse el archivo, que si no se queda en `preload="none"` en móvil.
 */
export function unlockAudio() {
  audioContext();

  if (!element) {
    element = new Audio(ADHAN_URL);
    element.preload = 'auto';
    element.volume = 0.9;
    // iOS ignora `preload` hasta que hay interacción: esto la aprovecha.
    try { element.load(); } catch { /* nada que hacer */ }
  }

  const played = element.play();
  if (played?.then) {
    played
      .then(() => { element.pause(); element.currentTime = 0; unlocked = true; })
      .catch(() => { unlocked = false; });
  } else {
    element.pause();
    element.currentTime = 0;
    unlocked = true;
  }
}

/** ¿Se ha conseguido desbloquear el audio con algún gesto del usuario? */
export function audioUnlocked() {
  return unlocked;
}

export async function playAdhan() {
  // Si el contexto quedó suspendido (iOS lo hace al ir a segundo plano),
  // se reanuda antes de nada: si no, la campanilla de reserva sería muda.
  audioContext();

  try {
    if (!element) {
      element = new Audio(ADHAN_URL);
      element.volume = 0.9;
    }
    element.currentTime = 0;
    await element.play();
  } catch {
    chime();   // sin archivo de adhan o con autoplay bloqueado: campanilla sintetizada
  }
}

export function stopAdhan() {
  if (element) { element.pause(); element.currentTime = 0; }
}

/** Dos notas suaves generadas con Web Audio: cero archivos, cero licencias. */
export function chime() {
  const audio = audioContext();
  if (!audio) return;
  const start = audio.currentTime + 0.02;

  [[528, 0], [396, 0.55]].forEach(([frequency, offset]) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + offset);
    gain.gain.linearRampToValueAtTime(0.25, start + offset + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 1.6);
    osc.connect(gain).connect(audio.destination);
    osc.start(start + offset);
    osc.stop(start + offset + 1.7);
  });
}
