/* =========================================================
   Reinyecta las personalizaciones nativas en android/.

   ¿Por qué existe? `npx cap add android` genera la carpeta desde una
   plantilla limpia. Como no tienes entorno local, esa carpeta se regenera
   en CADA build de GitHub Actions, y con ella se perderían:

     · el adhan.mp3 en res/raw
     · los permisos de alarma exacta y notificaciones del manifiesto
     · el icono de la barra de estado

   Todo eso vive en native/ dentro del repo, y este script lo vuelve a
   aplicar después de `cap add android`. Así el build es reproducible y no
   hace falta commitear la carpeta android/ entera.

   Se ejecuta con:  node scripts/apply-native.mjs
   ========================================================= */

import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = join(RAIZ, 'android');
const MAIN = join(ANDROID, 'app', 'src', 'main');

/* Permisos que el plugin de notificaciones necesita y que la plantilla de
   Capacitor no trae. Sin los de alarma exacta, Android 12+ retrasa el aviso
   hasta que le viene bien, que puede ser bastante después de la hora. */
const PERMISOS = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
  // Geolocalización: FINE da precisión de GPS, COARSE sirve de reserva si el
  // usuario sólo concede ubicación aproximada (Android 12+ deja elegir).
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.INTERNET',
];

async function main() {
  if (!existsSync(ANDROID)) {
    console.error('No existe android/. Ejecuta antes: npx cap add android');
    process.exit(1);
  }

  await copiarSonido();
  await copiarIconos();
  await parchearManifiesto();
  console.log('Personalizaciones nativas aplicadas.');
}

/* El sonido tiene que llamarse en minúsculas y sin guiones: res/raw sólo
   admite [a-z0-9_]. Un nombre inválido rompe la compilación de recursos. */
async function copiarSonido() {
  const origen = join(RAIZ, 'audio', 'adhan.mp3');
  if (!existsSync(origen)) {
    console.warn('  · aviso: no hay audio/adhan.mp3, el canal usará el tono del sistema');
    return;
  }
  const destino = join(MAIN, 'res', 'raw');
  await mkdir(destino, { recursive: true });
  await cp(origen, join(destino, 'adhan.mp3'));
  console.log('  · res/raw/adhan.mp3');
}

/**
 * Copia TODO native/android/res sobre el res/ generado por Capacitor.
 *
 * Ahí van tres cosas distintas:
 *   · drawable-*  → icono blanco de la barra de estado (notificaciones)
 *   · mipmap-*    → icono del cajón de aplicaciones (launcher), incluidos
 *                   los adaptativos de Android 8+
 *   · values/     → el color de fondo del icono adaptativo
 *
 * `cp` con `force` sobrescribe los ic_launcher de ejemplo que trae la
 * plantilla de Capacitor, que si no se quedarían con el logo de Capacitor.
 */
async function copiarIconos() {
  const origen = join(RAIZ, 'native', 'android', 'res');
  if (!existsSync(origen)) {
    console.warn('  · aviso: no hay native/android/res, se omiten los iconos');
    return;
  }
  await cp(origen, join(MAIN, 'res'), { recursive: true, force: true });

  const carpetas = await readdir(origen, { withFileTypes: true });
  const mipmaps = carpetas.filter((d) => d.isDirectory() && d.name.startsWith('mipmap')).length;
  const drawables = carpetas.filter((d) => d.isDirectory() && d.name.startsWith('drawable')).length;
  console.log(`  · iconos: ${drawables} densidades de notificación, ${mipmaps} de launcher`);
}

/**
 * Añade los permisos que falten al manifiesto.
 *
 * Se hace con una comprobación previa de cada permiso en vez de a lo bruto:
 * el script debe poder ejecutarse dos veces seguidas sin duplicar líneas.
 */
async function parchearManifiesto() {
  const ruta = join(MAIN, 'AndroidManifest.xml');
  let xml = await readFile(ruta, 'utf8');

  const faltan = PERMISOS.filter((p) => !xml.includes(`"${p}"`));
  if (!faltan.length) {
    console.log('  · manifiesto: los permisos ya estaban');
    return;
  }

  const lineas = faltan.map((p) => `    <uses-permission android:name="${p}"/>`).join('\n');

  // Se insertan justo antes de </manifest>, que siempre es la última etiqueta.
  xml = xml.replace('</manifest>', `${lineas}\n</manifest>`);
  await writeFile(ruta, xml, 'utf8');
  console.log(`  · manifiesto: ${faltan.length} permisos añadidos`);
}

main().catch((err) => {
  console.error('Fallo aplicando lo nativo:', err);
  process.exit(1);
});
