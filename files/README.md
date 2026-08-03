# Sakina

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
   hacen falta *datos*. `app.js` guarda `{fecha, lugar, horarios}` en `sakina.today` y los usa si el
   fetch falla, comprobando que la fecha y el lugar coincidan. Los horarios de ayer nunca se
   muestran como si fueran de hoy: si la fecha no cuadra, se muestra el error con botón de reintento.
   La última ciudad buscada vive en `sakina.place` y la lista de suras en `sakina.chapters`.

Comprobado con la red caída: la app arranca, pinta los horarios guardados y avisa con un toast
(«Sin conexión: mostrando los horarios guardados de hoy»).

Para subir versión, cambia `VERSION` en `service-worker.js`. Al detectar el worker nuevo la app
muestra un toast; no recarga sola, para no interrumpir una lectura.

## Aviso del adhan

En Ajustes hay un interruptor y un botón «Escuchar» para comprobar el volumen antes de confiar en él.

- `enableNotifications()` sólo se llama desde el gesto del interruptor: los permisos y el desbloqueo
  del audio lo exigen. Ese mismo gesto sirve para «tocar» el elemento `<audio>` y que después pueda
  sonar solo.
- `scheduleAdhan()` arma un `setTimeout` por cada rezo que quede del día, calculando el retardo en
  segundos del día sobre la zona horaria del lugar. Se rearma al cambiar los horarios, el método, el
  lugar, al cambiar el día y al volver del segundo plano (donde los temporizadores se retrasan).
- La notificación se lanza por `registration.showNotification()`, no por `new Notification()`:
  en Android lo segundo lanza excepción, y sólo la vía del service worker permite `vibrate`.
- El audio sale de `audio/adhan.mp3`. **No incluyo ninguna grabación por licencia**: pon la tuya
  (ver `audio/LEEME.txt`). Si el archivo no existe o el navegador bloquea la reproducción,
  `chime()` genera dos notas suaves con Web Audio, así que el aviso nunca se queda mudo.

**Límite honesto:** los temporizadores viven en la página, así que el aviso salta con la app abierta
(aunque esté en segundo plano). Cerrada, no suena. La programación en segundo plano real necesita
Web Push con servidor, o un envoltorio nativo (Capacitor) con alarmas del sistema. La
Notification Triggers API resolvería esto sin servidor, pero no está disponible de forma estable.
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
- Web Push con un endpoint mínimo si el aviso con la app cerrada se vuelve imprescindible.
