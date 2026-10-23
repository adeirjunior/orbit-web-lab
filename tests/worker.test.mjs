import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes, webcrypto } from 'node:crypto';
import ece from 'http_ece';
import webpush from 'web-push';
import { handleRequest, validSubscription } from '../cloudflare/worker.ts';

const keys = webpush.generateVAPIDKeys();
const receiver = createECDH('prime256v1');
receiver.generateKeys();
const auth = randomBytes(16).toString('base64url');
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/orbit-protocol-test',
  expirationTime: null,
  keys: { p256dh: receiver.getPublicKey().toString('base64url'), auth }
};

function environment(extra = {}) {
  return {
    ASSETS: { fetch: async () => new Response('site estático') },
    PUSH_RATE_LIMITER: { limit: async () => ({ success: true }) },
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: 'https://github.com/adeirjunior/orbit-web-lab',
    ...extra
  };
}

function request(body = { subscription }, extra = {}) {
  const { headers = {}, ...options } = extra;
  return new Request('https://orbit.example/api/push/test', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...options,
    headers: { origin: 'https://orbit.example', 'content-type': 'application/json', 'CF-Connecting-IP': '192.0.2.10', ...headers }
  });
}

test('Worker serve o frontend e expõe saúde sem revelar chaves', async () => {
  const env = environment();
  assert.equal(await (await handleRequest(new Request('https://orbit.example/'), env)).text(), 'site estático');
  const healthy = await handleRequest(new Request('https://orbit.example/healthz'), env);
  assert.deepEqual(await healthy.json(), { ok: true, runtime: 'cloudflare-workers', pushConfigured: true });
  const missing = await handleRequest(new Request('https://orbit.example/healthz'), environment({ VAPID_PRIVATE_KEY: undefined }));
  assert.equal((await missing.json()).pushConfigured, false);
});

test('endpoint público retorna somente a chave pública e não permite cache', async () => {
  const response = await handleRequest(new Request('https://orbit.example/api/push/public-key'), environment());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { publicKey: keys.publicKey });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const missing = await handleRequest(new Request('https://orbit.example/api/push/public-key'), environment({ VAPID_PRIVATE_KEY: undefined }));
  assert.equal(missing.status, 503);
});

test('envio exige origem exata e o CORS permite apenas origens configuradas', async () => {
  for (const origin of ['https://attacker.example', 'https://orbit.example.attacker.example', 'null']) {
    assert.equal((await handleRequest(request(undefined, { headers: { origin } }), environment())).status, 403);
  }
  const absent = request(); absent.headers.delete('origin');
  assert.equal((await handleRequest(absent, environment())).status, 403);
  const preflight = new Request('https://orbit.example/api/push/test', { method: 'OPTIONS', headers: { origin: 'https://adeirjunior.github.io' } });
  const permitted = await handleRequest(preflight, environment({ ALLOWED_ORIGINS: 'https://adeirjunior.github.io' }));
  assert.equal(permitted.status, 204);
  assert.equal(permitted.headers.get('access-control-allow-origin'), 'https://adeirjunior.github.io');
});

test('recusa JSON inválido, corpo grande, tipos e métodos incorretos', async () => {
  assert.equal((await handleRequest(request('{'), environment())).status, 400);
  assert.equal((await handleRequest(request('x'.repeat(9000)), environment())).status, 413);
  assert.equal((await handleRequest(request(undefined, { headers: { 'content-type': 'text/plain' } }), environment())).status, 415);
  assert.equal((await handleRequest(new Request('https://orbit.example/api/push/test'), environment())).status, 405);
  assert.equal((await handleRequest(new Request('https://orbit.example/api/missing'), environment())).status, 404);
});

test('valida assinaturas e impede encaminhamento para hosts arbitrários', async () => {
  assert.equal(validSubscription(subscription), true);
  for (const endpoint of ['https://127.0.0.1/push', 'https://example.com/push', 'http://fcm.googleapis.com/push', 'https://fcm.googleapis.com:8443/push', 'https://fcm.googleapis.com.attacker.example', 'https://user:pass@fcm.googleapis.com/push']) {
    const invalid = { ...subscription, endpoint };
    assert.equal(validSubscription(invalid), false);
    assert.equal((await handleRequest(request({ subscription: invalid }), environment())).status, 400);
  }
  assert.equal(validSubscription({ ...subscription, keys: { ...subscription.keys, auth: 'invalid' } }), false);
});

test('criptografa uma mensagem AES128GCM real e assina o JWT VAPID corretamente', async () => {
  let captured;
  const response = await handleRequest(request(), environment(), async (url, init) => {
    captured = { url, ...init };
    return new Response(null, { status: 201 });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(captured.url, subscription.endpoint);
  assert.equal(captured.redirect, 'manual');
  assert.equal(captured.headers['content-encoding'], 'aes128gcm');
  assert.equal(captured.body.length, 4096);
  const plaintext = ece.decrypt(Buffer.from(captured.body), { version: 'aes128gcm', privateKey: receiver, authSecret: auth });
  const data = JSON.parse(plaintext.toString());
  assert.equal(data.title, 'Olá, do Orbit! 🪐');
  assert.match(data.body, /Cloudflare Worker/);
  const [, jwt, vapidKey] = /^vapid t=(.+), k=(.+)$/.exec(captured.headers.authorization);
  assert.equal(vapidKey, keys.publicKey);
  const [header, payload, signature] = jwt.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, environment().VAPID_SUBJECT);
  assert.ok(claims.exp > Date.now() / 1000);
  const publicKey = await webcrypto.subtle.importKey('raw', Buffer.from(keys.publicKey, 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.equal(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, Buffer.from(signature, 'base64url'), Buffer.from(`${header}.${payload}`)), true);
});

test('limite nativo da Cloudflare impede envio e indica quando tentar novamente', async () => {
  let received;
  const response = await handleRequest(request(), environment({ PUSH_RATE_LIMITER: { limit: async (value) => { received = value; return { success: false }; } } }), () => { throw new Error('Não deveria enviar'); });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(received.key, 'push:192.0.2.10');
});

test('assinaturas expiradas e falhas do provedor têm respostas distintas', async () => {
  for (const upstream of [302, 307, 404, 410, 500]) {
    const response = await handleRequest(request(), environment(), async () => new Response(null, { status: upstream }));
    assert.equal(response.status, [404, 410].includes(upstream) ? 410 : 502);
  }
  const network = await handleRequest(request(), environment(), async () => { throw new Error('offline'); });
  assert.equal(network.status, 502);
});
