/* Nuby – notificaciones locales
 * Android (APK con Capacitor): usa el plugin nativo LocalNotifications. Las alarmas quedan
 *   registradas en el sistema, así que suenan aunque Nuby esté cerrada, y se restauran al reiniciar.
 * Web: solo puede avisar mientras la página está abierta (no hay servidor push).
 */
'use strict';
(function (N) {
  const U = N.util;
  const CHANNEL = 'nuby_recordatorios';
  const ACTION_TYPE = 'NUBY_REMINDER';
  const DAILY_WINDOW_DAYS = 30;     // se programan los próximos 30 días y se renuevan al abrir Nuby
  const WEEKLY_WINDOW_DAYS = 120;
  const MAX_TOTAL = 400;            // Android admite ~500 alarmas por app
  const TEST_ID = 2147480000;

  const $ = id => document.getElementById(id);
  let state = { native: false, granted: false, exact: null };
  let webTimers = [];
  let syncChain = Promise.resolve();

  function plugin() {
    const C = window.Capacitor;
    if (!C) return null;
    // En el APK, el puente nativo de Capacitor crea Capacitor.Plugins.LocalNotifications
    // (no hace falta empaquetar @capacitor/core). En la web ese objeto no existe.
    const isNative = typeof C.isNativePlatform === 'function' ? C.isNativePlatform()
      : (typeof C.getPlatform === 'function' ? C.getPlatform() !== 'web' : true);
    return isNative && C.Plugins && C.Plugins.LocalNotifications ? C.Plugins.LocalNotifications : null;
  }

  function setStatus(msg) { const el = $('notificationStatus'); if (el) el.textContent = msg; }
  function isReady() { return state.granted; }

  function updateUi() {
    const btn = $('enableNotifications');
    if (btn) { btn.textContent = state.granted ? 'Revisar' : 'Activar'; }
    const exactRow = $('exactRow');
    if (exactRow) exactRow.hidden = !(state.native && state.granted && state.exact === 'denied');
  }

  /* ------------ Android nativo ------------ */
  async function nativeInit(P) {
    try {
      await P.createChannel({
        id: CHANNEL, name: 'Recordatorios de Nuby', description: 'Medicamentos, tareas y actividades',
        importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#67C9EF'
      });
    } catch (e) { console.warn('createChannel', e); }
    try {
      await P.registerActionTypes({
        types: [{ id: ACTION_TYPE, actions: [{ id: 'done', title: '✓ Hecho' }, { id: 'snooze', title: '⏰ +10 min' }] }]
      });
    } catch (e) { console.warn('registerActionTypes', e); }
    try {
      P.addListener('localNotificationActionPerformed', ev => handleAction(ev));
      P.addListener('localNotificationReceived', n => {
        const title = (n && (n.body || n.title)) || 'Recordatorio';
        U.toast('🔔 ' + title, 5000);
        N.mascot.express('recordatorio', '¡Hora de: ' + title + '! ⏰', 6000);
        N.reminders.render();
      });
    } catch (e) { console.warn('addListener', e); }
    await refreshPermission(P);
  }

  function handleAction(ev) {
    const n = (ev && ev.notification) || {};
    const extra = n.extra || {};
    const rid = extra.rid;
    if (ev.actionId === 'done' && rid) {
      N.reminders.markDone(rid);
      U.toast('✅ Marcado como hecho');
      N.mascot.express('confirmando', '¡Bien hecho! 🎉');
    } else if (ev.actionId === 'snooze' && rid) {
      const until = N.reminders.snooze(rid, 10);
      if (until) U.toast('⏰ Te aviso otra vez a las ' + U.pad(until.getHours()) + ':' + U.pad(until.getMinutes()));
    } else {
      N.app && N.app.openTab('recordatorios');
    }
  }

  async function refreshPermission(P) {
    try {
      const p = await P.checkPermissions();
      state.granted = p.display === 'granted';
    } catch (e) { state.granted = false; }
    if (state.granted && typeof P.checkExactNotificationSetting === 'function') {
      try { const ex = await P.checkExactNotificationSetting(); state.exact = ex.exact_alarm; } catch (e) { state.exact = null; }
    }
    updateUi();
  }

  function buildNotifications() {
    const now = new Date();
    const list = [];
    for (const r of N.reminders.all()) {
      if (!r.active || r.done) continue;
      const days = r.repeat === 'weekly' ? WEEKLY_WINDOW_DAYS : DAILY_WINDOW_DAYS;
      const until = new Date(now.getTime() + days * 86400000);
      const occ = N.reminders.occurrences(r, now, until, 60).slice(0, 60);
      const t = N.reminders.TYPES[r.type];
      const base = {
        title: t.emoji + ' Nuby te recuerda', body: r.title + (r.notes ? ' · ' + r.notes : ''),
        channelId: CHANNEL, smallIcon: 'ic_stat_nuby', iconColor: '#67C9EF',
        actionTypeId: ACTION_TYPE, autoCancel: true
      };
      occ.forEach((d, k) => {
        // si está pospuesto, se salta la ocurrencia que cae dentro del aplazamiento
        if (r.snoozeAt && r.snoozeAt > now.getTime() && d.getTime() <= r.snoozeAt) return;
        list.push(Object.assign({}, base, {
          id: r.nid * 64 + k, schedule: { at: d, allowWhileIdle: true },
          extra: { nuby: true, rid: r.id }
        }));
      });
      if (r.snoozeAt && r.snoozeAt > now.getTime()) {
        list.push(Object.assign({}, base, {
          id: r.nid * 64 + 63, title: '⏰ Nuby (pospuesto)', schedule: { at: new Date(r.snoozeAt), allowWhileIdle: true },
          extra: { nuby: true, rid: r.id }
        }));
      }
    }
    list.sort((a, b) => a.schedule.at - b.schedule.at);
    return list.slice(0, MAX_TOTAL);
  }

  async function nativeSync(P) {
    await refreshPermission(P);
    if (!state.granted) { setStatus('Desactivadas. Pulsa "Activar" para recibir avisos con Nuby cerrada.'); return; }
    // 1) cancelar lo que Nuby había programado
    const ids = new Set(N.store.read('scheduledIds', []));
    try {
      const pending = await P.getPending();
      (pending.notifications || []).forEach(n => {
        if ((n.extra && n.extra.nuby) || ids.has(n.id)) { if (n.id !== TEST_ID) ids.add(n.id); }
      });
    } catch (e) { /* seguimos con los ids guardados */ }
    ids.delete(TEST_ID);
    if (ids.size) {
      try { await P.cancel({ notifications: [...ids].map(id => ({ id })) }); } catch (e) { console.warn('cancel', e); }
    }
    // 2) programar de nuevo
    const list = buildNotifications();
    if (list.length) {
      try {
        await P.schedule({ notifications: list });
      } catch (e) {
        N.store.save('scheduledIds', []);
        setStatus('⚠️ No se pudieron programar los avisos: ' + (e && e.message ? e.message : e));
        return;
      }
    }
    N.store.save('scheduledIds', list.map(n => n.id));
    const remindersCount = new Set(list.map(n => n.extra.rid)).size;
    let msg = '✅ Activadas. ' + (list.length ? list.length + ' aviso(s) programado(s) para ' + remindersCount + ' recordatorio(s).' : 'No hay avisos pendientes.');
    if (state.exact === 'denied') msg += ' Pueden llegar con algunos minutos de retraso.';
    setStatus(msg);
  }

  async function nativeRequest(P) {
    try {
      let p = await P.checkPermissions();
      if (p.display !== 'granted') p = await P.requestPermissions();
      if (p.display !== 'granted') {
        state.granted = false; updateUi();
        setStatus('Permiso denegado. Ve a Ajustes → Aplicaciones → Nuby → Notificaciones y actívalas.');
        return;
      }
      state.granted = true;
      await refreshPermission(P);
      if (state.exact === 'denied') U.toast('Último paso: toca "Permitir" para avisos a la hora exacta ⏱️', 5000);
      await sync();
      N.mascot.express('confirmando', '¡Listo! Te avisaré aunque cierres la app 🔔');
    } catch (e) { setStatus('No se pudo solicitar permiso: ' + (e && e.message ? e.message : e)); }
  }

  async function openExactSettings() {
    const P = plugin();
    if (!P || typeof P.changeExactNotificationSetting !== 'function') { U.toast('Esta versión no permite abrir ese ajuste.'); return; }
    try { const r = await P.changeExactNotificationSetting(); state.exact = r && r.exact_alarm ? r.exact_alarm : state.exact; }
    catch (e) { U.toast('Abre Ajustes → Aplicaciones → Nuby → Alarmas y recordatorios'); }
    await sync();
  }

  /* ------------ Web (solo con la página abierta) ------------ */
  function webSupported() { return 'Notification' in window && window.isSecureContext; }

  async function showWebNotification(title, body) {
    U.toast('🔔 ' + body, 6000);
    N.mascot.express('recordatorio', '¡Hora de: ' + body + '! ⏰', 6000);
    if (!webSupported() || Notification.permission !== 'granted') return;
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) { await reg.showNotification(title, { body, icon: 'img/icon-192.png', badge: 'img/icon-192.png', tag: 'nuby-' + Date.now() }); return; }
      new Notification(title, { body, icon: 'img/icon-192.png' });
    } catch (e) { /* algunos navegadores móviles solo permiten notificaciones vía service worker */ }
  }

  function webSync() {
    webTimers.forEach(clearTimeout); webTimers = [];
    const now = new Date();
    const until = new Date(now.getTime() + 24 * 3600000);
    for (const r of N.reminders.all()) {
      const t = N.reminders.TYPES[r.type];
      const times = N.reminders.occurrences(r, now, until, 10).map(d => d.getTime());
      if (r.snoozeAt && r.snoozeAt > now.getTime()) times.push(r.snoozeAt);
      times.forEach(ts => {
        webTimers.push(setTimeout(() => {
          showWebNotification(t.emoji + ' Nuby te recuerda', r.title);
          N.reminders.render();
        }, ts - Date.now()));
      });
    }
    state.granted = webSupported() && Notification.permission === 'granted';
    updateUi();
    if (!webSupported()) setStatus('Versión web: avisos dentro de la página mientras esté abierta. Para avisos con la app cerrada instala el APK.');
    else if (state.granted) setStatus('Web: avisos activados solo mientras Nuby esté abierta. Para avisos con la app cerrada, usa el APK.');
    else setStatus('Web: pulsa "Activar" para permitir avisos mientras la página esté abierta.');
  }

  async function webRequest() {
    if (!webSupported()) { U.toast('Este navegador no permite notificaciones aquí. Instala el APK.'); return; }
    try { await Notification.requestPermission(); } catch (e) {}
    webSync();
  }

  /* ------------ API pública ------------ */
  function sync() {
    const P = plugin();
    syncChain = syncChain.then(() => (P ? nativeSync(P) : webSync())).catch(e => console.warn('sync', e));
    return syncChain;
  }

  function request() { const P = plugin(); return P ? nativeRequest(P) : webRequest(); }

  async function test() {
    const P = plugin();
    const at = new Date(Date.now() + 60000);
    if (P) {
      await refreshPermission(P);
      if (!state.granted) { U.toast('Primero activa las notificaciones en la pestaña Avisos.'); return; }
      try {
        await P.schedule({ notifications: [{
          id: TEST_ID, title: '☁️ Prueba de Nuby', body: '¡Funciona! Así te avisaré de tus recordatorios.',
          channelId: CHANNEL, smallIcon: 'ic_stat_nuby', iconColor: '#67C9EF',
          schedule: { at, allowWhileIdle: true }, extra: { nuby: true, test: true }
        }] });
        U.toast('🔔 Aviso de prueba en 1 minuto. Puedes cerrar Nuby para comprobarlo.', 5000);
      } catch (e) { U.toast('Error: ' + (e && e.message ? e.message : e)); }
    } else {
      setTimeout(() => showWebNotification('☁️ Prueba de Nuby', '¡Funciona! (versión web)'), 60000);
      U.toast('🔔 Aviso de prueba en 1 minuto (deja la página abierta).', 5000);
    }
  }

  function hintEnable() { U.toast('💡 Activa las notificaciones (botón "Activar") para recibir este aviso.', 4500); }

  async function init() {
    const P = plugin();
    state.native = !!P;
    $('enableNotifications').addEventListener('click', request);
    $('enableExact').addEventListener('click', openExactSettings);
    if (P) await nativeInit(P);
    await sync();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { N.reminders.render(); sync(); }
    });
  }

  N.notify = { init, sync, request, test, isReady, hintEnable, isNative: () => !!plugin() };
})(window.Nuby);
