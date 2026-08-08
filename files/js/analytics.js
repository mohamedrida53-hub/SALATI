/* =========================================================
   Envoltorio de analítica — Umami (sin cookies).

   Toda la app llama a `track()` y nunca al proveedor directamente. Esa
   indirección acaba de demostrar para qué sirve: cambiar de Google Analytics
   a Umami sólo ha tocado este archivo y la etiqueta <script> del HTML; ni una
   sola llamada del resto de la app ha cambiado.

   La otra razón es la resiliencia: si el usuario tiene un bloqueador, va sin
   conexión o el script aún no ha llegado, `window.umami` no existe. Llamarlo
   lanzaría un ReferenceError que reventaría la función desde la que se llama
   — por ejemplo la que instala la PWA. Aquí se comprueba antes.

   Umami no usa cookies ni identifica a nadie, así que no hace falta pedir
   consentimiento y la app puede seguir prometiendo privacidad de verdad.
   ========================================================= */

/** ¿Está el script de Umami cargado y utilizable? */
export function analyticsReady() {
  return typeof window.umami?.track === 'function';
}

/**
 * Envía un evento. Nunca lanza: cualquier fallo se traga a propósito,
 * porque una métrica jamás debe romper una funcionalidad.
 *
 * @param {string} name  nombre del evento
 * @param {object} data  datos adicionales (opcional)
 * @returns {boolean}    true si se pudo enviar
 */
export function track(name, data = null) {
  if (!analyticsReady()) return false;
  try {
    if (data && Object.keys(data).length) window.umami.track(name, data);
    else window.umami.track(name);
    return true;
  } catch {
    return false;   // bloqueador que define umami pero lo rompe por dentro
  }
}

/**
 * Sección abierta dentro de la app. Umami cuenta una sola página en una SPA,
 * así que sin esto no se sabría qué pestañas se usan de verdad.
 */
export function trackScreen(name) {
  return track('screen-view', { screen: name });
}
