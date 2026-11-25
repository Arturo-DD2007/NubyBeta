/* Nuby – conversación con IA (Gemini) a través de TU servidor intermediario (Cloudflare Worker).
 * La app nunca conoce la clave de Gemini: solo la dirección del Worker y un código de acceso,
 * que escribes en Ajustes y se guardan en este teléfono (no en el APK ni en GitHub).
 */
'use strict';
(function (N) {
  const U = N.util;
  const TIMEOUT = 25000;
  const $ = id => document.getElementById(id);

  function cfg() {
    const s = N.store.read('ai', {});
    return {
      enabled: !!s.enabled, consent: !!s.consent,
      url: String(s.url || '').trim().replace(/\/+$/, ''), token: String(s.token || '')
    };
  }

  function enabled() {
    const c = cfg();
    return c.enabled && c.consent && /^https:\/\//.test(c.url) && c.token.length >= 8 && navigator.onLine !== false;
  }

  async function call(path, options) {
    const c = cfg();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(c.url + path, Object.assign({
        signal: ctrl.signal, cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Nuby-Token': c.token }
      }, options || {}));
      let data = {};
      try { data = await res.json(); } catch (e) { data = {}; }
      if (!res.ok) { const err = new Error(data.message || ('HTTP ' + res.status)); err.code = data.error || 'http'; err.status = res.status; throw err; }
      return data;
    } catch (e) {
      if (e.name === 'AbortError') { const err = new Error('La IA tardó demasiado.'); err.code = 'timeout'; throw err; }
      if (!e.code) { const err = new Error('Sin conexión con el servidor de Nuby.'); err.code = 'network'; throw err; }
      throw e;
    } finally { clearTimeout(t); }
  }

  /** history: [{role:'user'|'bot', text}] (los últimos mensajes, el último es del usuario) */
  async function ask(history) {
    const now = new Date();
    const context = {
      name: (N.store.read('settings', {}).name || '').slice(0, 30),
      now: now.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) + ', ' + U.pad(now.getHours()) + ':' + U.pad(now.getMinutes())
    };
    const messages = history.filter(m => m && !m.urgent && !m.private && typeof m.text === 'string').slice(-12)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'bot', text: m.text.slice(0, 1000) }));
    const data = await call('/chat', { method: 'POST', body: JSON.stringify({ messages, context }) });
    if (!data || typeof data.reply !== 'string' || !data.reply.trim()) { const e = new Error('Respuesta vacía'); e.code = 'empty'; throw e; }
    return { text: data.reply.trim(), mood: (N.mascot.EXPRESSIONS || []).includes(data.mood) ? data.mood : 'principal', model: data.model };
  }

  function setStatus(msg) { const el = $('aiStatus'); if (el) el.textContent = msg; }

function updateBadge() {
    const activo = enabled();

    // Indicador superior de la aplicación.
    const st = $('appStatus');

    if (st) {
      const base = N.notify && N.notify.isNative()
        ? 'App Android'
        : 'Web';

      st.textContent = activo
        ? '● ' + base + ' · IA Gemini activada ✨'
        : '● ' + base + ' · Modo local';
    }

    // Indicador debajo del chat.
    const chatHint = $('chatHint');

    if (chatHint) {
      chatHint.textContent = activo
        ? '✨ IA Gemini activada. Las conversaciones generales pueden usar inteligencia artificial. Los temas médicos y recordatorios se manejan localmente.'
        : '☁️ Modo local: respuestas programadas sin IA. Puedes activar Gemini desde Ajustes.';

      // Color visual del indicador.
      chatHint.style.color = activo
        ? '#80e4bb'
        : '#a9b8d0';
    }
  }

  function load() {
    const c = cfg();
    $('aiEnabled').checked = c.enabled;
    $('aiConsent').checked = c.consent;
    $('aiUrl').value = c.url;
    $('aiToken').value = c.token;
    updateBadge();
  }

  function save(silent) {
    const url = $('aiUrl').value.trim().replace(/\/+$/, '');
    const token = $('aiToken').value.trim();
    let en = $('aiEnabled').checked;
    const consent = $('aiConsent').checked;
    if (en && !consent) { en = false; $('aiEnabled').checked = false; U.toast('Para activar la IA, acepta primero el aviso de privacidad.'); }
    if (en && !/^https:\/\/[^\s/]+/.test(url)) { en = false; $('aiEnabled').checked = false; U.toast('Escribe la dirección https:// de tu Worker.'); }
    if (en && token.length < 8) { en = false; $('aiEnabled').checked = false; U.toast('El código de acceso debe tener al menos 8 caracteres.'); }
    N.store.save('ai', { enabled: en, consent, url, token });
    updateBadge();
    if (!silent) { setStatus(en ? '✨ IA activada. Usa "Probar conexión" para verificar.' : 'IA desactivada: Nuby responde en modo local.'); U.toast('💾 Ajustes de IA guardados'); }
  }

  async function test() {
    save(true);
    const c = cfg();
    if (!c.url || !c.token) { setStatus('Completa la dirección del Worker y el código de acceso.'); return; }
    setStatus('⏳ Probando conexión con tu servidor y con Gemini…');
    try {
      const d = await call('/health?deep=1');
      setStatus('✅ ¡Conectado! Modelo en uso: ' + (d.model || '?') + (c.enabled ? '' : '. Activa la casilla "Usar IA" para conversar con ella.'));
      N.mascot.express('emocionado', '¡Ya puedo conversar mejor contigo! ✨');
    } catch (e) {
      const hints = {
        unauthorized: 'El código de acceso no coincide con el secreto NUBY_TOKEN del Worker.',
        not_configured: 'Faltan secretos en Cloudflare (GEMINI_API_KEY y NUBY_TOKEN).',
        origin: 'El Worker no acepta este origen. Añade la dirección de tu web a ALLOWED_ORIGINS.',
        network: 'No se pudo contactar el Worker: revisa la dirección e internet.',
        bad_key: 'Google dice que la clave de Gemini no es válida.',
        model: 'Ningún modelo de Gemini está disponible para tu cuenta. Revisa GEMINI_MODEL en el Worker.',
        quota: 'Se agotó la cuota gratuita por ahora. Prueba más tarde.',
        region: 'Gemini no está disponible desde la región del servidor.'
      };
      setStatus('❌ ' + (hints[e.code] || e.message));
    }
  }

  function generateToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const tok = 'nuby-' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    $('aiToken').value = tok;
    try { navigator.clipboard.writeText(tok).then(() => U.toast('🔑 Código generado y copiado. Pégalo como secreto NUBY_TOKEN en Cloudflare.', 5000)); }
    catch (e) { U.toast('🔑 Código generado. Cópialo para Cloudflare.'); }
  }

  function init() {
    load();
    $('aiSave').addEventListener('click', () => save(false));
    $('aiTest').addEventListener('click', test);
    $('aiGenToken').addEventListener('click', generateToken);
    $('aiShowToken').addEventListener('click', () => { const i = $('aiToken'); i.type = i.type === 'password' ? 'text' : 'password'; });
    window.addEventListener('online', updateBadge);
    window.addEventListener('offline', updateBadge);
    setStatus(enabled() ? '✨ IA activada.' : 'Modo local (sin IA).');
  }

  N.ai = { init, enabled, ask, updateBadge };
})(window.Nuby);
