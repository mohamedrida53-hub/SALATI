/* ============================================================================
 * POLITISCAN · Lógica de aplicación
 * ----------------------------------------------------------------------------
 * Sin framework y sin build. Render por reemplazo de plantillas + delegación de
 * eventos. Estado en memoria, persistido en localStorage con degradación a
 * memoria si el navegador lo bloquea (pasa con file:// en algunos casos).
 * ==========================================================================*/
(function (global) {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var IDEO = global.PS_IDEOLOGIES;

  /* ---------------------------------------------------------------- store */
  var KEY = 'politiscan.v1';
  var memoryFallback = null;

  var Store = {
    read: function () {
      if (memoryFallback) return memoryFallback;
      try {
        var raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    write: function (state) {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { memoryFallback = state; }
    }
  };

  var state = Store.read() || {
    adult: false,
    unlocked: {},       // id -> { at, times }
    pins: {},           // id -> { at, reason }
    history: [],        // últimos análisis
    stats: { analyses: 0, bulos: 0 }
  };

  function save() { Store.write(state); }

  /* --------------------------------------------------------------- helpers */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(n) { return Math.max(0, Math.min(100, Math.round(n || 0))); }

  var VERDICT_LABEL = {
    falso: 'FALSO', enganoso: 'ENGAÑOSO', 'engañoso': 'ENGAÑOSO',
    impreciso: 'IMPRECISO', verdadero: 'VERIFICADO', sin_evidencia: 'SIN EVIDENCIA'
  };
  function verdictClass(v) {
    if (v === 'falso') return 'v-false';
    if (v === 'verdadero') return 'v-true';
    if (v === 'sin_evidencia') return 'v-unknown';
    return 'v-warn';
  }

  /* ------------------------------------------------------------ age gate */
  function initGate() {
    var gate = $('#gate');
    if (state.adult) { gate.hidden = true; return; }
    gate.hidden = false;
    $('#gate-enter').addEventListener('click', function () {
      state.adult = true; save();
      gate.classList.add('is-out');
      setTimeout(function () { gate.hidden = true; $('#idea').focus(); }, 320);
    });
    $('#gate-leave').addEventListener('click', function () {
      location.href = 'https://es.wikipedia.org/wiki/Ideolog%C3%ADa_pol%C3%ADtica';
    });
  }

  /* ------------------------------------------------------------- análisis */
  var analyzing = false;

  function runAnalysis() {
    var input = $('#idea');
    var text = input.value.trim();
    if (text.length < 12) {
      flash('Escribe algo más concreto: al menos una propuesta entera.');
      input.focus();
      return;
    }
    if (analyzing) return;
    analyzing = true;
    setBusy(true);

    global.PS_ANALYZER.analyze(text).then(function (res) {
      analyzing = false;
      setBusy(false);
      commit(text, res);
      renderResult(res, text);
      renderGallery();
      renderPins();
      renderStats();
      $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (err) {
      analyzing = false;
      setBusy(false);
      flash('Error de análisis: ' + err.message);
    });
  }

  function commit(text, res) {
    state.stats.analyses++;
    if (res.factCheck && res.factCheck.claims) state.stats.bulos += res.factCheck.claims.length;

    if (res.match && res.match.id && IDEO.byId(res.match.id)) {
      var u = state.unlocked[res.match.id];
      state.unlocked[res.match.id] = { at: u ? u.at : Date.now(), times: (u ? u.times : 0) + 1 };
    }
    if (res.shamePin && res.shamePin.awarded && res.shamePin.id) {
      if (!state.pins[res.shamePin.id]) {
        state.pins[res.shamePin.id] = { at: Date.now(), reason: res.shamePin.reason || '' };
      }
    }
    state.history.unshift({
      at: Date.now(),
      text: text.slice(0, 240),
      matchId: res.match ? res.match.id : null,
      matchName: res.match ? res.match.name : '—',
      pin: !!(res.shamePin && res.shamePin.awarded)
    });
    state.history = state.history.slice(0, 40);
    save();
  }

  function setBusy(on) {
    var btn = $('#analyze');
    btn.disabled = on;
    btn.dataset.busy = on ? '1' : '';
    btn.querySelector('.btn-label').textContent = on ? 'PROCESANDO' : 'ANALIZAR IDEA';
    $('#scanline').hidden = !on;
  }

  function flash(msg) {
    var el = $('#flash');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('is-on'); }, 3800);
  }

  /* -------------------------------------------------------- render result */
  function renderResult(res, sourceText) {
    var host = $('#result');
    host.hidden = false;

    if (!res.match) {
      host.innerHTML = '<div class="card card--empty"><p class="mono tag">SIN CLASIFICAR</p>' +
        '<p>' + esc(res.education.summary) + '</p></div>';
      return;
    }

    var m = res.match;
    var ideo = IDEO.byId(m.id);
    var risk = ideo ? ideo.risk : 0;
    var pin = res.shamePin && res.shamePin.awarded ? res.shamePin : null;

    var html = '';

    /* --- tarjeta de match --- */
    html +=
      '<article class="card card--match risk-' + risk + '">' +
        '<header class="match-head">' +
          '<div>' +
            '<p class="mono tag">MATCH IDEOLÓGICO · ' + esc(m.familyName || '') + '</p>' +
            '<h2 class="match-name">' + esc(m.name) + '</h2>' +
          '</div>' +
          '<div class="gauge" style="--v:' + pct(m.confidence) + '">' +
            '<span class="gauge-num">' + pct(m.confidence) + '<small>%</small></span>' +
            '<span class="mono gauge-cap">afinidad</span>' +
          '</div>' +
        '</header>' +
        '<p class="match-why">' + esc(m.rationale) + '</p>' +
        (m.signals && m.signals.length
          ? '<ul class="signals">' + m.signals.map(function (s) {
              return '<li class="mono">▸ ' + esc(s) + '</li>';
            }).join('') + '</ul>'
          : '') +
        (res.axis ? axisWidget(res.axis) : '') +
        (res.alternatives && res.alternatives.length
          ? '<div class="alts"><p class="mono tag">TAMBIÉN ROZA</p><div class="alt-row">' +
            res.alternatives.map(function (a) {
              return '<span class="chip">' + esc(a.name) + ' <b>' + pct(a.confidence) + '%</b></span>';
            }).join('') + '</div></div>'
          : '') +
      '</article>';

    /* --- pin de la vergüenza --- */
    if (pin) {
      html +=
        '<article class="card card--pin">' +
          '<div class="pin-stamp" aria-hidden="true">PIN DE LA<br>VERGÜENZA</div>' +
          '<p class="mono tag tag--alert">INSIGNIA OTORGADA</p>' +
          '<h3 class="pin-title">' + esc(pin.title) + '</h3>' +
          '<p class="pin-reason">' + esc(pin.reason) + '</p>' +
          '<div class="pin-harm"><p class="mono tag">QUÉ PASÓ CUANDO SE INTENTÓ</p><p>' + esc(pin.historicalHarm) + '</p></div>' +
          (pin.exit ? '<p class="pin-exit">' + esc(pin.exit) + '</p>' : '') +
        '</article>';
    }

    /* --- fact-checking --- */
    var fc = res.factCheck || { claims: [] };
    html +=
      '<article class="card card--fact">' +
        '<p class="mono tag tag--fact">CORRECCIÓN DE DATOS</p>' +
        '<p class="fact-summary">' + esc(fc.verdictSummary || '') + '</p>' +
        (fc.claims && fc.claims.length
          ? fc.claims.map(function (c) {
              return '<div class="claim">' +
                '<div class="claim-head">' +
                  '<span class="verdict ' + verdictClass(c.verdict) + '">' + esc(VERDICT_LABEL[c.verdict] || c.verdict) + '</span>' +
                  '<p class="claim-text">' + esc(c.claim) + '</p>' +
                '</div>' +
                '<p class="claim-fix">' + esc(c.correction) + '</p>' +
                (c.evidence && c.evidence.length
                  ? '<ul class="evidence">' + c.evidence.map(function (e) {
                      return '<li><b>' + esc(e.source || e.s) + '</b> — ' + esc(e.detail || e.d) + '</li>';
                    }).join('') + '</ul>'
                  : '') +
              '</div>';
            }).join('')
          : '<p class="muted">Ninguna premisa falsa reconocida. Que no se detecte un bulo no significa que la idea esté bien fundamentada.</p>') +
      '</article>';

    /* --- ficha educativa --- */
    html +=
      '<article class="card card--edu">' +
        '<p class="mono tag">EXPEDIENTE DESBLOQUEADO</p>' +
        '<p class="edu-sum">' + esc(res.education.summary || '') + '</p>' +
        (res.education.contrast ? '<p class="edu-contrast"><b>Límite conocido:</b> ' + esc(res.education.contrast) + '</p>' : '') +
        (res.education.question ? '<p class="edu-q">' + esc(res.education.question) + '</p>' : '') +
        '<p class="mono engine">motor: ' + esc(res.meta && res.meta.engine || '—') +
          (res.meta && res.meta.note ? ' · ' + esc(res.meta.note) : '') + '</p>' +
      '</article>';

    host.innerHTML = html;
  }

  function axisWidget(a) {
    var x = ((a.econ + 10) / 20) * 100;
    var y = ((a.social + 10) / 20) * 100;
    return '<div class="axis" aria-label="Posición estimada en ejes económico y social">' +
      '<div class="axis-grid"><span class="axis-dot" style="left:' + pct(x) + '%;top:' + pct(y) + '%"></span></div>' +
      '<span class="mono ax ax-l">← izq. económica</span>' +
      '<span class="mono ax ax-r">der. económica →</span>' +
      '<span class="mono ax ax-t">autoritario ↑</span>' +
      '<span class="mono ax ax-b">↓ libertario</span>' +
    '</div>';
  }

  /* ------------------------------------------------------------- galería */
  var activeFamily = 'all';

  function renderFilters() {
    var host = $('#filters');
    var chips = ['<button class="fchip is-on" data-fam="all">TODAS</button>'];
    IDEO.families.forEach(function (f) {
      var unlocked = f.items.filter(function (i) { return state.unlocked[i.id]; }).length;
      chips.push('<button class="fchip" data-fam="' + f.id + '">' + esc(f.n) +
        ' <b>' + unlocked + '/' + f.items.length + '</b></button>');
    });
    host.innerHTML = chips.join('');
  }

  function renderGallery() {
    renderFilters();
    var host = $('#gallery');
    var html = '';
    IDEO.families.forEach(function (f) {
      if (activeFamily !== 'all' && activeFamily !== f.id) return;
      html += '<section class="fam"><header class="fam-head">' +
        '<span class="mono fam-code">' + esc(f.code) + '</span>' +
        '<h3>' + esc(f.n) + '</h3><p class="fam-blurb">' + esc(f.blurb) + '</p></header>' +
        '<div class="grid">';
      f.items.forEach(function (it) {
        var u = state.unlocked[it.id];
        var pinned = !!state.pins[it.id];
        html += '<button class="tile risk-' + it.risk + (u ? ' is-open' : ' is-locked') + (pinned ? ' is-pinned' : '') + '"' +
          ' data-id="' + esc(it.id) + '"' + (u ? '' : ' aria-label="Tarjeta bloqueada"') + '>' +
          '<span class="mono tile-year">' + esc(it.y) + '</span>' +
          '<span class="tile-name">' + (u ? esc(it.n) : '████████') + '</span>' +
          '<span class="tile-desc">' + (u ? esc(it.d) : 'Expediente clasificado. Formula una idea que haga match para desbloquearlo.') + '</span>' +
          (it.risk === 3 ? '<span class="mono tile-flag">⚠ PIN</span>' : '') +
          (u && u.times > 1 ? '<span class="mono tile-times">×' + u.times + '</span>' : '') +
          '</button>';
      });
      html += '</div></section>';
    });
    host.innerHTML = html;
  }

  /* ---------------------------------------------------------------- pines */
  function renderPins() {
    var host = $('#pins');
    var ids = Object.keys(state.pins);
    $('#pin-count').textContent = ids.length;
    if (!ids.length) {
      host.innerHTML = '<p class="muted">Inventario vacío. De momento no has propuesto nada que exigiera una placa conmemorativa.</p>';
      return;
    }
    host.innerHTML = ids.map(function (id) {
      var it = IDEO.byId(id);
      if (!it) return '';
      return '<article class="pinbadge" data-id="' + esc(id) + '">' +
        '<div class="pinbadge-seal">✷</div>' +
        '<div><h4>' + esc(it.n) + '</h4>' +
        '<p class="mono">' + esc(it.familyName) + ' · ' + esc(it.y) + '</p>' +
        '<p class="pinbadge-why">' + esc((it.why || it.c).slice(0, 180)) + '…</p></div>' +
      '</article>';
    }).join('');
  }

  /* ---------------------------------------------------------------- stats */
  function renderStats() {
    var open = Object.keys(state.unlocked).length;
    $('#stat-open').textContent = open;
    $('#stat-total').textContent = IDEO.total;
    $('#stat-analyses').textContent = state.stats.analyses;
    $('#stat-bulos').textContent = state.stats.bulos;
    $('#progress-bar').style.setProperty('--p', pct((open / IDEO.total) * 100));
    $('#progress-label').textContent = pct((open / IDEO.total) * 100) + '%';
  }

  /* ----------------------------------------------------------- modal ficha */
  function openDetail(id) {
    var it = IDEO.byId(id);
    if (!it) return;
    var unlocked = !!state.unlocked[id];
    var m = $('#modal');
    $('#modal-body').innerHTML = unlocked
      ? '<p class="mono tag">' + esc(it.familyName) + ' · ' + esc(it.y) + '</p>' +
        '<h3>' + esc(it.n) + '</h3>' +
        '<p>' + esc(it.d) + '</p>' +
        '<p><b>Tesis central:</b> ' + esc(it.t) + '</p>' +
        '<p><b>Límite o crítica:</b> ' + esc(it.c) + '</p>' +
        (it.risk === 3 ? '<div class="modal-warn"><p class="mono tag tag--alert">PIN DE LA VERGÜENZA</p><p>' + esc(it.why) + '</p></div>' : '') +
        (it.kw ? '<p class="mono kw">marcadores: ' + esc(it.kw.join(' · ')) + '</p>' : '')
      : '<p class="mono tag">EXPEDIENTE CLASIFICADO</p><h3>████████</h3>' +
        '<p>Este expediente sigue cerrado. Escribe una idea que haga match con esta corriente y se abrirá con su ficha completa.</p>';
    m.hidden = false;
    $('#modal-close').focus();
  }

  /* ---------------------------------------------------------------- init */
  function bind() {
    $('#analyze').addEventListener('click', runAnalysis);
    $('#idea').addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runAnalysis();
    });
    $('#idea').addEventListener('input', function () {
      $('#counter').textContent = this.value.length;
    });

    $('#filters').addEventListener('click', function (e) {
      var b = e.target.closest('.fchip');
      if (!b) return;
      activeFamily = b.dataset.fam;
      renderGallery();
      $$('.fchip').forEach(function (c) { c.classList.toggle('is-on', c.dataset.fam === activeFamily); });
    });

    $('#gallery').addEventListener('click', function (e) {
      var t = e.target.closest('.tile');
      if (t) openDetail(t.dataset.id);
    });
    $('#pins').addEventListener('click', function (e) {
      var t = e.target.closest('.pinbadge');
      if (t) openDetail(t.dataset.id);
    });

    $('#modal-close').addEventListener('click', function () { $('#modal').hidden = true; });
    $('#modal').addEventListener('click', function (e) {
      if (e.target === this) this.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') $('#modal').hidden = true;
    });

    $('#reset').addEventListener('click', function () {
      if (!confirm('Esto borra tu progreso: expedientes desbloqueados, pines e historial. ¿Seguro?')) return;
      state = { adult: true, unlocked: {}, pins: {}, history: [], stats: { analyses: 0, bulos: 0 } };
      save();
      $('#result').hidden = true;
      renderGallery(); renderPins(); renderStats();
      flash('Progreso reiniciado.');
    });

    $$('.seed').forEach(function (b) {
      b.addEventListener('click', function () {
        $('#idea').value = this.dataset.text;
        $('#counter').textContent = this.dataset.text.length;
        $('#idea').focus();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initGate();
    bind();
    renderGallery();
    renderPins();
    renderStats();
  });
})(window);
