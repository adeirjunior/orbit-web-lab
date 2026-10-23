import { isIP } from 'node:net';

const PUSH_HOSTS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']);

export function validateSubscription(value) {
  if (!value || typeof value !== 'object' || typeof value.endpoint !== 'string' || value.endpoint.length > 4096) return false;
  let url;
  try { url = new URL(value.endpoint); } catch { return false; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || isIP(host)) return false;
  if (!PUSH_HOSTS.has(host) && !host.endsWith('.notify.windows.com')) return false;
  const { p256dh, auth } = value.keys || {};
  if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{87}=?$/.test(p256dh)) return false;
  if (typeof auth !== 'string' || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(auth)) return false;
  const publicKey = Buffer.from(p256dh, 'base64url');
  return publicKey.length === 65 && publicKey[0] === 4 && Buffer.from(auth, 'base64url').length === 16;
}

export function createRateLimiter({ max = 10, windowMs = 60000, capacity = 10000, now = Date.now } = {}) {
  const clients = new Map();
  return (key) => {
    const time = now();
    for (const [client, value] of clients) if (time - value.start >= windowMs) clients.delete(client);
    let entry = clients.get(key);
    if (!entry) {
      if (clients.size >= capacity) return false;
      entry = { start: time, count: 0 };
      clients.set(key, entry);
    }
    entry.count++;
    return entry.count <= max;
  };
}

export function allowedOrigin(origin, allowed) {
  return typeof origin === 'string' && allowed.has(origin);
}
