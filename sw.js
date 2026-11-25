// Offline cache for the London System Trainer.
// Pages are loaded from the network first, so updates arrive on the next open without changing VERSION.
// The saved copy is used only when the network is unavailable or too slow.
// Bump VERSION only when the list of FILES changes.
const VERSION = 'v8';
const CACHE = 'london-trainer-' + VERSION;
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('london-trainer-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first for the app itself (page loads, index.html, manifest): fresh copy when online, saved copy offline.
// Each fresh copy replaces the saved one, so the offline version is always the last one you opened.
function networkFirst(request, cacheKey) {
  const fromNetwork = fetch(request, { cache: 'no-cache' }).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(cacheKey, copy));
    }
    return res;
  });
  const fromCache = () => caches.match(cacheKey, { ignoreSearch: true });
  const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  return Promise.race([fromNetwork.catch(() => null), timeout]).then(res =>
    res || fromCache().then(hit => hit || fromNetwork)
  ).catch(() => fromCache().then(hit => hit || Response.error()));
}

// Threads for the analysis engine need a "cross-origin isolated" page. GitHub Pages cannot send the
// headers for that, so when the app asks for more than 1 thread, this worker adds them to every response.
// The choice is kept in a small cache of its own, so it survives restarts.
const FLAGS = 'lt-flags';
let coi = null;
const coiOn = () => coi !== null ? Promise.resolve(coi)
  : caches.open(FLAGS).then(c => c.match('./__coi')).then(r => (coi = !!r));
self.addEventListener('message', e => {
  if (!e.data || typeof e.data.coi !== 'boolean') return;
  coi = e.data.coi;
  e.waitUntil(caches.open(FLAGS)
    .then(c => coi ? c.put('./__coi', new Response('1')) : c.delete('./__coi'))
    .then(() => e.source && e.source.postMessage({ coiSaved: true })));
});
function isolate(res) {
  if (!res || res.status === 0 || res.type === 'opaque') return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname.replace(/\/+$/, '/');
  const scope = new URL(self.registration.scope).pathname;
  const isPage = e.request.mode === 'navigate' || path === scope || path === scope + 'index.html';
  let res;
  if (isPage) res = networkFirst(e.request, './index.html');
  else if (path === scope + 'manifest.webmanifest') res = networkFirst(e.request, './manifest.webmanifest');
  // The Stockfish engine downloads the first time it is needed, then is kept for offline use.
  else if (path.startsWith(scope + 'engine/')) res = caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }));
  // Icons and other static files rarely change: saved copy first, network as fallback.
  else res = caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request));
  e.respondWith(Promise.all([res, coiOn()]).then(([r, on]) => on ? isolate(r) : r));
});
