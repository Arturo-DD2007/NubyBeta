/* Nuby – biblioteca médica local: carga de paquetes, índice y búsqueda sin internet.
 *
 * Búsqueda: BM25F por campos (título, sinónimos, grupos, texto) + grupos de sinónimos
 * en lenguaje cotidiano + coincidencia por prefijo y corrección de errores de tipeo.
 * Es búsqueda por palabras clave mejorada, no "semántica" con un modelo de IA.
 *
 * Regla de oro: Nuby solo muestra texto que existe en la biblioteca, con su fuente y fecha.
 * Si no encuentra nada suficientemente relevante, lo dice; no inventa.
 */
'use strict';
(function (N) {
  const BASE = 'kb/';
  const FIELD_W = { t: 5, a: 3.5, g: 1, s: 1 };
  const K1 = 1.2, B = 0.6;
  const STOP = new Set(('a al algo algun alguna algunas alguno algunos ante antes aqui asi aun bajo bien cada como con contra cual cuales ' +
    'cuando de del desde donde dos el ella ellas ellos en entre era eran es esa esas ese eso esos esta estaba estan estar este esto estos ' +
    'fue fueron ha han hasta hay la las le les lo los mas me mi mis muy nada ni no nos o otra otras otro otros para pero poco por porque ' +
    'que quien se sea ser si sin sobre su sus tambien tan tanto te tiene tienen todo todos tu tus un una uno unos unas usted ustedes y ya yo ' +
    'puede pueden hace hacer debe deben esta estas tengo tiene tener mucho mucha muchos muchas the and of to in is are for with or be may ' +
    'by as an on it this that these from not at your you can if use used have has was were will which who also such than other into ' +
    'dime explicame hablame cuentame informacion sobre acerca saber quiero necesito favor').split(' '));

  let manifest = null, packs = {}, docs = [], byId = {}, synGroups = [];
  let postings = new Map(), vocab = [], avgLen = 1, N_DOCS = 0;
  let readyPromise = null, status = 'idle';

  /* ---------------- Texto ---------------- */
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function stem(w) {
    if (w.length > 5 && w.endsWith('es')) w = w.slice(0, -2);
    else if (w.length > 4 && w.endsWith('s')) w = w.slice(0, -1);
    if (w.length > 4 && /[aeo]$/.test(w)) w = w.slice(0, -1);
    return w;
  }
  function tokens(s) {
    return norm(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 1 && !STOP.has(w)).map(stem);
  }

  /* ---------------- Carga ---------------- */
  async function getJSON(file) {
    const res = await fetch(BASE + file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(file + ': HTTP ' + res.status);
    return res.json();
  }

  function ready() {
    if (readyPromise) return readyPromise;
    status = 'loading';
    readyPromise = (async () => {
      try {
        manifest = await getJSON('manifest.json');
        try { synGroups = ((await getJSON('sinonimos.json')).grupos || []).map(g => g.map(norm)); } catch (e) { synGroups = []; }
        for (const p of manifest.packs || []) {
          if (!p.ok) continue;
          try {
            const data = await getJSON(p.file);
            packs[p.id] = p;
            for (const e of data.entries || []) { e.pack = p.id; docs.push(e); byId[e.id] = e; }
          } catch (e) { p.ok = false; p.error = 'no se pudo leer: ' + e.message; }
        }
        buildIndex();
        status = 'ready';
      } catch (e) {
        status = 'error';
        console.warn('Nuby KB:', e);
      }
      return status;
    })();
    return readyPromise;
  }

  function docText(d) {
    if (d.s) return d.s;
    if (d.sec) return Object.entries(d.sec).map(([k, v]) => k + '. ' + (Array.isArray(v) ? v.join(' ') : v)).join('\n');
    return '';
  }

  function buildIndex() {
    postings = new Map(); let total = 0;
    docs.forEach((d, i) => {
      const tf = new Map();
      const add = (text, w) => { for (const t of tokens(text)) tf.set(t, (tf.get(t) || 0) + w); };
      add(d.t, FIELD_W.t);
      (d.a || []).forEach(x => add(x, FIELD_W.a));
      (d.g || []).forEach(x => add(x, FIELD_W.g));
      if (d.clase) add(d.clase, FIELD_W.g);
      const body = tokens(docText(d));
      body.forEach(t => tf.set(t, (tf.get(t) || 0) + FIELD_W.s));
      d._len = body.length || 1; total += d._len;
      d._tnorm = norm(d.t); d._anorm = (d.a || []).map(norm);
      d._tt = new Set(tokens(d.t + ' ' + (d.a || []).join(' ')));
      for (const [t, w] of tf) { let p = postings.get(t); if (!p) postings.set(t, p = []); p.push([i, w]); }
    });
    N_DOCS = docs.length; avgLen = N_DOCS ? total / N_DOCS : 1;
    vocab = [...postings.keys()];
  }

  /* ---------------- Búsqueda ---------------- */
  function editDist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function expand(q) {
    const nq = ' ' + norm(q).replace(/[^a-z0-9]+/g, ' ') + ' ';
    const terms = new Map(), corr = {}, synPhrases = new Set();
    const put = (t, w) => { if (!terms.has(t) || terms.get(t) < w) terms.set(t, w); };
    tokens(q).forEach(t => put(t, 1));
    for (const g of synGroups) {
      if (g.some(ph => nq.includes(' ' + ph + ' '))) g.forEach(ph => { synPhrases.add(ph); tokens(ph).forEach(t => put(t, 0.7)); });
    }
    // corrección de errores de tipeo y prefijos
    for (const [t, w] of [...terms]) {
      if (postings.has(t) || t.length < 4) continue;
      let found = false;
      for (const v of vocab) {
        if (v.length > t.length && v.startsWith(t)) { put(v, w * 0.6); found = true; if (!corr[t] || v.length < corr[t].length) corr[t] = v; }
      }
      if (!found && t.length >= 5) {
        const max = t.length >= 8 ? 2 : 1;
        let best = null, bd = 9;
        for (const v of vocab) if (v[0] === t[0]) { const dd = editDist(t, v, max); if (dd <= max) { put(v, w * 0.6); if (dd < bd) { bd = dd; best = v; } } }
        if (best) corr[t] = best;
      }
    }
    return { terms, nq, corr, synPhrases };
  }

  /**
   * @returns [{doc, score, strong}] ordenado. strong = el título o un sinónimo aparece completo en la consulta.
   */
  function search(q, opt) {
    opt = opt || {};
    if (status !== 'ready' || !q || !N_DOCS) return [];
    const { terms, nq, corr, synPhrases } = expand(q);
    const qTok = tokens(q).map(t => (postings.has(t) ? t : (corr[t] || t)));
    const scores = new Map();
    for (const [t, qw] of terms) {
      const p = postings.get(t); if (!p) continue;
      const idf = Math.log(1 + (N_DOCS - p.length + 0.5) / (p.length + 0.5));
      for (const [i, wtf] of p) {
        const d = docs[i];
        const s = idf * qw * (wtf * (K1 + 1)) / (wtf + K1 * (1 - B + B * d._len / avgLen));
        scores.set(i, (scores.get(i) || 0) + s);
      }
    }
    const out = [];
    for (const [i, s] of scores) {
      const d = docs[i];
      if (opt.kind && packs[d.pack] && packs[d.pack].kind !== opt.kind) continue;
      let bonus = 0, strong = false;
      const phrases = [d._tnorm].concat(d._anorm).filter(p => p.length >= 3);
      for (const ph of phrases) {
        const clean = ' ' + ph.replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
        if (clean.trim() && nq.includes(clean)) { strong = true; bonus = Math.max(bonus, nq.trim() === clean.trim() ? 14 : 8); }
        else if (synPhrases.has(clean.trim())) { strong = true; bonus = Math.max(bonus, 9); }
      }
      // consulta corta cuyas palabras (corregidas) están todas en el título o sinónimos
      if (!strong && qTok.length && qTok.length <= 3 && qTok.every(t => d._tt.has(t))) { strong = true; bonus = Math.max(bonus, 10); }
      const prio = d.pack === 'medlineplus-es' ? 1.15 : d.pack === 'medicamentos-fda' ? 1.1 : 0.85;   // se prefieren fuentes externas verificadas
      out.push({ doc: d, score: (s + bonus) * prio, strong });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, opt.limit || 20);
  }

  
  /* ---------------- Fragmentos relevantes ---------------- */
  // Buscar un apartado específico dentro de una ficha médica.
  function buscarApartado(d, pregunta) {
    const texto = docText(d);
    const consulta = norm(pregunta);

    // Por ahora identificamos preguntas sobre síntomas.
    if (!/\b(sintoma|sintomas|signos)\b/.test(consulta)) {
      return null;
    }

    const lineas = texto.split(/\r?\n/);

    // Buscar el encabezado de síntomas.
    const inicio = lineas.findIndex(linea => {
      const titulo = norm(linea.trim());

      return /^¿.{3,140}\?$/.test(titulo) &&
             /sintoma|signos/.test(titulo);
    });

    if (inicio === -1) return null;

    const contenido = [];

    for (let i = inicio + 1; i < lineas.length; i++) {
      const linea = lineas[i].trim();

      // Terminar cuando comienza otro apartado.
      if (/^¿.{3,140}\?$/.test(norm(linea))) {
        break;
      }

      if (linea) contenido.push(linea);

      if (contenido.join(' ').length > 1000) {
        break;
      }
    }

    if (!contenido.length) return null;

    return contenido.join('\n').slice(0, 1000);
  }
  
  function snippet(d, q, maxSent) {
    maxSent = maxSent || 3;

    const text = docText(d);
     // Priorizar la sección específica solicitada.
    const apartado = buscarApartado(d, q);

    if (apartado) {
      return apartado;
    }

    const sents = text
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    if (!sents.length) return text.slice(0, 300);

    const pregunta = norm(q);

    // Las preguntas de definición usan primero
    // la introducción de la ficha.
    const pideDefinicion =
      /\b(que es|que son|que significa|definicion de)\b/
        .test(pregunta);

    if (pideDefinicion) {
      return sents.slice(0, maxSent).join(' ')
        .slice(0, 520);
    }

    // Otras preguntas conservan la búsqueda
    // por coincidencia de palabras.
    const qt = new Set(expand(q).terms.keys());

    const scored = sents.map((s, i) => ({
      i,
      s,
      sc: tokens(s).filter(t => qt.has(t)).length
          + (i === 0 ? 0.8 : 0)
    }));

    const selected = scored
      .sort((a, b) => b.sc - a.sc)
      .slice(0, maxSent)
      .sort((a, b) => a.i - b.i);

    return selected.map(x => x.s).join(' ')
      .slice(0, 520);
  }

  function packOf(d) { return (manifest && (manifest.packs || []).find(p => p.id === d.pack)) || {}; }

  function sourceLine(d) {
    const p = packOf(d);
    if (p.id === 'medlineplus-es') return 'Fuente: MedlinePlus, Biblioteca Nacional de Medicina de EE. UU.' + (p.sourceDate ? ' · versión ' + p.sourceDate : '');
    if (p.id === 'medicamentos-fda') return 'Fuente: etiqueta oficial de la FDA de EE. UU. (DailyMed/openFDA), en inglés' + (d.d ? ' · revisión ' + d.d : '');
    if (p.id === 'guia-nuby') return 'Fuente: Guía rápida de Nuby (contenido propio, no revisado por un profesional)';
    return p.source || '';
  }

  // Secciones de las fichas de medicamentos que responde cada pregunta
  const DRUG_ASK = [
    [/efecto|secundari|advers|reaccion/, ['Reacciones adversas (efectos secundarios)']],
    [/interacc|mezcl|junto con|combinar/, ['Interacciones']],
    [/contraindic|no (debo|puedo|usar)|no tomar|quien no/, ['Contraindicaciones', 'No usar si']],
    [/para que sirve|sirve para|indicac|uso|para que se usa/, ['Indicaciones y uso', 'Propósito (venta libre)']],
    [/embaraz|lactanc|amamant/, ['Embarazo o lactancia', 'Embarazo']],
    [/riesgo|advertenc|precauc|peligro/, ['Advertencia de recuadro (boxed warning)', 'Advertencias y precauciones', 'Advertencias']]
  ];
  function drugSection(d, q) {
    const nq = norm(q);
    for (const [re, keys] of DRUG_ASK) if (re.test(nq)) for (const k of keys) if (d.sec && d.sec[k]) return [k, d.sec[k]];
    return null;
  }

  /* ---------------- Respuesta para el chat ---------------- */
  const CUE = /\b(que es|que son|que significa|significa|sintoma|causa|tratamiento|se trata|se cura|cura|contagi|prevenir|prevencion|efecto|secundari|adverso|para que sirve|sirve para|contraindic|interacc|riesgo|pronostico|prueba|analisis|examen|estudio|valores|normal|informacion|hablame|explicame|cuentame sobre|que pasa si|como funciona|como afecta|vacuna|nutricion|vitamina|alimentos)/;
  const EDU_NOTE = 'ℹ️ Información educativa general: no es un diagnóstico ni una indicación para tu caso. Para decisiones sobre tu salud, consulta a un profesional.';

  /** Devuelve una respuesta del chat basada solo en la biblioteca, o null si la pregunta no parece médica. */
  function answer(q) {
    if (status !== 'ready') return null;
    const nq = norm(q);
    const hasCue = CUE.test(nq);
    // Buscar resultados relacionados.
   const res = search(q, { limit: 30 });
    let top = res[0];
    const qtok = tokens(q).length;

    // Priorizar la ficha exacta de diabetes.
    const preguntaDiabetes =
      /\bdiabetes\b/.test(nq) &&
      !/\b(tipo 1|tipo 2|gestacional)\b/.test(nq);

    if (preguntaDiabetes) {
      const ficha = docs.find(d => {
        const nombres = [d.t, ...(d.a || [])];

        return nombres.some(nombre =>
          norm(nombre).trim() === 'diabetes'
        );
      });

      if (ficha) {
        // Seleccionar Diabetes, no Hiperglucemia.
        top = {
          doc: ficha,
          score: Math.max(top ? top.score : 0, 10),
          strong: true
        };
      } else {
        // No sustituir Diabetes por otro tema.
        return {
          text: '📚 No encontré una ficha específica ' +
            'sobre diabetes en mi biblioteca actual. ' +
            'Prefiero no mostrar información sobre ' +
            'hiperglucemia como si fuera una definición ' +
            'de diabetes. Puedes consultar una fuente ' +
            'médica confiable o la pestaña Salud.',
          mood: 'confundido',
          notFound: true,
          aiOk: false
        };
      }
    }

    // Identificar vitaminas específicas.
    const vitamina = /\bvitamina\s+(?:b\s?(?:12|[1235679])|[acdek])\b/.exec(nq);

    if (vitamina) {
      const solicitada = vitamina[0]
        .replace(/\s+/g, ' ')
        .replace(/^vitamina b (\d+)$/, 'vitamina b$1');

      // Buscar un título o sinónimo exactamente igual.
      const fichaExacta = docs.find(d => {
        const nombres = [d.t, ...(d.a || [])];

        return nombres.some(nombre => {
          const limpio = norm(nombre)
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/^vitamina b (\d+)$/, 'vitamina b$1');

          return limpio === solicitada;
        });
      });

      if (!fichaExacta) {
        return {
          text: '📚 No encontré una ficha específica y verificada sobre ' +
            solicitada +
            ' en mi biblioteca médica. Prefiero no mostrarte información de otra vitamina o suplemento como si fuera la respuesta exacta.\n\n' +
            'Puedes consultar la pestaña Salud o una fuente médica confiable.',
          mood: 'confundido',
          notFound: true,
          aiOk: false
        };
      }

      // Priorizar la ficha específica sobre el ranking general.
      top = {
        doc: fichaExacta,
        score: Math.max(top ? top.score : 0, 10),
        strong: true
      };
    }
    const strongEnough = top && (top.strong || (hasCue && top.score >= 6));
    if (!strongEnough) {
      if (hasCue && (top ? top.score < 6 : true) && qtok >= 2 && looksMedical(nq)) {
        return { text: '📚 No encontré información verificada sobre eso en mi biblioteca médica, así que prefiero no inventar.\n\nPuedes probar con otras palabras en Salud → Biblioteca, o consultar a un profesional de salud.', mood: 'confundido', notFound: true };
      }
      return null;
    }
    if (!hasCue && qtok > 6 && !top.strong) return null;
    const d = top.doc;
    let body;
    if (d.lang === 'en' && d.sec) {
      const sec = drugSection(d, q);
      body = '💊 ' + d.t + (d.clase ? ' — ' + d.clase : '') + '\n' +
        (sec ? '«' + sec[0] + '» según la etiqueta oficial (texto original en inglés):\n' + sec[1].slice(0, 420) + (sec[1].length > 420 ? '…' : '')
             : 'Tengo su ficha oficial de la FDA (en inglés) con indicaciones, contraindicaciones, interacciones y efectos secundarios.') +
        '\n\n⚠️ No indico dosis ni si debes tomarlo: eso lo decide tu médico o farmacéutico.';
    } else {
      body = '📘 ' + d.t + '\n' + snippet(d, q, 3);
    }
    const others = res.slice(1, 4).filter(r => r.score > top.score * 0.45).map(r => r.doc.t);
    let text = body + '\n\n— ' + sourceLine(d) + '\n' + EDU_NOTE;
    if (others.length) text += '\n\nTambién tengo: ' + others.join(' · ');
    return { text, mood: 'medico', kb: d.id };
  }

  function looksMedical(nq) {
    return /(enfermedad|sindrome|dolor|infeccion|medicament|pastilla|sintoma|cancer|virus|bacteria|sangre|corazon|pulmon|rinon|higado|cerebro|piel|hueso|presion|azucar|diabet|vacuna|analisis|examen|tratamiento|salud|medic)/.test(nq);
  }

  /* ---------------- Estadísticas ---------------- */
  function stats() {
    return {
      status, built: manifest && manifest.built, total: docs.length,
      packs: ((manifest && manifest.packs) || []).map(p => ({ id: p.id, title: p.title, ok: p.ok, count: p.count || 0, sourceDate: p.sourceDate || '', retrieved: p.retrieved || '', license: p.license, licenseUrl: p.licenseUrl || '', url: p.url || '', error: p.error || '', lang: p.lang, kind: p.kind }))
    };
  }

  N.kb = { ready, search, snippet, answer, get: id => byId[id], stats, sourceLine, packOf, drugSection, status: () => status, EDU_NOTE, norm };
})(window.Nuby);
