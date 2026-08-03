/* Acceso a la Geolocation API con mensajes claros para cada fallo posible. */

const MESSAGES = {
  1: 'Has denegado el acceso a tu ubicación. Puedes buscar tu ciudad a mano.',
  2: 'No se ha podido determinar tu posición. Prueba a buscar tu ciudad.',
  3: 'La búsqueda de ubicación ha tardado demasiado. Prueba a buscar tu ciudad.',
};

export class LocationError extends Error {
  constructor(message, code = 0) {
    super(message);
    this.name = 'LocationError';
    this.code = code;
  }
}

export function geolocationAvailable() {
  return 'geolocation' in navigator && window.isSecureContext;
}

export function requestPosition({ timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationError('Este navegador no ofrece geolocalización.'));
      return;
    }
    if (!window.isSecureContext) {
      reject(new LocationError('La geolocalización necesita HTTPS o localhost.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        lat: Number(coords.latitude.toFixed(5)),
        lon: Number(coords.longitude.toFixed(5)),
        accuracy: coords.accuracy,
      }),
      (err) => reject(new LocationError(MESSAGES[err.code] || 'No se ha podido obtener tu ubicación.', err.code)),
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
