# Nuby — Cómo compilar e instalar el APK solo con tu celular

Todo se hace desde **Chrome en tu POCO F6**. No necesitas computadora ni Android Studio:
GitHub compila el APK por ti en sus servidores.

Necesitas dos archivos:

- `nuby-proyecto.zip` → el proyecto completo (**no lo descomprimas**).
- `build-apk.yml` → el “robot” que compila (también está dentro del ZIP, en `.github/workflows/`).

> 💡 Si alguna pantalla de GitHub se ve cortada o no aparece un botón, abre el menú ⋮ de Chrome
> y marca **“Sitio de escritorio”**.

---

## Paso 1 — Crear la cuenta y el repositorio

1. Entra a **github.com** y crea una cuenta (o inicia sesión).
2. Toca el **+** (arriba a la derecha) → **New repository**.
3. Nombre: `nuby`.
4. Elige **Public** (recomendado: compilaciones gratis sin límite y permite la versión web).
   *Private* también funciona.
5. Marca ✅ **Add a README file**.
6. Toca **Create repository**.

## Paso 2 — Subir el ZIP del proyecto

1. Dentro del repositorio toca **Add file → Upload files**.
2. Toca **choose your files** y elige `nuby-proyecto.zip` (carpeta *Descargas*).
3. Espera a que termine de subir y toca **Commit changes**.

> No descomprimas el ZIP: el robot de compilación lo descomprime solo.
> Deja **un solo** archivo `.zip` en el repositorio.

## Paso 3 — Crear el robot de compilación (workflow)

1. Abre el archivo `build-apk.yml` en tu teléfono (con un visor de texto o el gestor de archivos),
   **selecciona todo** y **copia**.
2. En GitHub, en tu repositorio, toca **Add file → Create new file**.
3. En el nombre del archivo escribe exactamente:

   ```
   .github/workflows/build-apk.yml
   ```

   (al escribir cada `/` GitHub crea la carpeta, es normal).
4. Pega el contenido en el cuadro grande.
5. Toca **Commit changes…** → **Commit changes**.

*Alternativa:* pestaña **Actions** → **set up a workflow yourself** → borra lo que haya, pega el contenido,
cambia el nombre a `build-apk.yml` y confirma.

Al guardar este archivo, **la compilación empieza sola**.

## Paso 4 — Ver la compilación

1. Toca la pestaña **Actions** del repositorio.
2. Verás “Compilar APK de Nuby” con un círculo amarillo 🟡 (trabajando). Tarda unos **5–10 minutos**.
3. Resultado:
   - ✅ **Verde en “APK Android”** = el APK se compiló bien.
   - ❌ **Rojo en “APK Android”** = algo falló. Tócalo, abre el paso con la ❌, copia las últimas
     líneas del error (o haz captura) y envíamelas.
   - “Versión web (GitHub Pages, opcional)” puede salir en rojo si no activaste Pages (Paso 8).
     **No afecta al APK.**

Para compilar de nuevo sin cambiar nada: **Actions → Compilar APK de Nuby → Run workflow**.

## Paso 5 — Descargar el APK

**Opción A (la más fácil):**
1. Vuelve a la página principal del repositorio (toca `nuby` arriba).
2. Busca **Releases** (en escritorio está a la derecha; en móvil, más abajo) → **Nuby APK de prueba #N**.
3. En **Assets** toca **Nuby-1.6.N.apk**. Chrome lo descargará.

**Opción B:** Actions → toca la compilación verde → abajo, en **Artifacts**, descarga
`Nuby-APK-N`. Llega como `.zip`: ábrelo con la app *Archivos* y toca el `.apk` de adentro.

## Paso 6 — Instalar en tu POCO F6

1. Toca la notificación de descarga (o abre *Archivos → Descargas*) y toca el `.apk`.
2. Si aparece “Por seguridad, tu teléfono no permite instalar apps de esta fuente”:
   **Ajustes → activa “Permitir de esta fuente”** para Chrome (o para *Archivos*) y vuelve atrás.
3. HyperOS puede hacer un análisis de seguridad o pedir esperar unos segundos: acepta **Instalar**.
4. Si Google Play Protect dice “App no reconocida/insegura”: toca **Más detalles → Instalar de todos modos**.
   Es normal en apps de prueba que no vienen de Play Store.
5. Abre **Nuby** ☁️.

## Paso 7 — Activar las notificaciones (¡importante!)

1. En Nuby abre la pestaña **⏰ Avisos** → **Activar** → **Permitir**.
2. Si aparece la fila “Para que los avisos lleguen a la hora exacta…”, toca **Permitir**,
   activa **Nuby** en “Alarmas y recordatorios” y vuelve atrás.
3. Ajustes de Android para POCO/Xiaomi (si no los haces, HyperOS puede retrasar o bloquear avisos):
   - Ajustes → Aplicaciones → Administrar apps → **Nuby** → **Ahorro de batería → Sin restricciones**.
   - En la misma pantalla: **Inicio automático → activado**.
   - **Notificaciones** → activa todo (pantalla de bloqueo, emergentes/flotantes, sonido).
   - En la vista de apps recientes, mantén pulsada Nuby → toca el **candado** 🔒.
4. Prueba: pestaña **⚙️ Ajustes → “Probar aviso en 1 min”**, cierra Nuby y espera.

## Paso 8 (opcional) — Versión web

1. Repositorio → **Settings → Pages** → en *Source* elige **GitHub Actions**.
2. Actions → Compilar APK de Nuby → **Run workflow**.
3. Tu web quedará en `https://TU-USUARIO.github.io/nuby/`
   (en la web, los avisos solo funcionan con la página abierta).

## Actualizar Nuby más adelante

1. **Add file → Upload files** → sube el ZIP nuevo **con el mismo nombre** `nuby-proyecto.zip`
   (reemplaza al anterior) → *Commit changes*.
2. Se compila solo. Descarga el APK nuevo e instálalo **encima** del anterior:
   tus recordatorios se conservan (todas las versiones usan la misma firma).

## Actualizar el robot de compilación (recomendado desde la versión 1.6)

El archivo `.github/workflows/build-apk.yml` de tu repositorio **no se actualiza solo** al subir un ZIP
nuevo. La versión 1.6 funciona igual con el archivo antiguo, pero el nuevo añade:
la descarga de la biblioteca médica como paso propio, la **actualización automática el día 1 de cada
mes** y un resumen de la biblioteca en las notas de cada versión.

Para actualizarlo: en GitHub abre `.github/workflows/build-apk.yml` → icono del **lápiz** (editar) →
selecciona todo y borra → pega el contenido nuevo de `build-apk.yml` → **Commit changes**.

## Problemas comunes

| Problema | Solución |
|---|---|
| No aparece la pestaña Actions | Settings → Actions → General → “Allow all actions” → Save |
| Error “No encuentro package.json ni un archivo .zip” | No subiste el ZIP o lo descomprimiste mal. Repite el Paso 2 |
| “Paquete no válido / conflicto” al instalar | Desinstala una versión vieja de Nuby (la 1.1 compilada en otro lado) y vuelve a instalar |
| No llegan los avisos con la app cerrada | Revisa el Paso 7.3 (batería sin restricciones + inicio automático) |
| Los avisos llegan tarde | Activa “Alarmas y recordatorios” (Paso 7.2) |
| Se borraron mis datos | Pasa al desinstalar o al “borrar datos”. Usa Ajustes → Copiar respaldo antes |
