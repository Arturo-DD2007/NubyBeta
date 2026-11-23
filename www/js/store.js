/* Nuby – almacenamiento local y utilidades compartidas */
'use strict';
window.Nuby = window.Nuby || {};

(function (N) {
  const PREFIX = 'nuby2-';

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (e) { return fallback; }
  }
  function save(key, data) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }

  // Migra datos de la versión 1.1 (prefijo "nuby-v1-") una sola vez.
  function migrateV1() {
    try {
      if (localStorage.getItem(PREFIX + 'migrated')) return;
      const oldRem = JSON.parse(localStorage.getItem('nuby-v1-reminders') || '[]');
      const oldHist = JSON.parse(localStorage.getItem('nuby-v1-history') || '[]');
      if (Array.isArray(oldRem) && oldRem.length && !localStorage.getItem(PREFIX + 'reminders')) {
        let nid = 1;
        const conv = oldRem.filter(r => r && typeof r.text === 'string' && r.date).map(r => ({
          id: String(r.id || Date.now().toString(36) + Math.random().toString(36).slice(2)),
          nid: nid++, type: 'task', title: r.text, notes: '', date: String(r.date).slice(0, 16),
          repeat: 'none', active: true, done: !!r.done, created: Date.now()
        }));
        save('reminders', conv); save('nextNid', nid);
      }
      if (Array.isArray(oldHist) && oldHist.length && !localStorage.getItem(PREFIX + 'history')) {
        save('history', oldHist.filter(m => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'bot')));
      }
      localStorage.setItem(PREFIX + 'migrated', '1');
    } catch (e) { /* sin datos previos */ }
  }

  const pad = n => String(n).padStart(2, '0');
  // "YYYY-MM-DDTHH:MM" en hora local (formato de <input type="datetime-local">)
  function toLocalInput(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  // Interpreta "YYYY-MM-DDTHH:MM" SIEMPRE como hora local (evita diferencias entre navegadores).
  function parseLocal(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(s || ''));
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function todayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function formatWhen(d) {
    if (!d) return '';
    const now = new Date();
    const time = pad(d.getHours()) + ':' + pad(d.getMinutes());
    const diffDays = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    if (diffDays === 0) return 'hoy ' + time;
    if (diffDays === 1) return 'mañana ' + time;
    if (diffDays === -1) return 'ayer ' + time;
    if (diffDays > 1 && diffDays < 7) return DAYS[d.getDay()] + ' ' + time;
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + time;
  }

  function toast(msg, ms) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg; el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, ms || 3200);
  }

  N.store = { read, save, migrateV1 };
  N.util = { pad, toLocalInput, parseLocal, todayKey, formatWhen, toast, DAYS };
})(window.Nuby);
