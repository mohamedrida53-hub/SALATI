import { PRAYERS } from './config.js';
import { cleanTime, timeToSeconds, secondsOfDayInZone } from './utils.js';
import { t, prayerName, getLang } from './i18n.js';

/* =========================================================
   Notificaciones locales nativas (Capacitor / Android).

   Sustituye al temporizador del navegador cuando la app corre dentro de
   Capacitor: aquí las alarmas las programa el sistema operativo, así que
   suenan con la app cerrada, que es justo lo que el navegador no permitía.

   ---------------------------------------------------------
   Se accede al plugin por `window.Capacitor.Plugins`, NO con un import.

   Tu proyecto no tiene empaquetador: son módulos ES servidos tal cual, y
   `import { LocalNotifications } from '@capacitor/local-notifications'` es
   un especificador desnudo que el navegador no sabe resolver. Capacitor
   registra cada plugin instalado en `window.Capacitor.Plugins`, así que por
   esta vía funciona sin añadir Vite ni Webpack al proyecto.
   ---------------------------------------------------------

   EL DETALLE QUE MÁS CUESTA DESCUBRIR: desde Android 8 el sonido de una
   notificación lo decide su CANAL, no la notificación. Y los canales son
   inmutables: una vez creado, cambiarle el sonido no tiene ningún efecto.
   Por eso aquí se crean DOS canales, uno con el adhan y otro con el tono
   por defecto, y se elige el canal según el interruptor del usuario.
   Si algún día cambias el archivo de audio, tendrás que cambiar también el
   id del canal (por ejemplo `adhan_v2`) o los usuarios seguirán oyendo el
   sonido viejo.
   ========================================================= */

const CANAL_ADHAN = 'salati_adhan_v1';
const CANAL_SILENCIOSO = 'salati_aviso_v1';

/* El nombre del archivo, tal cual está en android/app/src/main/res/raw/.
   Con extensión y en minúsculas: Android sólo admite [a-z0-9_] en res/raw. */
const SONIDO_ADHAN = 'adhan.mp3';

/** Rango de ids reservado a los rezos, para no pisar otras notificaciones. */
const ID_BASE = 1000;

function plugin() {
  return globalThis.Capacitor?.Plugins?.LocalNotifications ?? null;
}

/** ¿Estamos dentro de la app nativa y con el plugin disponible? */
export function nativeAvailable() {
  return globalThis.Capacitor?.isNativePlatform?.() === true && plugin() !== null;
}

/**
 * Pide permiso de notificaciones. En Android 13+ es obligatorio y sólo se
 * concede tras una acción del usuario, igual que en la web.
 */
export async function requestNativePermission() {
  const LN = plugin();
  if (!LN) return false;
  try {
    const { display } = await LN.requestPermissions();
    return display === 'granted';
  } catch (err) {
    console.error('[SALATI/nativo] Permiso denegado o fallido:', err);
    return false;
  }
}

/** Crea los dos canales. Es idempotente: repetirlo no rompe nada. */
export async function ensureChannels() {
  const LN = plugin();
  if (!LN?.createChannel) return;   // createChannel sólo existe en Android

  try {
    await LN.createChannel({
      id: CANAL_ADHAN,
      name: 'Adhan',
      description: 'Llamada a la oración a la hora de cada rezo',
      importance: 5,        // MAX: notificación emergente con sonido
      visibility: 1,        // visible en la pantalla de bloqueo
      sound: SONIDO_ADHAN,
      vibration: true,
    });

    await LN.createChannel({
      id: CANAL_SILENCIOSO,
      name: 'Avisos de rezo',
      description: 'Aviso a la hora del rezo con el tono del sistema',
      importance: 4,        // HIGH: suena, pero con el tono por defecto
      visibility: 1,
      vibration: true,
    });
  } catch (err) {
    console.error('[SALATI/nativo] No se han podido crear los canales:', err);
  }
}

/**
 * Programa los rezos que quedan del día.
 *
 * @param {object}  opciones
 * @param {object}  opciones.timings   horarios de Aladhan
 * @param {string}  opciones.timezone  zona horaria del lugar
 * @param {string}  opciones.label     nombre de la ciudad
 * @param {boolean} opciones.conAdhan  ¿suena el adhan o el tono del sistema?
 * @returns {Promise<number>} cuántos avisos han quedado programados
 */
export async function scheduleNativeAdhan({ timings, timezone, label, conAdhan }) {
  const LN = plugin();
  if (!LN || !timings) return 0;

  await cancelNativeAdhan();
  await ensureChannels();

  const ahora = new Date();
  const nowSec = secondsOfDayInZone(timezone);
  const avisos = [];

  PRAYERS.forEach((prayer, indice) => {
    if (prayer.info) return;                       // el amanecer no es un rezo
    const sec = timeToSeconds(timings[prayer.key]);
    if (!Number.isFinite(sec) || sec <= nowSec) return;

    const cuando = new Date(ahora.getTime() + (sec - nowSec) * 1000);
    const nombre = prayerName(prayer.key);
    const clock = cleanTime(timings[prayer.key]);

    avisos.push({
      id: ID_BASE + indice,
      title: `${nombre} · ${prayer.ar}`,
      body: [t('notify.body', { name: nombre, time: clock }), label].filter(Boolean).join(' · '),
      channelId: conAdhan ? CANAL_ADHAN : CANAL_SILENCIOSO,
      // `sound` acompaña al canal por compatibilidad y para iOS, donde no
      // existen los canales y el sonido sí va en la notificación.
      sound: conAdhan ? SONIDO_ADHAN : undefined,
      smallIcon: 'ic_stat_salati',
      iconColor: '#C9A227',
      schedule: {
        at: cuando,
        // Imprescindible: sin esto el aviso se retrasa con el móvil dormido
        // en Doze. Usa setExactAndAllowWhileIdle por debajo.
        allowWhileIdle: true,
      },
      extra: { prayer: prayer.key, lang: getLang() },
    });
  });

  if (!avisos.length) return 0;

  try {
    await LN.schedule({ notifications: avisos });
    console.log(`[SALATI/nativo] ${avisos.length} avisos programados (adhan: ${conAdhan})`);
    return avisos.length;
  } catch (err) {
    console.error('[SALATI/nativo] No se han podido programar los avisos:', err);
    return 0;
  }
}

/** Cancela los avisos de rezo ya programados, sin tocar otras notificaciones. */
export async function cancelNativeAdhan() {
  const LN = plugin();
  if (!LN) return;
  try {
    const { notifications } = await LN.getPending();
    const mios = (notifications || [])
      .filter((n) => n.id >= ID_BASE && n.id < ID_BASE + 100)
      .map((n) => ({ id: n.id }));
    if (mios.length) await LN.cancel({ notifications: mios });
  } catch (err) {
    console.error('[SALATI/nativo] No se han podido cancelar los avisos:', err);
  }
}

/** Al tocar la notificación, abrir la pestaña de rezos. */
export function wireNativeTaps(onOpen) {
  const LN = plugin();
  if (!LN?.addListener) return;
  LN.addListener('localNotificationActionPerformed', () => onOpen?.());
}
