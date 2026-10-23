import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push';

export interface Env {
  ASSETS: Fetcher;
  PUSH_RATE_LIMITER: RateLimit;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  ALLOWED_ORIGINS?: string;
}

const MAX_BODY_BYTES = 8192;
const PUSH_HOSTS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']);

function decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}

export function validSubscription(value: unknown): value is PushSubscription {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PushSubscription>;
  if (typeof candidate.endpoint !== 'string' || candidate.endpoint.length > 4096) return false;
  let url: URL;
  try { url = new URL(candidate.endpoint); } catch { return false; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
  if (!PUSH_HOSTS.has(host) && !host.endsWith('.notify.windows.com')) return false;
  const { auth, p256dh } = candidate.keys || {};
  if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{87}=?$/.test(p256dh)) return false;
  if (typeof auth !== 'string' || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(auth)) return false;
  try {
    const publicKey = decode(p256dh);
    return publicKey.length === 65 && publicKey[0] === 4 && decode(auth).length === 16;
  } catch { return false; }
}

function configured(env: Env): boolean {
  try {
    const subject = new URL(env.VAPID_SUBJECT || '');
    return ['https:', 'mailto:'].includes(subject.protocol)
      && decode(env.VAPID_PUBLIC_KEY || '').length === 65
      && decode(env.VAPID_PRIVATE_KEY || '').length === 32;
  } catch { return false; }
}

class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new RequestError('Pedido muito grande.', 413);
  if (!request.body) throw new RequestError('JSON obrigatório.', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new RequestError('Pedido muito grande.', 413); }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(body)); }
  catch { throw new RequestError('JSON inválido.', 400); }
}

export async function handleRequest(request: Request, env: Env, send: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== '/healthz' && !url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  const origin = request.headers.get('origin');
  const origins = new Set([url.origin, ...(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)]);
  const permitted = origin !== null && origins.has(origin);
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
  if (permitted) headers['Access-Control-Allow-Origin'] = origin;
  const json = (status: number, body: unknown, extra?: Record<string, string>) => Response.json(body, { status, headers: { ...headers, ...extra } });
  try {
    if (url.pathname === '/healthz') {
      if (!['GET', 'HEAD'].includes(request.method)) return json(405, { error: 'Método não permitido.' });
      if (request.method === 'HEAD') return new Response(null, { headers });
      return json(200, { ok: true, runtime: 'cloudflare-workers', pushConfigured: configured(env) });
    }
    if (origin && !permitted) return json(403, { error: 'Origem não autorizada.' });
    if (!['/api/push/public-key', '/api/push/test'].includes(url.pathname)) return json(404, { error: 'Endpoint não encontrado.' });
    if (request.method === 'OPTIONS') {
      if (!permitted) return json(403, { error: 'Origin obrigatório.' });
      return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }
    if (url.pathname === '/api/push/public-key') {
      if (request.method !== 'GET') return json(405, { error: 'Use GET.' }, { Allow: 'GET, OPTIONS' });
      if (!configured(env)) return json(503, { error: 'Web Push ainda não configurado neste ambiente.' });
      return json(200, { publicKey: env.VAPID_PUBLIC_KEY });
    }
    if (request.method !== 'POST') return json(405, { error: 'Use POST.' }, { Allow: 'POST, OPTIONS' });
    if (!permitted) return json(403, { error: 'Origin obrigatório para enviar notificações.' });
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return json(415, { error: 'Use application/json.' });
    if (!configured(env)) return json(503, { error: 'Web Push ainda não configurado neste ambiente.' });
    if (!env.PUSH_RATE_LIMITER) return json(503, { error: 'O limite de envio precisa ser configurado.' });
    // CF-Connecting-IP é preenchido pela Cloudflare; não use cabeçalhos de proxy fornecidos pelo cliente.
    const { success } = await env.PUSH_RATE_LIMITER.limit({ key: `push:${request.headers.get('CF-Connecting-IP') || 'local'}` });
    if (!success) return json(429, { error: 'Limite de testes atingido. Aguarde um minuto.' }, { 'Retry-After': '60' });
    const body = await readBody(request);
    const subscription = body && typeof body === 'object' ? (body as { subscription?: unknown }).subscription : undefined;
    if (!validSubscription(subscription)) return json(400, { error: 'Assinatura inválida ou serviço de push não reconhecido.' });
    let payload: Awaited<ReturnType<typeof buildPushPayload>>;
    try {
      payload = await buildPushPayload({
        data: { title: 'Olá, do Orbit! 🪐', body: 'Web Push real: esta mensagem veio do Cloudflare Worker que também hospeda o site.' },
        options: { ttl: 60, urgency: 'high' }
      }, { ...subscription, expirationTime: subscription.expirationTime ?? null }, {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY
      });
    } catch {
      return json(400, { error: 'Não foi possível usar esta assinatura. Revogue a permissão e tente novamente.' });
    }
    try {
      // Workers não aceita redirect: 'error'. Não siga redirecionamentos para
      // impedir que um serviço repasse a mensagem para um host não autorizado.
      const response = await send(subscription.endpoint, { ...payload, redirect: 'manual', signal: AbortSignal.timeout(10000) });
      await response.body?.cancel();
      if (response.status === 404 || response.status === 410) return json(410, { error: 'Assinatura expirada. Revogue a permissão e tente novamente.' });
      if (!response.ok) return json(502, { error: 'O serviço de push recusou a mensagem. Confira as permissões e as chaves VAPID.' });
      return json(200, { accepted: true });
    } catch (error) {
      // Não registre a assinatura, o endpoint ou as chaves do dispositivo.
      console.error('Falha no transporte Web Push.', error instanceof Error
        ? `${error.name}: ${error.message.replace(/https?:\/\/\S+/g, '[endpoint]')}`
        : 'UnknownError');
      return json(502, { error: 'Não foi possível alcançar o serviço de push. Tente novamente.' });
    }
  } catch (error) {
    if (error instanceof RequestError) return json(error.status, { error: error.message });
    console.error('Falha no endpoint Web Push do Orbit.');
    return json(500, { error: 'Erro interno ao processar o teste.' });
  }
}

export default {
  fetch(request: Request, env: Env) { return handleRequest(request, env); }
} satisfies ExportedHandler<Env>;
