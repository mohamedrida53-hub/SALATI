import { PRAYERS, STORAGE_KEYS, ADHAN_URL } from './config.js';
import { cleanTime, timeToSeconds, secondsOfDayInZone, load, save, toast } from './utils.js';
import { t, prayerName, getLang } from './i18n.js';

/* =========================================================
   Aviso de adhan.
   Los temporizadores viven en la página: mientras la app esté
   abierta (aunque sea en segundo plano) el aviso salta. Para que
   suene con la app cerrada haría falta Web Push con servidor o
   un envoltorio nativo; se explica en el README.
   ========================================================= */

let enabled = load(STORAGE_KEYS.notify, false);
let timers = [];
let element = null;
let ctx = null;
let lastFired = null;   // evita duplicados si se reprograma en el mismo minuto

export function notificationsSupported() {
  return 'Notification' in window;
}

export function notificationsEnabled() {
  return enabled && notificationsSupported() && Notification.permission === 'granted';
}

export function permissionDenied() {
  return notificationsSupported() && Notification.permission === 'denied';
}

/** Debe llamarse desde un gesto del usuario: los permisos y el audio lo exigen. */
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

  enabled = true;
  save(STORAGE_KEYS.notify, true);
  unlockAudio();   // aprovechamos este mismo gesto para desbloquear el sonido
  return true;
}

export function disableNotifications() {
  enabled = false;
  save(STORAGE_KEYS.notify, false);
  clearTimers();
}

/* ---------------- Programación ---------------- */

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

/**
 * Programa los avisos que quedan del día.
 * Se vuelve a llamar cada vez que cambian los horarios, el lugar o el día.
 */
export function scheduleAdhan({ timings, timezone, label } = {}) {
  clearTimers();
  if (!enabled || !timings || !notificationsEnabled()) return 0;

  const nowSec = secondsOfDayInZone(timezone);
  let armed = 0;

  for (const prayer of PRAYERS) {
    if (prayer.info) continue;
    const sec = timeToSeconds(timings[prayer.key]);
    if (!Number.isFinite(sec) || sec <= nowSec) continue;

    const delay = (sec - nowSec) * 1000;
    const clock = cleanTime(timings[prayer.key]);
    timers.push(setTimeout(() => fire(prayer, clock, label), delay));
    armed += 1;
  }
  return armed;
}

async function fire(prayer, clock, label) {
  const stamp = `${new Date().toDateString()}|${prayer.key}`;
  if (lastFired === stamp) return;
  lastFired = stamp;

  const name = prayerName(prayer.key);
  const body = [t('notify.body', { name, time: clock }), label].filter(Boolean).join(' · ');

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const options = {
      body,
      tag: `adhan-${prayer.key}`,
      renotify: true,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      lang: getLang(),
      vibrate: [220, 120, 220],
      data: { url: './#prayer', prayer: prayer.key },
    };
    // En Android `new Notification()` lanza excepción: hay que pasar por el service worker.
    if (registration?.showNotification) await registration.showNotification(`${name} · ${prayer.ar}`, options);
    else new Notification(`${name} · ${prayer.ar}`, options);
  } catch {
    toast(t('notify.body', { name, time: clock }));
  }

  playAdhan();
}

/* ---------------- Sonido ---------------- */

function audioContext() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
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
