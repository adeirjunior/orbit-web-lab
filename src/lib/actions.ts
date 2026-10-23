import type { IconName } from './Icon.svelte';

export type ActionId = 'internal' | 'push' | 'both' | 'system' | 'theme' | 'install' | 'offline' | 'fullscreen';

export const actions: { id: ActionId; icon: IconName; label: string; title: string; description: string }[] = [
  { id: 'internal', icon: 'toast', label: 'Notificação interna', title: 'Notificação interna', description: 'Veja uma mensagem dentro do app.' },
  { id: 'push', icon: 'bell', label: 'Notificação externa · Web Push', title: 'Web Push', description: 'Teste uma mensagem enviada pelo servidor.' },
  { id: 'both', icon: 'layers', label: 'Notificação interna + externa', title: 'Interna + externa', description: 'Combine os dois tipos de notificação.' },
  { id: 'system', icon: 'monitor', label: 'Notificação local do sistema', title: 'Notificação do sistema', description: 'Veja uma notificação nativa do dispositivo.' },
  { id: 'theme', icon: 'sun', label: 'Alternar tema', title: 'Alternar tema', description: 'Experimente os temas claro e escuro.' },
  { id: 'install', icon: 'download', label: 'Instalar aplicativo', title: 'Instalar aplicativo', description: 'Adicione o Orbit à sua tela inicial.' },
  { id: 'offline', icon: 'wifi', label: 'Testar modo offline', title: 'Modo offline', description: 'Confira o funcionamento sem internet.' },
  { id: 'fullscreen', icon: 'expand', label: 'Alternar tela cheia', title: 'Tela cheia', description: 'Use todo o espaço do seu navegador.' }
];
