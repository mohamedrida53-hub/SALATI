/* Acceso a la Geolocation API con mensajes claros para cada fallo posible.
   Los textos se resuelven al lanzarse el error, no al cargar el módulo, para
   que salgan en el idioma que el usuario tenga puesto en ese momento. */

import { t } from './i18n.js';

const MESSAGE_KEYS = {
  1: 'loc.denied',
  2: 'loc.unavailable',
  3: 'loc.timeout',
};

/**
 * Guarda la CLAVE de traducción además del texto ya resuelto. Si sólo se
 * guardara el texto, un error capturado en castellano seguiría en castellano
 * después de que el usuario cambiara de idioma.
 */
export class LocationError extends Error {
  constructor(key, code = 0) {
    super(t(key));
    this.name = 'LocationError';
    this.key = key;
    this.code = code;
  }
}

export function geolocationAvailable() {
  return 'geolocation' in navigator && window.isSecureContext;
}

export function requestPosition({ timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationError('loc.noGeo'));
      return;
    }
    if (!window.isSecureContext) {
      reject(new LocationError('loc.noSecure'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        lat: Number(coords.latitude.toFixed(5)),
        lon: Number(coords.longitude.toFixed(5)),
        accuracy: coords.accuracy,
      }),
      (err) => reject(new LocationError(MESSAGE_KEYS[err.code] ?? 'loc.generic', err.code)),
      { enableHighAccuracy: false, timeout, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** ¿Ya hay permiso concedido? Sirve para no pedirlo dos veces. */
export async function permissionState() {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' });
    return status?.state ?? 'prompt';
  } catch {
    return 'prompt';
  }
}
