/* Nuby – chat con respuestas locales (sin API ni IA externa) */
'use strict';
(function (N) {
  const U = N.util;
  const norm = s => String(s || '').normalize('NFC').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const settings = () => N.store.read('settings', {});
  const nameOr = (pre, post) => { const n = settings().name; return n ? (pre || '') + n + (post || '') : ''; };

  let history = [];
  let pending = null;       // recordatorio esperando hora
  let lastFallback = -1;

  // Privacidad por defecto: una consulta relacionada con salud se atiende localmente.
  // Esta lista es conservadora; no sustituye pruebas ni una auditoría de privacidad.
  const PRIVATE_HEALTH = /\b(sintom\w*|signos?|diagnos\w*|enferm\w*|dolor\w*|fiebre|tos|medic\w*|pastilla\w*|farmac\w*|dosis|insulina|paracetamol|antibiotic\w*|tratamient\w*|terapia\w*|diabet\w*|hiperglucem\w*|glucos\w*|sangre|orina|embaraz\w*|hospital\w*|urgencia\w*|emergencia\w*|salud|vitamin\w*|suplement\w*|alergi\w*|infeccion\w*|cancer|depres\w*|ansiedad|suicid\w*|lastimarme|respirar|ahogo|convulsi\w*|recordatori\w*|recuerdame|avisame|presion arterial|me siento mal)\b/;
// Protección adicional para consultas sensibles.
  const PRIVATE_EXTRA =
    /\b(vih|sida|asma|hipertens\w*|hipotens\w*|presion alta|presion baja|cardiac\w*|infarto|ictus|derrame cerebral|epilepsia|migra[nñ]\w*|neumonia|tuberculosis|anemia|colesterol|tiroides|hipotiroid\w*|hipertiroid\w*|artritis|autismo|tdah|trastorno\w*|psiquiatr\w*|psicolog\w*|antidepresiv\w*|vacun\w*|menstru\w*|periodo menstrual|regla menstrual)\b/;

  const isSensitive = text => {
    const t = norm(text);
    return PRIVATE_HEALTH.test(t) || PRIVATE_EXTRA.test(t);
  };

  /* ---------------- Seguridad primero ---------------- */
  const CRISIS = /(suicid|quitarme la vida|matarme|no quiero vivir|no quiero seguir viviendo|hacerme dano|lastimarme|cortarme|acabar con todo|desaparecer para siempre|mejor muert)/;
  const EMERGENCY = /(dolor (muy )?(fuerte |intenso |opresivo )?(en el |del )?pecho|me duele (mucho )?el pecho|presion en el pecho|no puedo respirar|no respira|dificultad (para |al )?respirar|me falta el aire|me ahogo|se ahoga|atragant|desmay|convulsi|cara caida|boca torcida|debilidad repentina|no puedo mover (el|la|un|una)|habla arrastrada|no puedo hablar|perdi la vista|sangrado (abundante|que no para)|sangra mucho|vomito sangre|perdio el conocimiento|inconsciente|no despierta|sobredosis|me trague|se trago|envenen|intoxicad|labios morados|labios azules|reaccion alergica grave|se me cierra la garganta|se le hincha la (cara|lengua|garganta)|quemadura grave|bebe (de|con) .{0,15}(fiebre|no respira)|golpe (fuerte )?en la cabeza)/;

  function emergencyLine() {
    const num = (settings().emergencyNumber || '').trim();
    return num ? 'Llama ahora al ' + num + ' (emergencias).' : 'Llama ahora al número de emergencias de tu zona.';
  }

  /* ---------------- Interpretación de fechas ---------------- */
  const NUMS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50 };
  const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const toNum = w => (/^\d+$/.test(w) ? parseInt(w, 10) : NUMS[w]);

  // Reemplaza el texto encontrado por \0 (misma longitud) para luego extraer el título.
  function blank(s, re, fn) {
    return s.replace(re, function () {
      const m = arguments[0];
      if (fn) fn.apply(null, arguments);
      return '\0'.repeat(m.length);
    });
  }

  function parseWhen(ns) {
    const now = new Date();
    let s = ns, rel = null, hour = null, minute = 0, ampm = null, dayOffset = null, weekday = null, repeat = 'none', found = false;

    s = blank(s, /\b(todos los dias|todos los días|cada dia|diariamente|a diario|diario)\b/g, () => { repeat = 'daily'; });
    s = blank(s, /\b(cada semana|semanalmente|todas las semanas)\b/g, () => { repeat = 'weekly'; });
    s = blank(s, /\b(?:todos los|cada) (lunes|martes|miercoles|jueves|viernes|sabado|domingo)s?\b/g, (m, d) => { repeat = 'weekly'; weekday = WEEKDAYS.indexOf(d); });

    s = blank(s, /\ben\s+(media hora|un cuarto de hora|(\d+|una?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta|cuarenta|cincuenta)\s*(minutos?|mins?|horas?|hrs?|h)\b)/g, (m, all, n, unit) => {
      if (all === 'media hora') rel = 30; else if (all === 'un cuarto de hora') rel = 15;
      else { const v = toNum(n); if (v) rel = /^h/.test(unit) ? v * 60 : v; }
    });

    s = blank(s, /\b(?:de|en|por) la (manana|tarde|noche|madrugada)\b/g, (m, p) => { ampm = p; });
    s = blank(s, /\b(?:a|para) las? (\d{1,2})(?:[:.h](\d{2}))?(?:\s*(am|pm|a\.m\.|p\.m\.|hrs|horas))?\b/g, (m, h, mi, ap) => {
      hour = +h; minute = mi ? +mi : 0; if (ap && /^a/.test(ap)) ampm = ampm || 'am'; if (ap && /^p/.test(ap)) ampm = 'pm'; found = true;
    });
    if (hour === null) s = blank(s, /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/g, (m, h, mi, ap) => {
      hour = +h; minute = mi ? +mi : 0; ampm = /^a/.test(ap) ? 'am' : 'pm'; found = true;
    });
    if (hour === null) s = blank(s, /\b(?:a|al|para el|para la) (mediodia|medianoche)\b/g, (m, w) => { hour = w === 'mediodia' ? 12 : 0; ampm = 'fixed'; found = true; });

    s = blank(s, /\bpasado manana\b/g, () => { dayOffset = 2; });
    s = blank(s, /\bmanana\b/g, () => { dayOffset = 1; });
    s = blank(s, /\b(?:hoy|esta (?:tarde|noche))\b/g, (m) => { dayOffset = 0; if (/tarde|noche/.test(m) && !ampm) ampm = 'pm'; });
    if (weekday === null) s = blank(s, /\b(?:el |este |el proximo |el siguiente )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/g, (m, d) => { weekday = WEEKDAYS.indexOf(d); });

    if (rel !== null) {
      return { date: new Date(now.getTime() + rel * 60000), repeat, masked: s, hasTime: true };
    }
    if (hour !== null && (hour > 23 || minute > 59)) hour = null;

    if (hour !== null) {
      if (ampm === 'pm' || ampm === 'tarde' || ampm === 'noche') { if (hour < 12) hour += 12; if (ampm === 'noche' && hour === 24) hour = 0; }
      if (ampm === 'am' || ampm === 'manana' || ampm === 'madrugada') { if (hour === 12) hour = 0; }
    }
    const hasDay = dayOffset !== null || weekday !== null;
    if (hour === null) return { date: null, repeat, masked: s, hasTime: false, hasDay, dayOffset, weekday };

    let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (dayOffset !== null) d.setDate(d.getDate() + dayOffset);
    else if (weekday !== null) { let add = (weekday - d.getDay() + 7) % 7; d.setDate(d.getDate() + add); if (d <= now) d.setDate(d.getDate() + 7); }
    else if (d <= now) {
      // "a las 8" sin am/pm: si las 8:00 ya pasaron pero las 20:00 no, usa la tarde/noche
      if (!ampm && hour < 12) { const pmDate = new Date(d); pmDate.setHours(hour + 12); if (pmDate > now) d = pmDate; else d.setDate(d.getDate() + 1); }
      else d.setDate(d.getDate() + 1);
    }
    return { date: d, repeat, masked: s, hasTime: found, hasDay };
  }

  const TRIGGER = /\b(?:por favor\s+)?(?:puedes\s+|podrias\s+|quiero que\s+)?(?:recuerdame|recordarme|recuerdeme|me recuerdas|avisame|avisarme|me avisas|ponme un recordatorio|pon(?:er)? un recordatorio|crea(?:r)? un recordatorio|agrega(?:r)? un recordatorio|nuevo recordatorio|programa(?:r)? un aviso|agendame|agenda(?:r)?)\b(?:\s+(?:para|de|que)\b)?/;

  function extractTitle(original, masked) {
    // masked y original tienen la misma longitud (normalización carácter a carácter)
    const src = original.normalize('NFC');
    let out = '';
    for (let i = 0; i < masked.length && i < src.length; i++) out += masked[i] === '\0' ? ' ' : src[i];
    out = out.replace(/\s+/g, ' ').trim()
      .replace(/^(?:que|de|para|a)\s+/i, '')
      .replace(/^(?:que|de|para)\s+/i, '')
      .replace(/[\s,.;:!?¡¿-]+$/g, '').replace(/^[\s,.;:!?¡¿-]+/g, '')
      .replace(/\s+(?:a|el|la|para|de|y)$/i, '');
    return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
  }

  function guessType(ns) {
    if (/(pastilla|medicament|medicina|jarabe|inyecc|insulina|tableta|capsula|gotas|antibiotic|vitamina|remedio|dosis|inhalador)/.test(ns)) return 'med';
    if (/(caminar|ejercicio|correr|yoga|estirar|gimnasio|entrenar|meditar|respirar|pasear|bicicleta|nadar|agua|bailar)/.test(ns)) return 'activity';
    return 'task';
  }

  function createFromChat(title, when, typeHint) {
    const r = N.reminders.add({ type: typeHint, title, date: U.toLocalInput(when.date), repeat: when.repeat });
    if (!r) return ['Uy, no pude guardar ese recordatorio. Prueba desde la pestaña Avisos ⏰', 'confundido'];
    const rep = when.repeat === 'daily' ? ' y luego todos los días' : when.repeat === 'weekly' ? ' y luego cada semana' : '';
    let msg = '✅ ¡Anotado! ' + N.reminders.TYPES[r.type].emoji + ' «' + r.title + '» — te aviso ' + U.formatWhen(when.date) + rep + '.';
    if (r.type === 'med') msg += '\n💊 Recuerda seguir la dosis que te indicó tu médico.';
    if (!N.notify.isReady()) msg += '\n🔔 Ojo: activa las notificaciones en la pestaña Avisos para que te llegue el aviso.';
    msg += '\nPuedes editarlo o borrarlo en la pestaña Avisos.';
    return [msg, 'recordatorio'];
  }

  function handleReminder(raw, ns) {
    const trig = TRIGGER.exec(ns);
    let masked = ns;
    if (trig) masked = ns.slice(0, trig.index) + '\0'.repeat(trig[0].length) + ns.slice(trig.index + trig[0].length);
    const when = parseWhen(masked);
    const title = extractTitle(raw, when.masked);
    const type = guessType(ns);
    if (!title) {
      pending = { stage: 'title', when: when.date ? when : null };
      return ['¡Claro! ⏰ ¿Qué quieres que te recuerde? (Ej.: «tomar la pastilla», «llamar a mamá»)', 'pensando'];
    }
    if (!when.date) {
      pending = { stage: 'time', title, type, repeat: when.repeat };
      return ['¿A qué hora te aviso de «' + title + '»? 🕐\nEj.: «a las 8 de la noche», «en 30 minutos», «mañana a las 9».', 'pensando'];
    }
    pending = null;
    return createFromChat(title, when, type);
  }

  function continuePending(raw, ns) {
    if (/^(no|cancela|cancelar|olvidalo|nada|dejalo)\b/.test(ns)) { pending = null; return ['Está bien, no lo anoto 💙', 'principal']; }
    if (pending.stage === 'title') {
      const title = extractTitle(raw, ns);
      if (pending.when) { const w = pending.when; pending = null; return createFromChat(title, w, guessType(ns)); }
      pending = { stage: 'time', title, type: guessType(ns), repeat: 'none' };
      return ['Perfecto. ¿A qué hora te aviso de «' + title + '»? 🕐', 'pensando'];
    }
    const when = parseWhen(ns);
    if (when.date) {
      if (pending.repeat !== 'none' && when.repeat === 'none') when.repeat = pending.repeat;
      const p = pending; pending = null;
      return createFromChat(p.title, when, p.type);
    }
    return null; // no entendió una hora: seguimos con el chat normal
  }

  /* ---------------- Intenciones ---------------- */
  const JOKES = [
    '¿Qué le dijo una nube a otra? ¡Nos vemos en el cielo! ☁️😄',
    '¿Por qué las nubes nunca pelean? Porque siempre se lo toman con calma… y llueve después. 🌧️',
    '¿Cuál es el colmo de una nube? Tener la cabeza en las nubes. 😆',
    '¿Qué hace una nube con comezón? ¡Se rasca… cielos! ✨',
    '¿Qué le dijo el termómetro al médico? ¡Tengo grados de confianza contigo! 🌡️'
  ];
  const FALLBACKS = [
    '☁️ Todavía estoy aprendiendo y no entendí bien. Prueba con «estoy triste», «tengo tos» o «recuérdame tomar agua a las 5».',
    'Hmm, esa no me la sé 🤔. Puedo conversar, darte consejos generales de bienestar y crear recordatorios. ¿Qué necesitas?',
    'No estoy segura de entender 💭. ¿Me lo dices con otras palabras? También puedes tocar los botones de abajo.',
    '¡Uy! Mi cerebrito de nube no captó eso ☁️. Escribe «ayuda» para ver lo que sé hacer.'
  ];

  const INTENTS = [
    { re: /^(hola|holi|holis|buenas|buenos dias|buenas tardes|buenas noches|hey|saludos|que tal|ola)\b/, mood: 'saludando',
      fn: () => {
        const h = new Date().getHours();
        const g = h < 12 ? '¡Buenos días' : h < 19 ? '¡Buenas tardes' : '¡Buenas noches';
        return pick([g + nameOr(', ') + '! ☁️💙 ¿Cómo te sientes hoy?', '¡Holaaa' + nameOr(', ') + '! ☁️ Qué alegría verte. ¿Cómo estás?', g + '! Soy Nuby 💙 ¿En qué te acompaño?']);
      } },
    { local: true, re: /\b(me llamo|mi nombre es)\s+([a-zñ]+)/, mood: 'feliz',
      fn: (ns, raw) => {
        const m = /\b(?:me llamo|mi nombre es)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/i.exec(raw);
        const name = m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : '';
        if (!name) return '¡Qué lindo nombre! 💙';
        const st = settings(); st.name = name; N.store.save('settings', st); N.app && N.app.loadSettings();
        return '¡Encantada, ' + name + '! ☁️💙 Ya me aprendí tu nombre.';
      } },
    { local: true, re: /\b(como me llamo|sabes mi nombre|cual es mi nombre)\b/, mood: 'feliz',
      fn: () => settings().name ? '¡Te llamas ' + settings().name + '! 💙' : 'Aún no me lo dijiste. Escribe «me llamo …» ☁️' },
    { local: true, re: /\b(que puedes hacer|que sabes hacer|que haces|ayuda|ayudame|funciones|como funcionas|para que sirves)\b/, mood: 'principal',
      fn: () => 'Esto es lo que sé hacer ☁️:\n• 💬 Conversar contigo (modo local sin internet, o más natural con la IA si la activas en Ajustes).\n• 💗 Darte orientación general de bienestar (sin diagnósticos).\n• ⏰ Crear recordatorios: «recuérdame tomar la pastilla a las 8 de la noche todos los días».\n• 📋 Decirte tus pendientes: «¿qué tengo hoy?».\n• 💧 Contar tus vasos de agua: «tomé agua».\n• 🌬️ Respirar contigo: «quiero respirar».' },
    { local: true, re: /\b(que tengo (hoy|pendiente)|mis recordatorios|mis pendientes|mis avisos|que me toca|tengo algo hoy)\b/, mood: 'recordatorio',
      fn: () => {
        const now = new Date(); const end = new Date(now); end.setHours(23, 59, 59, 999);
        const due = N.reminders.dueList();
        const today = [];
        N.reminders.all().forEach(r => N.reminders.occurrences(r, now, end, 5).forEach(d => today.push({ r, d })));
        today.sort((a, b) => a.d - b.d);
        if (!due.length && !today.length) return 'No tienes nada más para hoy 🎉. ¿Quieres crear un recordatorio?';
        let out = '';
        if (due.length) out += '🔔 Pendientes:\n' + due.map(r => '• ' + N.reminders.TYPES[r.type].emoji + ' ' + r.title).join('\n') + '\n';
        if (today.length) out += (out ? '\n' : '') + '📋 Más tarde hoy:\n' + today.map(x => '• ' + U.pad(x.d.getHours()) + ':' + U.pad(x.d.getMinutes()) + ' ' + N.reminders.TYPES[x.r.type].emoji + ' ' + x.r.title).join('\n');
        return out.trim();
      } },
    { local: true, re: /\b(tome|bebi|me tome|ya tome) (un |una |)?(vaso de )?agua\b/, mood: 'saludable',
      fn: () => { N.health.addWater(1); return '¡Glup glup! 💧 Sumé un vaso de agua a tu día.'; } },
    { local: true, re: /\b(respirar|respiracion|relajarme|calmarme|me quiero calmar)\b/, mood: 'saludable',
      fn: () => { N.app && N.app.openTab('salud'); setTimeout(() => { const b = document.getElementById('breathBtn'); if (b && b.textContent === 'Empezar') N.health.toggleBreath(); }, 400); return '🌬️ Vamos juntos: inhala 4 segundos… exhala 6 segundos. Abrí el ejercicio en la pestaña Salud.'; } },
    { re: /\b(chiste|hazme reir|algo gracioso|cuentame algo divertido)\b/, mood: 'emocionado', fn: () => pick(JOKES) },
    { local: true, re: /\b(que hora es|la hora|hora actual)\b/, mood: 'principal',
      fn: () => { const d = new Date(); return '🕐 Son las ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '.'; } },
    { local: true, re: /\b(que dia es|fecha de hoy|que fecha|dia de hoy)\b/, mood: 'principal',
      fn: () => '📅 Hoy es ' + new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.' },
    { re: /\b(gracias|muchas gracias|te lo agradezco|grax)\b/, mood: 'feliz', fn: () => pick(['¡Con mucho cariño! 💙', '¡Para eso estoy! ☁️', 'De nada' + nameOr(', ') + ' 💙 Aquí estaré.']) },
    { re: /\b(adios|chau|chao|hasta luego|nos vemos|me voy|buenas noches nuby)\b/, mood: 'saludando', fn: () => pick(['¡Hasta pronto! Cuídate mucho 💙☁️', '¡Chau' + nameOr(', ') + '! Toma agüita y descansa 💧', 'Nos vemos. Aquí te espero ☁️']) },
    { re: /\b(te quiero|te amo|eres linda|eres lindo|eres tierna|eres tierno|me caes bien)\b/, mood: 'emocionado', fn: () => pick(['¡Awww! Yo también te quiero mucho 💙☁️', '¡Me sonrojo! 😊 Gracias por ser tan lindo/a conmigo.']) },
    { re: /\b(quien eres|como te llamas|tu nombre|que eres)\b/, mood: 'principal', fn: () => '¡Soy Nuby! Una nubecita virtual que te acompaña, te da ánimos y te ayuda a recordar tus cosas ☁️💙' },
    {
      local: true,
      re: /\b(eres (una )?ia|inteligencia artificial|chatgpt|eres un robot|eres real|utilizas gemini|usas gemini|funcionas con gemini)\b/,
      mood: 'principal',
      fn: () =>
        '¡Sí! ☁️💙 Cuando tienes internet y activas la IA, utilizo Gemini ' +
        'para conversar de forma más natural. Pero también tengo un modo ' +
        'local que funciona sin conexión, con respuestas programadas, ' +
        'recordatorios y mi biblioteca médica.'
    },
    { re: /\b(quien te (creo|hizo)|tu creador)\b/, mood: 'feliz', fn: () => 'Me creó alguien que quería cuidar su bienestar y el de los demás 💙' },
    { re: /\b(triste|deprimid|me siento sol[oa]|soledad|llorar|lloro|llorando|desanimad|me siento mal emocionalmente|vacio)\b/, mood: 'preocupado',
      fn: () => pick([
        'Siento mucho que te sientas así 💙. Estoy aquí contigo. ¿Quieres contarme qué pasó?',
        'Abrazo de nube 🤗☁️. Los días grises también pasan. Hablar con alguien de confianza puede aliviar mucho.',
        'Gracias por contármelo 💙. Si esta tristeza dura semanas o te pesa mucho, un profesional de salud mental puede ayudarte. Mientras tanto, ¿probamos una respiración juntos?'
      ]) },
    { re: /\b(enojad|molest|furios|rabia|harto|harta)\b/, mood: 'preocupado', fn: () => 'Es válido sentir enojo 💙. Prueba alejarte un momento, respirar lento y volver cuando estés más calmado/a. ¿Quieres contarme qué pasó?' },
    { re: /\b(aburrid|no se que hacer)\b/, mood: 'principal', fn: () => pick(['¿Y si damos un paseíto de 10 minutos? 🚶', '¡Idea! Estira el cuerpo, toma agua y escucha tu canción favorita 🎵', '¿Quieres un chiste? Escribe «chiste» 😄']) },
    { re: /\b(buenas noticias|buena noticia|aprobe|pase el examen|me ascendieron|consegui (el|un|una)|gane|ganamos|lo logre|lo conseguí|lo consegui|me fue (muy )?bien|me aceptaron|estoy embarazad|voy a ser (mama|papa|tia|tio|abuel)|cumplo anos|es mi cumpleanos|me caso|me gradue)\b/, mood: 'emocionado',
      fn: () => pick(['¡¿En serio?! ¡Qué maravilla! 🎉✨ ¡Felicidades' + nameOr(', ') + '!', '¡Wiii! ¡Esa noticia me hace saltar de alegría! 🤩 Cuéntame más.', '¡Felicitaciones! 🎉 Te lo mereces muchísimo 💙']) },
    { re: /\b(eres (tonta|tonto|fea|feo|inutil|mala|malo)|te odio|no sirves|callate)\b/, mood: 'triste',
      fn: () => pick(['Eso me pone un poquito triste ☁️💧… Pero sigo aquí si me necesitas.', 'Auch… mi corazón de nube se nubló 🌧️. ¿Pasó algo? Puedo intentar ayudarte mejor.']) },
    { re: /\b(me siento (muy |super |re )?(bien|feliz|genial|contento|contenta|alegre)|estoy (muy |super )?(bien|feliz|contento|contenta|alegre)|que bien|me encanta|que lindo|que bonito|maravillos|increible|fue un buen dia|tuve un buen dia)\b/, mood: 'feliz',
      fn: () => pick(['¡Qué alegría! 😄 Tu felicidad me hace flotar más alto ☁️✨', '¡Me encanta escuchar eso! 💙 Sigue así.', '¡Yupi! 😄 Los días bonitos hay que disfrutarlos.']) },
    { re: /^(bien|muy bien|todo bien|genial|excelente|feliz|contento|contenta|super)\b/, mood: 'feliz', fn: () => pick(['¡Me alegra muchísimo! 🎉☁️', '¡Qué bueno! Tu alegría me hace flotar más alto ✨']) },
    { re: /\b(como estas|que tal estas|como te sientes)\b/, mood: 'feliz', fn: () => pick(['¡Esponjosa y feliz! ☁️ ¿Y tú?', 'Flotando de alegría porque me escribiste 💙 ¿Y tú cómo estás?']) },
    { re: /\b(cansad|agotad|sin energia)\b/, mood: 'preocupado', fn: () => 'Parece que necesitas un respiro 💙. Descansar, hidratarte y dormir bien ayuda mucho. Si el cansancio dura semanas sin explicación, coméntalo con un médico.' },
    { local: true, re: /\b(dosis|cuant[oa]s? .{0,30}(tomo|tomar|debo)|que (medicamento|pastilla|remedio|medicina) .{0,20}(tomo|tomar|puedo)|puedo tomar|me recetas|recetame|que me recomiendas tomar|mezclar)/, mood: 'medico',
      fn: () => '💊 No puedo indicar medicamentos, dosis ni combinaciones: eso depende de tu salud y debe decidirlo un médico o farmacéutico. Lo que sí puedo hacer es recordarte las tomas que te indicaron. Ej.: «recuérdame la pastilla a las 8 de la noche todos los días».' },
    { local: true, re: /\b(diagnostic|que enfermedad tengo|que tengo yo|estoy enferm)\b/, mood: 'medico',
      fn: () => 'No puedo diagnosticar 💙. Puedo darte información general en la pestaña Salud, pero si algo te preocupa, consulta con un profesional de salud.' }
  ];

  /* ---------------- Motor de respuesta ---------------- */
  function respond(raw) {
    const ns = norm(raw).trim();
    if (!ns) return null;

    if (CRISIS.test(ns)) {
      pending = null;
      return { text: '💙 Lamento mucho que estés sintiendo tanto dolor. Tu vida importa.\n\nSi estás en peligro o piensas hacerte daño, ' + emergencyLine().charAt(0).toLowerCase() + emergencyLine().slice(1) + ' También puedes buscar la línea de ayuda en crisis de tu país, o pedirle a alguien de confianza que esté contigo ahora mismo.\n\nNo tienes que pasar por esto a solas. ¿Hay alguien a quien puedas llamar o escribir ahora?', mood: 'preocupado', urgent: true };
    }
    if (EMERGENCY.test(ns)) {
      pending = null;
      return { text: '🚨 Esto puede ser una emergencia. ' + emergencyLine() + ' Si puedes, avisa a alguien cercano y no te quedes solo/a. No esperes una respuesta de esta aplicación.', mood: 'alert', urgent: true };
    }

// Orientación local para una consulta personal sobre asma.
    // Las emergencias se comprueban antes de este bloque.
    const consultaPersonalAsma =
      /\b(tengo|padezco|sufro de|me diagnosticaron)\b.{0,45}\basma\b/.test(ns) &&
      /\b(que hago|que puedo hacer|que debo hacer|como me cuido|necesito ayuda)\b/.test(ns);

    if (consultaPersonalAsma) {
      return {
        text:
          '💙 Si tienes asma, es importante seguir el plan de acción ' +
          'que te haya indicado tu médico.\n\n' +
          '• Utiliza tus medicamentos solamente según las indicaciones recibidas.\n' +
          '• Identifica y evita, cuando sea posible, los factores que desencadenan tus síntomas.\n' +
          '• Si tus síntomas empeoran o necesitas tu medicamento de rescate ' +
          'con más frecuencia de lo habitual, busca valoración médica.\n' +
          '• Si tienes dificultad intensa para respirar, no puedes hablar ' +
          'con normalidad o no mejoras siguiendo tu plan de emergencia, ' +
          'busca atención médica urgente.\n\n' +
          'No puedo evaluar tu situación desde el chat ni sustituir ' +
          'la atención de un profesional.',
        mood: 'medico',
        private: true,
        aiOk: false
      };
    }
    
    if (pending) { const r = continuePending(raw, ns); if (r) return { text: r[0], mood: r[1] }; pending = null; }

    if (TRIGGER.test(ns)) { const r = handleReminder(raw, ns); return { text: r[0], mood: r[1] }; }

    // Temas de salud (antes que emociones genéricas como "me siento mal")
    const intentFirst = INTENTS.find(i => i.re.test(ns) && /dosis|diagnostic/.test(i.re.source));
    if (intentFirst) {
      const r = { text: intentFirst.fn(ns, raw), mood: intentFirst.mood };
      if (N.kb && N.kb.status() === 'ready') {
        const hit = N.kb.search(raw, { limit: 3 }).find(x => x.strong);
        if (hit) { r.kb = hit.doc.id; r.text += '\n\n📖 Tengo información educativa sobre «' + hit.doc.t + '» (sin dosis). Toca el botón para verla.'; }
      }
      return r;
    }
    // Acciones locales (agua, respirar, hora, nombre…) primero
    for (const it of INTENTS) {
      if (it.local && !/dosis|diagnostic/.test(it.re.source) && it.re.test(ns)) return { text: it.fn(ns, raw), mood: it.mood };
    }

    // Conversaciones académicas: enviar a Gemini,
    // sin consultar la biblioteca médica.
 // Reconocer preguntas académicas y de programación.
    const hablaDeEstudios =
      /\b(examen|parcial|universidad|colegio|estudiar|estudios|profesor|materia|reprobe|aprobar|calificacion|matematicas|programacion|python|javascript|java|pseint|algoritmo|algoritmos|pseudocodigo|codigo|variable|variables|funcion|funciones|bucle|bucles|for|while|do-while|delphi)\b/.test(ns);

    // Reconocer vocabulario relacionado con salud.
    const hablaDeSalud =
      /\b(sangre|orina|clinico|laboratorio|enfermedad|medicamento|vitamina|diagnostico|sintoma|sintomas|dolor|fiebre|hospital|salud|menstruacion|menstrual|embarazo|tratamiento)\b/.test(ns);

    if (hablaDeEstudios && !hablaDeSalud) {
      return {
        text: '☁️ Estoy aquí para escucharte. ¿Quieres contarme un poco más?',
        mood: 'preocupado',
        aiOk: true
      };
    }
    
    // Detectar conversaciones sobre exámenes académicos.
    // No confundirlas con consultas médicas.
    const examenAcademico =
      /\b(examen|prueba|parcial|materia|universidad|colegio|clase|tarea)\b/.test(ns) &&
      /\b(me fue|reprobe|aprobar|nota|profesor|estudiar|estudie|universidad|colegio|materia|clase|tarea|parcial)\b/.test(ns) &&
      !/\b(sangre|orina|medicamento|medicina|clinico|laboratorio|salud|dolor|sintoma|diagnostico|vitamina|enfermedad|tratamiento|analisis|embarazo)\b/.test(ns);
     
    // Biblioteca médica local.
    // Evitar respuestas médicas para exámenes académicos.
    let kbMiss = null;

    if (!examenAcademico && N.kb) {
      const k = N.kb.answer(raw);

      if (k && !k.notFound) {
        return k;
      }

      kbMiss = k;
    }

    // Buscar temas médicos locales cuando la biblioteca
    // no está disponible y no es una consulta académica.
    if (
      !examenAcademico &&
      (!N.kb || N.kb.status() !== 'ready')
    ) {
      const topic = N.health.findTopic(ns);

      if (topic) {
        N.health.showTopic(topic.id);

        return {
          text: N.health.summary(topic),
          mood: 'medico'
        };
      }
    }
    
    // ¿Pregunta inesperada? → sorprendido. ¿Frase no reconocida? → confundido.
    if (/\?/.test(raw) || /^(que|como|por que|porque|cuando|donde|cual|quien|cuanto|sabes|puedes|has)\b/.test(ns)) {
      return { text: pick(['¡Oh! 😮 Esa pregunta me tomó por sorpresa. Todavía no sé responderla, pero puedo ayudarte con recordatorios, consejos de bienestar o una charla.',
        '¡Uy, qué pregunta! 😮 No tengo esa respuesta en mi cabecita de nube. Prueba con «ayuda» para ver lo que sé hacer.']), mood: 'sorprendido', aiOk: true };
    }
    let i; do { i = Math.floor(Math.random() * FALLBACKS.length); } while (i === lastFallback && FALLBACKS.length > 1);
    lastFallback = i;
    return { text: FALLBACKS[i], mood: 'confundido', aiOk: true };
  }

  /* ---------------- Interfaz ---------------- */
  const $ = id => document.getElementById(id);

  
  // Muestra mensajes normales y bloques de código.
  // Usa textContent para evitar ejecutar HTML recibido de la IA.
  function append(role, text, urgent, ai, kb) {
    const el = document.createElement('div');

    el.className = 'bubble ' + role +
      (urgent ? ' urgent' : '') +
      (ai ? ' ai' : '');

    const contenido = String(text || '');

    // Reconocer bloques Markdown con tres comillas invertidas.
    const patronCodigo = /```([^\r\n`]*)\r?\n([\s\S]*?)```/g;

    let posicion = 0;
    let coincidencia;

    // Agregar texto normal conservando los saltos de línea.
    function agregarTexto(valor) {
      if (!valor) return;

      const parte = document.createElement('span');
      parte.textContent = valor;
      parte.style.whiteSpace = 'pre-wrap';
      parte.style.overflowWrap = 'anywhere';

      el.appendChild(parte);
    }

    // Construir un bloque visual de código seguro.
    function agregarCodigo(lenguaje, codigo) {
      const bloque = document.createElement('div');

      bloque.style.margin = '12px 0';
      bloque.style.borderRadius = '10px';
      bloque.style.overflow = 'hidden';
      bloque.style.background = '#172033';
      bloque.style.border = '1px solid #35435b';

      // Cabecera con lenguaje y botón para copiar.
      const cabecera = document.createElement('div');

      cabecera.style.display = 'flex';
      cabecera.style.justifyContent = 'space-between';
      cabecera.style.alignItems = 'center';
      cabecera.style.gap = '10px';
      cabecera.style.padding = '8px 12px';
      cabecera.style.background = '#243149';

      const etiqueta = document.createElement('span');
      etiqueta.textContent = lenguaje.trim() || 'Código';
      etiqueta.style.fontSize = '12px';
      etiqueta.style.color = '#cbd5e1';

      const copiar = document.createElement('button');
      copiar.type = 'button';
      copiar.textContent = '📋 Copiar';
      copiar.style.cursor = 'pointer';
      copiar.style.padding = '5px 9px';
      copiar.style.borderRadius = '6px';
      copiar.style.border = '1px solid #64748b';
      copiar.style.background = '#334155';
      copiar.style.color = '#ffffff';
      copiar.style.fontSize = '12px';

      copiar.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(codigo);
          copiar.textContent = '✅ Copiado';
        } catch (error) {
          copiar.textContent = 'No se pudo copiar';
        }
      });

      cabecera.appendChild(etiqueta);
      cabecera.appendChild(copiar);

      // Contenido del código.
      const pre = document.createElement('pre');
      const code = document.createElement('code');

      code.textContent = codigo.replace(/^\n+|\n+$/g, '');

      pre.style.margin = '0';
      pre.style.padding = '12px';
      pre.style.overflowX = 'auto';
      pre.style.whiteSpace = 'pre';
      pre.style.fontFamily = 'Consolas, monospace';
      pre.style.fontSize = '13px';
      pre.style.lineHeight = '1.6';
      pre.style.color = '#e2e8f0';

      pre.appendChild(code);
      bloque.appendChild(cabecera);
      bloque.appendChild(pre);

      el.appendChild(bloque);
    }

    // Separar explicaciones y ejemplos de código.
    while ((coincidencia = patronCodigo.exec(contenido)) !== null) {
      agregarTexto(
        contenido.slice(posicion, coincidencia.index)
      );

      agregarCodigo(coincidencia[1], coincidencia[2]);

      posicion = patronCodigo.lastIndex;
    }

    // Mostrar el texto restante.
    agregarTexto(contenido.slice(posicion));

    // Mantener el botón original de la biblioteca médica.
    if (kb) {
      const b = document.createElement('button');

      b.type = 'button';
      b.className = 'kb-open';
      b.textContent = '📖 Ver ficha completa';

      b.addEventListener('click', () => {
        N.library.openFromChat(kb);
      });

      el.appendChild(b);
    }

    $('messages').appendChild(el);
    $('messages').scrollTop = $('messages').scrollHeight;
  }


  function persist() { history = history.slice(-100); N.store.save('history', history); }

  let busy = false;
  let aiErrorShown = 0;
  const BUBBLES = {
    saludando: ['¡Hola, hola! 👋', '¡Qué alegría verte! ☁️'], feliz: ['¡Me encanta conversar contigo! 💙', '¡Yupi! ☁️'],
    emocionado: ['¡Wiii! 🎉', '¡Qué emoción! ✨'], sorprendido: ['¡Oh! 😮'], preocupado: ['Estoy aquí para escucharte 💙'],
    triste: ['Snif… 💧'], medico: ['Cuidemos tu salud 🩺'], enfermizo: ['Cuídate mucho 🤒💙'], saludable: ['¡Así se hace! 💪'],
    recordatorio: ['¡Lo tengo anotado! ⏰'], confirmando: ['¡Listo! ✅'], confundido: ['Mmm… no entendí 😵‍💫'],
    pensando: ['Pensando contigo… 💭'], principal: ['Aquí estoy contigo 💙']
  };

  function finish(res, typing) {
    typing.remove();
    append('bot', res.text, res.urgent, res.ai, res.kb);
    history.push({ role: 'bot', text: res.text, urgent: !!res.urgent, ai: !!res.ai,
      private: !!res.private, aiAllowed: !!res.ai && !isSensitive(res.text), kb: res.kb || undefined }); persist();
    const ex = res.mood || 'principal';
    const bubble = res.urgent ? 'Busca ayuda ahora mismo 💙' : pick(BUBBLES[ex] || BUBBLES.principal);
    if (res.urgent) N.mascot.express('preocupado', bubble, 9000, { alert: true });
    else N.mascot.express(ex, bubble, ex === 'principal' ? 0 : 4000);
    busy = false;
  }

  function send(text) {
    text = String(text || '').trim().slice(0, 500);
    if (!text || busy) return;
    append('user', text);
    history.push({ role: 'user', text }); persist();
    busy = true;
    const kbReady = N.kb ? Promise.race([N.kb.ready(), new Promise(r => setTimeout(r, 4000))]) : Promise.resolve();
    kbReady.then(() => { busy = false; reply(text); });
  }


  // Respuestas generales cuando Gemini no está disponible.
  function respuestaSinConexion(texto) {
    const ns = norm(texto).trim();

    if (/\b(como estas|que tal estas|como te va)\b/.test(ns)) {
      return {
        text: '¡Holaaa! ☁️💙 Estoy muy bien, feliz de acompañarte. ¿Y tú cómo estás?',
        mood: 'feliz'
      };
    }

    if (/^(hola|holi|holis|buenas|buenos dias|buenas tardes|buenas noches|hey)\b/.test(ns)) {
      return {
        text: '¡Hola, hola! ☁️💙 Qué alegría verte. ¿Qué te gustaría hacer hoy?',
        mood: 'saludando'
      };
    }

    if (/\b(chiste|hazme reir|algo gracioso)\b/.test(ns)) {
      return {
        text: pick(JOKES),
        mood: 'emocionado'
      };
    }

    if (/\b(gracias|muchas gracias|grax)\b/.test(ns)) {
      return {
        text: '¡De nada! ☁️💙 Me alegra poder ayudarte.',
        mood: 'feliz'
      };
    }

    if (/\b(adios|chau|chao|hasta luego|nos vemos)\b/.test(ns)) {
      return {
        text: '¡Hasta pronto! ☁️💙 Que tengas un bonito día.',
        mood: 'saludando'
      };
    }

    return {
      text: '☁️ Ahora estoy en modo local. Puedo conversar de forma sencilla, ayudarte con recordatorios y consultar mi biblioteca médica. Para respuestas más completas necesito conexión a internet.',
      mood: 'principal'
    };
  }

  
  function reply(text) {
    const res = respond(text);
    if (!res) return;
    // Defensa adicional: aunque el buscador local no reconozca el tema,
    // las consultas de salud no se envían a Gemini ni se usan en su historial.
    const sensitive = isSensitive(text);
    if (sensitive && res.aiOk) {
      res.aiOk = false;
      res.text = '💙 Para cuidar tu privacidad, esta consulta se atiende en modo local. ' +
        'Puedes buscar información general en Salud → Biblioteca. ' +
        'Si necesitas orientación para tu caso, consulta a un profesional.';
      res.mood = 'medico';
    }
    const current = history[history.length - 1];
    if (current && current.role === 'user') {
      current.private = sensitive || !res.aiOk;
      // Únicamente los mensajes expresamente autorizados entran al historial de Gemini.
      current.aiAllowed = !current.private && !!res.aiOk;
      persist();
    }
    if (sensitive || !res.aiOk) res.private = true;
    busy = true;
    const typing = document.createElement('div'); typing.className = 'typing'; typing.innerHTML = '<i></i><i></i><i></i>';
    $('messages').appendChild(typing); $('messages').scrollTop = $('messages').scrollHeight;
    N.mascot.express('pensando', 'Mmm… déjame pensar 💭', 0);   // procesando la respuesta

    
    // Conversación general con Gemini.
    if (res.aiOk && N.ai && N.ai.enabled()) {
      N.ai.ask(history)
        .then(r => {
          finish({
            text: r.text,
            mood: r.mood,
            ai: true
          }, typing);
        })
        .catch(() => {
          // Si falla la conexión, responder localmente.
          const local = respuestaSinConexion(text);

          const actual = history[history.length - 1];
          if (actual && actual.role === 'user') {
           actual.aiAllowed = false;
           actual.private = true;
           persist();
          }

          finish({
            text: local.text,
            mood: local.mood,
            private: true
          }, typing);
        });

      return;
    }

    // Si Gemini está desactivado o no hay conexión,
    // utilizar directamente las respuestas locales.
    if (res.aiOk) {
      const local = respuestaSinConexion(text);
      res.text = local.text;
      res.mood = local.mood;
      res.private = true;

      const actual = history[history.length - 1];
      if (actual && actual.role === 'user') {
       actual.aiAllowed = false;
       actual.private = true;
       persist();
      }
    }

    const delay = res.urgent ? 150 : 700 + Math.min(900, res.text.length * 6);
    setTimeout(() => finish(res, typing), delay);
  }

  function clear() {
    history = []; persist(); pending = null;
    $('messages').replaceChildren();
    append('bot', '¡Chat nuevo! ☁️ ¿En qué te acompaño?');
  }

  function init() {
    const saved = N.store.read('history', []);
    history = Array.isArray(saved) ? saved.filter(m => m && (m.role === 'user' || m.role === 'bot') && typeof m.text === 'string') : [];
    if (history.length) history.forEach(m => append(m.role, m.text, m.urgent, m.ai, m.kb));
    else append('bot', '¡Hola! Soy Nuby ☁️💙\nPuedo conversar, darte consejos generales de bienestar y recordarte tus medicamentos, tareas y actividades.\n¿Cómo estás hoy?');
    $('chatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('chatInput').value; $('chatInput').value = ''; send(v); });
    document.querySelectorAll('[data-prompt]').forEach(b => b.addEventListener('click', () => send(b.dataset.prompt)));
  }

  N.chat = { init, send, respond, clear, parseWhen, _norm: norm, isSensitive };
})(window.Nuby);
