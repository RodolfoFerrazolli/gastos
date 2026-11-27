// =====================================================================
//  SERVICE WORKER — permite abrir o app sem internet.
//  Ao publicar uma versão nova dos arquivos, aumente o número abaixo.
// =====================================================================
const VERSAO = 'gastos-v13';
// V12: o envio dos pedidos de melhoria continua aqui, mesmo com o app fechado (quando a internet voltar)
try { importScripts('./config.js', './pedidos-fundo.js'); } catch (e) { /* sem o envio em segundo plano */ }
const ARQUIVOS = [
  './',
  './index.html',
  './estilo.css',
  './config.js',
  './trava.js',
  './banco.js',
  './api.js',
  './gravador.js',
  './fotos.js',
  './qr.js',
  './qr-worker.js',
  './vendor/jsQR.js',
  './camera.js',
  './visor.js',
  './recorte.js',
  './sincronizacao.js',
  './veiculos.js',
  './grupos.js',
  './relatorio.js',
  './pneus.js',
  './lugares.js',
  './vendor/leaflet.js',
  './vendor/leaflet.css',
  './exportar.js',
  './melhorias.js',
  './pedidos-fundo.js',
  './vendor/html2canvas.min.js',
  './app.js',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' busca direto da internet (sem cópias velhas guardadas pelo navegador)
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // V8: apaga só as versões antigas deste app (o app do administrador tem o cache dele, 'admin-...')
      .then(chaves => Promise.all(chaves.filter(k => k !== VERSAO && k.indexOf('gastos-') === 0).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('sync', (e) => {
  if (typeof PedidosFundo === 'undefined' || e.tag !== PedidosFundo.ETIQUETA) return;
  e.waitUntil(PedidosFundo.enviarTodos().then(async (r) => {
    if (r.enviados) {
      for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage({ tipo: 'pedidosEnviados', enviados: r.enviados });
    }
    if (r.semRede) throw new Error('sem internet: o Android tenta de novo mais tarde');
  }));
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
