import { ALADHAN_BASE, QURAN_BASE, GEOCODE_BASE, STORAGE_KEYS } from './config.js';
import { apiDate, load, save, sleep } from './utils.js';

export class ApiError extends Error {
  constructor(message, { status = 0, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.cause = cause;
  }
}

const memory = new Map();

/**
 * fetch con tiempo límite, reintento y mensajes legibles.
 * Nunca lanza excepciones sin mensaje: la interfaz siempre puede mostrar algo.
 */
async function request(url, { retries = 1, timeout = 12000, cacheKey } = {}) {
  if (cacheKey && memory.has(cacheKey)) return memory.get(cacheKey);

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (!navigator.onLine) {
      throw new ApiError('Sin conexión. Comprueba tu red e inténtalo de nuevo.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const body = await res.text();
      let json = null;
      try { json = JSON.parse(body); } catch { /* respuesta no JSON */ }

      if (!res.ok) {
        const detail = typeof json?.data === 'string' ? json.data : `El servidor respondió ${res.status}.`;
        throw new ApiError(detail, { status: res.status });
      }
      if (!json) throw new ApiError('La respuesta del servidor no es válida.');

      if (cacheKey) memory.set(cacheKey, json);
      return json;
    } catch (err) {
      lastError = err.name === 'AbortError'
        ? new ApiError('La petición ha tardado demasiado.')
        : (err instanceof ApiError ? err : new ApiError('No se ha podido contactar con el servidor.', { cause: err }));
      // Un 4xx no mejora reintentando.
      if (lastError.status >= 400 && lastError.status < 500) break;
      if (attempt < retries) await sleep(700 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/* ================= Aladhan ================= */

function normalizeTimings(payload) {
  const data = payload?.data;
  if (!data?.timings) throw new ApiError('No se han recibido horarios para esa fecha.');
  return {
    timings: data.timings,
    hijri: data.date?.hijri,
    gregorian: data.date?.gregorian,
    meta: {
      timezone: data.meta?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      lat: Number(data.meta?.latitude),
      lon: Number(data.meta?.longitude),
      methodName: data.meta?.method?.name,
    },
  };
}

export async function getTimingsByCoords(lat, lon, method, date = new Date()) {
  const url = `${ALADHAN_BASE}/timings/${apiDate(date)}`
    + `?latitude=${lat}&longitude=${lon}&method=${method}&iso8601=false`;
  return normalizeTimings(await request(url, { cacheKey: url }));
}

/** Búsqueda manual por texto libre ("Barcelona, España"). Aladhan geocodifica por nosotros. */
export async function getTimingsByAddress(address, method, date = new Date()) {
  const url = `${ALADHAN_BASE}/timingsByAddress/${apiDate(date)}`
    + `?address=${encodeURIComponent(address)}&method=${method}&iso8601=false`;
  try {
    return normalizeTimings(await request(url, { cacheKey: url, retries: 0 }));
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      throw new ApiError('No se ha encontrado esa ciudad. Prueba con "Ciudad, País".', { status: err.status });
    }
    throw err;
  }
}

/* ================= Nombre del lugar ================= */

/** Nombre legible para unas coordenadas. Si falla, devuelve null y seguimos con las coordenadas. */
export async function reverseGeocode(lat, lon) {
  try {
    const url = `${GEOCODE_BASE}?latitude=${lat}&longitude=${lon}&localityLanguage=es`;
    const data = await request(url, { retries: 0, timeout: 7000, cacheKey: `geo:${lat},${lon}` });
    const city = data.city || data.locality || data.principalSubdivision;
    return city ? [city, data.countryName].filter(Boolean).join(', ') : null;
  } catch {
    return null;
  }
}

/* ================= Quran.com ================= */

export async function getChapters(language = 'es') {
  const cached = load(STORAGE_KEYS.chapters);
  if (cached?.language === language && Array.isArray(cached.chapters)) return cached.chapters;

  const url = `${QURAN_BASE}/chapters?language=${language}`;
  const data = await request(url, { cacheKey: url });
  const chapters = data.chapters ?? [];
  if (!chapters.length) throw new ApiError('La lista de suras ha llegado vacía.');
  save(STORAGE_KEYS.chapters, { language, chapters });
  return chapters;
}

/** Traducciones disponibles, con el español primero. */
export async function getTranslations() {
  const url = `${QURAN_BASE}/resources/translations`;
  const data = await request(url, { cacheKey: url });
  const wanted = ['spanish', 'english'];
  return (data.translations ?? [])
    .map((t) => ({ ...t, language_name: String(t.language_name).toLowerCase() }))
    .filter((t) => wanted.includes(t.language_name))
    .sort((a, b) => wanted.indexOf(a.language_name) - wanted.indexOf(b.language_name)
      || String(a.author_name || a.name).localeCompare(String(b.author_name || b.name)));
}

/** Versos de una sura. Pagina hasta traer la sura completa. */
export async function getVerses(chapterId, translationId) {
  const verses = [];
  let page = 1;
  for (let guard = 0; guard < 12; guard += 1) {
    const url = `${QURAN_BASE}/verses/by_chapter/${chapterId}`
      + `?fields=text_uthmani&per_page=50&page=${page}`
      + (translationId ? `&translations=${translationId}` : '');
    const data = await request(url, { cacheKey: url });
    verses.push(...(data.verses ?? []));
    const next = data.pagination?.next_page;
    if (!next) break;
    page = next;
  }
  if (!verses.length) throw new ApiError('No se han recibido versos para esta sura.');
  return verses;
}
