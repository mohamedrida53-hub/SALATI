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

/** Color de la barra del navegador, distinto en cada tema. */
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
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BAR_COLOR[resolvedTheme()]);
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
