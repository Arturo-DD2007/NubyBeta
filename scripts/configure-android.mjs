// Nuby – ajusta el proyecto Android generado por "npx cap add android".
// Se ejecuta automáticamente en GitHub Actions. No necesitas Android Studio.
//  1. Copia iconos de la app y el icono de notificación.
//  2. Añade permisos de notificaciones, alarmas exactas y reinicio.
//  3. Evita que la interfaz quede debajo de la barra de estado (Android 15/16).
//  4. Usa una llave de firma fija para poder actualizar el APK sin desinstalar.
//  5. Pone número de versión automático.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = path.join(root, 'android', 'app');
const main = path.join(app, 'src', 'main');
let warnings = 0;
const warn = m => { warnings++; console.warn('⚠️  ' + m); };
const ok = m => console.log('✅ ' + m);

if (!fs.existsSync(main)) {
  console.error('❌ No existe android/app/src/main. Ejecuta antes: npx cap add android');
  process.exit(1);
}

// 0) Biblioteca médica: si el workflow no la construyó antes (workflow antiguo), se construye aquí,
//    antes de "npx cap sync", para que entre en el APK.
if (process.env.NUBY_KB_DONE !== '1') {
  try { execFileSync(process.execPath, [path.join(root, 'scripts', 'build-kb.mjs')], { stdio: 'inherit' }); }
  catch (e) { warn('No se pudo construir la biblioteca médica: ' + e.message); }
}

// 1) Recursos
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
copyDir(path.join(root, 'android-config', 'res'), path.join(main, 'res'));
ok('Iconos y recursos copiados');

// 2) Permisos
const manifestPath = path.join(main, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
const perms = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.WAKE_LOCK',
  'android.permission.VIBRATE'
];
const missing = perms.filter(p => !manifest.includes('"' + p + '"'));
if (missing.length) {
  const lines = missing.map(p => `    <uses-permission android:name="${p}" />`).join('\n') + '\n';
  if (manifest.includes('</manifest>')) {
    manifest = manifest.replace('</manifest>', lines + '</manifest>');
    fs.writeFileSync(manifestPath, manifest);
  } else warn('No se encontró </manifest>');
}
ok('Permisos: ' + perms.map(p => p.split('.').pop()).join(', '));

// 3) Barra de estado: desactiva el modo "edge-to-edge" forzado (targetSdk 35)
const stylesPath = path.join(main, 'res', 'values', 'styles.xml');
if (fs.existsSync(stylesPath)) {
  let styles = fs.readFileSync(stylesPath, 'utf8');
  if (!styles.includes('windowOptOutEdgeToEdgeEnforcement')) {
    if (!styles.includes('xmlns:tools')) styles = styles.replace('<resources>', '<resources xmlns:tools="http://schemas.android.com/tools">');
    const item = '\n        <item name="android:windowOptOutEdgeToEdgeEnforcement" tools:targetApi="35">true</item>';
    let n = 0;
    styles = styles.replace(/(<style name="AppTheme\.NoActionBar(?:Launch)?"[^>]*>)/g, m => { n++; return m + item; });
    if (n) { fs.writeFileSync(stylesPath, styles); ok('Estilos ajustados para Android 15/16 (' + n + ')'); }
    else warn('No se encontró el estilo AppTheme.NoActionBar; se omite el ajuste de barra de estado');
  }
} else warn('No existe styles.xml');

// 4) y 5) build.gradle: firma fija + versión
const gradlePath = path.join(app, 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
const run = parseInt(process.env.RUN_NUMBER || '1', 10) || 1;
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode ' + run);
gradle = gradle.replace(/versionName\s+"[^"]*"/, 'versionName "1.6.' + run + '"');
if (!gradle.includes('nuby-debug.keystore')) {
  const signing = `
    signingConfigs {
        debug {
            storeFile file("\${rootDir}/../android-config/nuby-debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }
`;
  if (/android\s*\{/.test(gradle)) gradle = gradle.replace(/android\s*\{/, m => m + '\n' + signing);
  else warn('No se encontró el bloque android { } en build.gradle');
}
fs.writeFileSync(gradlePath, gradle);
ok('Versión 1.6.' + run + ' (versionCode ' + run + ') y firma fija configuradas');

console.log(warnings ? `Terminado con ${warnings} advertencia(s).` : 'Proyecto Android listo.');
