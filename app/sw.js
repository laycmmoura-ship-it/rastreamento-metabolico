// Cache simples para o app abrir rápido e funcionar sem internet (só a interface).
const CACHE = 'lay-ia-v31';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './config.js', './nutricao.js', './dados/taco.json', './dados/medidas.json', './dados/complementar.json', './dados/ibge.json', './marca/simbolo.png', './marca/logo-horizontal.jpg', './fontes/fontes.css', './fontes/GreatVibes-400.woff2', './fontes/Poppins-300.woff2', './fontes/Poppins-400.woff2', './fontes/Poppins-500.woff2', './fontes/Poppins-600.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request))
  );
});
