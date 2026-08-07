# SALATI

PWA instalable (mobile-first, sin build ni dependencias) con cuatro secciones: horarios de oración,
brújula de la Qibla, lectura del Corán y contador de tasbih.

## Cómo ejecutarla

Módulos ES, Geolocation, service worker: nada de eso funciona con `file://`. Necesita un servidor:

```bash
python3 -m http.server 8000     # o: npx serve .
```

Abre `http://localhost:8000`. `localhost` cuenta como contexto seguro, así que el GPS, la brújula y
el service worker funcionan. **Al desplegar, HTTPS obligatorio**: sin él no hay geolocalización, ni
service worker, ni notificaciones. GitHub Pages sirve por HTTPS y todas las rutas del proyecto son
relativas (`./`), así que funciona igual en la raíz del dominio que en `usuario.github.io/repo/`.

## Organización de archivos

```
.
├── index.html            4 paneles + barra de pestañas + diálogo de ubicación + sprite de iconos
├── styles.css            Todo el CSS. Tema oscuro único; variables en :root
├── manifest.json         Nombre, iconos, colores, atajos. start_url y scope relativos
├── service-worker.js     Precarga del shell + estrategias de caché
├── favicon.svg
├── icons/                192, 512, maskable (zona segura 80 %) y apple-touch-icon
├── audio/                Deja aquí tu adhan.mp3 (ver audio/LEEME.txt)
└── js/
    ├── config.js         Constantes: Kaaba, endpoints, métodos, dhikr, metas del tasbih, claves
    ├── utils.js          Helpers sin dependencias: DOM, tiempo, geometría, storage, saneado
    ├── api.js            Única capa que habla con la red
    ├── location.js       Geolocation API con errores en español
    ├── store.js          Estado compartido (pub/sub) y persistencia
    ├── notifications.js  Permisos, programación del adhan y audio
    ├── prayer.js         Sección 1
    ├── qibla.js          Sección 2
    ├── quran.js          Sección 3
    ├── tasbih.js         Sección 4
    └── app.js            Ensamblaje: pestañas, arranque, ubicación, datos, PWA, ajustes
```

Reglas que mantienen esto ordenado: **`api.js` es el único archivo que hace `fetch`** y **las
secciones no se importan entre ellas**; sólo `app.js` las conoce. Añadir una quinta sección son
cuatro pasos: panel en el HTML, botón en `.tabbar`, `js/loquesea.js` con `init…()`, y su nombre en
`PANELS` dentro de `app.js`.

## Identidad visual

Un solo tema, oscuro. Sin `prefers-color-scheme`: la app se usa de noche y al amanecer, y el
contraste alto es lo que hace cómoda la lectura del Corán.

| Variable | Valor | Uso |
|---|---|---|
| `--bg` | `#070a09` | Fondo, casi negro con matiz verde |
| `--bg-raised` | `#0b100e` | Cabecera y barra de pestañas |
| `--surface` / `--surface-2` | `#101714` / `#161f1b` | Tarjetas y estados pulsados |
| `--line` | `#1f2b26` | Bordes y separadores |
| `--accent` | `#1f9d6b` | Botones, iconos, marcas de la brújula |
| `--accent-bright` | `#3fd69a` | Arco de progreso, pestaña activa, cifras vivas |
| `--ink` / `--ink-read` | `#f0f5f2` / `#dbe5e0` | Texto principal / cuerpos largos |
| `--sand` | `#c7a87a` | Sólo la fecha hijri y la basmala |

Contrastes medidos (WCAG): texto principal 18:1, traducciones 14:1, texto secundario 8,3:1, acento
claro sobre el fondo 10,7:1, texto de botón sobre esmeralda 5,4:1. Todo AA o AAA. El único tono
cálido queda reservado a dos elementos litúrgicos, para que el esmeralda no compita con nada.

## PWA y funcionamiento sin conexión

Hay **dos** capas de caché, y hacen cosas distintas:

