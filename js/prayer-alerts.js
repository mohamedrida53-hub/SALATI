import { PRAYERS, STORAGE_KEYS } from './config.js';
import { load, save } from './utils.js';
import { writeFlag } from './prefs-db.js';

/* =========================================================
   Qué rezos avisan y cuáles están silenciados.

   Es un SEGUNDO filtro, no un sustituto de los interruptores generales.
   Para que un rezo avise tienen que cumplirse las dos condiciones:

     1. el interruptor general (adhan y/o notificaciones) está encendido
     2. la campana de ESE rezo está activa aquí

   El caso de uso que lo motiva es concreto: mucha gente quiere el adhan
   durante el día pero no que le suene el móvil a las 5 de la mañana con el
   Fajr, ni a medianoche con el Isha. Antes la única salida era apagarlo todo.

   Por defecto los cinco están activos: quien nunca toque una campana no
   nota que esto existe.
   ========================================================= */

/* Sólo los cinco obligatorios. El amanecer va marcado con `info: true` en
   config.js porque no es un rezo, nunca ha tenido aviso y tampoco lleva
   campana. Derivarlo de PRAYERS y no escribirlo a mano evita que las dos
   listas se separen si algún día cambia la configuración. */
const CLAVES = PRAYERS.filter((p) => !p.info).map((p) => p.key);

let prefs = normalizar(load(STORAGE_KEYS.prayerAlerts, null));

/**
 * Devuelve siempre un objeto con las cinco claves y valores booleanos.
 *
 * Se normaliza en vez de usar lo que haya en localStorage tal cual porque ese
 * valor no es de fiar: puede venir de una versión anterior sin alguna clave,
 * de un JSON a medio escribir o de una edición manual. La regla es «sólo
 * silenciado si vale exactamente false», así que cualquier dato corrupto o
 * ausente cae del lado seguro, que es avisar.
 */
function normalizar(bruto) {
  const salida = {};
  for (const clave of CLAVES) salida[clave] = bruto?.[clave] !== false;
  return salida;
}

/** ¿Avisa este rezo? Una clave desconocida (el amanecer) nunca avisa. */
export function prayerAlertOn(clave) {
  return prefs[clave] === true;
}

/** Copia del estado completo. Se devuelve clonado para que nadie lo mute por fuera. */
export function allPrayerAlerts() {
  return { ...prefs };
}

/**
 * Enciende o silencia un rezo. Devuelve el estado resultante.
 * Quien llame a esto debe reprogramar los avisos después: cambiar la
 * preferencia no toca las alarmas que ya estaban puestas.
 */
export function setPrayerAlert(clave, activo) {
  if (!CLAVES.includes(clave)) return false;
  prefs = { ...prefs, [clave]: Boolean(activo) };
  save(STORAGE_KEYS.prayerAlerts, prefs);
  // Espejo para el service worker, que no puede leer localStorage.
  writeFlag('prayerAlerts', prefs);
  return prefs[clave];
}

/** Invierte la campana de un rezo. Devuelve el estado resultante. */
export function togglePrayerAlert(clave) {
  return setPrayerAlert(clave, !prayerAlertOn(clave));
}

/**
 * ¿Queda algún rezo con aviso?
 *
 * Hace falta para no mentirle al usuario: con los cinco silenciados, los
 * interruptores generales siguen encendidos pero no va a sonar nada, y eso
 * hay que decirlo en vez de confirmar unos avisos que no existen.
 */
export function anyPrayerAlertOn() {
  return CLAVES.some((clave) => prefs[clave]);
}
