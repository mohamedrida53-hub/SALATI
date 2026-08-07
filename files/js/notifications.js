import { PRAYERS, STORAGE_KEYS, ADHAN_URL } from './config.js';
import { cleanTime, timeToSeconds, secondsOfDayInZone, load, save, toast } from './utils.js';
import { t, prayerName, getLang } from './i18n.js';

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
let lastFired = null;   // evita duplicados si se reprograma en el mismo minuto

export function notificationsSupported() {
  return 'Notification' in window;
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
  unlockAudio();
  return true;
}

export function disableAdhan() {
  soundOn = false;
  save(STORAGE_KEYS.adhan, false);
  stopAdhan();
}

/* ---------------- Interruptor de notificaciones ---------------- */

export function notificationsEnabled() {
  return notifyOn && notificationsSupported() && Notification.permission === 'granted';
}

export async function enableNotifications() {
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
  return true;
}

export function disableNotifications() {
  notifyOn = false;
  save(STORAGE_KEYS.notify, false);
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
        // `silent` deja el aviso sin sonido propio del sistema: si el usuario
        // quiere oír algo, para eso está el interruptor del adhan.
        silent: true,
        vibrate: [220, 120, 220],
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

/**
 * Al recargar la página el navegador vuelve a bloquear la reproducción
 * automática, aunque el interruptor del adhan siguiera encendido. Sin esto,
 * a la hora del rezo `play()` era rechazado y sonaba la campanilla de reserva
 * en vez del adhan. Aprovechamos el primer toque del usuario, sea cual sea.
 */
export function primeAudioOnFirstGesture() {
  const once = () => {
    document.removeEventListener('pointerdown', once, true);
    document.removeEventListener('keydown', once, true);
    if (soundOn) unlockAudio();
  };
  document.addEventListener('pointerdown', once, true);
  document.addEventListener('keydown', once, true);
}

/** Prepara el audio durante un gesto del usuario para que luego pueda sonar solo. */
export function unlockAudio() {
  audioContext();
  if (!element) {
    element = new Audio(ADHAN_URL);
    element.preload = 'auto';
    element.volume = 0.9;
  }
  const played = element.play();
  if (played?.then) {
    played.then(() => { element.pause(); element.currentTime = 0; }).catch(() => {});
  }
}

export async function playAdhan() {
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
