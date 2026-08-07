import { $, el } from './utils.js';
import { t, getLocale, getLang, hijriMonths, hijriSuffix } from './i18n.js';

/* =========================================================
   Calendario islámico (Hégira).

   Conversión: `Intl.DateTimeFormat` con el calendario `islamic-umalqura`,
   que es el de Umm al-Qura y coincide exactamente con lo que devuelve
   Aladhan para la cabecera de rezos (verificado: 3-8-2026 → 20 Safar 1448).
   Va incluido en el navegador, así que no hay librería ni red de por medio
   y el calendario funciona sin conexión, que es lo que toca en una PWA.

   Rejilla: SIEMPRE 6 semanas × 7 días = 42 celdas, tenga el mes 28 o 31
   días y empiece en el día que empiece. Es lo que garantiza que la altura
   no cambie nunca al pasar de mes y no haya ningún salto de layout.
   ========================================================= */

/* Fiestas del año islámico: [mes hijri, día hijri] → clave de traducción. */
const HOLIDAYS = [
  { month: 1,  day: 1,  key: 'cal.newYear',  tone: 'gold' },
  { month: 1,  day: 10, key: 'cal.ashura',   tone: 'gold' },
  { month: 9,  day: 1,  key: 'cal.ramadan',  tone: 'green' },
  { month: 10, day: 1,  key: 'cal.eidFitr',  tone: 'green' },
  { month: 12, day: 9,  key: 'cal.arafat',   tone: 'gold' },
  { month: 12, day: 10, key: 'cal.eidAdha',  tone: 'green' },
];

/* Primer día de la semana por idioma: lunes en Europa, sábado en árabe. */
const FIRST_DAY = { ca: 1, es: 1, en: 1, ar: 6 };

const CELLS = 42;
const dom = {};
let viewYear = 0;
let viewMonth = 0;    // 0-11, gregoriano
let selected = null;  // clave 'YYYY-M-D' de la celda abierta

export function initCalendar() {
  dom.grid = $('#cal-grid');
  dom.head = $('#cal-weekdays');
  dom.greg = $('#cal-greg');
  dom.hijri = $('#cal-hijri');
  dom.detail = $('#cal-detail');
  dom.prev = $('#cal-prev');
  dom.next = $('#cal-next');
  dom.today = $('#cal-today');

  const hoy = new Date();
  viewYear = hoy.getFullYear();
  viewMonth = hoy.getMonth();

  dom.prev.addEventListener('click', () => shiftMonth(-1));
  dom.next.addEventListener('click', () => shiftMonth(1));
  dom.today.addEventListener('click', () => {
    const d = new Date();
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    selected = null;
    renderCalendar();
  });

  // Flechas del teclado sobre la rejilla, para no obligar a apuntar al botón.
  dom.grid.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); shiftMonth(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); shiftMonth(1); }
  });
}

function shiftMonth(delta) {
  const d = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
  viewYear = d.getUTCFullYear();
  viewMonth = d.getUTCMonth();
  selected = null;
  renderCalendar();
}

/* ---------------- Conversión ---------------- */

/** Un único formateador reutilizado: crearlo por celda sería 42 veces más caro. */
let hijriFmt = null;
let hijriFmtLang = null;

function hijriParts(date) {
  if (!hijriFmt || hijriFmtLang !== getLang()) {
    hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC',
    });
    hijriFmtLang = getLang();
  }
  const p = {};
  for (const part of hijriFmt.formatToParts(date)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { day: p.day, month: p.month, year: p.year };
}

function holidayFor(h) {
  return HOLIDAYS.find((x) => x.month === h.month && x.day === h.day) ?? null;
}

/* ---------------- Pintado ---------------- */

