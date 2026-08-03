/* Constantes de la aplicación. Cambia aquí y no en el resto del código. */

export const KAABA = { lat: 21.422487, lon: 39.826206 };

export const ALADHAN_BASE = 'https://api.aladhan.com/v1';
export const QURAN_BASE = 'https://api.quran.com/api/v4';
export const GEOCODE_BASE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/* Métodos de cálculo de Aladhan (subconjunto habitual), en orden de aparición.
   Los nombres visibles viven en i18n.js → methodName(id).
   Lista completa: https://aladhan.com/calculation-methods */
export const METHODS = [3, 12, 2, 4, 5, 1, 13, 15];

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

/* Radios de búsqueda de mezquitas, en kilómetros. */
export const MOSQUE_RADII = [2, 5, 10, 25];
export const DEFAULT_MOSQUE_RADIUS = 5;

export const STORAGE_KEYS = {
  place: 'sakina.place',
  method: 'sakina.method',
  translation: 'sakina.translation',
  chapters: 'sakina.chapters',
  notify: 'sakina.notify',
  tasbih: 'sakina.tasbih',
  today: 'sakina.today',
  lang: 'sakina.lang',
  radius: 'sakina.radius',
};
