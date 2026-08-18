/* =========================================================
   Prepara la carpeta `www/` que consume Capacitor.

   ¿Por qué hace falta? Capacitor copia entero el directorio que le indiques
   en `webDir`. Como tu index.html vive en la raíz, apuntar `webDir` a "."
   metería dentro del APK `node_modules/`, la carpeta `android/`, los scripts
   y el propio `.git`: cientos de megas de basura.

   Este script copia SÓLO lo que la app necesita. Se ejecuta con:
     node scripts/build-www.mjs

   La PWA sigue funcionando desde la raíz como hasta ahora; `www/` es
   únicamente el material que se empaqueta en la app nativa.
   ========================================================= */

import { cp, rm, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'www');

/* Lo que entra en la app nativa. El service worker NO se copia a propósito:
   en Capacitor la caché offline la da el propio WebView con los archivos ya
   empaquetados, y un SW registrado sobre capacitor:// da problemas. */
const INCLUIR = [
  'index.html',
  'privacidad.html',
  'privacy.html',
  'fonts.css',
  'assets',
  'styles.css',
  'manifest.json',
  'favicon.svg',
  'js',
  'audio',
  /* Obligatorio, no opcional: Leaflet (BSD-2) y Leaflet.markercluster (MIT)
     exigen que su aviso de copyright acompañe a las redistribuciones en
     forma binaria, y meterlos dentro de un APK es exactamente eso. */
  'LICENCIAS.txt',
];

/* La carpeta `icons/` NO se copia entera a propósito.
   Además de los iconos de la app guarda las 15 capturas de pantalla del
   README y la imagen de Open Graph: 1,9 MB que la app no referencia en
   ningún sitio y que suponían casi un tercio del peso del paquete.
   Aquí van sólo los archivos que index.html, manifest.json y las páginas
   legales piden de verdad. */
const ICONOS = [
  'icon-192.png',        // manifest + icono de las notificaciones
  'icon-512.png',        // manifest
  'maskable-512.png',    // manifest, icono adaptativo
  'apple-touch-icon.png',
  'logo-salati.png',     // cabecera de index.html y de las páginas legales
  'logo-mark.png',
];

async function main() {
  if (existsSync(DESTINO)) await rm(DESTINO, { recursive: true });
  await mkdir(DESTINO, { recursive: true });

  let copiados = 0;
  for (const nombre of INCLUIR) {
    const origen = join(RAIZ, nombre);
    if (!existsSync(origen)) {
      console.warn(`  · aviso: no existe ${nombre}, se omite`);
      continue;
    }
    await cp(origen, join(DESTINO, nombre), { recursive: true });
    copiados += 1;
  }

  await copiarIconos();

  /* Aquí había un `quitarAnalitica()` que recortaba el script de Umami del
     index.html empaquetado. Ya no hace falta: SALATI dejó de usar analítica
     también en la web, así que no hay nada que recortar. Quien vigila que no
     se cuele ningún script externo es ahora scripts/auditar-www.mjs, que
     además comprueba el resultado en disco en lugar de fiarse de este script. */

  const total = await pesar(DESTINO);
  console.log(`www/ listo: ${copiados + 1} entradas, ${(total / 1024 / 1024).toFixed(2)} MB`);
}

/** Copia sólo los iconos que la app usa, uno a uno. */
async function copiarIconos() {
  const destino = join(DESTINO, 'icons');
  await mkdir(destino, { recursive: true });

  for (const nombre of ICONOS) {
    const origen = join(RAIZ, 'icons', nombre);
    if (!existsSync(origen)) {
      console.warn(`  · aviso: falta icons/${nombre}`);
      continue;
    }
    await cp(origen, join(destino, nombre));
  }
  console.log(`  · icons/: ${ICONOS.length} archivos (capturas del README excluidas)`);
}

async function pesar(dir) {
  let suma = 0;
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    suma += entrada.isDirectory() ? await pesar(ruta) : (await stat(ruta)).size;
  }
  return suma;
}

main().catch((err) => {
  console.error('No se ha podido preparar www/:', err);
  process.exit(1);
});
