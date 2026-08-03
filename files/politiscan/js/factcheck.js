/* ============================================================================
 * POLITISCAN · Base de bulos frecuentes (motor local de respaldo)
 * ----------------------------------------------------------------------------
 * Esto NO sustituye al verificador del backend. Es la red de seguridad para
 * cuando la app corre sin API: detecta premisas falsas muy comunes por patrón.
 *
 *   p    array de expresiones regulares (se prueban sobre el texto en minúsculas
 *        y sin tildes)
 *   claim  cómo se formula normalmente el bulo
 *   v      veredicto: falso | enganoso | impreciso | sin_evidencia
 *   fix    corrección con datos
 *   src    fuentes citables (nombre + dato concreto)
 * ==========================================================================*/
(function (global) {
  'use strict';

  var DB = [
    {
      id: 'fc-inmigracion-delito',
      p: [/inmigrant\w* (delinqu|crimin)/, /los? (inmigrantes|extranjeros) (traen|causan|generan) (la )?(delincuencia|crimen|inseguridad)/, /mas (delincuencia|crimen) por (la )?inmigracion/],
      claim: 'La inmigración dispara la delincuencia.',
      v: 'enganoso',
      fix: 'La literatura criminológica comparada no encuentra una relación causal general entre inmigración y aumento de la criminalidad; varios metaanálisis en EE. UU. y Europa encuentran tasas de delito iguales o inferiores entre población inmigrante una vez controladas edad, sexo y nivel de renta. Donde sí hay efecto es en la sobrerrepresentación penitenciaria, explicada en buena parte por situación administrativa irregular, pobreza y sesgos en la identificación policial.',
      src: [
        { s: 'Ousey & Kubrin, Annual Review of Criminology (2018)', d: 'Metaanálisis de 51 estudios: la relación inmigración-delito es nula o ligeramente negativa.' },
        { s: 'Light & Miller, Criminology (2018)', d: 'La inmigración irregular en EE. UU. no se asocia con más delito violento entre 1990 y 2014.' }
      ]
    },
    {
      id: 'fc-ayudas-inmigrantes',
      p: [/(los )?inmigrantes? (cobran|reciben|se llevan) (mas|todas las) (ayudas|subvenciones|paguitas)/, /paguita/, /(ayudas|subsidios) solo para (los )?(inmigrantes|extranjeros)/],
      claim: 'Los inmigrantes cobran más ayudas públicas que los nacionales.',
      v: 'falso',
      fix: 'Ningún sistema de protección social europeo prioriza por nacionalidad: los requisitos son de residencia legal, cotización y renta. En España, los perceptores del Ingreso Mínimo Vital son mayoritariamente de nacionalidad española y la normativa exige un año de residencia legal previa. Los estudios de contribución fiscal neta (OCDE) sitúan el saldo de la población inmigrante en el entorno del equilibrio, y positivo en tramos de edad laboral.',
      src: [
        { s: 'OCDE, "International Migration Outlook"', d: 'El impacto fiscal neto de la inmigración en los países OCDE oscila en torno a ±0,5 % del PIB.' },
        { s: 'Normativa del IMV (España)', d: 'Exige residencia legal y efectiva previa; no existe prelación por nacionalidad extranjera.' }
      ]
    },
    {
      id: 'fc-gran-reemplazo',
      p: [/gran reemplazo/, /nos (estan )?(sustituyendo|reemplazando)/, /plan para (sustituir|reemplazar) (a )?(los )?(europeos|nativos|blancos)/],
      claim: 'Existe un plan organizado para sustituir a la población europea nativa.',
      v: 'falso',
      fix: 'No existe ninguna evidencia de un plan coordinado. Los cambios demográficos europeos se explican por dos factores medidos y públicos: caída de la natalidad por debajo del reemplazo (~1,5 hijos por mujer en la UE) y migración impulsada por demanda laboral. La teoría fue formulada por Renaud Camus en 2011 y ha sido citada en los manifiestos de los atentados de Christchurch (51 muertos), El Paso (23) y Buffalo (10).',
      src: [
        { s: 'Eurostat, indicadores de fecundidad', d: 'Tasa de fecundidad de la UE en torno a 1,4-1,5 hijos por mujer, muy por debajo del 2,1 de reemplazo.' },
        { s: 'Informes de terrorismo de Europol (TE-SAT)', d: 'La teoría del reemplazo aparece de forma recurrente en la doctrina del terrorismo de extrema derecha.' }
      ]
    },
    {
      id: 'fc-clima',
      p: [/el clima siempre (ha )?cambi/, /(no hay|no existe) (calentamiento|cambio climatico)/, /(estafa|timo|negocio) (del )?(clima|climatic)/, /los cientificos no se ponen de acuerdo (sobre el|con el) clima/],
      claim: 'El cambio climático actual es un ciclo natural o una exageración.',
      v: 'falso',
      fix: 'El clima ha variado siempre, pero el calentamiento actual es unas diez veces más rápido que las transiciones glaciar-interglaciar y coincide con el aumento de CO₂ de origen fósil, identificable por su firma isotópica. El consenso en la literatura revisada por pares supera el 97 % y el IPCC (AR6, 2021) califica la influencia humana de "inequívoca".',
      src: [
        { s: 'IPCC AR6 WG1 (2021)', d: '"Es inequívoco que la influencia humana ha calentado la atmósfera, el océano y la tierra".' },
        { s: 'Lynas et al., Environmental Research Letters (2021)', d: 'Más del 99 % de los artículos revisados por pares respaldan el origen antropogénico.' }
      ]
    },
    {
      id: 'fc-impuestos-recaudacion',
      p: [/bajar (los )?impuestos (siempre )?(aumenta|sube|incrementa) la recaudacion/, /curva de laffer/],
      claim: 'Bajar impuestos siempre incrementa la recaudación total.',
      v: 'enganoso',
      fix: 'La curva de Laffer solo predice más recaudación si el tipo de partida está por encima del punto de maximización. Las estimaciones empíricas sitúan ese punto muy por encima de los tipos efectivos vigentes en la mayoría de países desarrollados, de modo que las bajadas de impuestos reales han reducido la recaudación. El caso documentado más citado es Kansas (2012-2017), que revirtió la reforma tras un desplome de ingresos.',
      src: [
        { s: 'Diamond & Saez, Journal of Economic Perspectives (2011)', d: 'Tipo marginal maximizador de recaudación estimado en torno al 73 %.' },
        { s: 'Kansas Legislative Research Department', d: 'La reforma fiscal de 2012 fue derogada en 2017 tras déficits acumulados.' }
      ]
    },
    {
      id: 'fc-nazis-socialistas',
      p: [/los nazis eran (de izquierda|socialistas|comunistas)/, /nacionalsocialismo es socialismo/, /(hitler|el nazismo) era (de izquierdas|socialista)/],
      claim: 'Los nazis eran socialistas porque su partido se llamaba nacionalsocialista.',
      v: 'falso',
      fix: 'El nombre fue una decisión de captación de voto obrero, no un programa. En la práctica el NSDAP ilegalizó sindicatos y partidos socialistas y comunistas el 2 de mayo de 1933, encarceló y asesinó a sus dirigentes, purgó su propia ala anticapitalista en la Noche de los Cuchillos Largos (1934), privatizó empresas públicas (acuñando el propio término "privatización" en la literatura económica de la época) y contó con financiación de grandes grupos industriales. Los primeros internados en Dachau fueron opositores de izquierda.',
      src: [
        { s: 'Bel, G., Economic History Review (2010)', d: '"Against the mainstream": la Alemania nazi privatizó sistemáticamente empresas estatales en los años 30.' },
        { s: 'Archivo de Dachau', d: 'Las primeras deportaciones al campo, en marzo de 1933, fueron de comunistas y socialdemócratas.' }
      ]
    },
    {
      id: 'fc-franco-obras',
      p: [/franco (hizo|construyo) (los )?(pantanos|embalses)/, /con franco se vivia mejor/, /(la )?dictadura (trajo|dio) (progreso|desarrollo)/],
      claim: 'Las dictaduras del siglo XX trajeron prosperidad y desarrollo.',
      v: 'enganoso',
      fix: 'El crecimiento español de los años 60 coincide con la apertura exterior forzada por la quiebra de la autarquía (Plan de Estabilización de 1959), las remesas de casi dos millones de emigrantes y el turismo, no con el modelo político. En 1959 España tenía una renta per cápita inferior a la de 1935. La comparación relevante es con países similares que se democratizaron antes y crecieron más, y el balance incluye decenas de miles de ejecuciones de posguerra, censura y trabajos forzados.',
      src: [
        { s: 'Prados de la Escosura, "Spanish Economic Growth 1850-2015"', d: 'La renta per cápita de 1935 no se recuperó hasta finales de los años cincuenta.' },
        { s: 'Plan de Estabilización (1959)', d: 'El despegue siguió a la liberalización exterior, tras el agotamiento de la autarquía.' }
      ]
    },
    {
      id: 'fc-vacunas',
      p: [/vacunas? (causan|producen|provocan) autismo/, /las vacunas (no funcionan|son un experimento)/, /(chip|grafeno) en (la vacuna|las vacunas)/],
      claim: 'Las vacunas causan autismo o contienen dispositivos de control.',
      v: 'falso',
      fix: 'El artículo de Wakefield (1998) que originó el bulo fue retractado por The Lancet en 2010 y su autor inhabilitado por fraude. Estudios de cohorte con más de 650.000 niños en Dinamarca no encuentran ninguna asociación entre la vacuna triple vírica y el autismo. No es físicamente posible incorporar un dispositivo funcional en una suspensión inyectable por aguja intramuscular estándar.',
      src: [
        { s: 'Hviid et al., Annals of Internal Medicine (2019)', d: 'Cohorte danesa de 657.461 niños: sin asociación entre triple vírica y autismo.' },
        { s: 'The Lancet (2010)', d: 'Retractación completa del artículo de Wakefield por datos falsificados.' }
      ]
    },
    {
      id: 'fc-agenda2030',
      p: [/agenda 2030/, /gran rese?teo|great reset/, /(nuevo orden mundial|elites globales) (nos )?(controlan|planean)/, /no tendras nada y seras feliz/],
      claim: 'La Agenda 2030 o el "Gran Reseteo" son un plan secreto de control global.',
      v: 'falso',
      fix: 'La Agenda 2030 es una resolución pública de la Asamblea General de la ONU (A/RES/70/1, 2015) con 17 objetivos no vinculantes, sin capacidad sancionadora ni de imposición sobre Estados. El "Gran Reseteo" es el título de un libro y de una edición del foro de Davos, no un instrumento jurídico. La frase "no tendrás nada y serás feliz" procede de un vídeo especulativo de 2016 sobre escenarios de futuro, no de ningún acuerdo.',
      src: [
        { s: 'Resolución A/RES/70/1 de la ONU', d: 'Texto público, no vinculante, aprobado por 193 Estados.' },
        { s: 'Foro Económico Mundial', d: 'Organización privada sin capacidad normativa ni ejecutiva sobre ningún Estado.' }
      ]
    },
    {
      id: 'fc-comunismo-muertos',
      p: [/(el )?comunismo (mato|asesino) (a )?(mas de )?\d+/, /100 millones de muertos/],
      claim: 'Cifras redondas atribuidas en bloque a "el comunismo".',
      v: 'impreciso',
      fix: 'Los crímenes del estalinismo, el maoísmo y el polpotismo están documentados y son enormes. Pero las cifras agregadas de tipo "100 millones" proceden del Libro negro del comunismo y fueron cuestionadas por dos de sus propios coautores (Werth y Margolin), entre otras cosas por sumar muertes por hambruna con ejecuciones y por incluir bajas militares alemanas. La crítica al totalitarismo no necesita cifras infladas: las verificadas ya son abrumadoras.',
      src: [
        { s: 'Werth y Margolin (1997)', d: 'Se desmarcaron públicamente de la cifra global del prólogo de la obra que coescribieron.' },
        { s: 'Snyder, "Bloodlands" (2010)', d: 'Estimaciones desagregadas por régimen, periodo y causa en lugar de totales agregados.' }
      ]
    },
    {
      id: 'fc-brecha-salarial',
      p: [/(la )?brecha salarial (no existe|es un mito|es mentira)/],
      claim: 'La brecha salarial de género no existe.',
      v: 'enganoso',
      fix: 'Hay que distinguir dos medidas. La brecha bruta (diferencia de ingresos medios) es de aproximadamente un 12-13 % en la UE. La brecha ajustada, controlando ocupación, jornada y experiencia, es menor pero distinta de cero, y buena parte de los factores "de control" —jornada parcial, segregación ocupacional, penalización por maternidad— son ellos mismos el fenómeno a explicar, no una neutralización de él.',
      src: [
        { s: 'Eurostat, Gender Pay Gap', d: 'Brecha bruta en la UE en torno al 12 %.' },
        { s: 'Kleven et al., AEJ: Applied Economics (2019)', d: 'La "child penalty" explica una parte creciente de la brecha en países desarrollados.' }
      ]
    },
    {
      id: 'fc-fraude-electoral',
      p: [/fraude (electoral|masivo)/, /(las )?elecciones (estan )?(amanadas|robadas)/, /(nos )?robaron las elecciones/],
      claim: 'Las elecciones están amañadas de forma sistemática.',
      v: 'sin_evidencia',
      fix: 'El fraude electoral a escala capaz de alterar un resultado nacional es extremadamente raro en democracias con administración electoral independiente, y cuando se alega debe demostrarse ante tribunales. En el caso más difundido —EE. UU. 2020— más de 60 demandas fueron desestimadas por falta de pruebas, incluidas las resueltas por jueces nombrados por el propio demandante. Alegar fraude sin evidencia es en sí mismo un mecanismo de deslegitimación institucional.',
      src: [
        { s: 'CISA / Consejo de Coordinación Electoral de EE. UU. (2020)', d: 'Declaración conjunta: "la elección más segura de la historia del país".' },
        { s: 'Recuento de litigios postelectorales 2020-21', d: 'Más de 60 demandas desestimadas o retiradas por ausencia de pruebas.' }
      ]
    },
    {
      id: 'fc-salario-minimo',
      p: [/(el )?salario minimo (destruye|elimina) (el )?empleo/, /subir el salario minimo (causa|genera) paro/],
      claim: 'Subir el salario mínimo destruye empleo de forma automática.',
      v: 'impreciso',
      fix: 'La evidencia empírica moderna es mucho menos concluyente que la predicción del modelo competitivo simple. Card y Krueger (1994) y numerosas réplicas posteriores encuentran efectos sobre el empleo próximos a cero para subidas moderadas; Card obtuvo el Nobel de Economía en 2021 en parte por este trabajo. El consenso actual es que el efecto depende del nivel de partida: subidas muy grandes respecto al salario mediano sí pueden tener efectos negativos.',
      src: [
        { s: 'Card & Krueger, American Economic Review (1994)', d: 'Estudio natural New Jersey-Pensilvania: sin pérdida de empleo tras la subida.' },
        { s: 'Cengiz et al., QJE (2019)', d: 'Metaanálisis de 138 cambios estatales: efecto agregado sobre el empleo cercano a cero.' }
      ]
    },
    {
      id: 'fc-holocausto',
      p: [/(no hubo|nunca hubo) holocausto/, /(el )?holocausto (es un|fue un) (invento|montaje|exagerac)/, /las camaras de gas no existieron/],
      claim: 'El Holocausto no ocurrió o sus cifras están infladas.',
      v: 'falso',
      fix: 'La Shoah es uno de los hechos históricos mejor documentados que existen: archivos administrativos alemanes con la contabilidad de las deportaciones, planos y facturas de las instalaciones de gaseado, evidencia forense en los emplazamientos, testimonios de miles de supervivientes y confesiones de los propios perpetradores en Núremberg y en el juicio a Eichmann. Los censos demográficos de posguerra confirman la desaparición de aproximadamente seis millones de judíos europeos.',
      src: [
        { s: 'Actas del Tribunal Militar Internacional de Núremberg (1945-46)', d: 'Documentación alemana original aportada por la propia acusación.' },
        { s: 'Yad Vashem, base central de nombres', d: 'Más de 4,8 millones de víctimas identificadas nominalmente.' }
      ]
    },
    {
      id: 'fc-privatizar-siempre',
      p: [/lo privado (siempre )?(es mejor|funciona mejor)/, /lo publico (siempre )?(es un desastre|funciona mal)/],
      claim: 'La gestión privada es siempre más eficiente que la pública.',
      v: 'enganoso',
      fix: 'Depende del sector y del diseño del contrato. En servicios competitivos con calidad medible, la privatización suele mejorar la eficiencia. En monopolios naturales con calidad difícil de contratar —agua, prisiones, sanidad de emergencia— la evidencia es mixta o desfavorable: hay una ola documentada de remunicipalizaciones del agua en Europa por sobrecostes y bajo cumplimiento contractual.',
      src: [
        { s: 'Hart, Shleifer & Vishny, QJE (1997)', d: 'Marco teórico: la privatización falla cuando la calidad no es contratable.' },
        { s: 'Transnational Institute, base de remunicipalizaciones', d: 'Más de 300 casos de reversión de la privatización del agua desde 2000.' }
      ]
    }
  ];

  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  global.PS_FACTCHECK = {
    db: DB,
    /** Devuelve los bulos detectados en el texto. */
    scan: function (text) {
      var t = norm(text);
      var hits = [];
      DB.forEach(function (e) {
        for (var i = 0; i < e.p.length; i++) {
          if (e.p[i].test(t)) {
            hits.push({ id: e.id, claim: e.claim, verdict: e.v, correction: e.fix, evidence: e.src });
            break;
          }
        }
      });
      return hits;
    },
    norm: norm
  };
})(window);
