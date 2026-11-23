# Nuby 1.6 ☁️ — Mascota virtual 2D de bienestar con biblioteca médica local

Nuby es una nubecita animada que conversa con respuestas locales, da orientación general de
bienestar y te recuerda medicamentos, tareas y actividades con notificaciones locales.
En modo local todo funciona dentro del teléfono, sin internet. Opcionalmente, Nuby conversa de forma natural
con **Gemini** a través de tu propio servidor en Cloudflare: lee [`INSTRUCCIONES-IA.md`](INSTRUCCIONES-IA.md).

👉 **Para compilar e instalar desde el celular, lee [`INSTRUCCIONES.md`](INSTRUCCIONES.md).**
👉 **Arquitectura médica, fuentes, licencias y evaluación de IA local: [`docs/ARQUITECTURA-MEDICA.md`](docs/ARQUITECTURA-MEDICA.md).**

## Funciones

- **Mascota 2D con 15 expresiones** (`www/assets/nuby/`): principal, feliz, emocionado, pensando,
  sorprendido, triste, preocupado, enfermizo, saludable, médico, durmiendo, saludando, recordatorio,
  confirmando y confundido. Parpadea (8 expresiones tienen fotograma de ojos cerrados en
  `assets/nuby/parpadeo/`), flota, salta cuando está feliz, se duerme tras 90 s sin actividad
  (45 s de noche), se despierta al tocarla y reacciona a los recordatorios. Cambia de cara sin recargar.
- **Expresiones automáticas**: saludo → saludando · charla normal → principal · mensaje positivo → feliz ·
  buenas noticias → emocionado · procesando → pensando · pregunta inesperada → sorprendido ·
  usuario triste → preocupado · salud → médico · «me siento mal» → enfermizo · agua/respiración → saludable ·
  recordatorio → calendario · tarea completada → confirmando · no entendido → confundido ·
  insulto → triste · inactivo → durmiendo.
- **Chat local**: saludos, emociones, chistes, hora/fecha, recuerda tu nombre, consulta de pendientes,
  contador de agua, ejercicio de respiración y **creación de recordatorios en lenguaje natural**:
  «recuérdame tomar la pastilla a las 8 de la noche todos los días», «avísame en 20 minutos»,
  «recuérdame mañana a las 9:30 ir al médico».
- **Seguridad**: detecta mensajes de emergencia médica o de crisis emocional y responde siempre con
  indicación de buscar ayuda inmediata (puedes guardar tu número de emergencias en Ajustes).
  Se niega a dar dosis, medicamentos o diagnósticos.
- **Biblioteca médica local** (sin internet): resúmenes de **MedlinePlus en español** (NLM, dominio
  público) y **etiquetas oficiales de la FDA** de ~80 medicamentos (CC0, en inglés, sin dosis),
  descargados y empaquetados por GitHub Actions; cada ficha muestra fuente, fecha y licencia. Búsqueda
  por palabras clave con sinónimos cotidianos y corrección de tipeo. El chat responde preguntas médicas
  **solo con texto de la biblioteca** (si no hay ficha, lo dice) y nunca diagnostica, receta ni da dosis.
  Se actualiza sola el día 1 de cada mes. No contiene toda la medicina: ver la cobertura real en
  `docs/ARQUITECTURA-MEDICA.md`.
- **Salud**: 11 fichas (dolor de cabeza, fiebre, tos, garganta, estómago, diarrea/vómitos, estrés,
  sueño, alergias, presión, heridas) con cuidados generales, cuándo consultar y señales de alarma.
  Herramientas: vasos de agua del día y respiración guiada de 1 minuto.
- **Recordatorios**: tipos 💊 medicamento / ✅ tarea / 🏃 actividad, nota opcional, una vez / diario /
  semanal, editar, pausar, marcar hecho, eliminar, filtros y pendientes con contador.
- **Notificaciones Android** (plugin `@capacitor/local-notifications`): llegan con la app cerrada y tras
  reiniciar el teléfono; botones **✓ Hecho** y **⏰ +10 min** en la propia notificación; canal de alta
  prioridad; solicitud de permisos de notificación y de alarmas exactas.
- **IA opcional (Gemini)**: conversación natural vía `worker/worker.js` (Cloudflare Worker). La clave de
  Gemini es un secreto del Worker; la app usa un código de acceso propio. La IA elige la expresión de Nuby.
  Emergencias, salud, dosis y recordatorios se resuelven en el teléfono y no se envían. Sin internet o si
  falla, vuelve al modo local.
- **Versión web** (PWA) con avisos mientras la página está abierta.
- **Respaldo**: copiar/restaurar todos tus datos como texto.

## Estructura

