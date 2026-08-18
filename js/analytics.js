/* =========================================================
   Analítica — DESACTIVADA a propósito.

   SALATI no mide nada: ni en la web ni en la aplicación de Android. No hay
   proveedor, no hay script externo, no sale ni una petición del dispositivo
   por este concepto. Es una decisión de producto, no un olvido: la privacidad
   es el pilar de la app y las páginas legales lo afirman por escrito.

   ¿Y por qué sigue existiendo este archivo? Porque siete puntos de app.js
   llaman a `track()` — instalación, cambio de tema, apertura de sección,
   enlaces externos. Borrarlo obligaría a tocar los siete y a repetir la
   comprobación en cada uno. Dejándolo aquí, la decisión vive en UN solo sitio.

   Si algún día quisieras medir algo, esto es lo único que hay que cambiar:
   implementar `track()` y añadir la etiqueta del proveedor en index.html.
   Y entonces habría que actualizar, a la vez y sin excepción:

     · la sección 7 de privacidad.html y privacy.html
     · la tabla de terceros de la sección 6 de ambas
     · el formulario de Seguridad de los Datos de Play Console
     · la declaración de permisos, que afirma que no hay seguimiento

   La regla de scripts/auditar-www.mjs que prohíbe scripts externos saltaría
   en la compilación para recordártelo.
   ========================================================= */

/** No hay proveedor de analítica. Siempre false. */
export function analyticsReady() {
  return false;
}

/**
 * Punto de entrada único de la medición. Hoy no hace nada y nunca lanza.
 *
 * Se mantiene la firma `(name, data)` para que los puntos de llamada no
 * tengan que cambiar si algún día se reactiva.
 *
 * @returns {boolean} siempre false: no se ha enviado nada
 */
export function track() {
  return false;
}

/** Sección abierta dentro de la app. Igualmente inerte. */
export function trackScreen() {
  return false;
}
