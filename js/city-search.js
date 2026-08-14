import { NOMINATIM_BASE } from './config.js';
import { getLang } from './i18n.js';

/* =========================================================
   Búsqueda de ciudades con Nominatim (OpenStreetMap).

   Por qué existe: antes el usuario escribía texto libre y ese texto se le
   pasaba tal cual a Aladhan. Si escribía algo inventado, la API devolvía
   igualmente unas coordenadas cualesquiera y la app generaba horarios de
   rezo FALSOS sin avisar de nada. Ahora hay que elegir un sitio real de la
   lista, y de él se sacan latitud y longitud exactas.

   Política de uso de Nominatim (es un servicio gratuito y hay que
   respetarla o bloquean la IP):
     · máximo 1 petición por segundo → de ahí el retardo de 450 ms
     · nada de descargas masivas → `limit=6`
     · hay que identificarse → el navegador manda el Referer solo
   Además se cancela la petición anterior en cuanto se teclea otra letra,
   que evita ráfagas y respuestas que llegan desordenadas.
   ========================================================= */

export const MIN_CARACTERES = 3;
const RETARDO_MS = 450;
const TIMEOUT_MS = 8000;
const LIMITE = 6;

let temporizador = null;
let controlador = null;

/* Caché en memoria: teclear y borrar la última letra es constante, y sin
   esto cada corrección disparaba otra petición al servidor. */
const cache = new Map();

/**
 * Busca lugares. Devuelve [] en cualquier fallo: el buscador nunca debe
 * romper el diálogo, sólo quedarse sin sugerencias.
 *
 * @param {string} texto lo que ha escrito el usuario
 * @returns {Promise<Array<{id,label,lat,lon,tipo}>>}
 */
export function buscarCiudades(texto) {
  const consulta = texto.trim();
  if (consulta.length < MIN_CARACTERES) return Promise.resolve([]);

  const clave = `${getLang()}|${consulta.toLowerCase()}`;
  if (cache.has(clave)) return Promise.resolve(cache.get(clave));

  return new Promise((resolve) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(async () => {
      controlador?.abort();
      controlador = new AbortController();
      const corte = setTimeout(() => controlador.abort(), TIMEOUT_MS);

      const url = `${NOMINATIM_BASE}/search`
        + `?format=jsonv2&q=${encodeURIComponent(consulta)}`
        + `&limit=${LIMITE}&addressdetails=1`
        + `&accept-language=${encodeURIComponent(getLang())}`;

      try {
        const res = await fetch(url, { signal: controlador.signal });
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const datos = await res.json();
        const lista = (datos || []).map(aLugar).filter(Boolean);
        cache.set(clave, lista);
        resolve(lista);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error('[SALATI/ciudades] Nominatim ha fallado:', err);
        }
        resolve([]);
      } finally {
        clearTimeout(corte);
      }
    }, RETARDO_MS);
  });
}

/** Cancela lo que haya en vuelo. Se llama al cerrar el diálogo. */
export function cancelarBusqueda() {
  clearTimeout(temporizador);
  controlador?.abort();
  controlador = null;
}

/**
 * Nominatim devuelve nombres larguísimos («Barcelona, Barcelonès,
 * Barcelona, Cataluña, 08001, España»). Se recorta a ciudad + región + país,
 * que es lo que el usuario necesita para distinguir dos sitios homónimos.
 */
function aLugar(item) {
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const dir = item.address || {};
  const ciudad = dir.city || dir.town || dir.village || dir.municipality
    || dir.county || item.name || '';
  const region = dir.state || dir.region || '';
  const pais = dir.country || '';

  const partes = [ciudad, region, pais].filter(Boolean);
  // Sin nombre reconocible se cae al display_name recortado
  const label = partes.length
    ? [...new Set(partes)].join(', ')
    : String(item.display_name || '').split(',').slice(0, 3).join(',').trim();

  return {
    id: `${item.osm_type || 'x'}${item.osm_id || item.place_id}`,
    label,
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
    tipo: item.addresstype || item.type || '',
  };
}
