// Service worker: só a casca do app fica em cache. Dados nunca.
// Estratégia: stale-while-revalidate para o que é nosso, passe livre para o resto.

const VERSAO = 'caderninho-v1';

const CASCA = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './icone.svg',
  './icone-192.png',
  './js/main.js',
  './js/ui.js',
  './js/store.js',
  './js/local.js',
  './js/util.js',
  './js/telas/hoje.js',
  './js/telas/pessoas.js',
  './js/telas/ficha.js',
  './js/telas/outras.js',
  './vendor/preact.module.js',
  './vendor/hooks.module.js',
  './vendor/htm.module.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSAO)
      .then((c) => c.addAll(CASCA))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;  // Supabase e afins: sempre rede

  // config.js nunca entra no cache. É o arquivo que diz com qual banco falar:
  // se um dia você trocar de projeto, uma cópia velha guardada aqui mandaria o
  // app para o lugar errado, e descobrir isso levaria horas.
  if (url.pathname.endsWith("/config.js")) return;

  e.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const guardado = await cache.match(req);
      const rede = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) cache.put(req, resp.clone());
          return resp;
        })
        .catch(() => guardado);
      return guardado || rede;
    })
  );
});