1. **Service worker.** `SHELL` precarga los 20 archivos de la app en la instalación (cache-first vía
   stale-while-revalidate), `DATA` guarda las respuestas de las APIs (network-first: red primero,
   copia guardada si falla) y `FONTS` las tipografías de Google. Cada archivo se precarga por
   separado, así que si uno falla no tumba la instalación entera.
2. **`localStorage`.** El service worker devuelve *respuestas*; para pintar la pantalla al instante
   hacen falta *datos*. `app.js` guarda `{fecha, lugar, horarios}` en `SALATI.today` y los usa si el
   fetch falla, comprobando que la fecha y el lugar coincidan. Los horarios de ayer nunca se
   muestran como si fueran de hoy: si la fecha no cuadra, se muestra el error con botón de reintento.
   La última ciudad buscada vive en `SALATI.place` y la lista de suras en `SALATI.chapters`.

Comprobado con la red caída: la app arranca, pinta los horarios guardados y avisa con un toast
(«Sin conexión: mostrando los horarios guardados de hoy»).

Para subir versión, cambia `VERSION` en `service-worker.js`. Al detectar el worker nuevo la app
muestra un toast; no recarga sola, para no interrumpir una lectura.

## Avisos del rezo

Son **dos interruptores independientes**, más un botón «Escuchar» para comprobar el volumen antes
de confiar en ellos:

| Interruptor | Clave | Necesita permiso | Qué hace |
|---|---|---|---|
| Adhan | `salati.adhan` | No | Reproduce `audio/adhan.mp3` |
| Notificaciones | `salati.notify` | Sí | Notificación **silenciosa** del sistema |

Se pueden usar por separado. Antes eran un solo ajuste y el sonido estaba atado al permiso de
notificaciones: si lo denegabas, te quedabas sin adhan. Ahora no.

- `enableAdhan()` sólo se llama desde el gesto del interruptor, porque el navegador sólo desbloquea
  la reproducción automática con una interacción real del usuario.
- `primeAudioOnFirstGesture()` cubre el caso de la recarga: al volver a cargar la página el audio
  queda bloqueado otra vez aunque el interruptor siguiera encendido, así que se vuelve a desbloquear
  en el primer toque, sea donde sea. Sin esto, a la hora del rezo sonaba `chime()` en vez del adhan.
- `scheduleAdhan()` guarda las horas que quedan del día y **un único `setInterval` de 15 s** las
  comprueba. Antes era un `setTimeout` por rezo, de hasta varias horas: los navegadores estrangulan
  y agrupan los temporizadores de las pestañas en segundo plano, así que un timer tan largo se
  disparaba tarde o no se disparaba. Con la comprobación periódica, aunque el navegador la frene a
  una vez por minuto, el aviso salta con un margen de segundos.
- `GRACE_SEC` (5 min) evita que, si la pestaña estuvo congelada, se lance el adhan de un rezo que
  pasó hace horas al volver a primer plano.
- La notificación se lanza por `registration.showNotification()`, no por `new Notification()`:
  en Android lo segundo lanza excepción, y sólo la vía del service worker permite `vibrate`.
  Va con `silent: true`, para que el sonido lo ponga el interruptor del adhan y no el sistema.
- Si el archivo no existe o el navegador bloquea la reproducción, `chime()` genera dos notas suaves
  con Web Audio, así que el aviso nunca se queda mudo.

### Por qué NO suena con la app cerrada

Esto se investigó a fondo y la respuesta es que **no se puede con una PWA**. Hay dos muros
independientes y harían falta superar los dos:

