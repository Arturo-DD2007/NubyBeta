/* Nuby – recordatorios de medicamentos, tareas y actividades */
'use strict';
(function (N) {
  const U = N.util;
  const TYPES = {
    med: { emoji: '💊', label: 'Medicamento' },
    task: { emoji: '✅', label: 'Tarea' },
    activity: { emoji: '🏃', label: 'Actividad' }
  };
  const REPEAT_LABEL = { none: '', daily: '🔁 Todos los días', weekly: '🔁 Cada semana' };

  let items = [];
  let editingId = null;
  let filter = 'all';

  function load() {
    const raw = N.store.read('reminders', []);
    items = (Array.isArray(raw) ? raw : []).filter(r => r && typeof r.title === 'string' && U.parseLocal(r.date));
    items.forEach(r => {
      if (!TYPES[r.type]) r.type = 'task';
      if (!REPEAT_LABEL.hasOwnProperty(r.repeat)) r.repeat = 'none';
      if (typeof r.active !== 'boolean') r.active = true;
      if (!Number.isInteger(r.nid) || r.nid < 1) r.nid = nextNid();
    });
  }
  function persist() { N.store.save('reminders', items); }

  // Identificador numérico estable para Android (cada recordatorio reserva 64 ids)
  function nextNid() {
    let n = +N.store.read('nextNid', 1) || 1;
    const used = new Set(items.map(r => r.nid));
    while (used.has(n)) n++;
    N.store.save('nextNid', n + 1);
    return n;
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /**
   * Próximas fechas de aviso de un recordatorio entre `from` (exclusivo) y `until`.
   * Omite el día marcado como "hecho hoy" en los repetitivos.
   */
  function occurrences(r, from, until, max) {
    max = max || 60;
    const out = [];
    if (!r.active || r.done) return out;
    const start = U.parseLocal(r.date);
    if (!start) return out;
    if (r.repeat === 'none') {
      if (start > from && start <= until) out.push(start);
      return out;
    }
    const step = r.repeat === 'weekly' ? 7 : 1;
    let d = new Date(start);
    if (d <= from) {
      // salta directamente cerca de "from" conservando hora y día de la semana
      const daysBehind = Math.floor((from - d) / 86400000);
      const jumps = Math.floor(daysBehind / step);
      d.setDate(d.getDate() + jumps * step);
      while (d <= from) d.setDate(d.getDate() + step);
    }
    while (d <= until && out.length < max) {
      if (U.todayKey(d) !== r.lastDone) out.push(new Date(d));
      d.setDate(d.getDate() + step);
    }
    return out;
  }

  function nextOccurrence(r) {
    const now = new Date();
    const list = occurrences(r, now, new Date(now.getTime() + 400 * 86400000), 1);
    return list[0] || null;
  }

  // ¿Está vencido y sin atender?
  function isDue(r, now) {
    now = now || new Date();
    if (!r.active || r.done) return false;
    if (r.snoozeAt && r.snoozeAt > now.getTime()) return false;
    const start = U.parseLocal(r.date);
    if (r.repeat === 'none') return start <= now;
    // repetitivo: la toma de hoy ya pasó y no se marcó como hecha
    if (start > now) return false;
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todays = occurrences(r, new Date(midnight.getTime() - 1), now, 5);
    return todays.length > 0 && r.lastDone !== U.todayKey(now);
  }

  function dueList() { const now = new Date(); return items.filter(r => isDue(r, now)); }

  function changed(opts) {
    persist(); render();
    if (!(opts && opts.noSync) && N.notify) N.notify.sync();
  }

  function add(data) {
    const r = {
      id: uid(), nid: nextNid(), type: TYPES[data.type] ? data.type : 'task',
      title: String(data.title || '').trim().slice(0, 120), notes: String(data.notes || '').trim().slice(0, 200),
      date: data.date, repeat: REPEAT_LABEL.hasOwnProperty(data.repeat) ? data.repeat : 'none',
      active: true, done: false, created: Date.now()
    };
    if (!r.title || !U.parseLocal(r.date)) return null;
    items.push(r); changed();
    return r;
  }

  function get(id) { return items.find(r => r.id === id); }

  function markDone(id) {
    const r = get(id); if (!r) return;
    r.snoozeAt = 0;
    if (r.repeat === 'none') r.done = true; else r.lastDone = U.todayKey();
    changed();
  }

  function snooze(id, minutes) {
    const r = get(id); if (!r) return null;
    r.snoozeAt = Date.now() + (minutes || 10) * 60000;
    changed();
    return new Date(r.snoozeAt);
  }

  function remove(id) { items = items.filter(r => r.id !== id); if (editingId === id) cancelEdit(); changed(); }

  /* ---------------- Interfaz ---------------- */
  const $ = id => document.getElementById(id);

  function defaultDate() {
    const d = new Date(Date.now() + 60 * 60000); d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return U.toLocalInput(d);
  }

  function setType(t) { document.querySelectorAll('input[name="rtype"]').forEach(i => { i.checked = i.value === t; }); }
  function getType() { const c = document.querySelector('input[name="rtype"]:checked'); return c ? c.value : 'task'; }

  function startEdit(id) {
    const r = get(id); if (!r) return;
    editingId = id;
    setType(r.type);
    $('reminderText').value = r.title; $('reminderNotes').value = r.notes || '';
    $('reminderDate').value = r.date; $('reminderRepeat').value = r.repeat;
    $('formTitle').textContent = 'Editar recordatorio';
    $('saveReminder').textContent = '💾 Guardar cambios';
    $('cancelEdit').hidden = false;
    $('reminderForm').classList.add('editing');
    $('reminderForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    editingId = null;
    $('reminderForm').reset(); setType('med');
    $('reminderDate').value = defaultDate();
    $('formTitle').textContent = 'Nuevo recordatorio';
    $('saveReminder').textContent = '+ Guardar recordatorio';
    $('cancelEdit').hidden = true;
    $('reminderForm').classList.remove('editing');
  }

  function onSubmit(e) {
    e.preventDefault();
    const title = $('reminderText').value.trim();
    const date = $('reminderDate').value;
    const repeat = $('reminderRepeat').value;
    const start = U.parseLocal(date);
    if (!title || !start) { U.toast('Escribe qué recordar y elige fecha y hora.'); return; }
    if (repeat === 'none' && start <= new Date()) { U.toast('⏰ Esa hora ya pasó. Elige una fecha futura.'); return; }
    const data = { type: getType(), title, notes: $('reminderNotes').value, date, repeat };
    if (editingId) {
      const r = get(editingId);
      if (r) {
        Object.assign(r, { type: data.type, title: title.slice(0, 120), notes: data.notes.trim().slice(0, 200), date, repeat, done: false, active: true, snoozeAt: 0, lastDone: '' });
      }
      cancelEdit(); changed();
      U.toast('✏️ Recordatorio actualizado');
    } else {
      const r = add(data);
      cancelEdit();
      if (r) {
        const next = nextOccurrence(r);
        U.toast('✅ Guardado. Próximo aviso: ' + U.formatWhen(next));
        N.mascot.express('recordatorio', '¡Anotado! Te avisaré ' + U.formatWhen(next) + ' ⏰');
      }
    }
    if (N.notify && !N.notify.isReady()) N.notify.hintEnable();
  }

  function button(text, label, onClick, extra) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'secondary' + (extra ? ' ' + extra : ''); b.textContent = text;
    b.setAttribute('aria-label', label); b.title = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function card(r, now) {
    const due = isDue(r, now);
    const next = nextOccurrence(r);
    const wrap = document.createElement('div');
    wrap.className = 'reminder t-' + r.type + (due ? ' due' : '') + (r.done ? ' done' : '') + (!r.active ? ' paused' : '');
    const info = document.createElement('div'); info.className = 'info';
    const title = document.createElement('strong'); title.textContent = TYPES[r.type].emoji + ' ' + r.title;
    info.appendChild(title);
    if (r.notes) { const n = document.createElement('small'); n.className = 'note'; n.textContent = r.notes; info.appendChild(n); }
    const when = document.createElement('small');
    let txt;
    if (r.done) txt = '✔ Completado · ' + U.formatWhen(U.parseLocal(r.date));
    else if (!r.active) txt = '⏸ En pausa';
    else if (due) txt = '🔔 ¡Pendiente! ' + (r.repeat === 'none' ? U.formatWhen(U.parseLocal(r.date)) : 'de hoy');
    else if (r.snoozeAt && r.snoozeAt > now.getTime()) txt = '😴 Pospuesto hasta ' + U.formatWhen(new Date(r.snoozeAt));
    else txt = 'Próximo: ' + (next ? U.formatWhen(next) : '—');
    if (r.repeat !== 'none') txt += ' · ' + REPEAT_LABEL[r.repeat];
    if (r.repeat !== 'none' && r.lastDone === U.todayKey(now)) txt += ' · ✔ hecho hoy';
    when.textContent = txt; info.appendChild(when);

    const actions = document.createElement('div'); actions.className = 'actions';
    if (!r.done && r.active) {
      actions.appendChild(button('✓', r.repeat === 'none' ? 'Marcar completado' : 'Marcar hecho hoy', () => {
        markDone(r.id); N.mascot.express('confirmando', '¡Tarea completada! 🎉');
      }));
    }
    if (r.done) actions.appendChild(button('↩', 'Reactivar', () => {
      r.done = false;
      if (U.parseLocal(r.date) <= new Date()) { startEdit(r.id); U.toast('Elige una nueva fecha y guarda.'); return; }
      changed();
    }));
    if (r.repeat !== 'none') actions.appendChild(button(r.active ? '⏸' : '▶', r.active ? 'Pausar' : 'Reanudar', () => { r.active = !r.active; changed(); }));
    actions.appendChild(button('✎', 'Editar', () => startEdit(r.id)));
    actions.appendChild(button('🗑', 'Eliminar', () => {
      if (window.confirm('¿Eliminar "' + r.title + '"?')) { remove(r.id); U.toast('🗑 Eliminado'); }
    }, 'danger'));
    wrap.append(info, actions);
    return wrap;
  }

  function render() {
    const list = $('reminderList'); if (!list) return;
    const now = new Date();
    list.replaceChildren();
    const shown = items.filter(r => filter === 'all' || r.type === filter);
    const due = shown.filter(r => isDue(r, now));
    const upcoming = shown.filter(r => !isDue(r, now) && r.active && !r.done)
      .sort((a, b) => ((nextOccurrence(a) || 0) - (nextOccurrence(b) || 0)));
    const rest = shown.filter(r => r.done || !r.active);
    const group = (title, arr) => {
      if (!arr.length) return;
      const h = document.createElement('div'); h.className = 'group-title'; h.textContent = title; list.appendChild(h);
      arr.forEach(r => list.appendChild(card(r, now)));
    };
    group('Para atender', due);
    group('Próximos', upcoming);
    group('Completados / en pausa', rest);
    if (!shown.length) {
      const p = document.createElement('p'); p.className = 'muted';
      p.textContent = items.length ? 'No hay recordatorios de este tipo.' : 'Todavía no tienes recordatorios. ¡Crea el primero arriba! ☁️';
      list.appendChild(p);
    }
    const badge = $('dueBadge');
    const allDue = dueList().length;
    badge.hidden = allDue === 0; badge.textContent = allDue;
  }

  function init() {
    load();
    $('reminderForm').addEventListener('submit', onSubmit);
    $('cancelEdit').addEventListener('click', cancelEdit);
    $('reminderDate').value = defaultDate();
    document.querySelectorAll('#reminderFilter button').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.filter;
      document.querySelectorAll('#reminderFilter button').forEach(x => x.classList.toggle('on', x === b));
      render();
    }));
    render();
    // refresca estados ("pendiente", "próximo") cada 30 s
    setInterval(render, 30000);
  }

  N.reminders = {
    init, load, add, get, markDone, snooze, remove, render, occurrences, nextOccurrence, isDue, dueList,
    all: () => items, replaceAll: list => { items = Array.isArray(list) ? list : []; load2(); changed(); }, TYPES
  };
  function load2() { N.store.save('reminders', items); load(); }
})(window.Nuby);
