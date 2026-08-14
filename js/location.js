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
  // En el APK el plugin siempre está disponible aunque no haya contexto seguro.
  if (globalThis.Capacitor?.isNativePlatform?.()) return true;
  return 'geolocation' in navigator && window.isSecureContext;
}

/** El plugin nativo, si estamos dentro de Capacitor. */
function pluginGeo() {
  return globalThis.Capacitor?.isNativePlatform?.()
    ? globalThis.Capacitor?.Plugins?.Geolocation ?? null
    : null;
}

/**
 * Ubicación por la vía nativa de Capacitor.
 *
 * En el APK la API del navegador no basta: Android exige que la app pida el
 * permiso al sistema operativo, y eso sólo lo hace el plugin. Sin esto la
 * geolocalización fallaba en silencio dentro de la app compilada.
 */
async function requestPositionNative(timeout) {
  const Geo = pluginGeo();

  const permiso = await Geo.checkPermissions();
  if (permiso.location !== 'granted') {
    const pedido = await Geo.requestPermissions({ permissions: ['location'] });
    if (pedido.location !== 'granted') {
      throw new LocationError('loc.denied', 1);
    }
  }

  const pos = await Geo.getCurrentPosition({
    enableHighAccuracy: false,
    timeout,
    maximumAge: 5 * 60 * 1000,
  });

  return {
    lat: Number(pos.coords.latitude.toFixed(5)),
    lon: Number(pos.coords.longitude.toFixed(5)),
    accuracy: pos.coords.accuracy,
  };
}

export function requestPosition({ timeout = 12000 } = {}) {
  // Dentro del APK manda el plugin; en la web, la API del navegador.
  if (pluginGeo()) {
    return requestPositionNative(timeout).catch((err) => {
      if (err instanceof LocationError) throw err;
      console.error('[SALATI/geo] Fallo del plugin nativo:', err);
      throw new LocationError('loc.unavailable', 2);
    });
  }

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
