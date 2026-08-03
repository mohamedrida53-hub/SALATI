/* ============================================================================
 * POLITISCAN · Capa de análisis
 * ----------------------------------------------------------------------------
 * analyze(text) intenta primero el backend (POST /api/analyze). Si no responde
 * —o si la app se abre con file://— cae al motor heurístico local, que devuelve
 * exactamente el mismo contrato JSON para que la interfaz no tenga que
 * distinguir entre ambos.
 *
 * CONTRATO (idéntico en backend y local):
 * {
 *   "match":      { id, name, family, familyName, confidence, rationale, signals[] },
 *   "alternatives":[ { id, name, confidence } ],
 *   "shamePin":   { awarded, id, title, reason, historicalHarm, exit } | null,
 *   "factCheck":  { verdictSummary, claims: [ { claim, verdict, correction, evidence[] } ] },
 *   "education":  { summary, contrast, question },
 *   "meta":       { engine: "api" | "local", refusal: bool, note }
 * }
 * ==========================================================================*/
(function (global) {
  'use strict';

  var API_URL = (global.PS_CONFIG && global.PS_CONFIG.apiUrl) || '/api/analyze';
  var norm = global.PS_FACTCHECK.norm;

  /* --- Señales transversales que empujan hacia el eje autoritario --------- */
  var AUTHORITARIAN_SIGNALS = [
    { re: /(prohibir|ilegalizar|cerrar) (los )?(partidos|la oposicion|los sindicatos|los medios)/, w: 6, s: 'Propone eliminar actores políticos legales' },
    { re: /(deportar|expulsar|echar) a (todos|los) /, w: 6, s: 'Propone expulsión colectiva de un grupo' },
    { re: /(fusilar|eliminar|exterminar|acabar con) (a )?(todos|los)/, w: 9, s: 'Lenguaje de eliminación física de un grupo' },
    { re: /raza (superior|inferior|pura)|pureza racial|sangre y suelo/, w: 10, s: 'Jerarquía racial explícita' },
    { re: /(no son|no somos) (personas|humanos)|son (una plaga|animales|ratas|parasitos|escoria)/, w: 10, s: 'Deshumanización directa' },
    { re: /suspender (la constitucion|las elecciones|el parlamento)/, w: 8, s: 'Suspensión del marco constitucional' },
    { re: /(un solo|unico) partido|partido unico/, w: 7, s: 'Partido único' },
    { re: /mano dura|orden a cualquier precio|hace falta un (dictador|hombre fuerte)/, w: 5, s: 'Demanda de poder personal sin control' },
    { re: /esteriliz\w+ (forzos|obligator)/, w: 10, s: 'Control reproductivo coercitivo' },
    { re: /(no deberian|no deben) (reproducirse|tener hijos)/, w: 8, s: 'Selección reproductiva de poblaciones' },
    { re: /campos? de (concentracion|internamiento|trabajo)/, w: 9, s: 'Internamiento masivo' },
    { re: /(golpe de estado|que entren los militares|que gobierne el ejercito)/, w: 7, s: 'Ruptura del orden constitucional por la fuerza' },
    { re: /(censurar|controlar) (la prensa|los medios|internet)/, w: 5, s: 'Control de la información' },
    { re: /(los jueces|el poder judicial) (sobran|estorban|deben obedecer)/, w: 5, s: 'Subordinación del poder judicial' }
  ];

  /* --- Ejes para el mapa de posición ------------------------------------- */
  var AXIS = {
    econ: [ /* negativo = izquierda económica, positivo = derecha */
      { re: /nacionalizar|expropiar|colectivizar|banca publica|controlar los precios/, v: -3 },
      { re: /impuestos? (a los ricos|progresiv)|redistribu|subir impuestos|renta basica/, v: -2 },
      { re: /estado del bienestar|sanidad publica|educacion publica|vivienda publica/, v: -1.5 },
      { re: /sindicat|huelga|negociacion colectiva|salario minimo/, v: -1 },
      { re: /libre mercado|desregul|privatiz|bajar impuestos|competencia/, v: 2 },
      { re: /impuestos son robo|estado minimo|eliminar (el )?(irpf|los impuestos)/, v: 3 },
      { re: /arancel|proteccionismo|industria nacional/, v: 0.5 }
    ],
    social: [ /* negativo = libertario/abierto, positivo = autoritario/cerrado */
      { re: /libertad de expresion|derechos civiles|privacidad|legalizar/, v: -2 },
      { re: /democracia directa|asamblea|participacion ciudadana|autogestion/, v: -2 },
      { re: /diversidad|inclusion|derechos lgtbi|feminismo|multicultural/, v: -1.5 },
      { re: /tradicion|familia tradicional|valores de siempre|orden moral/, v: 1.5 },
      { re: /mano dura|carcel para|endurecer penas|tolerancia cero/, v: 2 },
      { re: /vigilancia|control|obligatorio para todos|prohibir/, v: 2 },
      { re: /nacion por encima|patria|soberania nacional|fronteras cerradas/, v: 1.5 }
    ]
  };

  function scoreIdeologies(t) {
    var scored = [];
    global.PS_IDEOLOGIES.all.forEach(function (it) {
      if (!it.kw || !it.kw.length) return;
      var score = 0, hits = [];
      it.kw.forEach(function (k) {
        var kn = norm(k);
        if (t.indexOf(kn) !== -1) {
          score += 3 + Math.min(kn.split(' ').length, 3); // frases largas pesan más
          hits.push(k);
          return;
        }
        // coincidencia parcial: todas las palabras del keyword presentes
        var words = kn.split(' ').filter(function (w) { return w.length > 4; });
        if (words.length > 1 && words.every(function (w) { return t.indexOf(w) !== -1; })) {
          score += 2;
          hits.push(k);
        }
      });
      if (score > 0) scored.push({ item: it, score: score, hits: hits });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored;
  }

  function axisPosition(t) {
    var out = { econ: 0, social: 0 };
    ['econ', 'social'].forEach(function (k) {
      AXIS[k].forEach(function (r) { if (r.re.test(t)) out[k] += r.v; });
      out[k] = Math.max(-10, Math.min(10, out[k] * 1.6));
    });
    return out;
  }

  function analyzeLocal(text) {
    var t = norm(text);
    var scored = scoreIdeologies(t);
    var signals = [];
    var authScore = 0;

    AUTHORITARIAN_SIGNALS.forEach(function (a) {
      if (a.re.test(t)) { authScore += a.w; signals.push(a.s); }
    });

    // Si hay señales extremas fuertes y ninguna ideología concreta domina,
    // se fuerza el match hacia la entrada extremista más cercana.
    var top = scored[0];
    if (authScore >= 9 && (!top || top.item.risk < 3)) {
      var forced = null;
      if (/raza|racial|sangre y suelo|arios?/.test(t)) forced = 'ext-supremacismo';
      else if (/deportar|expulsar|remigracion|limpieza etnica|puro/.test(t)) forced = 'ext-etnonacionalismo';
      else if (/esteriliz|reproducirse|mejorar la raza/.test(t)) forced = 'ext-eugenesia';
      else if (/campos?|exterminar|eliminar a/.test(t)) forced = 'fas-nazismo';
      else if (/golpe|militares|ejercito gobierne/.test(t)) forced = 'aut-militar';
      else if (/partido unico|prohibir partidos|ilegalizar la oposicion/.test(t)) forced = 'aut-partido-unico';
      else if (/vigilar|reconocimiento facial|credito social/.test(t)) forced = 'tec-vigilancia';
      else forced = 'aut-despotismo';
      var f = global.PS_IDEOLOGIES.byId(forced);
      if (f) scored.unshift({ item: f, score: 20 + authScore, hits: signals.slice(0, 3) });
    }

    if (!scored.length) {
      return {
        match: null,
        alternatives: [],
        shamePin: null,
        factCheck: { verdictSummary: 'Sin afirmaciones verificables detectadas.', claims: global.PS_FACTCHECK.scan(text) },
        education: {
          summary: 'El texto no contiene suficientes marcadores ideológicos reconocibles para asignar una corriente. Prueba a formular una propuesta concreta: qué harías, con qué recursos y sobre quién recae.',
          contrast: '', question: '¿Qué problema concreto intentas resolver con esa idea?'
        },
        axis: axisPosition(t),
        meta: { engine: 'local', refusal: false, note: 'Motor heurístico local.' }
      };
    }

    var best = scored[0];
    var maxScore = best.score;
    var confidence = Math.min(96, Math.round(38 + maxScore * 4.2));
    var it = best.item;

    var pin = null;
    if (it.risk === 3) {
      pin = {
        awarded: true,
        id: it.id,
        title: it.n,
        reason: 'Tu propuesta reproduce el núcleo doctrinal de: ' + it.n + '.',
        historicalHarm: it.why || it.c,
        exit: '¿Qué evidencia concreta te haría cambiar de opinión sobre esto? Si la respuesta es "ninguna", el problema ya no es de datos.'
      };
    }

    var claims = global.PS_FACTCHECK.scan(text);

    return {
      match: {
        id: it.id, name: it.n, family: it.family, familyName: it.familyName,
        confidence: confidence,
        rationale: it.t + ' ' + (best.hits.length ? 'Marcadores detectados: ' + best.hits.slice(0, 4).join(', ') + '.' : ''),
        signals: signals
      },
      alternatives: scored.slice(1, 4).map(function (s) {
        return { id: s.item.id, name: s.item.n, confidence: Math.min(88, Math.round(s.score * 4.2 + 20)) };
      }),
      shamePin: pin,
      factCheck: {
        verdictSummary: claims.length
          ? claims.length + ' premisa(s) problemática(s) detectada(s) en tu texto.'
          : 'No se han detectado bulos conocidos en el motor local. Esto no equivale a verificación completa.',
        claims: claims
      },
      education: {
        summary: it.d,
        contrast: it.c,
        question: '¿Qué pasaría con quien no forme parte del grupo que tu propuesta beneficia?'
      },
      axis: axisPosition(t),
      meta: { engine: 'local', refusal: false, note: 'Motor heurístico local (sin backend). Precisión limitada.' }
    };
  }

  function analyze(text) {
    if (!global.PS_CONFIG || global.PS_CONFIG.useApi === false) {
      return Promise.resolve(analyzeLocal(text));
    }
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        data.meta = data.meta || {};
        data.meta.engine = 'api';
        // El backend devuelve ids; se completan los nombres desde el registro.
        if (data.match && !data.match.familyName) {
          var it = global.PS_IDEOLOGIES.byId(data.match.id);
          if (it) { data.match.familyName = it.familyName; data.match.family = it.family; }
        }
        return data;
      })
      .catch(function (err) {
        var local = analyzeLocal(text);
        local.meta.note = 'Backend no disponible (' + err.message + '). Analizado en local.';
        return local;
      });
  }

  global.PS_ANALYZER = { analyze: analyze, analyzeLocal: analyzeLocal };
})(window);
