# Nuby — Arquitectura de conocimiento médico (v1.6)

> **Resumen honesto.** Nuby 1.6 tiene una biblioteca médica **local, consultable sin internet,
> con fuente y fecha en cada ficha**. Su núcleo son los resúmenes de **MedlinePlus en español**
> (Biblioteca Nacional de Medicina de EE. UU., dominio público) y las **etiquetas oficiales de
> medicamentos de la FDA** (openFDA, CC0, en inglés). **No contiene "toda la medicina"**: cubre
> temas de salud para el público general y un grupo inicial de ~80 principios activos. La biblioteca
> se descarga y se empaqueta automáticamente en GitHub Actions; su tamaño real se muestra en la app
> (Salud → Biblioteca) y en las notas de cada versión.

---

## 1. Principios

1. **No inventar.** Las respuestas médicas se arman *extrayendo* frases de fichas existentes.
   Si la búsqueda no encuentra una ficha suficientemente relevante, Nuby dice que no tiene
   información verificada. No hay texto médico generado.
2. **Siempre con fuente, fecha y licencia** visibles.
3. **Educativo, no clínico.** Cada respuesta lleva el aviso: *información educativa general,
   no es un diagnóstico ni una indicación para tu caso*.
4. **Nunca**: diagnósticos, prescripciones, dosis personalizadas, interpretar "qué tengo".
   Las secciones de dosis de las etiquetas de la FDA se **excluyen** al construir la base.
5. **Emergencias primero.** Antes de buscar nada, un detector de señales de alarma (dolor de pecho,
   dificultad para respirar, derrame, convulsiones, anafilaxia, sangrado, intoxicación, ideas
   suicidas…) responde con indicación de atención inmediata.
6. **Ampliable.** Cada fuente es un "paquete" JSON independiente con su propio manifiesto.

## 2. Capas

```
 Mensaje del usuario
        │
 ┌──────▼──────────────────────────┐
 │ 1. Triaje de seguridad          │  crisis / emergencias → respuesta fija + expresión "preocupado"
 └──────┬──────────────────────────┘
 ┌──────▼──────────────────────────┐
 │ 2. Intención                    │  recordatorio · dosis personal (se rechaza) · "qué tengo"
 │                                 │  (se rechaza) · acción local · pregunta de conocimiento · charla
 └──────┬──────────────────────────┘
 ┌──────▼──────────────────────────┐
 │ 3. Recuperación local (kb.js)   │  BM25F por campos + sinónimos cotidianos + prefijos +
 │                                 │  corrección de tipeo + prioridad a fuentes externas
 └──────┬──────────────────────────┘
 ┌──────▼──────────────────────────┐
 │ 4. Composición extractiva       │  título + 1-3 frases más relevantes + fuente/fecha +
 │                                 │  aviso educativo + botón "Ver ficha completa"
 └──────┬──────────────────────────┘
        ▼
   Chat / Biblioteca (pestaña Salud) · mascota en modo "médico"

 Construcción (GitHub Actions, scripts/build-kb.mjs)
   MedlinePlus XML (ES) ─┐
   openFDA labels (EN) ──┼─► www/kb/*.json + manifest.json ─► APK y web
   Guía propia + sinónimos┘
```

Archivos:

| Archivo | Función |
|---|---|
| `scripts/build-kb.mjs` | Descarga, limpia y empaqueta las fuentes. Si una falla, la marca como no disponible y sigue. |
| `scripts/kb-sources/medicamentos.json` | Lista de principios activos (nombre en español ↔ nombre en EE. UU. ↔ clase). Ampliable. |
| `scripts/kb-sources/sinonimos.json` | Grupos de sinónimos cotidianos para la búsqueda ("presión alta" ↔ "hipertensión"). |
| `scripts/kb-sources/guia-nuby.json` | Guía rápida propia (12 fichas). **No revisada por profesionales.** |
| `www/kb/manifest.json` | Paquetes, conteos, versión de la fuente, fecha de descarga, licencia y errores. |
| `www/js/kb.js` | Índice y búsqueda en el teléfono; respuestas para el chat. |
| `www/js/library.js` | Interfaz de la biblioteca (buscar, filtrar, ver ficha, fuentes y licencias). |

### Formato de una ficha

