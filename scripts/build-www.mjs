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
  'icons',
  'audio',
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

  const total = await pesar(DESTINO);
  console.log(`www/ listo: ${copiados} entradas, ${(total / 1024 / 1024).toFixed(2)} MB`);
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
