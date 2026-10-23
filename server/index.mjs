import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
import { allowedOrigin, createRateLimiter, validateSubscription } from './policy.mjs';

// Node 22+ carrega .env sem dependência adicional. Variáveis do processo prevalecem.
try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = resolve(root, 'build');
const port = Number(process.env.PORT || 3001);
const configuredOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim()).filter(Boolean);
const allowed = new Set([...configuredOrigins, `http://localhost:${port}`, `http://127.0.0.1:${port}`]);
const limit = createRateLimiter();

let keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
if (!keys.publicKey || !keys.privateKey) {
  try { keys = JSON.parse(await readFile(resolve(root, '.push-keys.json'), 'utf8')); } catch { keys = {}; }
}
const pushConfigured = Boolean(keys.publicKey && keys.privateKey);
if (pushConfigured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', keys.publicKey, keys.privateKey);

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJSON(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 8192) throw Object.assign(new Error('Pedido muito grande.'), { status: 413 });
  }
  try { return JSON.parse(body); } catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/healthz') return json(res, 200, { ok: true, pushConfigured });
    if (url.pathname.startsWith('/api/push/')) {
      const origin = req.headers.origin;
      if (origin && !allowedOrigin(origin, allowed)) return json(res, 403, { error: 'Origem não autorizada. Configure ALLOWED_ORIGINS com a URL exata do site.' });
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
        return res.end();
      }
      if (!pushConfigured) return json(res, 503, { error: 'Web Push não configurado. Execute npm run push:keys e reinicie o servidor.' });
      if (url.pathname === '/api/push/public-key' && req.method === 'GET') return json(res, 200, { publicKey: keys.publicKey });
      if (url.pathname !== '/api/push/test' || req.method !== 'POST') return json(res, 404, { error: 'Endpoint não encontrado.' });
      if (!allowedOrigin(origin, allowed)) return json(res, 403, { error: 'Origin obrigatório para enviar notificações.' });
      if (!(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'Use application/json.' });
      // Não confie em X-Forwarded-For de clientes. Atrás de proxy, este limite é conservador e compartilhado.
      if (!limit(req.socket.remoteAddress || 'unknown')) return json(res, 429, { error: 'Limite de testes atingido. Aguarde um minuto.' });
      const { subscription } = await readJSON(req);
      if (!validateSubscription(subscription)) return json(res, 400, { error: 'Assinatura inválida ou serviço de push não reconhecido.' });
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title: 'Olá, do Orbit! 🪐', body: 'Web Push real: esta mensagem veio do servidor e chegou pelo serviço de push do navegador.' }), { TTL: 60, urgency: 'high', timeout: 10000 });
        return json(res, 200, { accepted: true });
      } catch (error) {
        const expired = error.statusCode === 404 || error.statusCode === 410;
        return json(res, expired ? 410 : 502, { error: expired ? 'Assinatura expirada. Remova a permissão deste site e assine novamente.' : 'O serviço de push recusou a mensagem. Confira a conexão, as chaves VAPID e a assinatura.' });
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Método não permitido.' });
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'Caminho inválido.' }); }
    if (pathname.includes('\0')) return json(res, 400, { error: 'Caminho inválido.' });
    let file = resolve(buildDir, `.${pathname}`);
    if (file !== buildDir && !file.startsWith(buildDir + sep)) return json(res, 403, { error: 'Caminho não permitido.' });
    let info;
    try {
      info = await stat(file);
      if (info.isDirectory()) { file = resolve(file, 'index.html'); info = await stat(file); }
      if (!info.isFile()) throw new Error('Not a file');
    } catch { return json(res, 404, { error: 'Página não encontrada. Execute npm run build antes de iniciar o servidor.' }); }
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.setHeader('Content-Length', info.size);
    const immutable = pathname.startsWith('/_app/immutable/');
    res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (pathname === '/service-worker.js') res.setHeader('Service-Worker-Allowed', '/');
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch (error) {
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Erro interno do servidor.' });
    else res.destroy();
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Orbit em http://localhost:${port}`);
  console.log(`Web Push: ${pushConfigured ? 'configurado' : 'execute npm run push:keys e reinicie'}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
