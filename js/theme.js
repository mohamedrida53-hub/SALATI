import { STORAGE_KEYS } from './config.js';

/* =========================================================
   Apariencia: sistema / claro / oscuro.

   El tema real lo aplica un script en línea del <head>, ANTES de que el
   navegador pinte nada. Si se hiciera desde aquí (un módulo, que va
   diferido) el usuario vería un fogonazo oscuro antes de que apareciera
   el modo claro. Este archivo sólo gestiona el cambio posterior.

   `auto` no es un tema: es «lo que diga el sistema». La CSS lo resuelve
   con una media query, así que si el usuario cambia el modo del móvil la
   app le sigue sin recargar.
   ========================================================= */

export const THEMES = ['auto', 'light', 'dark'];
export const DEFAULT_THEME = 'auto';

const listeners = new Set();

/** Color de la barra del navegador y de la de gestos, distinto en cada tema.
    Coincide con --bg de styles.css y con salatiBackground del tema Android. */
const BAR_COLOR = { dark: '#070a09', light: '#faf8f3' };

function read() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    return THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function getTheme() {
  return read();
}

/** ¿Qué se está viendo de verdad ahora mismo: claro u oscuro? */
export function resolvedTheme() {
  const elegido = read();
  if (elegido !== 'auto') return elegido;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function setTheme(value) {
  if (!THEMES.includes(value)) return;
  try { localStorage.setItem(STORAGE_KEYS.theme, value); } catch { /* modo privado */ }
  apply();
  for (const fn of listeners) fn(value);
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Vuelca el tema al DOM y ajusta el color de la barra del navegador. */
export function apply() {
  document.documentElement.dataset.theme = read();
  const color = BAR_COLOR[resolvedTheme()];
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', color);
  pintarBarraNativa();
}

/**
 * Ajusta los ICONOS de las barras del sistema al tema de la app.
 *
 * Antes esto pintaba la barra de gestos de un color con un plugin de la
 * comunidad. **En Android 15 eso dejó de funcionar y no tiene arreglo**: al
 * apuntar a targetSdk 35 o superior el sistema impone el modo «edge to edge»,
 * las barras son siempre transparentes y tanto `setNavigationBarColor` como
 * los atributos `android:navigationBarColor` y `android:statusBarColor` del
 * tema se ignoran. Google lo hizo obligatorio, no es opcional.
 *
 * Lo que sí se puede decidir es si los iconos del sistema (reloj, batería,
 * flechas de gestos) se dibujan claros u oscuros, y eso es justo lo que hace
 * falta: con la app en claro tienen que ser oscuros para verse, y al revés.
 * De eso se encarga SystemBars, que en Capacitor 8 viene dentro del propio
 * `@capacitor/core`, sin plugin de terceros.
 *
 * El fondo que se ve DETRÁS de las barras ahora lo pinta la propia web: el
 * `body` llega hasta los bordes y la cabecera y la barra de pestañas reservan
 * el hueco con `env(safe-area-inset-*)`, que ya estaba en styles.css.
 *
 * `Dark` significa «contenido para fondo oscuro», es decir iconos claros.
 */
function pintarBarraNativa() {
  const SB = globalThis.Capacitor?.Plugins?.SystemBars;
  if (!SB?.setStyle) return;   // navegador, o Capacitor anterior a la 8
  try {
    SB.setStyle({ style: resolvedTheme() === 'dark' ? 'DARK' : 'LIGHT' });
  } catch { /* se queda el estilo inicial de capacitor.config.json */ }
}

export function initTheme() {
  apply();

  // Con «Sistema» elegido, seguir al SO en caliente sin recargar.
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (read() === 'auto') {
      apply();
      for (const fn of listeners) fn('auto');
    }
  });
}
