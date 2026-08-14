import { DEFAULT_METHOD, STORAGE_KEYS } from './config.js';
import { load, save } from './utils.js';

/**
 * Estado compartido por las tres secciones.
 * place: { lat, lon, label, timezone, source: 'gps' | 'city', query }
 */
export const state = {
  place: load(STORAGE_KEYS.place, null),
  method: load(STORAGE_KEYS.method, DEFAULT_METHOD),
  today: null,      // { timings, hijri, gregorian, meta }
  tomorrowFajr: null,
  loading: false,
  error: null,
  errorKey: null,   // clave i18n del error, para poder retraducirlo
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  if ('place' in patch && patch.place) save(STORAGE_KEYS.place, patch.place);
  if ('method' in patch) save(STORAGE_KEYS.method, patch.method);
  for (const fn of listeners) fn(state);
}
