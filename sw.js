// =====================================================================
//  SERVICE WORKER — permite abrir o app sem internet.
//  Ao publicar uma versão nova dos arquivos, aumente o número abaixo.
// =====================================================================
const VERSAO = 'gastos-v1.0.0';
const ARQUIVOS = [
  './',
  './index.html',
  './estilo.css',
  './config.js',
  './banco.js',
  './api.js',
  './gravador.js',
  './fotos.js',
  './sincronizacao.js',
  './app.js',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'atualizar') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // o servidor (Apps Script) nunca passa pelo cache

  // config.js: sempre tenta a versão da internet primeiro (para o endereço do servidor valer na hora)
  if (url.pathname.endsWith('/config.js')) {
    e.respondWith(
      fetch(req).then(resp => {
        const copia = resp.clone();
        caches.open(VERSAO).then(c => c.put(req, copia));
        return resp;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  // demais arquivos: primeiro do aparelho (funciona sem internet)
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).catch(() => {
      if (req.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});
