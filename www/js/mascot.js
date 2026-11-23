/* Nuby – mascota 2D animada: 15 expresiones, parpadeo, flotar, saltar, dormir y reacciones.
 * Todo local (CSS + JavaScript). Imágenes en www/assets/nuby/.
 */
'use strict';
(function (N) {
  const BASE = 'assets/nuby/';
  // nombre → { etiqueta, animación, partículas, ¿tiene fotograma de parpadeo? }
  const EXPR = {
    principal:    { label: '😊 Aquí contigo',        anim: '',        fx: null,                  blink: true },
    feliz:        { label: '😄 Muy feliz',            anim: 'a-jump',  fx: ['💙', '✨', '💖'],    blink: false },
    emocionado:   { label: '🤩 ¡Emocionado!',         anim: 'a-jump2', fx: ['⭐', '✨', '🎉', '💫'], blink: false },
    pensando:     { label: '🤔 Pensando…',            anim: 'a-think', fx: ['💭'],                blink: true },
    sorprendido:  { label: '😮 ¡Sorprendido!',        anim: 'a-pop',   fx: ['❗'],                blink: true },
    triste:       { label: '😢 Un poquito triste',    anim: 'a-sad',   fx: ['💧'],                blink: true },
    preocupado:   { label: '😟 Preocupado por ti',    anim: 'a-shiver', fx: ['💧'],               blink: true },
    enfermizo:    { label: '🤒 Te acompaño',          anim: 'a-sad',   fx: ['🌡️'],               blink: false },
    saludable:    { label: '💪 ¡Saludable!',          anim: 'a-jump',  fx: ['💧', '💚', '✨'],    blink: true },
    medico:       { label: '🩺 Modo salud',           anim: 'a-nod',   fx: ['💗'],                blink: true },
    durmiendo:    { label: '💤 Durmiendo',            anim: 'a-sleep', fx: ['💤', 'z', 'Z'],      blink: false },
    saludando:    { label: '👋 ¡Hola!',               anim: 'a-wave',  fx: ['👋', '✨'],          blink: true },
    recordatorio: { label: '⏰ ¡Recordatorio!',       anim: 'a-ring',  fx: ['🔔', '⏰'],          blink: false },
    confirmando:  { label: '✅ ¡Hecho!',              anim: 'a-jump',  fx: ['✅', '🎉', '✨'],    blink: false },
    confundido:   { label: '😵‍💫 No entendí',        anim: 'a-wobble', fx: ['❓', '❔'],         blink: false }
  };
  // Compatibilidad con los estados anteriores
  const LEGACY = { idle: 'principal', happy: 'feliz', thinking: 'pensando', sad: 'preocupado', alert: 'preocupado', sleepy: 'principal', sleeping: 'durmiendo' };
  const ANIMS = ['a-jump', 'a-jump2', 'a-think', 'a-pop', 'a-sad', 'a-shiver', 'a-nod', 'a-sleep', 'a-wave', 'a-ring', 'a-wobble', 'a-alert'];
  const SLEEP_AFTER = 90000;        // se duerme tras 90 s sin interacción
  const SLEEP_AFTER_NIGHT = 45000;  // de noche, antes

  const TAP = [
    ['feliz', '¡Jiji, me haces cosquillas! ☁️'], ['emocionado', '¡Abrazo de nube! 🤗'], ['saludable', '¿Ya tomaste agua hoy? 💧'],
    ['feliz', 'Eres muy importante 💙'], ['saludando', '¡Holi holi! 👋'], ['emocionado', '¡Boing boing! ✨'], ['sorprendido', '¡Uy! ¿Me llamabas? 😮']
  ];

  let root, body, img, blinkImg, speechEl, moodEl, fxEl;
  let current = 'principal', resetTimer, blinkTimer, idleTimer, lastAnimTimer;
  const loaded = {}, failed = {};

  const src = name => BASE + name + '.png';
  const blinkSrc = name => BASE + 'parpadeo/' + name + '.png';
  const isNight = () => { const h = new Date().getHours(); return h >= 22 || h < 6; };

  /* ---------- Precarga y verificación de imágenes ---------- */
  function preload() {
    const jobs = [];
    Object.keys(EXPR).forEach(name => {
      const list = [src(name)].concat(EXPR[name].blink ? [blinkSrc(name)] : []);
      list.forEach(url => jobs.push(new Promise(resolve => {
        const i = new Image();
        i.onload = () => { loaded[url] = i; resolve(true); };
        i.onerror = () => { failed[url] = true; console.warn('Nuby: no se pudo cargar', url); resolve(false); };
        i.src = url;
      })));
    });
    return Promise.all(jobs).then(r => ({ total: r.length, ok: r.filter(Boolean).length, failed: Object.keys(failed) }));
  }

  /* ---------- Expresiones ---------- */
  function restartAnim(cls) {
    ANIMS.forEach(a => body.classList.remove(a));
    void body.offsetWidth;            // reinicia la animación aunque se repita
    if (cls) body.classList.add(cls);
  }

  function show(name) {
    if (!EXPR[name] || failed[src(name)]) name = 'principal';
    current = name;
    img.src = src(name);
    img.alt = 'Nuby ' + name;
    blinkImg.classList.remove('on');
    blinkImg.hidden = !EXPR[name].blink || !!failed[blinkSrc(name)];
    if (!blinkImg.hidden) blinkImg.src = blinkSrc(name);
    root.dataset.expr = name;
    // pequeño "pop" al cambiar de cara
    img.classList.remove('swap'); void img.offsetWidth; img.classList.add('swap');
  }

  /**
   * Cambia la expresión.
   * @param {string} name  expresión (o estado antiguo: happy, thinking, sad, alert…)
   * @param {string} [speech] texto del globo
   * @param {number} [hold] ms antes de volver a la cara normal (0 = quedarse)
   * @param {object} [opt] { alert:true } agita a Nuby (emergencias)
   */
  function express(name, speech, hold, opt) {
    if (!root) return;
    name = LEGACY[name] || name;
    if (!EXPR[name]) name = 'principal';
    clearTimeout(resetTimer);
    show(name);
    const e = EXPR[name];
    restartAnim(opt && opt.alert ? 'a-alert' : e.anim);
    moodEl.textContent = e.label;
    if (speech) speechEl.textContent = speech;
    burst(name);
    if (name !== 'principal' && name !== 'durmiendo' && hold !== 0) {
      resetTimer = setTimeout(() => { show('principal'); restartAnim(''); moodEl.textContent = EXPR.principal.label; }, hold || 3600);
    }
    poke(true);
  }

  // API anterior (otros módulos la usan)
  function setMood(mood, speech, hold) { express(mood, speech, hold, mood === 'alert' ? { alert: true } : null); }
  function say(text) { if (speechEl) speechEl.textContent = text; }

  function burst(name) {
    const set = EXPR[name] && EXPR[name].fx;
    if (!set || !fxEl) return;
    const n = name === 'emocionado' || name === 'confirmando' ? 7 : name === 'feliz' || name === 'saludable' ? 5 : 3;
    const falling = name === 'triste' || name === 'preocupado';
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.className = 'particle' + (falling ? ' drop' : '');
      p.textContent = set[Math.floor(Math.random() * set.length)];
      p.style.left = (22 + Math.random() * 56) + '%';
      p.style.setProperty('--dx', (Math.random() * 90 - 45) + 'px');
      p.style.animationDelay = (i * 0.16) + 's';
      fxEl.appendChild(p);
      setTimeout(() => p.remove(), 3000 + i * 160);
    }
  }

  /* ---------- Parpadeo ---------- */
  function scheduleBlink() {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => {
      if (!blinkImg.hidden && current !== 'durmiendo') {
        blinkImg.classList.add('on');
        setTimeout(() => blinkImg.classList.remove('on'), 130);
        if (Math.random() < 0.25) setTimeout(() => { blinkImg.classList.add('on'); setTimeout(() => blinkImg.classList.remove('on'), 110); }, 290);
      }
      scheduleBlink();
    }, 2200 + Math.random() * 4000);
  }

  /* ---------- Dormir cuando no hay actividad ---------- */
  function sleep() {
    clearTimeout(resetTimer);
    express('durmiendo', isNight() ? 'Zzz… Buenas noches 🌙' : 'Zzz… (tócame para despertarme) 💤', 0);
    clearTimeout(idleTimer);   // no reprogramar mientras duerme
  }
  let wokeAt = 0;
  function wake() {
    wokeAt = Date.now();
    express('sorprendido', '¡Ah! Me quedé dormidita… 😳', 1600);
  }
  function poke(fromExpress) {
    if (!fromExpress && current === 'durmiendo') { wake(); return; }
    clearTimeout(idleTimer);
    if (current === 'durmiendo') return;
    idleTimer = setTimeout(sleep, isNight() ? SLEEP_AFTER_NIGHT : SLEEP_AFTER);
  }

  /* ---------- Toque ---------- */
  function onTap(ev) {
    ev.stopPropagation();
    if (current === 'durmiendo') { wake(); return; }
    if (Date.now() - wokeAt < 500) return;   // el mismo toque ya la despertó
    img.classList.remove('squish'); void img.offsetWidth; img.classList.add('squish');
    const name = N.store.read('settings', {}).name;
    let [expr, phrase] = TAP[Math.floor(Math.random() * TAP.length)];
    if (name && Math.random() < 0.35) { expr = 'saludando'; phrase = '¡Hola, ' + name + '! 💙'; }
    express(expr, phrase, 2600);
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
  }

  function init() {
    root = document.getElementById('nuby');
    body = document.getElementById('nubyBody');
    img = document.getElementById('nubyImg');
    blinkImg = document.getElementById('nubyBlink');
    speechEl = document.getElementById('speech');
    moodEl = document.getElementById('mood');
    fxEl = document.getElementById('fx');
    img.addEventListener('error', () => { failed[img.src] = true; if (current !== 'principal') show('principal'); });
    root.addEventListener('click', onTap);
    ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => poke(false), { passive: true }));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poke(false); });
    const ready = preload().then(r => {
      N.mascot.imageReport = r;
      if (r.ok < r.total) console.warn('Nuby: imágenes que no cargaron:', r.failed);
      return r;
    });
    show('principal');
    scheduleBlink();
    poke(true);
    return ready;
  }

  N.mascot = { init, express, setMood, say, sleep, wake, current: () => current, EXPRESSIONS: Object.keys(EXPR) };
})(window.Nuby);
