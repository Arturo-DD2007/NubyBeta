/* Nuby – service worker (solo versión web).
 * Estrategia: red primero y caché como respaldo, para que las actualizaciones
 * se vean de inmediato y la app siga funcionando sin conexión. */
const CACHE = 'nuby-v1-6-0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/store.js', './js/mascot.js', './js/health.js', './js/kb.js', './js/library.js', './js/reminders.js', './js/notify.js', './js/ai.js', './js/chat.js', './js/app.js',
  './kb/manifest.json', './kb/sinonimos.json', './kb/guia-nuby.json',
  './img/icon-192.png', './img/icon-512.png',
  './assets/nuby/principal.png', './assets/nuby/feliz.png', './assets/nuby/emocionado.png', './assets/nuby/pensando.png', './assets/nuby/sorprendido.png', './assets/nuby/triste.png', './assets/nuby/preocupado.png', './assets/nuby/enfermizo.png', './assets/nuby/saludable.png', './assets/nuby/medico.png', './assets/nuby/durmiendo.png', './assets/nuby/saludando.png', './assets/nuby/recordatorio.png', './assets/nuby/confirmando.png', './assets/nuby/confundido.png', './assets/nuby/parpadeo/principal.png', './assets/nuby/parpadeo/sorprendido.png', './assets/nuby/parpadeo/pensando.png', './assets/nuby/parpadeo/preocupado.png', './assets/nuby/parpadeo/medico.png', './assets/nuby/parpadeo/triste.png', './assets/nuby/parpadeo/saludable.png', './assets/nuby/parpadeo/saludando.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});

// Al tocar una notificación web, enfoca o abre Nuby
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow ? self.clients.openWindow('./') : undefined;
  }));
});
