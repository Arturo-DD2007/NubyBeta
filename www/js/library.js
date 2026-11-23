/* Nuby – interfaz de la biblioteca médica (pestaña Salud) */
'use strict';
(function (N) {
  const $ = id => document.getElementById(id);
  let filter = '';
  const KIND_LABEL = { temas: 'MedlinePlus', medicamentos: 'Medicamento · FDA', guia: 'Guía Nuby' };

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function renderStats() {
    const st = N.kb.stats();
    const box = $('kbStats');
    if (st.status === 'loading' || st.status === 'idle') { box.textContent = 'Cargando biblioteca…'; return; }
    if (st.status === 'error') { box.textContent = '⚠️ No se pudo cargar la biblioteca médica.'; return; }
    const parts = st.packs.map(p => (p.ok ? '✅ ' : '❌ ') + p.title + (p.ok ? ': ' + p.count : ' (no incluida en esta versión)'));
    box.textContent = st.total + ' fichas sin internet · ' + parts.join(' · ');
    const body = $('kbSourcesBody'); body.replaceChildren();
    st.packs.forEach(p => {
      const d = el('div', 'src-item');
      d.appendChild(el('strong', '', (p.ok ? '✅ ' : '❌ ') + p.title));
      d.appendChild(el('p', 'tiny', p.license || ''));
      const dates = [];
      if (p.sourceDate) dates.push('Versión de la fuente: ' + p.sourceDate);
      if (p.retrieved) dates.push('Descargado: ' + p.retrieved.slice(0, 10));
      if (!p.ok && p.error) dates.push('Motivo: ' + p.error);
      if (dates.length) d.appendChild(el('p', 'tiny', dates.join(' · ')));
      if (p.licenseUrl || p.url) { const a = el('a', 'tiny', 'Ver fuente / licencia'); a.href = p.licenseUrl || p.url; a.target = '_blank'; a.rel = 'noopener'; d.appendChild(a); }
      body.appendChild(d);
    });
    if (st.built) body.appendChild(el('p', 'tiny', 'Biblioteca generada el ' + st.built.slice(0, 10) + '. Se actualiza al recompilar la app.'));
  }

  function renderResults(q) {
    const box = $('kbResults'); box.replaceChildren(); $('kbEntry').hidden = true; box.hidden = false;
    if (!q.trim()) return;
    const res = N.kb.search(q, { limit: 25, kind: filter || undefined }).filter((r, i, arr) => r.score >= Math.min(3, arr[0].score * 0.3));
    if (!res.length) {
      box.appendChild(el('p', 'muted', '📚 No encontré fichas sobre «' + q + '». Prueba con otras palabras (por ejemplo, el nombre de la enfermedad o del medicamento). Nuby no inventa información.'));
      return;
    }
    res.forEach(r => {
      const d = r.doc, p = N.kb.packOf(d);
      const card = el('button', 'kb-result'); card.type = 'button';
      const head = el('div', 'kb-head');
      head.appendChild(el('strong', '', d.t));
      head.appendChild(el('span', 'kb-badge k-' + (p.kind || ''), KIND_LABEL[p.kind] || p.title || ''));
      card.appendChild(head);
      card.appendChild(el('span', 'kb-snip', N.kb.snippet(d, q, 1).slice(0, 180)));
      card.addEventListener('click', () => openEntry(d.id, q));
      box.appendChild(card);
    });
  }

  function paragraphs(text) {
    const frag = document.createDocumentFragment();
    String(text || '').split(/\n{2,}/).forEach(block => {
      const lines = block.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length && lines.every(l => l.startsWith('•'))) {
        const ul = el('ul'); lines.forEach(l => ul.appendChild(el('li', '', l.replace(/^•\s*/, '')))); frag.appendChild(ul);
      } else lines.forEach(l => frag.appendChild(el('p', '', l)));
    });
    return frag;
  }

  function openEntry(id, q) {
    const d = N.kb.get(id);
    if (!d) return;
    const box = $('kbEntry'); box.replaceChildren(); box.hidden = false; $('kbResults').hidden = true;
    const back = el('button', 'secondary', '← Volver'); back.type = 'button';
    back.addEventListener('click', () => { box.hidden = true; $('kbResults').hidden = false; });
    box.appendChild(back);
    box.appendChild(el('h4', '', (d.lang === 'en' ? '💊 ' : '📘 ') + d.t));
    if (d.clase) box.appendChild(el('p', 'muted', d.clase + (d.gen ? ' · nombre en EE. UU.: ' + d.gen : '')));
    if (d.a && d.a.length && d.lang !== 'en') box.appendChild(el('p', 'tiny', 'También llamado: ' + d.a.slice(0, 6).join(', ')));
    if (d.brands && d.brands.length) box.appendChild(el('p', 'tiny', 'Marcas en EE. UU. (pueden ser distintas en tu país): ' + d.brands.join(', ')));
    box.appendChild(el('div', 'notice edu', N.kb.EDU_NOTE));
    if (d.lang === 'en') box.appendChild(el('div', 'notice', '🇺🇸 Texto oficial de la etiqueta de EE. UU., en inglés y sin traducir. Se omiten las secciones de dosis a propósito: la dosis la indica tu médico o farmacéutico.'));
    if (d.s) box.appendChild(paragraphs(d.s));
    if (d.sec) Object.entries(d.sec).forEach(([k, v]) => {
      box.appendChild(el('h5', /urgente|emergencia|recuadro/i.test(k) ? 'red' : '', k));
      if (Array.isArray(v)) { const ul = el('ul'); v.forEach(i => ul.appendChild(el('li', '', i))); box.appendChild(ul); }
      else box.appendChild(paragraphs(v));
    });
    if (d.r && d.r.length) {
      box.appendChild(el('h5', '', 'Temas relacionados'));
      const chips = el('div', 'chips');
      d.r.forEach(t => { const b = el('button', '', t); b.type = 'button'; b.addEventListener('click', () => { $('kbQuery').value = t; renderResults(t); }); chips.appendChild(b); });
      box.appendChild(chips);
    }
    const src = el('p', 'tiny', N.kb.sourceLine(d) + (d.d && d.lang !== 'en' ? ' · tema creado ' + d.d : ''));
    box.appendChild(src);
    if (d.u) { const a = el('a', 'tiny', 'Abrir la fuente original ↗'); a.href = d.u; a.target = '_blank'; a.rel = 'noopener'; box.appendChild(a); }
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    N.mascot.express('medico', 'Aquí tienes la ficha 🩺📘', 3500);
  }

  async function openFromChat(id) {
    N.app.openTab('salud');
    await N.kb.ready();
    openEntry(id);
  }

  function init() {
    $('kbForm').addEventListener('submit', e => { e.preventDefault(); renderResults($('kbQuery').value); N.mascot.express('medico', 'Buscando en mi biblioteca… 📚', 2500); });
    document.querySelectorAll('#kbFilter button').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.kind || '';
      document.querySelectorAll('#kbFilter button').forEach(x => x.classList.toggle('on', x === b));
      if ($('kbQuery').value.trim()) renderResults($('kbQuery').value);
    }));
    renderStats();
    N.kb.ready().then(renderStats);
  }

  N.library = { init, openEntry, openFromChat, renderStats };
})(window.Nuby);
