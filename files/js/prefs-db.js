/* =========================================================
   Espejo de preferencias en IndexedDB.

   Existe por una limitación concreta: **un service worker no puede leer
   localStorage**. localStorage es síncrono y sólo está disponible en el hilo
   de la ventana; el worker corre en otro contexto y no lo ve.

   Como el worker necesita saber si el usuario tiene el adhan y las
   notificaciones activados ANTES de mostrar nada (tarea 3), los dos flags se
   copian a IndexedDB, que sí es accesible desde ambos lados.

   localStorage sigue siendo la fuente de verdad para la interfaz; esto es
   sólo una copia de lectura para el worker.
   ========================================================= */

const DB_NAME = 'salati-prefs';
const STORE = 'flags';
const VERSION = 1;

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) { reject(new Error('sin IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Guarda un flag. Nunca lanza: si falla, la app sigue igual. */
export async function writeFlag(key, value) {
  try {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Lee un flag. Devuelve `fallback` si no existe o si IndexedDB falla. */
export async function readFlag(key, fallback = false) {
  try {
    const db = await open();
    const valor = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return valor === undefined ? fallback : valor;
  } catch {
    return fallback;
  }
}
