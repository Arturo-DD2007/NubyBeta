// Nuby – construye la biblioteca médica local (www/kb/) a partir de fuentes reutilizables.
// Se ejecuta en GitHub Actions antes de compilar el APK. No necesita dependencias.
//
//   node scripts/build-kb.mjs             descarga fuentes y genera www/kb/
//   node scripts/build-kb.mjs --offline   solo empaqueta el contenido local (sin internet)
//   MEDLINEPLUS_XML=/ruta/archivo.xml     usa un XML ya descargado (pruebas)
//
// Fuentes:
//   1. MedlinePlus en español (NLM, EE. UU.) – resúmenes de temas de salud. Dominio público.
//      https://medlineplus.gov/xml.html  ·  https://medlineplus.gov/copyright.html
//   2. openFDA – etiquetas oficiales de medicamentos de EE. UU. (en inglés). CC0 / dominio público.
//      https://open.fda.gov/apis/drug/label/  ·  https://open.fda.gov/license
//   3. Guía rápida de Nuby – contenido propio del proyecto (scripts/kb-sources/guia-nuby.json).
//
// Si una descarga falla, la compilación NO se detiene: esa parte queda marcada como no disponible
// en www/kb/manifest.json y la app lo muestra.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(root, 'scripts', 'kb-sources');
const OUT = path.join(root, 'www', 'kb');
const OFFLINE = process.argv.includes('--offline');
const UA = 'NubyKB/1.0 (proyecto educativo; https://github.com)';
const now = new Date().toISOString();
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log('•', ...a);
const warn = (...a) => console.warn('⚠️ ', ...a);

/* ---------------- utilidades ---------------- */
async function get(url, { binary = false, tries = 3, timeout = 60000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      if (!res.ok) { const err = new Error('HTTP ' + res.status); err.noRetry = res.status >= 400 && res.status < 500 && res.status !== 429; throw err; }
      return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
    } catch (e) { last = e; if (e.noRetry) break; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
    finally { clearTimeout(t); }
  }
  throw last;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü', Aacute: 'Á', Eacute: 'É',
  Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»', deg: '°', reg: '®', trade: '™', copy: '©' };
function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (n in ENT ? ENT[n] : m));
}
function htmlToText(html) {
  let s = decode(html);
  if (/&lt;|&gt;/.test(s)) s = decode(s);                 // doble escape
  s = s.replace(/<\s*li[^>]*>/gi, '\n• ').replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|ul|ol|h\d)\s*>/gi, '\n\n').replace(/<[^>]+>/g, '');
  s = decode(s);
  return s.split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function attrs(s) { const o = {}; s.replace(/([\w:-]+)="([^"]*)"/g, (m, k, v) => { o[k] = decode(v); }); return o; }
function all(re, s) { const out = []; let m; re.lastIndex = 0; while ((m = re.exec(s))) out.push(m); return out; }
function trimText(s, max) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max); const dot = cut.lastIndexOf('. ');
  return (dot > max * 0.6 ? cut.slice(0, dot + 1) : cut) + ' […]';
}
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------------- 1. MedlinePlus en español ---------------- */
export function parseMedlinePlus(xml) {
  const topics = [];
  for (const m of all(/<health-topic\b([^>]*)>([\s\S]*?)<\/health-topic>/g, xml)) {
    const a = attrs(m[1]);
    if (a.language !== 'Spanish') continue;
    const body = m[2];
    const fs1 = /<full-summary>([\s\S]*?)<\/full-summary>/.exec(body);
    const summary = fs1 ? htmlToText(fs1[1]) : '';
    if (!a.title || !summary) continue;
    const aliases = all(/<(?:also-called|see-reference)>([\s\S]*?)<\/(?:also-called|see-reference)>/g, body).map(x => decode(x[1]).trim()).filter(Boolean);
    const groups = all(/<group\b[^>]*>([\s\S]*?)<\/group>/g, body).map(x => decode(x[1]).trim()).filter(Boolean);
    const related = all(/<related-topic\b[^>]*>([\s\S]*?)<\/related-topic>/g, body).map(x => decode(x[1]).trim()).filter(Boolean);
    const en = /<language-mapped-topic\b[^>]*>([\s\S]*?)<\/language-mapped-topic>/.exec(body);
    topics.push({
      id: 'mp-' + (a.id || slug(a.title)), t: decode(a.title).trim(), a: [...new Set(aliases)], g: [...new Set(groups)],
      s: summary, u: a.url || '', d: a['date-created'] || '', r: [...new Set(related)].slice(0, 8), en: en ? decode(en[1]).trim() : ''
    });
  }
  topics.sort((x, y) => x.t.localeCompare(y.t, 'es'));
  return topics;
}

