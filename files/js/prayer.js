import { PRAYERS } from './config.js';
import {
  $, el, icon, showState, hideState, cleanTime, timeToSeconds,
  secondsOfDayInZone, formatCountdown, formatWeekday, formatGregorianShort, formatHijri,
} from './utils.js';
import { t, prayerName, prayerSub } from './i18n.js';

const ARC_RADIUS = 88;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;

const dom = {};
let current = null;
let timer = null;
let lastKey = null;
let lastNowSec = null;
let hooks = { onRetry: null, onDayChange: null };

export function initPrayer(callbacks = {}) {
  hooks = { ...hooks, ...callbacks };

  dom.state = $('#prayer-state');
  dom.hero = $('#hero');
  dom.hijri = $('#hijri-date');
  dom.gregorian = $('#gregorian-date');
  dom.name = $('#next-name');
  dom.time = $('#next-time');
  dom.count = $('#countdown');
  dom.arc = $('#arc-fill');
  dom.list = $('#times-list');
  dom.note = $('#meta-note');

  dom.arc.style.strokeDasharray = String(ARC_LENGTH);
  dom.arc.style.strokeDashoffset = String(ARC_LENGTH);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
}

/** Punto de entrada: recibe el estado y decide qué pintar. */
export function renderPrayer(state) {
  if (state.loading && !state.today) {
    dom.hero.hidden = true;
    dom.list.replaceChildren();
    showState(dom.state, { title: 'Cargando horarios', message: 'Consultando la API de Aladhan…' });
    return;
  }

  if (state.error && !state.today) {
    dom.hero.hidden = true;
    dom.list.replaceChildren();
    showState(dom.state, {
      kind: 'error',
      title: 'No hay horarios que mostrar',
      message: state.error,
      actionLabel: 'Reintentar',
      onAction: () => hooks.onRetry?.(),
    });
    stopClock();
    return;
  }

  if (!state.today) {
    dom.hero.hidden = true;
    showState(dom.state, {
      title: 'Elige una ubicación',
      message: 'Los horarios dependen de tus coordenadas.',
      actionLabel: 'Elegir ubicación',
      onAction: () => hooks.onRetry?.(),
    });
    return;
  }

  hideState(dom.state);
  dom.hero.hidden = false;

  const { hijri, gregorian, meta } = state.today;
  // Las dos fechas van juntas arriba: hijri primero, occidental al lado.
  dom.hijri.replaceChildren(
    el('span', { class: 'eyebrow__hijri', text: formatHijri(hijri) }),
    el('span', { class: 'eyebrow__sep', 'aria-hidden': 'true', text: '·' }),
    el('span', { class: 'eyebrow__greg', text: formatGregorianShort(gregorian) }),
  );
  dom.gregorian.textContent = formatWeekday(gregorian);
  dom.note.textContent = [
    meta.methodName ? t('prayer.metaMethod', { name: meta.methodName }) : '',
    meta.timezone ? t('prayer.metaZone', { zone: meta.timezone }) : '',
  ].filter(Boolean).join(' ');

  lastKey = null; // fuerza repintado de la lista
  current = state;
  startClock();
  tick();
}

/* ---------------- Reloj ---------------- */

function startClock() {
  if (timer) return;
  timer = setInterval(tick, 1000);
}

function stopClock() {
  clearInterval(timer);
  timer = null;
}

function tick() {
  if (!current?.today) return;
  const { timings, meta } = current.today;
  const nowSec = secondsOfDayInZone(meta.timezone);

  // Cambio de día: los horarios de hoy ya no sirven.
  if (lastNowSec !== null && nowSec < lastNowSec - 60) {
    lastNowSec = nowSec;
    hooks.onDayChange?.();
    return;
  }
  lastNowSec = nowSec;

  const next = computeNext(timings, current.tomorrowFajr, nowSec);
  if (!next) {
    dom.count.textContent = '--:--:--';
    return;
  }

  dom.count.textContent = formatCountdown(next.secondsLeft);

  if (next.key !== lastKey) {
    lastKey = next.key;
    dom.name.textContent = prayerName(next.key);
    dom.time.textContent = next.tomorrow
      ? t('prayer.tomorrowAt', { time: next.clock })
      : t('prayer.todayAt', { time: next.clock });
    renderList(timings, next.key, nowSec);
  }

  const span = next.targetSec - next.prevSec;
  const done = span > 0 ? Math.min(1, Math.max(0, (nowSec - next.prevSec) / span)) : 0;
  dom.arc.style.strokeDashoffset = String(ARC_LENGTH * (1 - done));
}

/**
 * Devuelve el próximo rezo trabajando en "segundos del día".
 * Después del Isha el objetivo pasa de 86400 (mañana) y el cálculo sigue siendo lineal.
 */
export function computeNext(timings, tomorrowFajr, nowSec) {
  const points = PRAYERS
    .filter((p) => !p.info)
    .map((p) => ({ ...p, sec: timeToSeconds(timings[p.key]), clock: cleanTime(timings[p.key]) }))
    .filter((p) => Number.isFinite(p.sec));

  if (!points.length) return null;

  for (let i = 0; i < points.length; i += 1) {
    if (points[i].sec > nowSec) {
      const prevSec = i > 0
        ? points[i - 1].sec
        : timeToSeconds(timings.Isha) - 86400; // Isha de ayer
      return {
        ...points[i],
        secondsLeft: points[i].sec - nowSec,
        prevSec: Number.isFinite(prevSec) ? prevSec : points[i].sec - 3600,
        targetSec: points[i].sec,
        tomorrow: false,
      };
    }
  }

  // Ya ha pasado el Isha: el siguiente es el Fajr de mañana.
  const fajrRaw = tomorrowFajr ?? timings.Fajr;
  const fajrSec = timeToSeconds(fajrRaw) + 86400;
  const isha = points[points.length - 1];
  return {
    ...points[0],
    clock: cleanTime(fajrRaw),
    secondsLeft: fajrSec - nowSec,
    prevSec: isha.sec,
    targetSec: fajrSec,
    tomorrow: true,
  };
}

/* ---------------- Lista ---------------- */

function renderList(timings, nextKey, nowSec) {
  const rows = PRAYERS.map((p) => {
    const sec = timeToSeconds(timings[p.key]);
    const isNext = p.key === nextKey;
    const isPast = Number.isFinite(sec) && sec <= nowSec && !isNext;

    const classes = ['time'];
    if (p.info) classes.push('time--info');
    if (isPast) classes.push('time--past');
    if (isNext) classes.push('time--next');

    return el('li', { class: classes.join(' '), 'aria-current': isNext ? 'true' : null }, [
      icon(p.icon),
      el('div', {}, [
        el('div', { class: 'time__name' }, [
          prayerName(p.key),
          isNext ? el('span', { class: 'time__tag', text: t('prayer.next') }) : null,
        ]),
        el('div', { class: 'time__ar', text: `${p.ar} · ${prayerSub(p.key)}` }),
      ]),
      el('div', { class: 'time__clock', text: cleanTime(timings[p.key]) }),
    ]);
  });

  dom.list.replaceChildren(...rows);
}
