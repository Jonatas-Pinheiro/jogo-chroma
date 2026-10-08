/* Aumente apenas este número ao publicar uma nova versão para renovar os caches. */
const CACHE_VERSION = 4;
const PREFIX = 'chroma-v';
const CORE_CACHE = `${PREFIX}${CACHE_VERSION}-essential`;
const DYNAMIC_CACHE = `${PREFIX}${CACHE_VERSION}-dynamic`;
const INDEX_URL = new URL('./index.html', self.registration.scope).href;
const ESSENTIAL = [
  './index.html', './style.css', './manifest.webmanifest', './lucide.min.js',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './MOEDA-E-RECOMPENSAS.png', './RANQUEADO-OU-PLACAR.png', './PASSE-DE-BATALHA.png', './SOCIAL.png'
];
const ESSENTIAL_URLS = new Set(ESSENTIAL.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  // Não usamos skipWaiting aqui: a pessoa escolhe quando atualizar no aviso do jogo.
  event.waitUntil(caches.open(CORE_CACHE).then(cache => cache.addAll(ESSENTIAL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CORE_CACHE && name !== DYNAMIC_CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function notificationPayload(data) {
  const d = data && typeof data === 'object' ? data : {};
  const type = String(d.type || 'general');
  const defaults = {
    reward: { title: 'CHROMA · Recompensa disponível', body: 'Você tem uma recompensa pronta para coletar.', route: 'rewards', icon: './MOEDA-E-RECOMPENSAS.png' },
    ranking: { title: 'CHROMA · Você foi ultrapassado', body: 'Confira sua nova posição no ranking.', route: 'ranking', icon: './RANQUEADO-OU-PLACAR.png' },
    season: { title: 'CHROMA · Nova temporada', body: 'Uma nova temporada está disponível.', route: 'battlePass', icon: './PASSE-DE-BATALHA.png' },
    gift: { title: 'CHROMA · Presente recebido', body: 'Você recebeu um presente de um amigo.', route: 'mail', icon: './SOCIAL.png' },
    general: { title: 'CHROMA', body: 'Você tem uma novidade no jogo.', route: 'home', icon: './icon-192.png' }
  };
  const base = defaults[type] || defaults.general;
  return { title: String(d.title || base.title), body: String(d.body || base.body), route: String(d.route || base.route), tag: String(d.tag || `chroma-${type}`), icon: String(d.icon || base.icon || './icon-192.png'), type };
}
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data?.text?.() || '' }; }
  const n = notificationPayload(data);
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const inUse = clients.some(client => client.visibilityState === 'visible' && client.focused);
    if (inUse) return; // O CHROMA está aberto e em uso: nenhum PUSH.
    return self.registration.showNotification(n.title, {
      body: n.body, icon: n.icon, badge: './icon-192.png', tag: n.tag, renotify: false,
      data: { route: n.route, type: n.type }
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const route = event.notification.data?.route || 'home';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) { await client.focus(); client.postMessage({ type: 'CHROMA_NOTIFICATION_CLICK', route }); return; }
    }
    if (self.clients.openWindow) return self.clients.openWindow(`./?notification=${encodeURIComponent(route)}`);
  })());
});

// Autenticação, banco de dados e sinalização P2P SEMPRE passam direto à rede.
function mustBypass(url) {
  const host = url.hostname.toLowerCase();
  return url.pathname.toLowerCase().includes('/__/auth/') ||
    host === 'firestore.googleapis.com' || host === 'identitytoolkit.googleapis.com' ||
    host === 'securetoken.googleapis.com' || host === 'apis.google.com' ||
    host === 'www.googleapis.com' || host === '0.peerjs.com' ||
    host.endsWith('.peerjs.com') || url.pathname.startsWith('/peerjs/');
}

// Não cacheie URLs arbitrárias: somente mídia local e dependências versionadas conhecidas.
function mayCacheDynamic(url) {
  const host = url.hostname.toLowerCase();
  if (url.origin === self.location.origin) {
    return /\.(?:png|jpe?g|webp|avif|gif|svg|ico|mp3|m4a|ogg|wav|flac|woff2?|ttf|otf)$/i.test(url.pathname);
  }
  if (host === 'fonts.googleapis.com') return /^\/css2?(?:$|\?)/.test(url.pathname + url.search);
  if (host === 'fonts.gstatic.com') return /\.(?:woff2?|ttf|otf)$/i.test(url.pathname);
  if (host === 'www.gstatic.com') return url.pathname.startsWith('/firebasejs/10.12.5/') && /\.js$/.test(url.pathname);
  if (host === 'cdn.jsdelivr.net') return /^\/npm\/(?:lucide@1\.48\.0|peerjs@1\.5\.4)\/dist\/.*\.js$/i.test(url.pathname);
  if (host === 'unpkg.com') return /^\/(?:lucide@1\.48\.0|peerjs@1\.5\.4)\/dist\/.*\.js$/i.test(url.pathname);
  return false;
}

function offlineReply(request) {
  // Um script offline vira comentário válido, e as outras ausências recebem resposta simples.
  const script = request.destination === 'script';
  return new Response(script ? '/* Recurso indisponível sem internet. */' : 'Recurso indisponível sem internet.', {
    status: 503,
    headers: { 'Content-Type': script ? 'application/javascript; charset=utf-8' : 'text/plain; charset=utf-8' }
  });
}

async function networkFirst(event) {
  const cache = await caches.open(CORE_CACHE);
  try {
    const response = await fetch(event.request);
    if (response.ok && response.type !== 'opaque' && new URL(response.url).origin === self.location.origin) {
      event.waitUntil(cache.put(INDEX_URL, response.clone()).catch(error =>
        console.warn('[CHROMA SW] Não consegui atualizar o HTML offline:', error)));
    }
    return response;
  } catch (error) {
    console.warn('[CHROMA SW] Sem rede para abrir a página:', error);
    return (await cache.match(INDEX_URL)) || offlineReply(event.request);
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(event.request);
  const fresh = fetch(event.request).then(async response => {
    if (response.ok || response.type === 'opaque') {
      try { await cache.put(event.request, response.clone()); }
      catch (error) { console.warn('[CHROMA SW] Não consegui armazenar o recurso:', error); }
    }
    return response;
  }).catch(error => {
    console.warn('[CHROMA SW] Recurso indisponível na rede:', event.request.url, error);
    return null;
  });
  if (saved) { event.waitUntil(fresh); return saved; }
  return (await fresh) || offlineReply(event.request);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return; // POST/PUT/DELETE etc. jamais passam pelo cache.
  const url = new URL(request.url);
  if (mustBypass(url)) return; // O navegador faz o fetch normalmente, sem interceptação.
  if (url.origin === self.location.origin && (request.mode === 'navigate' || url.href === INDEX_URL)) {
    event.respondWith(networkFirst(event));
  } else if (ESSENTIAL_URLS.has(url.href)) {
    event.respondWith(staleWhileRevalidate(event, CORE_CACHE));
  } else if (mayCacheDynamic(url)) {
    event.respondWith(staleWhileRevalidate(event, DYNAMIC_CACHE));
  }
  // Todo o resto, inclusive APIs online e servidores PeerJS próprios, segue sem interceptação.
});
