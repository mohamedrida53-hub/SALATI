/* =========================================================
   Auditoría del paquete que se mete en el APK.

   Corre DESPUÉS de build-www.mjs y comprueba el resultado en disco, no que
   el script anterior dijera haber hecho su trabajo. Esa independencia es el
   sentido del archivo: si build-www.mjs falla de una forma que no previmos,
   esto lo caza igual.

   Cada regla respalda una afirmación escrita en algún documento:

     · sin scripts externos  → la política de privacidad y la declaración de
                               permisos ante Google Play dicen que la app de
                               Android no contacta con servicios de analítica
     · con LICENCIAS.txt     → Leaflet (BSD-2) y Leaflet.markercluster (MIT)
                               obligan a incluir su aviso de copyright en
                               cualquier redistribución en forma binaria, y
                               empaquetarlos en un APK es exactamente eso

   Se ejecuta con:  node scripts/auditar-www.mjs
   ========================================================= */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(RAIZ, 'www');

const fallos = [];

async function main() {
  if (!existsSync(WWW)) {
    console.error('No existe www/. Ejecuta antes: node scripts/build-www.mjs');
    process.exit(1);
  }

  const archivos = await listar(WWW);

  await sinScriptsExternos(archivos);
  await conAvisoDeLicencias();

  if (fallos.length) {
    console.error('\nLa auditoría de www/ ha fallado:\n');
    for (const f of fallos) console.error(`  · ${f}`);
    console.error('\nCada una de estas reglas respalda una promesa escrita. No las desactives:');
    console.error('corrige la causa o actualiza el documento que dejó de ser cierto.\n');
    process.exit(1);
  }

  const total = await pesar(WWW);
  console.log(`www/ auditada: ${archivos.length} archivos, ${(total / 1024 / 1024).toFixed(2)} MB`);
  console.log('  · sin scripts de origen externo');
  console.log('  · con avisos de licencia de terceros');
}

/**
 * Ningún <script src="http(s)://…"> en el HTML empaquetado.
 *
 * Se hace leyendo la etiqueta entera y no con una búsqueda por líneas porque
 * en index.html el <script> de la analítica ocupaba TRES líneas: cualquier
 * comprobación línea a línea pasa en verde sin mirar nada, que es peor que no
 * comprobar. `[\s\S]` es lo que permite cruzar los saltos de línea.
 *
 * Ojo con lo que NO se busca: el nombre de ningún proveedor concreto. Las
 * páginas legales y los comentarios del código hablan de analítica a propósito,
 * y buscar la palabra daría falsos positivos eternos. Lo que importa no es que
 * algo se mencione, sino que no se CARGUE nada de fuera — y así la regla vale
 * igual para cualquier proveedor futuro, no sólo para el que hubo un día.
 */
async function sinScriptsExternos(archivos) {
  const htmls = archivos.filter((f) => f.endsWith('.html'));

  for (const archivo of htmls) {
    const contenido = await readFile(archivo, 'utf8');
    for (const etiqueta of contenido.matchAll(/<script[\s\S]*?>/gi)) {
      const src = etiqueta[0].match(/\ssrc\s*=\s*["']([^"']+)["']/i);
      if (!src) continue;                       // script en línea: no sale a la red
      if (!/^https?:\/\//i.test(src[1])) continue;   // ruta local: correcto
      fallos.push(`${relative(WWW, archivo)} carga un script externo: ${src[1]}`);
    }
  }
}

/** El aviso de licencias tiene que existir y nombrar lo que cubre. */
async function conAvisoDeLicencias() {
  const ruta = join(WWW, 'LICENCIAS.txt');
  if (!existsSync(ruta)) {
    fallos.push('falta LICENCIAS.txt, exigido por las licencias de Leaflet y markercluster');
    return;
  }

  const texto = await readFile(ruta, 'utf8');
  /* «adhan» y «CC BY-SA» están en la lista para que nadie pueda cambiar la
     grabación de audio sin actualizar su atribución: si se sustituye el MP3
     y se borra su apartado del aviso, la compilación falla. */
  for (const obligatorio of ['Leaflet', 'markercluster', 'BSD', 'MIT', 'adhan', 'CC BY-SA']) {
    if (!texto.includes(obligatorio)) {
      fallos.push(`LICENCIAS.txt no menciona «${obligatorio}»`);
    }
  }
}

async function listar(dir) {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...await listar(ruta));
    else salida.push(ruta);
  }
  return salida;
}

async function pesar(dir) {
  let suma = 0;
  for (const archivo of await listar(dir)) suma += (await stat(archivo)).size;
  return suma;
}

main().catch((err) => {
  console.error('La auditoría no ha podido ejecutarse:', err);
  process.exit(1);
});
