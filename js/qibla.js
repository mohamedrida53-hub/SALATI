import { KAABA } from './config.js';
import { $, showState, hideState, initialBearing, haversineKm, compassName, toast } from './utils.js';
import { t, getLocale } from './i18n.js';

/* Histéresis: se entra en «alineado» a 4° y no se sale hasta pasar de 9°.
   Sin esto el indicador parpadearía con el temblor de la mano. */
const ALIGN_ENTER = 4;
const ALIGN_EXIT = 9;
const TILT_LIMIT = 25;   // grados de inclinación que el magnetómetro tolera

/* El magnetómetro de un móvil es ruidoso: en reposo sigue entregando lecturas
   que bailan varios grados, y el evento llega hasta 60 veces por segundo. Sin
   filtrar, la aguja tiembla sin parar y la vista «se mueve» aunque el layout
   esté quieto. Esto no lo arregla ningún CSS: hay que suavizar el dato.

   SMOOTHING = peso de cada lectura nueva (filtro paso bajo de primer orden).
   Más bajo = más estable y más perezoso; 0.15 va sobrado para orientarse.
   DEADZONE = por debajo de este cambio ni siquiera se repinta. */
const SMOOTHING = 0.15;
const DEADZONE_DEG = 0.8;
const MIN_FRAME_MS = 66;   // ~15 repintados por segundo son de sobra

const dom = {};
let bearing = null;
let heading = null;
let listening = false;
let handler = null;
let eventName = 'deviceorientation';
let ringAngle = 0;      // ángulo acumulado, para que el giro nunca dé la vuelta larga
let sawEvent = false;
let aligned = false;
let tilted = false;
let alignTimer = null;
let smoothed = null;    // rumbo filtrado
let lastPaint = 0;      // marca de tiempo del último repintado
let hooks = { onNeedLocation: null };

export function initQibla(callbacks = {}) {
  hooks = { ...hooks, ...callbacks };

  dom.state = $('#qibla-state');
  dom.wrap = $('#qibla-wrap');
  dom.compass = $('#compass');
  dom.ring = $('#compass-ring');
  dom.ticks = $('#compass-ticks');
  dom.marker = $('#qibla-marker');
  dom.deg = $('#qibla-deg');
  dom.dir = $('#qibla-dir');
  dom.hint = $('#qibla-hint');
  dom.status = $('#qibla-status');
  dom.btn = $('#btn-compass');
  dom.bearing = $('#fact-bearing');
  dom.distance = $('#fact-distance');
  dom.place = $('#fact-place');
  dom.level = $('#level');
  dom.levelDot = $('#level-dot');

  drawTicks();

  eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  dom.btn.addEventListener('click', enableCompass);
}

function drawTicks() {
  const marks = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const major = deg % 45 === 0;
    const rad = (deg - 90) * (Math.PI / 180);
    const outer = 108;
    const inner = major ? 94 : 100;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', (120 + outer * Math.cos(rad)).toFixed(2));
    line.setAttribute('y1', (120 + outer * Math.sin(rad)).toFixed(2));
    line.setAttribute('x2', (120 + inner * Math.cos(rad)).toFixed(2));
    line.setAttribute('y2', (120 + inner * Math.sin(rad)).toFixed(2));
    if (major) line.setAttribute('class', 'major');
    marks.push(line);
  }
  dom.ticks.replaceChildren(...marks);
}

export function renderQibla(state) {
  const place = state.place;
  if (!place || !Number.isFinite(place.lat)) {
    dom.wrap.hidden = true;
    showState(dom.state, {
      title: t('qibla.noLocTitle'),
      message: t('qibla.noLocMsg'),
      actionLabel: t('qibla.noLocAction'),
      onAction: () => hooks.onNeedLocation?.(),
    });
    return;
  }

  hideState(dom.state);
  dom.wrap.hidden = false;

  const from = { lat: place.lat, lon: place.lon };
  bearing = initialBearing(from, KAABA);
  const km = haversineKm(from, KAABA);

  dom.deg.textContent = `${bearing.toFixed(0)}°`;
  dom.dir.textContent = compassName(bearing);
  dom.bearing.textContent = `${bearing.toFixed(0)}° (${compassName(bearing)})`;
  dom.distance.textContent = `${Math.round(km).toLocaleString(getLocale())} km`;
  // El nombre de la ciudad ya viene resuelto por el flujo de rezos.
  dom.place.textContent = place.label || `${from.lat.toFixed(3)}, ${from.lon.toFixed(3)}`;
  dom.marker.style.transform = `rotate(${bearing}deg)`;

  updateAlignment();
  updateHint();
}

function updateHint() {
  const needsPermission = typeof DeviceOrientationEvent !== 'undefined'
    && typeof DeviceOrientationEvent.requestPermission === 'function';

  // La brújula ya entrega datos: el botón sobra y su hueco también.
  // La clase colapsa la banda a 0 px, así que desaparece de verdad y no
  // queda un espacio vacío donde antes estaba el botón.
  const activa = listening && sawEvent;
  dom.status.classList.toggle('qibla__status--live', activa);

  if (activa) {
    dom.btn.hidden = true;
    if (aligned) {
      dom.hint.textContent = t('qibla.hintAligned');
    } else if (tilted) {
      dom.hint.textContent = t('qibla.hintFlat');
    } else {
      dom.hint.textContent = t('qibla.hintTurn');
    }
    dom.hint.classList.toggle('qibla__hint--ok', aligned);
    dom.hint.classList.toggle('qibla__hint--warn', tilted && !aligned);
    return;
  }

  dom.hint.classList.remove('qibla__hint--ok', 'qibla__hint--warn');

  if (needsPermission && !listening) {
    dom.hint.textContent = t('qibla.hintPermission');
    dom.btn.hidden = false;
    return;
  }
  dom.btn.hidden = true;
  dom.hint.textContent = bearing === null
    ? ''
    : t('qibla.hintNoCompass', { dir: compassName(bearing), deg: bearing.toFixed(0) });
}

