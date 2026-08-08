/* =========================================================
   Detección de plataforma.

   Sólo existe por iOS: Safari no implementa `beforeinstallprompt`, así que
   la instalación no se puede ofrecer con el mismo mecanismo que en Android
   y hay que explicarle al usuario cómo hacerlo a mano.

   Se detecta por capacidades siempre que se puede; el user agent es el
   último recurso, porque miente con facilidad.
   ========================================================= */

/**
 * ¿Estamos en iOS o iPadOS?
 *
 * Desde iPadOS 13 el iPad se anuncia como «Macintosh» en el user agent, así
 * que hay que distinguirlo de un Mac de verdad por la presencia de pantalla
 * táctil: los Mac no tienen `maxTouchPoints > 1`.
 */
export function isIOS() {
  const ua = navigator.userAgent;
  const iPhoneOClasico = /iPad|iPhone|iPod/.test(ua);
  const iPadModerno = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iPhoneOClasico || iPadModerno;
}

/**
 * ¿Es Safari? En iOS todos los navegadores usan WebKit por obligación, pero
 * sólo Safari puede añadir a la pantalla de inicio: Chrome, Firefox y Edge
 * para iOS no ofrecen esa opción, así que conviene distinguirlos.
 */
export function isIOSSafari() {
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  // CriOS = Chrome, FxiOS = Firefox, EdgiOS = Edge, OPiOS/OPT = Opera
  return !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(ua);
}

/** ¿La app ya está instalada y abierta desde la pantalla de inicio? */
export function isStandalone() {
  // `navigator.standalone` es la vía de iOS; el media query, la del estándar.
  return navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches;
}

/**
 * ¿Hay que enseñar las instrucciones manuales en vez del diálogo nativo?
 * Sólo en iOS, sólo si aún no está instalada.
 */
export function needsManualInstall() {
  return isIOS() && !isStandalone();
}