async function buildMedlinePlus() {
  const info = {
    id: 'medlineplus-es', file: 'medlineplus-es.json', title: 'MedlinePlus en español',
    source: 'MedlinePlus, Biblioteca Nacional de Medicina de EE. UU. (NLM)', url: 'https://medlineplus.gov/spanish/',
    license: 'Dominio público (resúmenes de temas de salud de MedlinePlus). Fuente: MedlinePlus, Biblioteca Nacional de Medicina.',
    licenseUrl: 'https://medlineplus.gov/copyright.html', lang: 'es', kind: 'temas', ok: false
  };
  try {
    let xml, sourceDate = '';
    if (process.env.MEDLINEPLUS_XML) {
      xml = fs.readFileSync(process.env.MEDLINEPLUS_XML, 'utf8');
      sourceDate = (/(\d{4}-\d{2}-\d{2})/.exec(process.env.MEDLINEPLUS_XML) || [])[1] || '';
    } else {
      if (OFFLINE) throw new Error('modo sin conexión');
      const page = await get('https://medlineplus.gov/xml.html');
      const zips = [...new Set(all(/mplus_topics_compressed_(\d{4}-\d{2}-\d{2})\.zip/g, page).map(x => x[1]))].sort().reverse();
      const xmls = [...new Set(all(/mplus_topics_(\d{4}-\d{2}-\d{2})\.xml/g, page).map(x => x[1]))].sort().reverse();
      if (zips.length) {
        sourceDate = zips[0];
        log('MedlinePlus: descargando ZIP del', sourceDate);
        const buf = await get(`https://medlineplus.gov/xml/mplus_topics_compressed_${sourceDate}.zip`, { binary: true, timeout: 180000 });
        const tmp = path.join(os.tmpdir(), 'mplus.zip');
        fs.writeFileSync(tmp, buf);
        xml = execFileSync('unzip', ['-p', tmp], { maxBuffer: 1024 * 1024 * 400 }).toString('utf8');
      } else if (xmls.length) {
        sourceDate = xmls[0];
        log('MedlinePlus: descargando XML del', sourceDate);
        xml = await get(`https://medlineplus.gov/xml/mplus_topics_${sourceDate}.xml`, { timeout: 180000 });
      } else throw new Error('no se encontraron enlaces en xml.html');
    }
    const topics = parseMedlinePlus(xml);
    if (topics.length < 50) throw new Error('muy pocos temas en español (' + topics.length + ')');
    fs.writeFileSync(path.join(OUT, info.file), JSON.stringify({ id: info.id, entries: topics }));
    Object.assign(info, { ok: true, count: topics.length, sourceDate, retrieved: now });
    log('MedlinePlus:', topics.length, 'temas en español');
  } catch (e) {
    warn('MedlinePlus no disponible:', e.message);
    Object.assign(info, { ok: false, count: 0, error: String(e.message || e) });
    try { fs.unlinkSync(path.join(OUT, info.file)); } catch (x) { /* no existía */ }
  }
  return info;
}