1. **No se puede programar un aviso local sin servidor.** La
   [Notification Triggers API](https://developer.chrome.com/docs/web-platform/notification-triggers)
   (`TimestampTrigger`) existía justo para esto. Estuvo en *origin trial* en Chrome 80–83 y 86–88, y
   Google **abandonó su desarrollo**; nunca llegó a estable. Periodic Background Sync tiene
   intervalo mínimo de horas y no garantiza el momento.
2. **Un service worker no puede reproducir audio.** Hace falta un documento vivo y una sesión de
   audio, y con la app cerrada no existe ninguno. Lo único que suena es el tono de notificación del
   sistema, no tu MP3.

Corolario importante: **montar Web Push tampoco resolvería el sonido**. La notificación llegaría
puntual, pero sonaría el tono genérico del móvil, no el adhan.

La única vía real es un **envoltorio nativo** (Capacitor) con alarmas del sistema y el adhan como
recurso de sonido nativo. Ahí Android reproduce el archivo completo; **iOS limita los sonidos de
notificación a 30 s**, así que un adhan entero con la app cerrada requeriría el permiso de
*Critical Alerts* de Apple, que se concede de forma muy restrictiva.

En iOS, además, la API de notificaciones sólo existe si la app está instalada en la pantalla de
inicio (16.4+).

## Tasbih

Toda la zona central es el contador: se usa sin mirar la pantalla, y responde en `pointerdown` en
vez de `click` para que el toque se sienta inmediato. Vibración de 12 ms en cada cuenta y patrón
`[70, 45, 140]` al cerrar la ronda, con destello del anillo. Metas de 33, 99, 100 y sin límite;
la meta sin límite se guarda como `0` porque `JSON.stringify(Infinity)` devuelve `null`. Cada ronda
avanza la fórmula del dhikr. «Deshacer» corrige el toque de más (incluso retrocediendo de ronda), y
el estado sobrevive al cierre de la app.

`navigator.vibrate` no existe en iOS ni en escritorio: allí el contador funciona igual, sin vibrar.

## APIs usadas

| Qué | Endpoint | Notas |
|---|---|---|
| Horarios por coordenadas | `aladhan.com/v1/timings/DD-MM-YYYY` | Devuelve también la fecha hijri |
| Horarios por ciudad | `aladhan.com/v1/timingsByAddress/DD-MM-YYYY` | Texto libre; de aquí salen lat/lon para la Qibla |
| Nombre del lugar | `api.bigdatacloud.net/data/reverse-geocode-client` | Sin clave; si falla, se muestran coordenadas |
| Suras | `api.quran.com/api/v4/chapters?language=es` | Se guarda en `localStorage` |
| Traducciones | `api.quran.com/api/v4/resources/translations` | Se filtran las españolas en vez de fijar un ID |
| Versos | `api.quran.com/api/v4/verses/by_chapter/{id}` | Paginado de 50 en 50 |

## Decisiones que conviene recordar

**Cuenta atrás sin líos de zonas horarias.** Aladhan devuelve las horas en la zona del lugar
consultado. En vez de construir `Date` (que usa la zona del dispositivo y se rompe con una ciudad
extranjera), todo se compara en «segundos del día» vía `Intl.DateTimeFormat` sobre `meta.timezone`.
Tras el Isha el objetivo pasa de 86 400 y el cálculo sigue siendo una resta lineal, que es también
lo que alimenta el arco de progreso y los temporizadores del adhan.

**Azimut ≠ Haversine.** Haversine da la *distancia*; la dirección es el *forward azimuth*.
`utils.js` tiene las dos (`initialBearing`, `haversineKm`). Verificado: L'Hospitalet 110,4° ESE y
4 163 km; Nueva York 58,5°; Yakarta 295,2°.

**Brújula.** iOS usa `webkitCompassHeading`; Android, `deviceorientationabsolute` con `360 − alpha`.
Se compensa `screen.orientation.angle` y el giro se acumula para que la aguja no dé la vuelta larga
al cruzar 0°. Sin sensores, la vista cae a la dirección fija.

**Traducciones del Corán.** Los IDs cambian, así que se piden las disponibles y se agrupan por
idioma. El texto llega con `<sup>` de notas al pie: pasa por un saneador con lista blanca de
etiquetas, no por `innerHTML` a pelo.

## Siguientes pasos naturales

- Recitación en audio de cada sura: `verses/by_chapter` acepta `audio={reciter_id}`.
- Guardar el último verso leído y lectura continua por juz.
- Ajuste manual del adhan por rezo (avisar sólo de Fajr y Maghrib, por ejemplo).
- Envoltorio con Capacitor si el adhan con la app cerrada se vuelve imprescindible. Es la única vía
  que lo consigue de verdad; Web Push no, porque el sonido lo elige el sistema (ver arriba).