export function renderCalendar() {
  if (!dom.grid) return;

  const locale = getLocale();
  const firstDay = FIRST_DAY[getLang()] ?? 1;

  renderWeekdays(locale, firstDay);

  // Primer día de la rejilla: se retrocede hasta el inicio de esa semana.
  const first = new Date(Date.UTC(viewYear, viewMonth, 1));
  const offset = (first.getUTCDay() - firstDay + 7) % 7;
  const start = new Date(Date.UTC(viewYear, viewMonth, 1 - offset));

  const hoy = new Date();
  const hoyKey = `${hoy.getFullYear()}-${hoy.getMonth()}-${hoy.getDate()}`;

  const cells = [];
  const hijriSeen = [];

  for (let i = 0; i < CELLS; i += 1) {
    const date = new Date(Date.UTC(
      start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i,
    ));
    const g = { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() };
    const h = hijriParts(date);
    const key = `${g.y}-${g.m}-${g.d}`;
    const outside = g.m !== viewMonth;
    const holiday = holidayFor(h);

    if (!outside) hijriSeen.push(h);

    const classes = ['cal__day'];
    if (outside) classes.push('cal__day--out');
    if (key === hoyKey) classes.push('cal__day--today');
    if (holiday) classes.push('cal__day--fest', `cal__day--${holiday.tone}`);
    if (key === selected) classes.push('cal__day--sel');

    const label = `${g.d} ${new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(date)}`
      + ` · ${h.day} ${hijriMonths()[h.month - 1]} ${h.year}`
      + (holiday ? ` · ${t(holiday.key)}` : '');

    cells.push(el('button', {
      class: classes.join(' '),
      type: 'button',
      title: label,
      'aria-label': label,
      'aria-pressed': String(key === selected),
      dataset: { key },
      onclick: () => {
        selected = selected === key ? null : key;
        renderCalendar();
      },
    }, [
      el('span', { class: 'cal__g', text: String(g.d) }),
      el('span', { class: 'cal__h', text: String(h.day) }),
      holiday ? el('span', { class: 'cal__dot', 'aria-hidden': 'true' }) : null,
    ]));
  }

  dom.grid.replaceChildren(...cells);
  renderHeader(locale, hijriSeen);
  renderDetail(locale);
}

function renderWeekdays(locale, firstDay) {
  // 4-1-1970 fue domingo: sirve de ancla para sacar los nombres en orden.
  const names = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(Date.UTC(1970, 0, 4 + ((firstDay + i) % 7)));
    names.push(el('span', {
      class: 'cal__wd',
      text: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(d),
    }));
  }
  dom.head.replaceChildren(...names);
}

function renderHeader(locale, hijriSeen) {
  const ref = new Date(Date.UTC(viewYear, viewMonth, 1));
  const greg = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(ref);
  dom.greg.textContent = greg.charAt(0).toUpperCase() + greg.slice(1);

  // Un mes gregoriano casi siempre pisa dos meses hijri: se muestran los dos.
  const months = hijriMonths();
  const firstH = hijriSeen[0];
  const lastH = hijriSeen[hijriSeen.length - 1];
  if (!firstH || !lastH) { dom.hijri.textContent = ''; return; }

  const a = months[firstH.month - 1];
  const b = months[lastH.month - 1];
  const years = firstH.year === lastH.year ? `${firstH.year}` : `${firstH.year}–${lastH.year}`;
  dom.hijri.textContent = a === b
    ? `${a} ${years} ${hijriSuffix()}`
    : `${a} – ${b} ${years} ${hijriSuffix()}`;
}

function renderDetail(locale) {
  if (!selected) {
    dom.detail.hidden = true;
    dom.detail.replaceChildren();
    return;
  }

  const [y, m, d] = selected.split('-').map(Number);
  const date = new Date(Date.UTC(y, m, d));
  const h = hijriParts(date);
  const holiday = holidayFor(h);

  const gregTxt = new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);

  dom.detail.hidden = false;
  dom.detail.replaceChildren(
    el('p', { class: 'cal__detail-h', text: `${h.day} ${hijriMonths()[h.month - 1]} ${h.year} ${hijriSuffix()}` }),
    el('p', { class: 'cal__detail-g', text: gregTxt.charAt(0).toUpperCase() + gregTxt.slice(1) }),
    holiday ? el('p', { class: `cal__detail-fest cal__detail-fest--${holiday.tone}`, text: t(holiday.key) }) : null,
  );
}
