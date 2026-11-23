# Nuby + Gemini: configurar la IA desde el celular

Con esto, Nuby conversa de forma natural usando **Gemini** a través de **tu propio servidor**
(un *Cloudflare Worker* gratuito). Funciona así:

```
Nuby (tu teléfono) ──código de acceso──▶ Tu Worker en Cloudflare ──clave secreta──▶ Gemini (Google)
```

- La **clave de Gemini** vive solo en Cloudflare como *secreto*. No está en el APK ni en GitHub.
- La app solo guarda la **dirección del Worker** y un **código de acceso** (NUBY_TOKEN), que escribes
  en *Ajustes* y quedan en tu teléfono.
- Emergencias, salud, dosis y recordatorios **no** pasan por la IA: Nuby los resuelve en el teléfono.
- Sin internet o si la IA falla, Nuby vuelve sola al **modo local**.

Necesitas: Chrome en el celular, tu clave de Gemini de Google AI Studio y el archivo `worker.js`
(está en `nuby-proyecto.zip`, carpeta `worker/`, y también te lo envié por separado).

> 💡 Para el panel de Cloudflare activa en Chrome ⋮ → **Sitio de escritorio**. El editor de código
> se usa mucho mejor así.

> ⚠️ Nunca pegues tu clave de Gemini en un chat, en GitHub ni dentro de Nuby. Solo en Cloudflare.

---

## Parte 1 — Compilar la nueva versión de Nuby (1.6)

1. En GitHub, en tu repositorio `nuby`: **Add file → Upload files** → sube el nuevo
   `nuby-proyecto.zip` (mismo nombre, reemplaza al anterior) → **Commit changes**.
2. Ve a **Actions** y espera el ✅ verde (5–10 min). Mientras tanto, sigue con la Parte 2.
3. Descarga desde **Releases** el `Nuby-1.6.N.apk` e instálalo **encima** de la versión anterior.
   Tus recordatorios se conservan.

## Parte 2 — Crear tu cuenta y tu Worker en Cloudflare

1. Entra a **dash.cloudflare.com** y crea una cuenta gratuita (confirma tu correo).
2. En el menú, busca **Workers & Pages** (puede estar dentro de *Compute* o *Build*).
3. Toca **Create** (o *Create application*) → **Start with Hello World!**
   (si te pide elegir un subdominio `workers.dev`, escribe uno, por ejemplo tu nombre).
4. Nombre del Worker: `nuby-ia` → **Deploy**.
5. Toca **Edit code**. Se abre un editor:
   - Abre `worker.js` en tu teléfono, **selecciona todo y copia**.
   - En el editor de Cloudflare, mantén pulsado el código → **Seleccionar todo** → bórralo.
   - **Pega** el contenido de `worker.js`.
   - Toca **Deploy** (arriba a la derecha).
6. Anota la dirección del Worker. Se ve así:
   `https://nuby-ia.TU-SUBDOMINIO.workers.dev`

## Parte 3 — Crear el código de acceso

Es una contraseña larga que comparten Nuby y tu Worker, para que nadie más use tu servidor.

1. Abre **Nuby** → **⚙️ Ajustes** → sección **✨ Conversación con IA**.
2. Toca **🔑 Generar código**. Se crea y se copia solo (empieza con `nuby-`).
3. Pégalo en una nota privada por un momento: lo necesitas en la Parte 4.

## Parte 4 — Guardar los secretos en Cloudflare

1. En Cloudflare abre tu Worker `nuby-ia` → **Settings** → **Variables and Secrets** → **Add**.
2. Primer secreto:
   - Type: **Secret**
   - Variable name: `GEMINI_API_KEY`
   - Value: pega tu **clave de Gemini** de Google AI Studio
3. Toca **Add variable** y crea el segundo:
   - Type: **Secret**
   - Variable name: `NUBY_TOKEN`
   - Value: pega el **código de acceso** de la Parte 3
4. Toca **Deploy**.
5. Comprueba: abre en Chrome `https://nuby-ia.TU-SUBDOMINIO.workers.dev/health`.
   - Si ves `"error":"unauthorized"` → ✅ el Worker funciona y está protegido (es lo esperado).
   - Si ves `"error":"not_configured"` → falta algún secreto o no tocaste *Deploy*.