/* ---------------- 2. openFDA: etiquetas de medicamentos ---------------- */
const FDA_SECTIONS = [
  ['boxed_warning', 'Advertencia de recuadro (boxed warning)'],
  ['purpose', 'Propósito (venta libre)'],
  ['indications_and_usage', 'Indicaciones y uso'],
  ['contraindications', 'Contraindicaciones'],
  ['do_not_use', 'No usar si'],
  ['warnings_and_cautions', 'Advertencias y precauciones'],
  ['warnings', 'Advertencias'],
  ['ask_doctor', 'Consulte al médico antes de usar si'],
  ['ask_doctor_or_pharmacist', 'Consulte al médico o farmacéutico si'],
  ['stop_use', 'Deje de usarlo y consulte si'],
  ['drug_interactions', 'Interacciones'],
  ['adverse_reactions', 'Reacciones adversas (efectos secundarios)'],
  ['pregnancy_or_breast_feeding', 'Embarazo o lactancia'],
  ['pregnancy', 'Embarazo']
];
// Se omiten a propósito las secciones de dosis (dosage_and_administration, directions):
// Nuby no calcula ni indica dosis.

function scoreLabel(r) {
  const g = ((r.openfda && r.openfda.generic_name) || []).join(' ');
  let s = 0;
  if (g && !/ AND |,/i.test(g)) s += 5;                           // un solo principio activo
  for (const [k] of FDA_SECTIONS) if (r[k]) s += 1;
  if (r.contraindications) s += 2; if (r.drug_interactions) s += 2; if (r.adverse_reactions) s += 2;
  return s;
}

async function buildFda() {
  const info = {
    id: 'medicamentos-fda', file: 'medicamentos-fda.json', title: 'Fichas de medicamentos (FDA, EE. UU.)',
    source: 'openFDA / DailyMed – etiquetas oficiales de medicamentos de la FDA de EE. UU.', url: 'https://open.fda.gov/apis/drug/label/',
    license: 'CC0 1.0 / dominio público. Texto original en inglés; refleja etiquetas de EE. UU. (marcas y presentaciones pueden diferir en tu país).',
    licenseUrl: 'https://open.fda.gov/license', lang: 'en', kind: 'medicamentos', ok: false
  };
  const list = JSON.parse(fs.readFileSync(path.join(SRC, 'medicamentos.json'), 'utf8')).medicamentos;
  if (OFFLINE) { Object.assign(info, { error: 'modo sin conexión', count: 0 }); return info; }
  const entries = [], missing = [];
  let consecutiveFails = 0;
  for (const d of list) {
    if (consecutiveFails >= 5 && !entries.length) { missing.push('(se canceló: openFDA no responde)'); break; }
    try {
      const q = encodeURIComponent(`openfda.generic_name:"${d.en}"`);
      const txt = await get(`https://api.fda.gov/drug/label.json?search=${q}&limit=25`, { timeout: 30000, tries: 2 });
      const res = (JSON.parse(txt).results || []).sort((a, b) => scoreLabel(b) - scoreLabel(a) || String(b.effective_time).localeCompare(String(a.effective_time)));
      const r = res[0];
      consecutiveFails = 0;
      if (!r) { missing.push(d.es); continue; }
      const sec = {};
      for (const [k, label] of FDA_SECTIONS) {
        if (!r[k]) continue;
        if (k === 'warnings' && sec['Advertencias y precauciones']) continue;
        let text = (Array.isArray(r[k]) ? r[k].join(' ') : String(r[k]))
          .replace(/^\s*[\d.]*\s*(BOXED WARNING|WARNING|INDICATIONS (AND|&) USAGE|CONTRAINDICATIONS|WARNINGS AND PRECAUTIONS|WARNINGS|DRUG INTERACTIONS|ADVERSE REACTIONS|PURPOSE|PURPOSES|DO NOT USE|STOP USE AND ASK A DOCTOR IF|ASK A DOCTOR BEFORE USE IF YOU HAVE|ASK A DOCTOR OR PHARMACIST BEFORE USE IF YOU ARE|PREGNANCY OR BREAST-FEEDING|PREGNANCY)\s*:?\s*/i, '');
        sec[label] = trimText(text, k === 'adverse_reactions' || k === 'drug_interactions' ? 1600 : 1200);
      }
      const of = r.openfda || {};
      const et = String(r.effective_time || '');
      entries.push({
        id: 'fda-' + slug(d.es), t: d.es, a: [d.en, ...(d.alias || []), ...((of.brand_name || []).slice(0, 6))],
        g: ['Medicamentos', d.clase], clase: d.clase, lang: 'en', sec,
        gen: (of.generic_name || [])[0] || d.en, brands: (of.brand_name || []).slice(0, 8),
        u: r.set_id ? `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${r.set_id}` : 'https://open.fda.gov/apis/drug/label/',
        d: et.length === 8 ? `${et.slice(0, 4)}-${et.slice(4, 6)}-${et.slice(6, 8)}` : ''
      });
      await new Promise(r2 => setTimeout(r2, 300));      // respetar límites de openFDA
    } catch (e) {
      // openFDA responde 404 cuando no hay resultados: no es un fallo de red
      if (/HTTP 404/.test(e.message)) { consecutiveFails = 0; missing.push(d.es); }
      else { consecutiveFails++; missing.push(d.es + ' (' + e.message + ')'); }
    }
  }
  if (!entries.length) { Object.assign(info, { error: 'sin resultados', count: 0 }); return info; }
  entries.sort((x, y) => x.t.localeCompare(y.t, 'es'));
  fs.writeFileSync(path.join(OUT, info.file), JSON.stringify({ id: info.id, entries }));
  Object.assign(info, { ok: true, count: entries.length, retrieved: now, missing });
  log('openFDA:', entries.length, 'fichas;', missing.length, 'sin datos');
  return info;
}

