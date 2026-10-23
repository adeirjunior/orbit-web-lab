/// <reference lib="webworker" />
import { base, build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE_PREFIX = `orbit-${encodeURIComponent(base)}-`;
const CACHE = `${CACHE_PREFIX}${version}`;
const HOME = `${base}/`;
const ASSETS = [...new Set([...build, ...files, HOME])];
const ASSET_PATHS = new Set(ASSETS);

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
    await sw.clients.claim();
  })());
});

sw.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== sw.location.origin || url.pathname.startsWith(`${base}/api/`)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return (await caches.open(CACHE)).match(HOME) as Promise<Response>;
      }
    })());
  } else if (ASSET_PATHS.has(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(url.pathname)) || fetch(request);
    })());
  }
});

sw.addEventListener('push', (event) => {
  let payload: { title?: string; body?: string } = {};
  try { payload = event.data?.json() || {}; } catch { /* use safe defaults */ }
  event.waitUntil(sw.registration.showNotification(payload.title || 'Orbit — Web Push', {
    body: payload.body || 'Uma mensagem chegou do servidor, mesmo fora da página.',
    icon: `${base}/icons/icon-192.png`,
    badge: `${base}/icons/icon-192.png`,
    tag: `orbit-push-${Date.now()}`,
    data: { url: HOME }
  }));
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === sw.location.origin && new URL(client.url).pathname.startsWith(HOME)) {
        await client.focus();
        return;
      }
    }
    await sw.clients.openWindow(HOME);
  })());
});
