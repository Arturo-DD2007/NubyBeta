/* Nuby – orientación general de salud (sin diagnósticos) y herramientas de bienestar */
'use strict';
(function (N) {
  // Cada tema: cuidados generales, cuándo consultar y señales de alarma.
  // Contenido deliberadamente general: sin dosis, sin nombres de medicamentos, sin diagnósticos.
  const TOPICS = [
    {
      id: 'cabeza', emoji: '🤕', title: 'Dolor de cabeza',
      keys: ['dolor de cabeza', 'cabeza me duele', 'me duele la cabeza', 'migrana', 'jaqueca', 'cefalea'],
      care: ['Descansa en un lugar tranquilo y con poca luz.', 'Bebe agua; la deshidratación puede influir.', 'Haz pausas de las pantallas y revisa si dormiste poco o te saltaste comidas.'],
      consult: ['Si se repite con frecuencia o cambia de forma.', 'Si no mejora en uno o dos días.', 'Si necesitas analgésicos muy seguido: pregunta a tu médico o farmacéutico.'],
      urgent: ['Dolor repentino y muy intenso ("el peor de mi vida").', 'Con fiebre y cuello rígido, confusión o somnolencia.', 'Con debilidad, cara caída, dificultad para hablar o ver.', 'Después de un golpe en la cabeza.']
    },
    {
      id: 'fiebre', emoji: '🌡️', title: 'Fiebre',
      keys: ['fiebre', 'temperatura alta', 'calentura', 'escalofrio'],
      care: ['Descansa y toma líquidos con frecuencia.', 'Usa ropa ligera y mantén el ambiente fresco.', 'Mide la temperatura con termómetro y anota los valores y horarios.'],
      consult: ['Si dura más de 2–3 días o va en aumento.', 'En bebés menores de 3 meses: consulta pronto ante cualquier fiebre.', 'En embarazo, personas mayores o con enfermedades crónicas.'],
      urgent: ['Dificultad para respirar o labios morados.', 'Convulsiones, confusión o mucha somnolencia.', 'Manchas en la piel que no desaparecen al presionarlas.', 'Cuello rígido o signos de deshidratación grave.']
    },
    {
      id: 'tos', emoji: '😷', title: 'Tos y resfriado',
      keys: ['tos!', 'toso', 'resfriado', 'resfrio', 'gripe', 'congestion', 'mocos', 'estornudo'],
      care: ['Descansa y bebe líquidos tibios.', 'Ventila los ambientes y lávate las manos seguido.', 'Cúbrete al toser y considera usar mascarilla cerca de otras personas.'],
      consult: ['Si la tos dura más de 3 semanas.', 'Si hay fiebre persistente o flemas con sangre.', 'Si tienes asma, EPOC u otra enfermedad pulmonar y empeoras.'],
      urgent: ['Falta de aire o respiración muy rápida.', 'Dolor en el pecho al respirar.', 'Labios o uñas azulados.']
    },
    {
      id: 'garganta', emoji: '🗣️', title: 'Dolor de garganta',
      keys: ['garganta', 'amigdal', 'tragar'],
      care: ['Bebe líquidos tibios y descansa la voz.', 'Mantén el ambiente húmedo y evita el humo.'],
      consult: ['Si dura más de una semana o hay fiebre alta.', 'Si aparecen placas blancas o ganglios muy inflamados.'],
      urgent: ['No puedes tragar tu saliva o babeas.', 'Dificultad para respirar o para abrir la boca.']
    },
    {
      id: 'estomago', emoji: '🤢', title: 'Dolor de estómago',
      keys: ['estomago', 'barriga', 'panza', 'abdomen', 'abdominal', 'nausea', 'indigestion', 'gastritis', 'acidez'],
      care: ['Come porciones pequeñas y ligeras.', 'Bebe agua a sorbos.', 'Evita alcohol, comidas muy grasosas o picantes mientras mejoras.'],
      consult: ['Si dura más de unos días o se repite.', 'Si hay pérdida de peso sin explicación.', 'En embarazo, consulta ante cualquier dolor abdominal importante.'],
      urgent: ['Dolor muy fuerte, abdomen duro o dolor que empeora rápido.', 'Vómitos con sangre o heces negras.', 'Dolor en la parte baja derecha con fiebre.', 'Desmayo.']
    },
    {
      id: 'diarrea', emoji: '🚽', title: 'Diarrea o vómitos',
      keys: ['diarrea', 'vomit', 'deshidrat', 'suelto'],
      care: ['Lo más importante es hidratarse: toma líquidos a sorbos frecuentes.', 'Las sales de rehidratación oral de farmacia ayudan; sigue las instrucciones del envase.', 'Lávate bien las manos.'],
      consult: ['Si dura más de 2 días en adultos.', 'En niños pequeños, personas mayores o embarazadas: consulta pronto.'],
      urgent: ['Sangre en las heces o en el vómito.', 'Signos de deshidratación: casi no orinas, boca muy seca, mareo al pararte.', 'No logras retener ningún líquido.']
    },
    {
      id: 'estres', emoji: '🌿', title: 'Estrés y ansiedad',
      keys: ['estres', 'estresad', 'ansiedad', 'ansios', 'nervios', 'agobi', 'panico', 'preocupad'],
      care: ['Prueba la respiración guiada de abajo: inhala lento, exhala más lento.', 'Muévete un poco: una caminata corta ayuda.', 'Habla con alguien de confianza y divide los problemas en pasos pequeños.', 'Cuida el sueño y reduce cafeína.'],
      consult: ['Si el malestar dura semanas o afecta tu trabajo, estudio o relaciones.', 'Un psicólogo o médico puede ayudarte; pedir ayuda es de valientes.'],
      urgent: ['Si piensas en hacerte daño o en quitarte la vida, busca ayuda inmediata: llama a emergencias o a alguien de confianza ahora.']
    },
    {
      id: 'sueno', emoji: '😴', title: 'Sueño e insomnio',
      keys: ['insomnio', 'no puedo dormir', 'dormir', 'sueno', 'desvelo', 'cansad'],
      care: ['Acuéstate y levántate a la misma hora.', 'Evita pantallas y cafeína por la tarde-noche.', 'Cuarto oscuro, fresco y silencioso.', 'Si no te duermes en ~20 min, levántate y haz algo tranquilo.'],
      consult: ['Si el problema dura más de un mes.', 'Si roncas fuerte o te dicen que dejas de respirar al dormir.', 'Si te quedas dormido durante el día sin querer.'],
      urgent: ['Somnolencia extrema al manejar: no conduzcas.']
    },
    {
      id: 'alergia', emoji: '🤧', title: 'Alergias',
      keys: ['alergi', 'picazon', 'ronchas', 'urticaria', 'estornud', 'polen'],
      care: ['Identifica y evita lo que te da alergia.', 'Mantén limpios y ventilados los ambientes.', 'Anota cuándo aparecen los síntomas para contárselo al médico.'],
      consult: ['Si los síntomas son frecuentes o no te dejan dormir.', 'Para saber qué tratamiento es adecuado para ti.'],
      urgent: ['Hinchazón de labios, lengua o garganta.', 'Dificultad para respirar o sensación de desmayo tras comer, una picadura o un medicamento.']
    },
    {
      id: 'presion', emoji: '❤️', title: 'Presión arterial',
      keys: ['presion', 'hipertension', 'tension alta', 'presion alta', 'presion baja'],
      care: ['Mídela en reposo, sentado, a la misma hora, y anota los valores.', 'Reduce la sal, muévete a diario y evita fumar.', 'Si tomas tratamiento, no lo suspendas por tu cuenta.'],
      consult: ['Si tus mediciones suelen estar altas.', 'Para ajustar cualquier tratamiento: siempre con tu médico.'],
      urgent: ['Presión muy alta con dolor de pecho, falta de aire, dolor de cabeza intenso, confusión o problemas para ver o hablar.']
    },
    {
      id: 'herida', emoji: '🩹', title: 'Heridas y golpes leves',
      keys: ['herida', 'corte', 'raspon', 'golpe', 'moreton', 'torcedura', 'esguince', 'quemadura'],
      care: ['Lava con agua limpia y jabón suave; cubre con una gasa limpia.', 'Golpes: frío local envuelto en un paño por ratos cortos y reposo.', 'Quemadura leve: agua fresca (no helada) unos 10–20 minutos; no uses hielo ni pasta dental.'],
      consult: ['Si la herida es profunda, abierta o sucia, o tu vacuna antitetánica no está al día.', 'Si hay enrojecimiento que se extiende, pus o fiebre.', 'Si no puedes apoyar o mover la zona.'],
      urgent: ['Sangrado que no se detiene con presión firme.', 'Quemaduras grandes, en cara, manos o genitales.', 'Golpe en la cabeza con vómitos, confusión o pérdida de conciencia.']
    }
  ];

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function findTopic(text) {
    const s = norm(text);
    let best = null, bestLen = 0;
    for (const t of TOPICS) for (const k of t.keys) {
      // inicio de palabra obligatorio; "!" al final = palabra completa
      const whole = k.endsWith('!');
      const key = whole ? k.slice(0, -1) : k;
      const re = new RegExp('(^|[^a-z\u00f1])' + key + (whole ? '($|[^a-z\u00f1])' : ''));
      if (re.test(s) && key.length > bestLen) { best = t; bestLen = key.length; }
    }
    return best;
  }

  function summary(t) {
    return t.emoji + ' ' + t.title + ': ' + t.care.slice(0, 2).join(' ') +
      '\n\n🚩 Busca atención urgente si: ' + t.urgent[0].replace(/\.$/, '').toLowerCase() + '.' +
      '\n\nMira la ficha completa en la pestaña Salud 💗. Recuerda: no puedo diagnosticar.';
  }

  function list(title, items, cls) {
    const h = document.createElement('h5'); h.textContent = title; if (cls) h.className = cls;
    const ul = document.createElement('ul');
    items.forEach(i => { const li = document.createElement('li'); li.textContent = i; ul.appendChild(li); });
    return [h, ul];
  }

  function showTopic(id) {
    const t = TOPICS.find(x => x.id === id);
    const box = document.getElementById('healthAnswer');
    if (!t || !box) return;
    const h = document.createElement('h4'); h.textContent = t.emoji + ' ' + t.title;
    const foot = document.createElement('p'); foot.className = 'tiny';
    foot.textContent = 'Información general. Ante dudas, consulta a un profesional de salud. Nuby no diagnostica ni indica medicamentos.';
    box.replaceChildren(h, ...list('🏠 Cuidados generales', t.care), ...list('👩‍⚕️ Consulta a un profesional', t.consult), ...list('🚨 Busca atención urgente si', t.urgent, 'red'), foot);
    document.querySelectorAll('#healthChips button').forEach(b => b.classList.toggle('on', b.dataset.topic === id));
    N.mascot.express('medico', 'Cuídate mucho 🩺💙 Si algo te preocupa, consulta a un profesional.', 4500);
  }

  /* ---------- Agua ---------- */
  function waterState() {
    const st = N.store.read('water', {});
    const today = N.util.todayKey();
    return st.day === today ? st : { day: today, count: 0 };
  }
  function renderWater() {
    const goal = Math.max(1, Math.min(20, +(N.store.read('settings', {}).waterGoal) || 8));
    const st = waterState();
    document.getElementById('waterCount').textContent = st.count + ' / ' + goal;
    const wrap = document.getElementById('waterGlasses');
    wrap.replaceChildren();
    for (let i = 0; i < Math.max(goal, st.count); i++) {
      const s = document.createElement('span'); s.textContent = '🥤';
      if (i < st.count) s.className = 'full';
      wrap.appendChild(s);
    }
    return { st, goal };
  }
  function addWater(delta) {
    const st = waterState();
    st.count = Math.max(0, Math.min(40, st.count + delta));
    N.store.save('water', st);
    const { goal } = renderWater();
    if (delta > 0) {
      if (st.count === goal) N.mascot.express('emocionado', '¡Meta de agua cumplida! 🎉💧');
      else N.mascot.express('saludable', '¡Glup glup! ' + st.count + ' vaso(s) hoy 💧', 1800);
    }
  }

  /* ---------- Respiración ---------- */
  let breathing = null;
  function toggleBreath() {
    const btn = document.getElementById('breathBtn');
    const circle = document.getElementById('breathCircle');
    const label = document.getElementById('breathLabel');
    const timer = document.getElementById('breathTimer');
    if (breathing) {
      clearTimeout(breathing.t); clearInterval(breathing.i); breathing = null;
      circle.className = 'breath'; label.textContent = 'Listo'; timer.textContent = '1 min'; btn.textContent = 'Empezar';
      return;
    }
    const end = Date.now() + 60000;
    breathing = {};
    btn.textContent = 'Detener';
    N.mascot.express('saludable', 'Respira conmigo… 🌬️', 4000);
    const cycle = () => {
      if (!breathing) return;
      if (Date.now() >= end) {
        toggleBreath();
        N.mascot.express('feliz', '¡Muy bien! ¿Te sientes un poco mejor? 💙');
        return;
      }
      circle.className = 'breath in'; label.textContent = 'Inhala';
      breathing.t = setTimeout(() => {
        if (!breathing) return;
        circle.className = 'breath out'; label.textContent = 'Exhala';
        breathing.t = setTimeout(cycle, 6000);
      }, 4000);
    };
    breathing.i = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      timer.textContent = left + ' s';
    }, 500);
    cycle();
  }

  function init() {
    const chips = document.getElementById('healthChips');
    TOPICS.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.topic = t.id; b.textContent = t.emoji + ' ' + t.title;
      b.addEventListener('click', () => showTopic(t.id));
      chips.appendChild(b);
    });
    document.getElementById('waterPlus').addEventListener('click', () => addWater(1));
    document.getElementById('waterMinus').addEventListener('click', () => addWater(-1));
    document.getElementById('breathBtn').addEventListener('click', toggleBreath);
    renderWater();
  }

  N.health = { init, findTopic, summary, showTopic, renderWater, addWater, toggleBreath, TOPICS, norm };
})(window.Nuby);