```json
{ "id": "mp-2120", "t": "Asma", "a": ["Asma bronquial"], "g": ["Pulmones y respiración"],
  "s": "Texto del resumen…", "u": "https://medlineplus.gov/spanish/asthma.html",
  "d": "04/04/2001", "r": ["Asma infantil"] }
```
Las fichas de medicamentos usan `sec` (secciones), `lang: "en"`, `clase`, `brands` y la fecha de
revisión de la etiqueta.

## 3. Fuentes evaluadas

| Fuente | Idioma | Licencia | Estado en v1.6 |
|---|---|---|---|
| **MedlinePlus – resúmenes de temas de salud** | Español | Dominio público (NLM). Atribución solicitada | ✅ Incluida (todas las fichas en español del XML oficial) |
| **openFDA – etiquetas de medicamentos (SPL)** | Inglés | CC0 1.0 / dominio público | ✅ Incluida (~80 principios activos, sin secciones de dosis) |
| Guía rápida de Nuby | Español | Propia | ✅ Incluida, marcada como "no revisada" |
| MedlinePlus – información de pruebas médicas | Español | Dominio público | 🔜 Fase 2 (no viene en el XML; requiere otro proceso de descarga) |
| MedlinePlus Genetics | Inglés | Dominio público | 🔜 Fase 2 (enfermedades raras/genéticas) |
| MedlinePlus – monografías de medicamentos (ASHP) | Español | **Con derechos de autor** | ❌ Excluida |
| Enciclopedia médica A.D.A.M. (MedlinePlus) | Español | **Con derechos de autor** | ❌ Excluida |
| CIMA (AEMPS, España) – prospectos en español | Español | Condiciones de reutilización **no verificadas** aún | ⏸ Pendiente de revisar licencia |
| Wikipedia | Varios | CC BY-SA (calidad variable) | ❌ No incluida por fiabilidad clínica |

## 4. Cobertura frente a lo pedido (realista)

| Área | v1.6 | Comentario |
|---|---|---|
| Enfermedades comunes, crónicas e infecciosas | ✅ Buena | MedlinePlus cubre la mayoría de temas para el público general |
| Enfermedades raras | ⚠️ Parcial | Solo las que tienen tema en MedlinePlus; MedlinePlus Genetics en fase 2 |
| Medicamentos (indicaciones, efectos, contraindicaciones, interacciones) | ⚠️ Parcial | ~80 principios activos, texto oficial **en inglés**, marcas de EE. UU. Sin dosis |
| Anatomía y fisiología | ⚠️ Parcial | Temas por órgano/sistema de MedlinePlus; no es un atlas |
| Especialidades | ✅ Por grupos | Los grupos de MedlinePlus (corazón, cerebro, piel, niños…) sirven de filtro |
| Síntomas, causas, tratamientos habituales | ✅ Educativo | Como lo describe MedlinePlus; nunca personalizado |
| Primeros auxilios y emergencias | ✅ | Temas de MedlinePlus + detector de emergencias + guía propia |
| Análisis y estudios | ⚠️ Parcial | Temas generales; fichas de cada prueba en fase 2 |
| Nutrición, vitaminas, prevención | ✅ | Temas de MedlinePlus |
| Salud mental | ✅ | Temas de MedlinePlus + protocolo de crisis |
| Terminología | ⚠️ Parcial | Sinónimos y "también llamado"; glosario dedicado en fase 2 |

## 5. Búsqueda

- **Implementada:** BM25F (título ×5, sinónimos ×3.5, grupos ×1, texto ×1), normalización sin tildes,
  lematización ligera, grupos de sinónimos cotidianos, coincidencia por prefijo y corrección de
  errores de tipeo (distancia de edición). Se priorizan MedlinePlus y FDA sobre la guía propia.
  Rendimiento medido en un navegador de escritorio con ~1.100 fichas: ~0,5 s para indexar al abrir
  y menos de 10 ms por consulta (en el teléfono será algo más lento).
- **No implementada aún: búsqueda semántica real.** Requiere un modelo de *embeddings* multilingüe en
  el teléfono (decenas a cientos de MB) y vectores precalculados en Actions. Es la fase 2; la
  arquitectura ya separa índice y paquetes para añadirla.

## 6. Actualizaciones

- El workflow se ejecuta **el día 1 de cada mes** (y cada vez que subes cambios) y vuelve a
  descargar MedlinePlus y openFDA. La nueva versión aparece en *Releases* con un resumen de la
  biblioteca.