/* ---------------- 3. Guía rápida de Nuby (propia) ---------------- */
function buildGuide() {
  const g = JSON.parse(fs.readFileSync(path.join(SRC, 'guia-nuby.json'), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'guia-nuby.json'), JSON.stringify({ id: 'guia-nuby', entries: g.entries }));
  return {
    id: 'guia-nuby', file: 'guia-nuby.json', title: 'Guía rápida de Nuby', source: 'Proyecto Nuby (contenido propio)',
    url: '', license: 'Contenido propio del proyecto. Orientación general redactada de forma conservadora; NO revisada aún por un profesional de salud.',
    lang: 'es', kind: 'guia', ok: true, count: g.entries.length, retrieved: now
  };
}

/* ---------------- principal ---------------- */
async function main() {
  const packs = [buildGuide(), await buildMedlinePlus(), await buildFda()];
  fs.copyFileSync(path.join(SRC, 'sinonimos.json'), path.join(OUT, 'sinonimos.json'));
  const manifest = {
    schema: 1, built: now,
    notice: 'Información educativa general. No reemplaza la consulta con un profesional de salud. Nuby no diagnostica, no prescribe y no calcula dosis.',
    packs: packs.map(p => { const c = Object.assign({}, p); if (c.missing && c.missing.length > 30) c.missing = c.missing.slice(0, 30); return c; })
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  if (process.env.GITHUB_ENV) { try { fs.appendFileSync(process.env.GITHUB_ENV, 'NUBY_KB_DONE=1\n'); } catch (e) { /* fuera de Actions */ } }
  console.log('\nBiblioteca médica:');
  for (const p of packs) console.log(`  ${p.ok ? '✅' : '❌'} ${p.title}: ${p.count || 0} ${p.ok ? '' : '(' + (p.error || 'no disponible') + ')'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch(e => { console.error('Error inesperado en build-kb:', e); process.exit(0); });
}