```
www/                     App web (la misma que va dentro del APK)
  index.html
  css/app.css
  js/store.js            Almacenamiento local, fechas, utilidades
  js/mascot.js           Motor de la mascota: expresiones, parpadeo, sueño, partículas
  js/health.js           Fichas de salud, agua, respiración
  js/reminders.js        Recordatorios (modelo + interfaz)
  js/notify.js           Notificaciones Android (nativas) y web
  js/kb.js               Biblioteca médica: carga, índice y búsqueda local
  js/library.js          Interfaz de la biblioteca (pestaña Salud)
  js/ai.js               Conexión con tu Worker de IA (opcional)
  js/chat.js             Motor de chat local, enrutado a la IA y expresión de cada respuesta
  js/app.js              Arranque, pestañas, ajustes, respaldo
  kb/                    Biblioteca médica (la genera scripts/build-kb.mjs)
  assets/nuby/           15 expresiones PNG transparentes (344×280, cara alineada)
  assets/nuby/parpadeo/  Fotogramas de ojos cerrados
  img/                   Iconos e imagen original de la versión 1.1
  sw.js, manifest.webmanifest
worker/worker.js         Servidor intermediario para Gemini (se pega en Cloudflare)
android-config/          Iconos Android, icono de notificación, llave de firma de prueba
scripts/configure-android.mjs   Ajusta el proyecto Android generado por Capacitor
scripts/build-kb.mjs            Construye la biblioteca médica (MedlinePlus + openFDA)
scripts/kb-sources/             Lista de medicamentos, sinónimos y guía propia (editables)
docs/ARQUITECTURA-MEDICA.md     Diseño, fuentes, licencias, cobertura y hoja de ruta
.github/workflows/build-apk.yml Compilación automática del APK en GitHub
capacitor.config.json, package.json
```

La carpeta `android/` **no se guarda**: GitHub Actions la genera en cada compilación con
`npx cap add android` y luego la ajusta con `scripts/configure-android.mjs`.

## Correcciones respecto a la versión 1.1 (incluidas desde la 1.2)

1. `nuby.jpg` era en realidad una imagen **WebP** con extensión equivocada → se convirtió a `nuby.webp`
   y se recortó el fondo para que Nuby flote como mascota (la original se conserva en `img/nuby-original.webp`). En la 1.4 se reemplazó por las 15 expresiones 2D.
2. El icono de notificación `ic_stat_nuby` **no existía** → creado como vector en `android-config/res/drawable`.
3. Faltaban permisos de **alarmas exactas** y **reinicio** → se añaden automáticamente.
4. Recordatorios solo de una vez → ahora diario/semanal, tipos, notas, edición y pausa.
5. Las fechas se interpretaban de forma distinta según el navegador → se leen siempre como hora local.
6. El ID de notificación por hash podía repetirse → IDs numéricos únicos y estables.
7. El service worker “caché primero” dejaba **versiones viejas** pegadas → ahora “red primero” y no se usa dentro del APK.
8. `new Notification()` falla en Chrome para Android → se usa el service worker para avisos web.
9. Cada compilación usaba una firma distinta (había que desinstalar para actualizar y se perdían datos)
   → llave de firma de prueba fija + número de versión automático.
10. En Android 15/16 la interfaz podía quedar bajo la barra de estado → se ajusta el tema.
11. Los iconos de la app eran los de Capacitor → iconos de Nuby (incluye icono adaptable).
12. El README pedía Android Studio → compilación 100 % en GitHub Actions.
13. Se migra automáticamente lo guardado en la versión 1.1 (recordatorios y chat).

## Probar la versión web en una computadora (opcional)

```
python3 -m http.server 8000 --directory www
```
y abre http://localhost:8000

## Limitaciones honestas

- Es un **APK de prueba (debug)**, firmado con una llave pública de pruebas. Sirve para instalar en tu
  teléfono, **no para publicar en Google Play** (para eso se necesita una llave privada propia).
- Sin la IA, las respuestas son programadas y no cubren cualquier frase.
- Con la IA: en el nivel gratuito de Gemini, Google puede usar los mensajes enviados para mejorar sus
  productos; requiere 18+ años y tiene cuotas diarias.
- Las imágenes de Nuby miden 344×280 px (tamaño original de la hoja). Se ven bien en el teléfono,
  pero si se agrandan mucho pierden nitidez; para más calidad hace falta una hoja de mayor resolución.
- Los recordatorios repetitivos se programan para los próximos 30 días (diarios) o ~4 meses (semanales)
  y se renuevan cada vez que abres Nuby. **Ábrela al menos una vez al mes.**
- Los fabricantes (Xiaomi/POCO incluidos) pueden retrasar avisos por ahorro de batería: sigue los
  ajustes de `INSTRUCCIONES.md`.
- Datos solo en el teléfono: desinstalar o borrar datos los elimina (usa el respaldo).
- **Nuby no es un servicio médico**: no diagnostica, no indica medicamentos ni dosis y no reemplaza a
  profesionales. No uses las notificaciones como único método para medicamentos críticos.
