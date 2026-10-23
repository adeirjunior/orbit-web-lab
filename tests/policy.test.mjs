import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigin, createRateLimiter, validateSubscription } from '../server/policy.mjs';

const key = Buffer.alloc(65); key[0] = 4;
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/example',
  keys: { p256dh: key.toString('base64url'), auth: Buffer.alloc(16).toString('base64url') }
};

test('aceita assinaturas dos serviços conhecidos e valida tamanho das chaves', () => {
  assert.equal(validateSubscription(subscription), true);
  assert.equal(validateSubscription({ ...subscription, endpoint: 'https://web.push.apple.com/token' }), true);
  assert.equal(validateSubscription({ ...subscription, keys: { ...subscription.keys, auth: 'invalid' } }), false);
});
test('recusa endpoints locais, IPs, portas e hosts arbitrários', () => {
  for (const endpoint of ['http://127.0.0.1:80', 'https://127.0.0.1', 'https://example.com/push', 'http://fcm.googleapis.com', 'https://fcm.googleapis.com:8443/', 'https://fcm.googleapis.com.attacker.com', 'https://user:password@fcm.googleapis.com']) {
    assert.equal(validateSubscription({ ...subscription, endpoint }), false, endpoint);
  }
});
test('origens precisam corresponder exatamente à lista permitida', () => {
  const allowed = new Set(['https://orbit.example']);
  assert.equal(allowedOrigin('https://orbit.example', allowed), true);
  assert.equal(allowedOrigin('https://orbit.example.attacker.com', allowed), false);
  assert.equal(allowedOrigin(undefined, allowed), false);
});
test('limita envios e libera novamente ao expirar a janela', () => {
  let time = 0;
  const allow = createRateLimiter({ max: 2, windowMs: 1000, now: () => time });
  assert.equal(allow('client-a'), true);
  assert.equal(allow('client-a'), true);
  assert.equal(allow('client-a'), false);
  assert.equal(allow('client-b'), true);
  time = 1001;
  assert.equal(allow('client-a'), true);
});
