import { STORAGE_KEYS, TASBIH_TARGETS, DHIKR } from './config.js';
import { $, el, load, save, toast } from './utils.js';
import { t } from './i18n.js';

/* =========================================================
   Contador de tasbih.
   Toda la zona central cuenta: se usa sin mirar la pantalla.
   Vibración corta en cada toque y larga al cerrar la ronda (33).
   `target = 0` significa «sin límite» (0 se guarda en JSON, Infinity no).
   ========================================================= */

const RING_RADIUS = 128;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const FREE_STEP = 33;   // ritmo de las vibraciones largas en modo sin límite

const dom = {};
let count = 0;
let rounds = 0;
let target = 33;
let dhikrIndex = 0;

export function initTasbih() {
  restore();

  dom.pad = $('#tasbih-pad');
  dom.count = $('#tasbih-count');
  dom.of = $('#tasbih-of');
  dom.dhikr = $('#tasbih-dhikr');
  dom.rounds = $('#tasbih-rounds');
  dom.fill = $('#tasbih-fill');
  dom.targets = $('#tasbih-targets');
  dom.reset = $('#tasbih-reset');
  dom.undo = $('#tasbih-undo');

  dom.fill.style.strokeDasharray = String(RING_LENGTH);

  dom.targets.replaceChildren(...TASBIH_TARGETS.map((value) => el('button', {
    class: 'tasbih__target',
    type: 'button',
    'aria-pressed': String(value === target),
    dataset: { target: value },
    text: value === 0 ? '∞' : String(value),
    onclick: () => setTarget(value),
  })));

  // pointerdown responde antes que click: el contador se siente inmediato.
  dom.pad.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    increment();
  });
  dom.pad.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); increment(); }
  });
  dom.undo.addEventListener('click', undo);
  dom.reset.addEventListener('click', reset);

  // El sistema suelta el wake lock al minimizar; hay que recuperarlo al volver.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });

  render();
}

/* ---------------- Pantalla siempre activa ---------------- */

let wakeLock = null;
let wakeWanted = false;

/** La llama app.js al entrar y salir de la pestaña. */
export function setTasbihActive(active) {
  wakeWanted = active;
  if (active) requestWakeLock();
  else releaseWakeLock();
}

async function requestWakeLock() {
  if (!wakeWanted || wakeLock) return;
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    wakeLock = null;   // batería baja o pestaña en segundo plano: se ignora
  }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

/** Repinta los textos tras un cambio de idioma. */
export function refreshTasbih() {
  if (dom.count) render();
}

/* ---------------- Acciones ---------------- */

function step() {
  return target > 0 ? target : FREE_STEP;
}

function increment() {
  count += 1;

  if (count % step() === 0) {
    rounds += 1;
    dhikrIndex = (dhikrIndex + 1) % DHIKR.length;
    buzz([70, 45, 140]);            // vibración larga al llegar a 33
    flash();
    if (target > 0) count = 0;      // con meta fija, la ronda vuelve a empezar
  } else {
    buzz(15);                       // toque seco en cada cuenta
  }

  render();
  persist();
}

function undo() {
  if (target > 0) {
    if (count === 0 && rounds > 0) {
      rounds -= 1;
      count = target - 1;
    } else if (count > 0) {
      count -= 1;
    }
  } else if (count > 0) {
    if (count % FREE_STEP === 0) rounds = Math.max(0, rounds - 1);
    count -= 1;
  }
  buzz(8);
  render();
  persist();
}

function reset() {
  count = 0;
  rounds = 0;
  dhikrIndex = 0;
  buzz(8);
  render();
  persist();
  toast(t('tasbih.resetDone'));
}

function setTarget(value) {
  target = value;
  count = 0;
  for (const button of dom.targets.children) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.target) === value));
  }
  render();
  persist();
}

function buzz(pattern) {
  // navigator.vibrate no existe en iOS ni en escritorio: simplemente no vibra.
  if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
}

function flash() {
  dom.pad.classList.remove('tasbih__pad--round');
  void dom.pad.offsetWidth;   // fuerza el reinicio de la animación
  dom.pad.classList.add('tasbih__pad--round');
}

/* ---------------- Pintado y persistencia ---------------- */

function render() {
  const limited = target > 0;
  dom.count.textContent = String(count);
  dom.of.textContent = limited ? t('tasbih.of', { n: target }) : t('tasbih.free');
  dom.rounds.textContent = rounds === 1 ? t('tasbih.roundsOne') : t('tasbih.roundsMany', { n: rounds });
  dom.dhikr.textContent = DHIKR[dhikrIndex]?.ar ?? '';
  dom.dhikr.title = DHIKR[dhikrIndex]?.es ?? '';
  dom.pad.setAttribute('aria-label', t('tasbih.padAria', {
    count,
    of: limited ? ` ${t('tasbih.of', { n: target })}` : '',
  }));

  const progress = limited ? Math.min(1, count / target) : (count % FREE_STEP) / FREE_STEP;
  dom.fill.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
}

function persist() {
  save(STORAGE_KEYS.tasbih, { count, rounds, target, dhikrIndex });
}

function restore() {
  const saved = load(STORAGE_KEYS.tasbih, null);
  if (!saved) return;
  count = Number(saved.count) || 0;
  rounds = Number(saved.rounds) || 0;
  target = TASBIH_TARGETS.includes(Number(saved.target)) ? Number(saved.target) : 33;
  dhikrIndex = Number(saved.dhikrIndex) || 0;
}