- **Añadir medicamentos:** agrega líneas a `scripts/kb-sources/medicamentos.json`.
- **Añadir sinónimos:** agrega grupos a `scripts/kb-sources/sinonimos.json`.
- **Añadir una fuente nueva:** crea una función en `build-kb.mjs` que escriba `www/kb/<id>.json` y la
  registre en el manifiesto con `source`, `license`, `licenseUrl`, `sourceDate` y `retrieved`.
- GitHub desactiva las ejecuciones programadas en repositorios sin actividad durante 60 días; si pasa,
  basta con ejecutar el workflow manualmente (Actions → Run workflow).

## 7. ¿Un modelo de lenguaje local en el POCO F6 (8 GB)?

**Hardware:** Snapdragon 8s Gen 3 (1× Cortex-X4 3,0 GHz + 4× A720 + 3× A520), GPU Adreno 735,
8 GB LPDDR5X, almacenamiento UFS 4.0.

**Opciones revisadas (noviembre 2026):**

| Opción | Qué es | Encaje con Nuby |
|---|---|---|
| **LiteRT-LM (Google AI Edge)** | Motor oficial para Gemma y otros; API Kotlin estable; CPU/GPU/NPU | Mejor rendimiento. Necesita un plugin nativo propio de Capacitor |
| **llama.cpp** (p. ej. plugin comunitario `llama-cpp-capacitor`, MIT, versiones 0.1.x) | Modelos GGUF cuantizados | Integración más directa con Capacitor, pero plugin joven |
| **@capacitor/local-llm** (Capacitor Labs) | Usa el modelo del sistema (Gemini Nano vía ML Kit en Android) | Experimental; la documentación cita Pixel 9 o posteriores. No consta soporte para el POCO F6 |

Referencias publicadas por Google para LiteRT-LM (otros teléfonos): Gemma 4 E2B ocupa ~2,6 GB y
decodifica ~52 tokens/s en GPU en un Samsung S26 Ultra; Gemma 3 1B (~1 GB) ~33 tokens/s en CPU en un
S24 Ultra; Qwen2.5-1.5B (~1,6 GB) ~34 tokens/s en un S25 Ultra.

**Conclusión:** es *técnicamente probable* que un modelo de 1–2 mil millones de parámetros funcione
en tu POCO F6 con 8 GB (más lento que esos teléfonos de gama alta; estimación no medida). Pero:

- Los modelos pequeños **inventan datos médicos con facilidad** (dosis, cifras, nombres). Usarlos
  para responder libremente rompería el principio n.º 1.
- Hay que descargar 1–2,6 GB la primera vez y gestionar memoria, batería y calor.
- Requiere un plugin nativo (Kotlin) que se puede compilar en Actions, pero que no he podido probar
  en un dispositivo real.

**Recomendación:** fase 3, **opcional y desactivada por defecto**, solo como *redactor* que reescribe
en lenguaje sencillo los fragmentos recuperados de la biblioteca, citándolos, con verificación de que
cada frase está respaldada, y **nunca** para dosis, diagnóstico o emergencias. La biblioteca extractiva
actual es la base que hace posible ese uso seguro.

## 8. Hoja de ruta

| Fase | Contenido |
|---|---|
| **1 (esta versión)** | Biblioteca local MedlinePlus ES + FDA + guía; búsqueda BM25F; respuestas extractivas con fuente; emergencias; actualización mensual |
| 2 | Pruebas médicas de MedlinePlus; MedlinePlus Genetics; glosario; búsqueda semántica con embeddings; revisión de licencia CIMA para prospectos en español |
| 3 | LLM local opcional (RAG estricto) tras pruebas en el dispositivo |
| Siempre | Revisión por un profesional de salud de la guía propia y de los textos de seguridad antes de un uso público |

## 9. Atribuciones

- *Fuente: MedlinePlus, Biblioteca Nacional de Medicina de EE. UU.* — https://medlineplus.gov/spanish/
  (los resúmenes de temas de salud son de dominio público; ver https://medlineplus.gov/copyright.html).
  El uso de estos datos no implica respaldo de la NLM a esta aplicación.
- *Datos de openFDA / DailyMed, Administración de Alimentos y Medicamentos de EE. UU.* — CC0
  (https://open.fda.gov/license). La FDA no respalda esta aplicación.
