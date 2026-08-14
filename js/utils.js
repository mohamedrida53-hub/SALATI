import { compassPoints, hijriMonths, hijriSuffix, getLocale } from './i18n.js';

/* ---------- DOM ---------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Icono del sprite SVG definido en index.html. */
export function icon(id, cls) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

/** Pinta un bloque de estado (cargando / error / vacío) en un contenedor. */
export function showState(node, { title, message, actionLabel, onAction, kind = 'info' }) {
  if (!node) return;
  node.className = `state${kind === 'error' ? ' state--error' : ''}`;
  node.replaceChildren();
  if (title) node.append(el('strong', { text: title }));
  if (message) node.append(document.createTextNode(message));
  if (actionLabel && onAction) {
    node.append(el('br'), el('button', { class: 'btn', type: 'button', text: actionLabel, onclick: onAction }));
  }
  node.hidden = false;
}

export function hideState(node) {
  if (node) node.hidden = true;
}

let toastTimer;
export function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('toast--on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('toast--on'), 3800);
}

/* ---------- Texto ---------- */

/** Limpia etiquetas de las traducciones de Quran.com dejando sólo un subconjunto seguro. */
export function sanitize(html, allowed = ['sup', 'i', 'em', 'b', 'strong', 'br', 'span']) {
  const doc = new DOMParser().parseFromString(`<div>${html ?? ''}</div>`, 'text/html');
  const walk = (source, target) => {
    for (const child of Array.from(source.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        target.append(document.createTextNode(child.nodeValue));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (allowed.includes(tag)) {
          const clean = document.createElement(tag);
          walk(child, clean);
          target.append(clean);
        } else {
          walk(child, target); // conserva el texto, descarta la etiqueta
        }
      }
    }
  };
  const out = document.createDocumentFragment();
  walk(doc.body.firstChild, out);
  return out;
}

/* ---------- Tiempo ---------- */

export const pad2 = (n) => String(n).padStart(2, '0');

/** Aladhan puede devolver "05:12" o "05:12 (CEST)". Nos quedamos con HH:MM. */
export function cleanTime(value) {
  const match = String(value ?? '').match(/(\d{1,2}):(\d{2})/);
  return match ? `${pad2(match[1])}:${match[2]}` : '--:--';
}

export function timeToSeconds(value) {
  const [h, m] = cleanTime(value).split(':');
  const hours = Number(h);
  const minutes = Number(m);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 3600 + minutes * 60 : NaN;
}

/**
 * Segundos transcurridos hoy en una zona horaria concreta.
 * Evita construir objetos Date con desfases: sólo comparamos "segundos del día".
 */
export function secondsOfDayInZone(timeZone, date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = {};
    for (const p of fmt.formatToParts(date)) {
      if (p.type !== 'literal') parts[p.type] = Number(p.value);
    }
    const hour = parts.hour === 24 ? 0 : parts.hour;
    return hour * 3600 + parts.minute * 60 + parts.second;
  } catch {
    return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  }
}

export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

/** Fecha para la URL de Aladhan: DD-MM-YYYY. */
export function apiDate(date = new Date()) {
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function tomorrow(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

export function formatGregorian(gregorian) {
  if (!gregorian?.date) return '';
  const [d, m, y] = gregorian.date.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // `calendar: gregory` es obligatorio: en árabe, Intl usaría el hijri por defecto.
  const text = new Intl.DateTimeFormat(getLocale(), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC', calendar: 'gregory',
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Solo el día de la semana: la fecha completa ya va arriba, junto a la hijri. */
export function formatWeekday(gregorian) {
  if (!gregorian?.date) return '';
  const [d, m, y] = gregorian.date.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const text = new Intl.DateTimeFormat(getLocale(), {
    weekday: 'long', timeZone: 'UTC', calendar: 'gregory',
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Versión corta para ponerla al lado de la fecha hijri (sin día de la semana). */
export function formatGregorianShort(gregorian) {
  if (!gregorian?.date) return '';
  const [d, m, y] = gregorian.date.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC', calendar: 'gregory',
  }).format(date);
}

export function formatHijri(hijri) {
  if (!hijri?.day) return '';
  const month = hijriMonths()[Number(hijri.month?.number) - 1] || hijri.month?.en || '';
  return `${Number(hijri.day)} ${month} ${hijri.year} ${hijriSuffix()}`;
}

/* ---------- Geometría ---------- */

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Azimut inicial de círculo máximo (forward azimuth) entre dos puntos, en grados 0–360. */
export function initialBearing(from, to) {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lon - from.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Distancia de círculo máximo (Haversine) en kilómetros. */
export function haversineKm(from, to) {
  const R = 6371.0088;
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δφ = toRad(to.lat - from.lat);
  const Δλ = toRad(to.lon - from.lon);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function compassName(deg) {
  return compassPoints()[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

/* ---------- Almacenamiento ---------- */

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* modo privado o cuota llena: seguimos sin caché */ }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