/* ---------------- Sensores ---------------- */

export async function enableCompass() {
  if (listening) return;

  if (typeof DeviceOrientationEvent === 'undefined') {
    toast('Este dispositivo no informa de su orientación.');
    return;
  }

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== 'granted') {
        toast('Permiso de sensores denegado. Se muestra la dirección fija.');
        return;
      }
    } catch {
      toast('No se ha podido pedir el permiso de sensores.');
      return;
    }
  }

  handler = onOrientation;
  window.addEventListener(eventName, handler, true);
  listening = true;
  sawEvent = false;

  // Repintado inmediato: con el permiso ya concedido el botón no pinta nada
  // esperando 2,5 s a que llegue la primera lectura del sensor.
  updateHint();

  setTimeout(() => {
    if (!sawEvent) updateHint(); // ningún dato: seguimos en modo estático
  }, 2500);
}

export function stopCompass() {
  if (!listening) return;
  window.removeEventListener(eventName, handler, true);
  listening = false;
  handler = null;
  heading = null;
  smoothed = null;
  stopAlignBuzz();
  aligned = false;
  tilted = false;
  dom.compass.classList.remove('compass--aligned');
  dom.level.hidden = true;
}

function onOrientation(event) {
  let raw = null;

  if (typeof event.webkitCompassHeading === 'number') {
    raw = event.webkitCompassHeading;                     // iOS: ya es norte magnético
  } else if (typeof event.alpha === 'number' && (event.absolute || eventName === 'deviceorientationabsolute')) {
    raw = (360 - event.alpha) % 360;                      // Android con brújula absoluta
  }

  updateTilt(event);

  if (raw === null || Number.isNaN(raw)) return;

  // Compensa el giro de pantalla del dispositivo.
  const screenAngle = screen.orientation?.angle ?? 0;
  const measured = (raw + screenAngle) % 360;

  smoothed = smoothHeading(measured);
  heading = smoothed;

  if (!sawEvent) {
    sawEvent = true;
    updateHint();
  }

  // Limita la frecuencia de repintado y descarta los temblores minúsculos.
  const now = performance.now();
  if (now - lastPaint >= MIN_FRAME_MS) {
    lastPaint = now;
    rotateRing(-heading);
  }
  updateAlignment();
}

/**
 * Filtro paso bajo sobre el círculo. No se puede promediar en grados sin más
 * (entre 359° y 1° la media daría 180°), así que se trabaja con la diferencia
 * más corta entre el valor filtrado y la lectura nueva.
 */
function smoothHeading(measured) {
  if (smoothed === null) return measured;

  const delta = ((measured - smoothed) % 360 + 540) % 360 - 180;
  // Un salto grande es un giro de verdad, no ruido: se sigue sin frenar.
  if (Math.abs(delta) > 40) return measured;
  if (Math.abs(delta) < DEADZONE_DEG) return smoothed;

  return ((smoothed + delta * SMOOTHING) % 360 + 360) % 360;
}

/** Gira siempre por el camino corto: acumulamos grados en vez de saltar de 359 a 0. */
function rotateRing(targetDeg) {
  const delta = ((targetDeg - ringAngle) % 360 + 540) % 360 - 180;
  ringAngle += delta;
  dom.ring.style.transform = `rotate(${ringAngle.toFixed(1)}deg)`;
}

/* ---------------- Nivel de burbuja ---------------- */

function updateTilt(event) {
  const beta = Number(event.beta);
  const gamma = Number(event.gamma);
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;

  dom.level.hidden = false;

  const clamp = (v) => Math.max(-9, Math.min(9, v / 3));
  dom.levelDot.style.translate =
    `calc(-50% + ${clamp(gamma).toFixed(1)}px) calc(-50% + ${clamp(beta).toFixed(1)}px)`;

  const flat = Math.hypot(beta, gamma) <= TILT_LIMIT;
  dom.level.classList.toggle('level--flat', flat);

  if (tilted !== !flat) {
    tilted = !flat;
    updateHint();
  }
}

/* ---------------- Alineación con la Qibla ---------------- */

function updateAlignment() {
  if (bearing === null || heading === null) return;

  const diff = Math.abs(((heading - bearing + 180) % 360 + 360) % 360 - 180);
  const next = aligned ? diff <= ALIGN_EXIT : diff <= ALIGN_ENTER;
  if (next === aligned) return;

  aligned = next;
  dom.compass.classList.toggle('compass--aligned', aligned);
  if (aligned) startAlignBuzz();
  else stopAlignBuzz();
  updateHint();
}

function startAlignBuzz() {
  stopAlignBuzz();
  buzz([180, 70, 180]);                              // confirmación fuerte al enganchar
  alignTimer = setInterval(() => buzz(90), 1600);    // recordatorio suave mientras siga apuntando
}

function stopAlignBuzz() {
  clearInterval(alignTimer);
  alignTimer = null;
  buzz(0);
}

function buzz(pattern) {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
}
