import { base } from '$app/paths';

const apiBase = (import.meta.env.VITE_PUSH_API_URL || base).replace(/\/$/, '');

export async function workerReady(): Promise<ServiceWorkerRegistration> {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    throw new Error('Use HTTPS ou localhost para habilitar o service worker.');
  }
  if (import.meta.env.DEV) {
    throw new Error('PWA e notificações externas exigem o build: npm run build e npm start.');
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('O service worker ainda não está pronto. Recarregue a página e tente novamente.')), 10000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function permission(): Promise<void> {
  if (!('Notification' in window)) throw new Error('Este navegador não oferece notificações. No iPhone/iPad, instale o PWA e abra pela tela inicial.');
  if (!window.isSecureContext) throw new Error('Notificações exigem HTTPS ou localhost.');
  const result = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (result !== 'granted') throw new Error('Permissão de notificações não concedida. Você pode alterá-la nas configurações deste site.');
}

function decodeKey(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  const result = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let i = 0; i < decoded.length; i++) result[i] = decoded.charCodeAt(i);
  return result;
}

async function api(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/push/${path}`, { ...init, signal: AbortSignal.timeout(20000) });
  } catch {
    throw new Error('Servidor Web Push indisponível. Execute npm start ou configure VITE_PUSH_API_URL.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'O servidor não conseguiu enviar o Web Push.');
  return body;
}

export async function sendWebPush(): Promise<void> {
  // Peça permissão antes de qualquer await de rede: preserva o gesto do usuário.
  await permission();
  if (!('PushManager' in window)) throw new Error('Web Push não é suportado neste navegador.');
  const registration = await workerReady();
  const { publicKey } = await api('public-key');
  if (typeof publicKey !== 'string') throw new Error('O servidor não informou uma chave VAPID válida.');
  const subscription = (await registration.pushManager.getSubscription()) || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeKey(publicKey)
  });
  await api('test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() })
  });
}

export async function showSystemNotification(): Promise<void> {
  await permission();
  const registration = await workerReady();
  await registration.showNotification('Olá, do Orbit! 🪐', {
    body: 'Esta é uma notificação local do sistema, exibida pelo service worker.',
    icon: `${base}/icons/icon-192.png`,
    badge: `${base}/icons/icon-192.png`,
    tag: `orbit-local-${Date.now()}`,
    data: { url: `${base}/` }
  });
}
