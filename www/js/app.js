/* Nuby – arranque, pestañas, ajustes y respaldo */
'use strict';
(function (N) {
  const VERSION = '1.6.0';
  const U = N.util;
  const $ = id => document.getElementById(id);

  function openTab(name) {
    document.querySelectorAll('.tab').forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on); t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === name));
    if (name === 'recordatorios') N.reminders.render();
    if (name === 'salud') { N.health.renderWater(); N.kb.ready().then(N.library.renderStats); }
  }

  function loadSettings() {
    const s = N.store.read('settings', {});
    $('userName').value = s.name || '';
    $('emergencyNumber').value = s.emergencyNumber || '';
    $('waterGoal').value = s.waterGoal || 8;
    $('emergencyInline').textContent = s.emergencyNumber ? ' (' + s.emergencyNumber + ')' : '';
  }

  function saveSettings() {
    const s = N.store.read('settings', {});
    s.name = $('userName').value.trim().slice(0, 30);
    s.emergencyNumber = $('emergencyNumber').value.trim().slice(0, 20);
    s.waterGoal = Math.max(1, Math.min(20, parseInt($('waterGoal').value, 10) || 8));
    N.store.save('settings', s);
    loadSettings(); N.health.renderWater();
    U.toast('💾 Ajustes guardados');
    N.mascot.express('feliz', s.name ? '¡Gracias, ' + s.name + '! 💙' : '¡Listo! 💙');
  }

  async function exportData() {
    const data = {
      app: 'nuby', version: VERSION, exported: new Date().toISOString(),
      // la configuración de IA (dirección y código) no se incluye en el respaldo por seguridad
      reminders: N.reminders.all(), settings: N.store.read('settings', {}),
      history: N.store.read('history', []), water: N.store.read('water', {}), nextNid: N.store.read('nextNid', 1)
    };
    const txt = JSON.stringify(data);
    $('backupText').value = txt;
    try { await navigator.clipboard.writeText(txt); U.toast('📋 Respaldo copiado. Pégalo en una nota segura.'); }
    catch (e) { $('backupText').select(); U.toast('Selecciona el texto y cópialo manualmente.'); }
  }

  function importData() {
    let data;
    try { data = JSON.parse($('backupText').value.trim()); } catch (e) { U.toast('⚠️ El texto no es un respaldo válido.'); return; }
    if (!data || data.app !== 'nuby' || !Array.isArray(data.reminders)) { U.toast('⚠️ No parece un respaldo de Nuby.'); return; }
    if (!window.confirm('Esto reemplazará tus recordatorios y ajustes actuales. ¿Continuar?')) return;
    if (data.settings) N.store.save('settings', data.settings);
    if (Array.isArray(data.history)) N.store.save('history', data.history);
    if (data.water) N.store.save('water', data.water);
    if (data.nextNid) N.store.save('nextNid', data.nextNid);
    N.reminders.replaceAll(data.reminders);
    loadSettings(); N.health.renderWater();
    U.toast('✅ Respaldo restaurado (' + data.reminders.length + ' recordatorios)');
  }

  function registerServiceWorker() {
    // En el APK no hace falta (los archivos ya están dentro de la app) y podría dejar versiones viejas en caché.
    if (N.notify.isNative()) return;
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }

  async function init() {
    N.store.migrateV1();
    N.mascot.init();
    N.health.init();
    N.library.init();
    N.reminders.init();
    N.ai.init();
    N.chat.init();
    loadSettings();

    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => openTab(t.dataset.tab)));
    $('saveSettings').addEventListener('click', saveSettings);
    $('exportData').addEventListener('click', exportData);
    $('importData').addEventListener('click', importData);
    $('clearChat').addEventListener('click', () => { if (window.confirm('¿Borrar toda la conversación?')) { N.chat.clear(); openTab('chat'); } });
    $('testNotification').addEventListener('click', () => N.notify.test());

    const native = N.notify.isNative();
    N.ai.updateBadge();
    $('versionInfo').textContent = 'Nuby ' + VERSION + (native ? ' · Android' : ' · Web');

    registerServiceWorker();
    // carga la biblioteca médica en segundo plano (sin bloquear la interfaz)
    setTimeout(() => N.kb.ready().then(N.library.renderStats), 1200);
    await N.notify.init();

    const nm = N.store.read('settings', {}).name;
    N.mascot.express('saludando', nm ? '¡Hola, ' + nm + '! ☁️💙' : '¡Hola! Soy Nuby ☁️💙', 3000);
    const due = N.reminders.dueList();
    if (due.length) N.mascot.express('recordatorio', 'Tienes ' + due.length + ' recordatorio(s) pendiente(s) ⏰', 5000);
  }

  N.app = { openTab, loadSettings, VERSION };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.Nuby);
