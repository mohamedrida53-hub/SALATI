import { getChapters, getTranslations, getVerses } from './api.js';
import { $, el, icon, showState, hideState, sanitize } from './utils.js';
import { getLang } from './i18n.js';

/* La traducción ya no se elige a mano: sale del idioma de la app.
   Quran.com no publica traducción al catalán, así que el catalán lee en
   castellano; en árabe se muestra sólo el texto original. */
const LANG_TO_TRANSLATION = { es: 'spanish', ca: 'spanish', en: 'english', ar: null };

const dom = {};
let chapters = [];
let translations = [];
let translationId = null;
let openChapter = null;
let loaded = false;

export function initQuran() {
  dom.index = $('#quran-index');
  dom.reader = $('#quran-reader');
  dom.search = $('#surah-search');
  dom.list = $('#surah-list');
  dom.listState = $('#chapters-state');
  dom.back = $('#btn-back');
  dom.eyebrow = $('#reader-eyebrow');
  dom.arabic = $('#reader-arabic');
  dom.meta = $('#reader-meta');
  dom.bismillah = $('#bismillah');
  dom.verses = $('#verse-list');
  dom.versesState = $('#verses-state');

  dom.search.addEventListener('input', () => renderList(dom.search.value));
  dom.back.addEventListener('click', closeReader);
}

/** La llama app.js al cambiar de idioma: recarga la sura abierta traducida. */
export function refreshQuranTranslation() {
  if (!loaded) return;
  const previous = translationId;
  pickTranslation();
  if (translationId !== previous && openChapter) loadVerses(openChapter);
}

/** Se llama la primera vez que se abre la pestaña: no gastamos red antes. */
export async function ensureQuranLoaded() {
  if (loaded) return;
  loaded = true;
  showState(dom.listState, { title: 'Cargando suras', message: 'Consultando la API de Quran.com…' });

  try {
    const [chapterList, translationList] = await Promise.all([
      getChapters('es'),
      getTranslations().catch(() => []),
    ]);
    chapters = chapterList;
    translations = translationList;
    pickTranslation();
    hideState(dom.listState);
    renderList('');
  } catch (err) {
    loaded = false;
    showState(dom.listState, {
      kind: 'error',
      title: 'No se han podido cargar las suras',
      message: err.message,
      actionLabel: 'Reintentar',
      onAction: () => ensureQuranLoaded(),
    });
  }
}

/** Primera traducción disponible en el idioma de la app; si no hay, sólo árabe. */
function pickTranslation() {
  const wanted = LANG_TO_TRANSLATION[getLang()];
  translationId = wanted
    ? translations.find((t) => t.language_name === wanted)?.id ?? null
    : null;
}

/* ---------------- Índice de suras ---------------- */

function renderList(query) {
  const q = query.trim().toLowerCase();
  const items = chapters.filter((c) => !q
    || String(c.id) === q
    || c.name_simple.toLowerCase().includes(q)
    || (c.translated_name?.name || '').toLowerCase().includes(q));

  if (!items.length) {
    dom.list.replaceChildren();
    showState(dom.listState, { title: 'Sin resultados', message: `Ninguna sura coincide con “${query}”.` });
    return;
  }
  hideState(dom.listState);

  dom.list.replaceChildren(...items.map((c) => el('li', {}, [
    el('button', { class: 'surah', type: 'button', onclick: () => openReader(c) }, [
      el('span', { class: 'surah__num' }, [icon('icon-khatam'), el('span', { text: String(c.id) })]),
      el('span', { class: 'surah__name' }, [
        c.name_simple,
        el('span', {
          class: 'surah__sub',
          text: `${c.translated_name?.name || ''} · ${c.verses_count} versos · ${c.revelation_place === 'makkah' ? 'La Meca' : 'Medina'}`,
        }),
      ]),
      el('span', { class: 'surah__ar', text: c.name_arabic }),
    ]),
  ])));
}

/* ---------------- Lector ---------------- */

function openReader(chapter) {
  openChapter = chapter;
  dom.index.hidden = true;
  dom.reader.hidden = false;
  dom.eyebrow.textContent = `Sura ${chapter.id}`;
  dom.arabic.textContent = chapter.name_arabic;
  dom.meta.textContent = `${chapter.name_simple} · ${chapter.translated_name?.name || ''} · ${chapter.verses_count} versos`;
  dom.bismillah.hidden = !chapter.bismillah_pre;
  dom.verses.replaceChildren();
  window.scrollTo({ top: 0 });
  loadVerses(chapter);
}

function closeReader() {
  openChapter = null;
  dom.reader.hidden = true;
  dom.index.hidden = false;
  window.scrollTo({ top: 0 });
}

async function loadVerses(chapter) {
  showState(dom.versesState, { title: 'Cargando versos', message: `Sura ${chapter.name_simple}…` });
  const requestedFor = chapter.id;

  try {
    const verses = await getVerses(chapter.id, translationId);
    if (openChapter?.id !== requestedFor) return; // el usuario ya cambió de sura
    hideState(dom.versesState);
    dom.verses.replaceChildren(...verses.map(renderVerse));
  } catch (err) {
    dom.verses.replaceChildren();
    showState(dom.versesState, {
      kind: 'error',
      title: 'No se han podido cargar los versos',
      message: err.message,
      actionLabel: 'Reintentar',
      onAction: () => loadVerses(chapter),
    });
  }
}

function renderVerse(verse) {
  const node = el('li', { class: 'verse' }, [
    el('span', { class: 'verse__no', text: `${verse.verse_number}` }),
    el('p', { class: 'verse__ar', lang: 'ar', dir: 'rtl', text: verse.text_uthmani || '' }),
  ]);

  const translation = verse.translations?.[0]?.text;
  if (translation) {
    const p = el('p', { class: 'verse__tr' });
    p.append(sanitize(translation));
    node.append(p);
  }
  return node;
}
