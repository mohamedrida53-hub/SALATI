import { $, el } from './utils.js';
import { LANGS, getLang, setLang, t } from './i18n.js';

/* =========================================================
   Selector de idioma de la cabecera.

   Es un desplegable propio y no un <select> nativo porque los
   <option> no admiten SVG: hacía falta la bandera tanto en la
   opción elegida como en la lista.

   Teclado: Enter/Espacio/flechas abren, flechas mueven,
   Escape cierra y Tab fuera cierra también.
   ========================================================= */

const dom = {};
let open = false;

export function initLangPicker() {
  dom.root = $('#lang-picker');
  dom.btn = $('#lang-btn');
  dom.list = $('#lang-list');
  if (!dom.root) return;

  dom.btn.addEventListener('click', () => toggle(!open));
  dom.btn.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      toggle(true);
      focusOption(event.key === 'ArrowDown' ? 0 : LANGS.length - 1);
    }
  });

  // Un clic fuera cierra el menú; se escucha en captura para adelantarse
  // a los handlers de la propia app.
  document.addEventListener('pointerdown', (event) => {
    if (open && !dom.root.contains(event.target)) toggle(false);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) { toggle(false); dom.btn.focus(); }
  });

  render();
}

function toggle(next) {
  open = next;
  dom.root.classList.toggle('lang--open', open);
  dom.btn.setAttribute('aria-expanded', String(open));
  dom.list.hidden = !open;
}

function focusOption(index) {
  const options = dom.list.querySelectorAll('[role="option"]');
  options[Math.max(0, Math.min(options.length - 1, index))]?.focus();
}

/** Repinta el botón y la lista. Se llama al arrancar y tras cada cambio. */
export function render() {
  const current = LANGS.find((l) => l.code === getLang()) ?? LANGS[1];

  dom.btn.replaceChildren(
    flag(current.flag),
    el('span', { class: 'lang__code', text: current.code.toUpperCase() }),
    chevron(),
  );
  dom.btn.setAttribute('aria-label', `${t('app.langLabel')}: ${current.name}`);

  dom.list.replaceChildren(...LANGS.map((lang, index) => el('li', {
    class: 'lang__option',
    role: 'option',
    tabindex: '-1',
    'aria-selected': String(lang.code === current.code),
    lang: lang.code,
    onclick: () => choose(lang.code),
    onkeydown: (event) => onOptionKey(event, index),
  }, [
    flag(lang.flag),
    el('span', { text: lang.name }),
  ])));
}

function onOptionKey(event, index) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    choose(LANGS[index].code);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    focusOption((index + 1) % LANGS.length);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    focusOption((index - 1 + LANGS.length) % LANGS.length);
  } else if (event.key === 'Tab') {
    toggle(false);
  }
}

function choose(code) {
  toggle(false);
  dom.btn.focus();
  setLang(code);   // dispara onLangChange: app.js repinta y esto vuelve por render()
}

function flag(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lang__flag');
  svg.setAttribute('viewBox', '0 0 24 16');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

function chevron() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lang__chevron');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'm6 9 6 6 6-6');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}
