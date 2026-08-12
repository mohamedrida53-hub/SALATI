/* Constantes de la aplicación. Cambia aquí y no en el resto del código. */

export const KAABA = { lat: 21.422487, lon: 39.826206 };

export const ALADHAN_BASE = 'https://api.aladhan.com/v1';
export const QURAN_BASE = 'https://api.quran.com/api/v4';
export const GEOCODE_BASE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/* Método de cálculo de Aladhan. Ya no se elige desde la interfaz: se usa
   siempre el de la Muslim World League, que es el más extendido en Europa.
   Para cambiarlo, edita este número. Lista: https://aladhan.com/calculation-methods */
export const DEFAULT_METHOD = 3;

/* Los cinco rezos obligatorios, en orden. `info: true` = fila informativa, no es rezo.
   El nombre y el subtítulo traducidos salen de i18n.js → prayerName() / prayerSub(). */
export const PRAYERS = [
  { key: 'Fajr',    ar: 'الفجر',   icon: 'icon-dawn' },
  { key: 'Sunrise', ar: 'الشروق',  icon: 'icon-sun', info: true },
  { key: 'Dhuhr',   ar: 'الظهر',   icon: 'icon-sun' },
  { key: 'Asr',     ar: 'العصر',   icon: 'icon-sunlow' },
  { key: 'Maghrib', ar: 'المغرب',  icon: 'icon-sunset' },
  { key: 'Isha',    ar: 'العشاء',  icon: 'icon-moon' },
];

/* Ruta del adhan. Coloca tu propio archivo en audio/adhan.mp3;
   si no existe, notifications.js genera una campanilla con Web Audio. */
export const ADHAN_URL = './audio/adhan.mp3';

/* Metas del tasbih. 0 = sin límite (0 se guarda en JSON; Infinity no). */
export const TASBIH_TARGETS = [33, 99, 100, 0];

export const DHIKR = [
  { ar: 'سُبْحَانَ اللّٰه', es: 'Subhan Allah' },
  { ar: 'الْحَمْدُ لِلّٰه', es: 'Alhamdulillah' },
  { ar: 'اللّٰهُ أَكْبَر', es: 'Allahu akbar' },
];

/* Mapa de mezquitas: teselas de OpenStreetMap y datos de Overpass.
   Ninguno de los dos pide clave de API. Overpass tiene varios espejos;
   si el primero va saturado se prueba el siguiente. */
export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/* Los dos espejos se consultan a la vez y gana el primero que responda:
   el cuello de botella no es la consulta, es que un espejo esté saturado. */
export const OVERPASS_SERVER_TIMEOUT = 8;    // segundos que Overpass se da a sí mismo
export const OVERPASS_CLIENT_TIMEOUT = 9000; // ms antes de que abortemos nosotros

/* Radios de búsqueda de mezquitas, en kilómetros.
   Se arranca en 2 km: es lo que se recorre andando y es lo que más rápido responde. */
export const MOSQUE_RADII = [2, 5, 10, 25];
export const DEFAULT_MOSQUE_RADIUS = 2;

/* Tope de resultados. Sube a 200 ahora que los marcadores se agrupan:
   con clustering el mapa aguanta el volumen y en radios de 25 km sobre
   una ciudad densa el tope anterior de 60 se quedaba corto. */
export const MOSQUE_LIMIT = 200;

export const STORAGE_KEYS = {
  place: 'salati.place',
  method: 'salati.method',
  chapters: 'salati.chapters',
  notify: 'salati.notify',   // aviso visual
  adhan: 'salati.adhan',     // sonido del adhan, independiente del anterior
  tasbih: 'salati.tasbih',
  today: 'salati.today',
  lang: 'salati.lang',
  theme: 'salati.theme',     // 'auto' | 'light' | 'dark'
  radius: 'salati.radius',
};

/* La app se llamaba Sakina: se copian las claves antiguas a las nuevas para que
   nadie pierda su ciudad, su método ni su contador de tasbih.

   Corre aquí, en el cuerpo de config.js, y no en app.js a propósito: store.js y
   notifications.js leen localStorage al evaluarse, y en módulos ES las
   dependencias se evalúan antes que el módulo que las importa. config.js no
   importa nada, así que es lo primero que se ejecuta de toda la app.
   Se puede borrar este bloque dentro de unas cuantas versiones. */
(function migrateLegacyKeys() {
  try {
    if (localStorage.getItem('salati.migrated')) return;
    for (const key of Object.values(STORAGE_KEYS)) {
      const old = key.replace(/^salati\./, 'sakina.');
      const value = localStorage.getItem(old);
      if (value !== null && localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
    localStorage.setItem('salati.migrated', '1');
  } catch { /* modo privado: se empieza de cero */ }
})();
