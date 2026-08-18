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
  await escribirTema();
  await parchearGradle();
  console.log('Personalizaciones nativas aplicadas.');
}

/**
 * Prepara app/build.gradle para la firma y el versionado.
 *
 * La firma se lee de VARIABLES DE ENTORNO, no de un archivo con contraseñas
 * dentro del repositorio. Esto tiene una consecuencia práctica muy cómoda:
 * hoy, sin secretos configurados, `bundleRelease` produce un .aab SIN FIRMAR;
 * el día que añadas los secretos a GitHub, el MISMO código produce un .aab
 * firmado sin tocar ni una línea.
 *
 * El versionCode sale del número de ejecución de GitHub Actions. Google Play
 * rechaza cualquier subida cuyo versionCode no sea mayor que el anterior, y
 * llevarlo a mano es la forma más fácil de bloquearse una release.
 */
async function parchearGradle() {
  const ruta = join(ANDROID, 'app', 'build.gradle');
  if (!existsSync(ruta)) {
    console.warn('  · aviso: no existe app/build.gradle, se omite la firma');
    return;
  }

  let gradle = await readFile(ruta, 'utf8');
  if (gradle.includes('salatiSigning')) {
    console.log('  · build.gradle: ya estaba preparado');
    return;
  }

  const bloque = `
    // ---- Firma y versionado inyectados por scripts/apply-native.mjs ----
    signingConfigs {
        salatiSigning {
            // Sólo se rellena si el entorno trae el keystore. Si no, este
            // bloque queda vacío y Gradle genera un artefacto sin firmar.
            if (System.getenv("SALATI_KEYSTORE_PATH")) {
                storeFile file(System.getenv("SALATI_KEYSTORE_PATH"))
                storePassword System.getenv("SALATI_KEYSTORE_PASSWORD")
                keyAlias System.getenv("SALATI_KEY_ALIAS")
                keyPassword System.getenv("SALATI_KEY_PASSWORD")
            }
        }
    }
`;

  // Se inserta justo después de la apertura de `android {`.
  gradle = gradle.replace(/android\s*\{/, (m) => `${m}\n${bloque}`);

  /* Al buildType `release` se le asigna la firma sólo si hay keystore.
     `signingConfig null` haría fallar la compilación, de ahí el `if`. */
  gradle = gradle.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{)/,
    `$1
            if (System.getenv("SALATI_KEYSTORE_PATH")) {
                signingConfig signingConfigs.salatiSigning
            }`,
  );

  /* versionCode y versionName desde el entorno, con reserva razonable.

     El separador se captura y se reutiliza porque Capacitor 8 migró el
     build.gradle a sintaxis de asignación (`versionCode = 1`) mientras que
     versiones anteriores usaban llamada a método (`versionCode 1`). Con
     `\s+` a secas la expresión dejaba de encajar en Capacitor 8 y el parche
     no se aplicaba, generando un AAB con versionCode 1 que Play rechaza. */
  gradle = gradle.replace(
    /versionCode(\s*=\s*|\s+)\d+/,
    (_, sep) => `versionCode${sep}Integer.parseInt(System.getenv("SALATI_VERSION_CODE") ?: "1")`,
  );
  gradle = gradle.replace(
    /versionName(\s*=\s*|\s+)"[^"]*"/,
    (_, sep) => `versionName${sep}System.getenv("SALATI_VERSION_NAME") ?: "1.0.0"`,
  );

  /* Comprobación explícita antes de escribir. Una expresión regular que no
     encaja no lanza ningún error: se queda tal cual y el fallo aparecería
     mucho más tarde, como un rechazo de Play sin explicación. Mejor tumbar
     aquí la compilación, donde el motivo es evidente. */
  const faltan = [
    ['bloque de firma', 'salatiSigning'],
    ['versionCode dinámico', 'SALATI_VERSION_CODE'],
    ['versionName dinámico', 'SALATI_VERSION_NAME'],
  ].filter(([, aguja]) => !gradle.includes(aguja)).map(([nombre]) => nombre);

  if (faltan.length) {
    console.error(`No se ha podido parchear app/build.gradle: falta ${faltan.join(', ')}.`);
    console.error('Probablemente Capacitor ha cambiado la plantilla. Revisa parchearGradle().');
    process.exit(1);
  }

  await writeFile(ruta, gradle, 'utf8');
  console.log('  · build.gradle: firma por entorno y versionado dinámico');
}

/**
 * Tema nativo: fondo oscuro desde el primer fotograma.
 *
 * OJO CON LO QUE SIGUE SIRVIENDO Y LO QUE NO, que cambió con Android 15:
 *
 *   · `android:windowBackground` / `android:background` → SIGUEN valiendo, y
 *     son lo que evita el destello blanco al abrir. Se aplican antes incluso
 *     de que exista el WebView, cosa que ningún plugin de JS puede hacer.
 *
 *   · `android:statusBarColor` y `android:navigationBarColor` → el sistema
 *     los IGNORA a partir de Android 15 cuando se apunta a targetSdk 35 o
 *     superior, porque el modo «edge to edge» pasó a ser obligatorio y las
 *     barras son siempre transparentes. Se dejan porque la app admite desde
 *     Android 7 (minSdk 24) y en Android 7–14 sí se respetan.
 *
 * Existió un escape temporal, `windowOptOutEdgeToEdgeEnforcement`, pero
 * Android 16 lo eliminó: no sirve para targetSdk 36 y no se usa aquí.
 *
 * El color de los ICONOS del sistema ya no se decide en este XML sino en
 * caliente desde js/theme.js con SystemBars, porque la app tiene modo claro
 * y oscuro y el tema nativo es fijo.
 */
async function escribirTema() {
  const valores = join(MAIN, 'res', 'values');
  await mkdir(valores, { recursive: true });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="android:background">@color/salatiBackground</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@color/salatiBackground</item>
        <item name="android:statusBarColor">@color/salatiBackground</item>
        <item name="android:navigationBarColor">@color/salatiBackground</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>

    <!-- Pantalla de arranque en color plano y no con @drawable/splash: ese
         recurso puede no existir según la versión de Capacitor y tumbaría la
         compilación. Un fondo del color de la app es además más limpio. -->
    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">@color/salatiBackground</item>
    </style>
</resources>
`;
  await writeFile(join(valores, 'styles.xml'), xml, 'utf8');

  const colores = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="salatiBackground">#FF070A09</color>
    <color name="colorPrimary">#FF070A09</color>
    <color name="colorPrimaryDark">#FF070A09</color>
    <color name="colorAccent">#FFC9A227</color>
</resources>
`;
  await writeFile(join(valores, 'colors.xml'), colores, 'utf8');
  console.log('  · tema nativo: barras de estado y navegación en oscuro');
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