Los nombres deben escribirse **exactamente así**, en mayúsculas.

## Parte 5 — Conectar Nuby

1. En Nuby → **Ajustes → ✨ Conversación con IA**:
   - Lee el aviso y marca ✅ **Entiendo el aviso y soy mayor de 18 años**.
   - Marca ✅ **Usar IA para conversar**.
   - **Dirección de tu Worker:** `https://nuby-ia.TU-SUBDOMINIO.workers.dev`
   - **Código de acceso:** ya está escrito si lo generaste ahí (si no, pégalo).
2. Toca **Guardar** y luego **🔌 Probar conexión**.
   - ✅ `¡Conectado! Modelo en uso: gemini-2.5-flash-lite` → listo.
   - Si dice otro modelo (por ejemplo `gemini-3.5-flash-lite`), también está bien: significa que
     Google no ofrece 2.5 Flash-Lite a tu cuenta y el Worker usó automáticamente el respaldo.
3. Ve al **Chat** y escríbele a Nuby. Arriba verás `IA Gemini ✨`, las respuestas de la IA llevan
   la marca “✨ IA” y Nuby cambia de expresión según lo que responde (feliz, emocionada, preocupada…).
4. Borra la nota donde pegaste el código.

## Opcional — Elegir el modelo

En Cloudflare → Worker → Settings → Variables and Secrets → Add → Type **Text**:

| Variable | Ejemplo | Para qué |
|---|---|---|
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Modelo principal (es el valor por defecto) |
| `FALLBACK_MODELS` | `gemini-3.5-flash-lite,gemini-3.1-flash-lite` | Respaldo si el principal no está disponible |
| `ALLOWED_ORIGINS` | `https://TU-USUARIO.github.io` | Necesario solo para usar la IA en la **versión web** |

## Seguridad: qué hacer si algo se filtra

- **¿Alguien vio tu código de acceso?** Genera uno nuevo en Nuby, cámbialo en el secreto
  `NUBY_TOKEN` de Cloudflare (Edit → Deploy) y guarda en Nuby.
- **¿Se filtró tu clave de Gemini?** En Google AI Studio bórrala y crea otra; actualiza el
  secreto `GEMINI_API_KEY` en Cloudflare. No hay que recompilar el APK.
- El código de acceso se guarda en el almacenamiento interno de la app. No se incluye en
  la copia de seguridad.

## Privacidad y límites

- En el **nivel gratuito**, Google puede usar lo que envíes a Gemini para mejorar sus productos,
  y personas revisoras pueden leerlo. No escribas datos personales ni de salud sensibles en el chat.
- Las condiciones de Gemini exigen **18 años o más** y prohíben usarlo para dar consejo médico.
  Por eso Nuby tiene la IA limitada a la conversación general.
- El nivel gratuito tiene límites de peticiones por minuto y por día (los ves en AI Studio).
  Si se agotan, Nuby avisa y responde en modo local hasta que se renueven.
- El Worker limita cada conexión a 12 mensajes por minuto para frenar abusos.

## Problemas comunes

| Mensaje en “Probar conexión” | Solución |
|---|---|
| El código de acceso no coincide | El código en Nuby y el secreto `NUBY_TOKEN` deben ser idénticos. Vuelve a pegarlo y toca *Deploy* |
| Faltan secretos en Cloudflare | Revisa los nombres `GEMINI_API_KEY` y `NUBY_TOKEN` y toca *Deploy* |
| No se pudo contactar el Worker | Revisa que la dirección empiece con `https://` y termine en `.workers.dev`, y que tengas internet |
| La clave de Gemini no es válida | Copia de nuevo la clave desde AI Studio al secreto `GEMINI_API_KEY` |
| Ningún modelo está disponible | Pon en `GEMINI_MODEL` un modelo que aparezca en tu AI Studio |
| Se agotó la cuota gratuita | Espera (la cuota diaria se renueva a medianoche, hora del Pacífico) |
| Gemini no está disponible desde la región | Prueba de nuevo más tarde; si sigue, avísame |
| El editor de Cloudflare no deja pegar | Activa *Sitio de escritorio* en Chrome y vuelve a intentarlo |
